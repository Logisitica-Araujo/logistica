/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  04_API.gs   (para la PWA, v3.0)
 * ---------------------------------------------------------------------
 * Convierte el Apps Script en una API que la app instalada en el celular
 * consulta por internet. La versión web actual sigue funcionando igual.
 *
 * CAMBIOS DE LA 3.0:
 *  • El login devuelve también el arranque (estado + catálogos) y elegir
 *    vehículo devuelve el estado del menú. Del login al menú pasan de
 *    4 viajes al servidor a 2.
 *  • Cada consulta que tarda más de 8 s queda anotada en APP_Log como
 *    "LENTO", con la acción y los segundos. Así medimos sin adivinar.
 *
 * El Content-Type es texto plano a propósito: así el navegador no hace
 * la consulta previa de permisos (preflight), que Apps Script no sabe
 * contestar. Es el truco estándar para que una web externa pueda hablarle.
 ***********************************************************************/

/** Responde JSON. */
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Versión del código del servidor. Se ve abriendo  …/exec?api=ping  */
var VERSION_SERVIDOR = '3.0';

/* Consultas que tarden más que esto quedan anotadas en APP_Log. */
var API_LENTO_MS = 8000;


/** ===================== ENTRADA DE LA PWA ===================== */
function doPost(e) {
  let accion = '(sin acción)';
  const t0 = Date.now();
  try {
    const cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    accion = String(cuerpo.accion || '');
    const r = _despachar(accion, cuerpo);
    _anotarSiLento(accion, t0);
    return _json(r);
  } catch (err) {
    _log('API', 'ERROR', accion + ' :: ' + err.message);
    return _json(_err(err.message));
  }
}

function _anotarSiLento(accion, t0) {
  const ms = Date.now() - t0;
  if (ms < API_LENTO_MS) return;
  _log('API', 'LENTO', accion + ' ' + (ms / 1000).toFixed(1) + ' s');
}


/** Enruta la acción a la función que ya existe en 02_BACKEND / 03_ADMIN. */
function _despachar(accion, c) {
  const t = c.token || '';

  switch (accion) {

    /* --- salud y arranque --- */
    case 'ping':
      // "servidor" dice qué versión del CÓDIGO está publicada (para comprobar
      // que la implementación nueva sí quedó); "version" es la de APP_Config.
      return _ok({ servidor: VERSION_SERVIDOR, version: String(_cfgHoja('VERSION', '?')), hora: _ahora() });

    case 'login': {
      if (!_permitirIntentoLogin(c.nombre)) {
        return _err('Demasiados intentos con ese nombre. Espera 15 minutos.');
      }
      const r = apiLogin(c.nombre, c.codigo, c.userAgent);
      if (r && r.ok === false) { _contarFalloLogin(c.nombre); return r; }
      _limpiarFallosLogin(c.nombre);
      // Un viaje menos: el login ya trae estado y catálogos
      try {
        const a = _arranque(r.datos.token);
        if (a && a.ok !== false) r.datos.arranque = a.datos;
      } catch (e) { }
      return r;
    }

    case 'logout':   return apiLogout(t);
    case 'estado':   return apiEstado(t);
    case 'arranque': return _arranque(t);   // estado + catálogos en un viaje

    /* --- catálogos: una sola llamada para poder trabajar sin señal --- */
    case 'catalogos': return _catalogos(t);

    /* --- vehículos --- */
    case 'vehiculos':    return apiVehiculos();
    case 'setVehiculo': {
      const r = apiSetVehiculo(t, c.vehiculo, c.motivo);
      // Un viaje menos: devuelve también el estado para pintar el menú
      if (r && r.ok !== false) {
        try {
          const est = apiEstado(t);
          if (est && est.ok !== false) r.datos.estado = est.datos;
        } catch (e) { }
      }
      return r;
    }
    case 'usoVehiculos': return apiUsoVehiculos(t);
    case 'checklistOk':  return apiChecklistOk(t, c.vehiculo, c.tipo);

    /* --- documentación --- */
    case 'documentos':   return apiDocumentos(t);

    /* --- pedidos a domicilio --- */
    case 'pedidos':      return apiPedidosPendientes(t);
    case 'cerrarPedido': return apiCerrarPedido(t, c.p);

    /* --- traspasos --- */
    case 'sucursales':          return apiSucursales();
    case 'traspasosPendientes': return apiTraspasosPendientes(t);
    case 'recolectarTraspasos': return apiRecolectarTraspasos(t, c.folios);
    case 'actualizarTraspaso':  return apiActualizarTraspaso(t, c.p);
    case 'cerrarTraspaso':      return apiCerrarTraspaso(t, c.p);

    /* --- historial --- */
    case 'historial': return apiHistorial(t, c.tipo, c.q, c.soloMios, c.limite);

    /* --- la cola que se acumuló sin señal --- */
    case 'sincronizarLote': return _sincronizarLote(t, c.items);

    /* --- panel de administrador --- */
    case 'admin': return apiAdmin(c.clave, c.accionAdmin, c.datos);

    default: return _err('Acción desconocida: ' + accion);
  }
}


/**
 * Permite probar la API desde el navegador:
 *   .../exec?api=ping
 * Sin el parámetro, sigue sirviendo el Rastreo de siempre.
 */
function doGet(e) {
    if (!(e && e.parameter && (e.parameter.api || e.parameter.app))) return doGetRastreo(e);
  if (e && e.parameter && e.parameter.api) {
    try { return _json(_despachar(String(e.parameter.api), e.parameter)); }
    catch (err) { return _json(_err(err.message)); }
  }
  return _paginaWeb();
}


/** ===================== CATÁLOGOS EN UNA SOLA LLAMADA ===================== */
/**
 * La app baja esto al entrar y lo guarda en el celular. Así puede mostrar
 * vehículos, sucursales y motivos aunque después se quede sin señal.
 *
 * VELOCIDAD v3.0: se recuerda CACHE_CATALOGO_SEG (5 min por defecto) en vez
 * de 15 s. Casi no cambia; y cuando alguien elige vehículo se tira al momento.
 */
function _catalogos(token) {
  try {
    _exigirSesion(token);

    const enMemoria = _cacheGet('cat');
    if (enMemoria) return _ok(enMemoria);

    const sacar = function (r) { return (r && r.ok !== false) ? r.datos : []; };
    const datos = {
      vehiculos:  sacar(apiVehiculos()),
      sucursales: sacar(apiSucursales()),
      motivos: {
        CANCELADO: sacar(apiMotivos('CANCELADO')),
        RETORNO:   sacar(apiMotivos('RETORNO')),
        TRASPASO:  sacar(apiMotivos('TRASPASO'))
      },
      whatsapp: {
        activo:      _cfgHoja('WHATSAPP_ACTIVO', true) !== false,
        incluirFoto: _cfgHoja('WA_INCLUIR_FOTO', true) !== false,
        plantillas: {
          ENTREGADO:   String(_cfgHoja('WA_MSG_ENTREGADO', '')),
          RETORNO:     String(_cfgHoja('WA_MSG_RETORNO', '')),
          CANCELADO:   String(_cfgHoja('WA_MSG_CANCELADO', '')),
          TRASPASO_OK: String(_cfgHoja('WA_MSG_TRASPASO_OK', '')),
          TRASPASO_NO: String(_cfgHoja('WA_MSG_TRASPASO_NO', ''))
        }
      },
      actualizado: _ahora()
    };
    const seg = Number(_cfgHoja('CACHE_CATALOGO_SEG', 300)) || 300;
    _cachePut('cat', datos, seg);
    return _ok(datos);
  } catch (e) { return _err(e.message); }
}


/** ===================== ARRANQUE EN UN SOLO VIAJE ===================== */
/**
 * Devuelve estado + catálogos en UNA sola llamada.
 */
function _arranque(token) {
  try {
    _exigirSesion(token);
    const est = apiEstado(token);
    const cat = _catalogos(token);
    return _ok({
      estado:    (est && est.ok !== false) ? est.datos : null,
      catalogos: (cat && cat.ok !== false) ? cat.datos : null
    });
  } catch (e) { return _err(e.message); }
}


/** ===================== LA COLA DE LO CAPTURADO SIN SEÑAL ===================== */
/**
 * items = [{ idLocal, tipo:'PEDIDO'|'TRASPASO'|'RECOLECCION', datos }]
 * Devuelve el resultado de cada uno para que la app sepa cuáles ya puede
 * borrar del celular y cuáles debe reintentar.
 *
 * Si un pedido ya había sido cerrado (porque subió dos veces), se marca
 * como resuelto: no es un error, es que ya estaba hecho.
 */
function _sincronizarLote(token, items) {
  try {
    _exigirSesion(token);
    if (!items || !items.length) return _ok({ resultados: [] });

    const resultados = [];
    items.slice(0, 8).forEach(function (it) {
      let r;
      try {
        switch (String(it.tipo)) {
          case 'PEDIDO':      r = apiCerrarPedido(token, it.datos); break;
          case 'TRASPASO':    r = apiCerrarTraspaso(token, it.datos); break;
          case 'RECOLECCION': r = apiRecolectarTraspasos(token, it.datos.folios); break;
          default:            r = _err('Tipo desconocido: ' + it.tipo);
        }
      } catch (e) { r = _err(e.message); }

      const yaEstaba = r && r.ok === false &&
        /ya fue cerrado|ya no está en tu lista|ya estaba/i.test(String(r.error));

      resultados.push({
        idLocal: it.idLocal,
        ok: (r && r.ok !== false) || yaEstaba,
        yaEstaba: !!yaEstaba,
        error: (r && r.ok === false) ? r.error : ''
      });
    });

    _log('SISTEMA', 'SINCRONIZAR_COLA', resultados.length + ' elemento(s)');
    return _ok({ resultados: resultados });
  } catch (e) { return _err(e.message); }
}


/** ===================== LÍMITE DE INTENTOS DE LOGIN ===================== */
/* La URL de la API queda dentro de la app instalada, así que cualquiera
   con curiosidad podría intentar adivinar credenciales. Esto lo frena:
   6 intentos fallidos con el mismo nombre bloquean 15 minutos.          */

function _claveIntentos(nombre) { return 'login_' + _norm(nombre).replace(/\s+/g, '_').substring(0, 40); }

function _permitirIntentoLogin(nombre) {
  if (!nombre) return true;
  const n = Number(CacheService.getScriptCache().get(_claveIntentos(nombre)) || 0);
  return n < 6;
}

function _contarFalloLogin(nombre) {
  if (!nombre) return;
  const cache = CacheService.getScriptCache();
  const k = _claveIntentos(nombre);
  cache.put(k, String(Number(cache.get(k) || 0) + 1), 900);
}

function _limpiarFallosLogin(nombre) {
  if (!nombre) return;
  CacheService.getScriptCache().remove(_claveIntentos(nombre));
}
