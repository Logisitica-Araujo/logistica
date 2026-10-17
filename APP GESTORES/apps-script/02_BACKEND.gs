/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  ARCHIVO 3 de 6
 * 02_BACKEND.gs   (VERSIÓN 3.0)
 * ---------------------------------------------------------------------
 * Toda la lógica del servidor: login, sesión, vehículos, pedidos,
 * traspasos, evidencias en Drive e historial.
 *
 * CAMBIOS DE LA 3.0:
 *  • SESIÓN QUE NO SE CIERRA SOLA. Antes caducaba 14 h después del login,
 *    aunque el gestor la estuviera usando. Ahora solo se cierra tras
 *    SESION_INACTIVIDAD_HORAS sin usar la app (72 h por defecto) o al
 *    cumplir SESION_MAX_DIAS (30). Se configuran en APP_Config.
 *  • EL VEHÍCULO ES POR DÍA. Como la sesión ya dura varios días, cada
 *    mañana la app vuelve a pedir el vehículo y el checklist, y el
 *    vehículo de ayer deja de contar como "ocupado".
 *  • LA SESIÓN SE BUSCA EN MEMORIA (2 min) en vez de leer APP_Sesiones
 *    completa en cada consulta.
 *  • CIERRES MÁS CORTOS: las fotos se suben a Drive FUERA del candado, y
 *    la escritura en "Operaciones" la hace el robot de 08_SYNC.gs en
 *    segundo plano. El candado (que bloquea a TODOS los gestores) ahora
 *    dura menos de un segundo.
 ***********************************************************************/

/**
 * Sirve la versión web de siempre (la que abres con el link /exec).
 * Ya no se llama doGet: ahora quien recibe las visitas es 04_API.gs,
 * que decide si te da la página o una respuesta para la app instalada.
 */
function _paginaWeb() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CFG.NOMBRE_APP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Permite partir el HTML en varios archivos. */
function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** Respuesta estándar. */
function _ok(datos)  { return { ok: true,  datos: datos || null }; }
function _err(msg)   { return { ok: false, error: String(msg) }; }


/* ===================================================================
 *  1. AUTENTICACIÓN Y SESIÓN
 * -------------------------------------------------------------------
 *  Columnas de APP_Sesiones:
 *    1 Token  2 Gestor  3 Vehiculo  4 InicioISO  5 UltimoCambioVehISO
 *    6 Activa  7 UserAgent  8 UltimaActividadISO  9 VehiculoElegidoISO
 *  La 8 y la 9 son nuevas (v3.0). Las sesiones viejas no las tienen y
 *  siguen funcionando: se usan la 4 y la 5 en su lugar.
 * =================================================================== */
var SES_COLS = 9;
var SES_MEMORIA_SEG = 120;        // cuánto se recuerda una sesión sin releer la hoja
var SES_ACTIVIDAD_CADA_MIN = 30;  // cada cuánto se anota "sigue usando la app"

/** Pone los encabezados nuevos de APP_Sesiones si faltan. */
function _asegurarEncabezadosSesion(sh) {
  try {
    const enc = sh.getRange(1, 8, 1, 2).getValues()[0];
    if (!enc[0] || !enc[1]) sh.getRange(1, 8, 1, 2).setValues([['UltimaActividadISO', 'VehiculoElegidoISO']]);
  } catch (e) { }
}

/** Fecha (yyyy-MM-dd, hora de México) de un valor ISO o Date. '' si no hay. */
function _diaDe(v) {
  if (!v) return '';
  const d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'America/Mexico_City', 'yyyy-MM-dd');
}

/** Milisegundos de un valor ISO o Date. NaN si no hay. */
function _msDe(v) {
  if (!v) return NaN;
  const d = (v instanceof Date) ? v : new Date(v);
  return d.getTime();
}

/** Última vez que se usó la sesión (col 8; si no existe, el inicio). */
function _ultimaActividad(f) {
  const a = _msDe(f[7]);
  return isNaN(a) ? _msDe(f[3]) : a;
}

/** Cuándo eligió vehículo (col 9; en sesiones viejas, col 5 o el inicio). */
function _vehiculoElegidoEl(f) {
  return f[8] || f[4] || f[3];
}

/** ¿Esta fila de sesión sigue viva? */
function _sesionViva(f, ahoraMs) {
  if (!f || f[5] === false) return false;
  const inicio = _msDe(f[3]);
  if (isNaN(inicio)) return false;
  const maxDias = Number(_cfgHoja('SESION_MAX_DIAS', CFG.SESION_MAX_DIAS || 30));
  if ((ahoraMs - inicio) / 86400000 > maxDias) return false;
  const horas = Number(_cfgHoja('SESION_INACTIVIDAD_HORAS', CFG.SESION_INACTIVIDAD_HORAS || 72));
  return (ahoraMs - _ultimaActividad(f)) / 3600000 <= horas;
}

/**
 * Login: nombre del gestor + código de barras de su credencial.
 * Devuelve un token que el celular guarda en memoria local.
 */
function apiLogin(nombre, codigo, userAgent) {
  try {
    if (_cfgHoja('APP_BLOQUEADA', false) === true) {
      return _err(_cfgHoja('MENSAJE_BLOQUEO', 'App en mantenimiento.'));
    }

    const n = _norm(nombre);
    const c = _normCodigo(codigo);
    if (!n)  return _err('Escribe tu nombre.');
    if (!c)  return _err('Escanea tu credencial.');

    const sh = _hoja(CFG.H.USUARIOS);
    if (sh.getLastRow() < 2) return _err('No hay gestores dados de alta. Avisa a administración.');
    const filas = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();

    let encontrado = null, fila = 0;
    for (let i = 0; i < filas.length; i++) {
      if (_norm(filas[i][0]) === n) { encontrado = filas[i]; fila = i + 2; break; }
    }
    // segunda pasada: coincidencia parcial (el gestor escribió solo su nombre de pila)
    if (!encontrado) {
      const candidatos = [];
      for (let i = 0; i < filas.length; i++) {
        if (_norm(filas[i][0]).indexOf(n) >= 0 || n.indexOf(_norm(filas[i][0])) >= 0) {
          candidatos.push({ f: filas[i], r: i + 2 });
        }
      }
      if (candidatos.length === 1) { encontrado = candidatos[0].f; fila = candidatos[0].r; }
    }

    if (!encontrado) { _log(nombre, 'LOGIN_FALLIDO', 'usuario no existe'); return _err('No encontré ese nombre. Escríbelo como aparece en tu credencial.'); }
    if (encontrado[3] === false) return _err('Tu usuario está desactivado. Habla con administración.');
    if (_normCodigo(encontrado[1]) !== c) {
      _log(encontrado[0], 'LOGIN_FALLIDO', 'código incorrecto');
      return _err('La credencial no corresponde a ese nombre.');
    }

    const gestor = String(encontrado[0]);
    const token  = _uid('T');
    const ahoraISO = new Date().toISOString();

    const shS = _hoja(CFG.H.SESIONES, true);
    _asegurarEncabezadosSesion(shS);
    shS.appendRow([
      token, gestor, '', ahoraISO, '', true, String(userAgent || '').substring(0, 180),
      ahoraISO, ''
    ]);
    _hoja(CFG.H.USUARIOS).getRange(fila, 5).setValue(_ahora());
    _log(gestor, 'LOGIN', 'ok');

    return _ok({ token: token, gestor: gestor, vehiculo: '' });
  } catch (e) { return _err(e.message); }
}


/**
 * Busca la sesión por token. Devuelve {fila, gestor, vehiculo, ultimoCambio} o null.
 *
 * VELOCIDAD v3.0: la sesión se guarda 2 min en memoria compartida. Antes
 * se leía APP_Sesiones completa (que crece con cada login) en CADA consulta.
 * Si administración cierra las sesiones, el cambio tarda hasta 2 min.
 *
 * VEHÍCULO POR DÍA: si el vehículo se eligió otro día, la sesión sigue
 * viva pero sin vehículo: la app pide elegirlo y hacer el checklist.
 */
function _sesion(token) {
  if (!token) return null;
  const ck = 'ses_' + token;
  const ahoraMs = Date.now();
  let s = null;

  try {
    const c = CacheService.getScriptCache().get(ck);
    if (c) s = JSON.parse(c);
  } catch (e) { s = null; }

  if (!s) {
    const sh = _hoja(CFG.H.SESIONES);
    if (sh.getLastRow() < 2) return null;
    const nCols = Math.min(SES_COLS, Math.max(7, sh.getLastColumn()));
    const filas = sh.getRange(2, 1, sh.getLastRow() - 1, nCols).getValues();
    for (let i = filas.length - 1; i >= 0; i--) {         // de la más nueva a la más vieja
      if (String(filas[i][0]) !== String(token)) continue;
      const f = filas[i];
      while (f.length < SES_COLS) f.push('');
      if (!_sesionViva(f, ahoraMs)) return null;
      s = {
        fila: i + 2,
        gestor: String(f[1]),
        vehiculo: String(f[2] || ''),
        ultimoCambioISO: f[4] ? new Date(f[4]).toISOString() : '',
        diaVehiculo: _diaDe(_vehiculoElegidoEl(f)),
        actividadMs: _ultimaActividad(f)
      };
      break;
    }
    if (!s) return null;
  }

  /* ---- Vehículo de otro día: se suelta ---- */
  let soltarVehiculo = false;
  if (s.vehiculo && s.diaVehiculo !== _hoyISO()) {
    s.vehiculo = '';
    s.ultimoCambioISO = '';
    soltarVehiculo = true;
  }

  /* ---- "Sigue usando la app": se anota a lo más cada 30 min ---- */
  const anotar = isNaN(s.actividadMs) ||
                 (ahoraMs - s.actividadMs) > SES_ACTIVIDAD_CADA_MIN * 60000;
  if (anotar || soltarVehiculo) {
    try {
      const sh = _hoja(CFG.H.SESIONES);
      if (anotar) {
        _asegurarEncabezadosSesion(sh);
        sh.getRange(s.fila, 8).setValue(new Date(ahoraMs).toISOString());
        s.actividadMs = ahoraMs;
      }
      if (soltarVehiculo) {
        sh.getRange(s.fila, 3).setValue('');
        sh.getRange(s.fila, 5).setValue('');
      }
    } catch (e) { }
  }

  try { CacheService.getScriptCache().put(ck, JSON.stringify(s), SES_MEMORIA_SEG); } catch (e) { }

  return {
    fila: s.fila,
    token: token,
    gestor: s.gestor,
    vehiculo: s.vehiculo,
    ultimoCambio: s.ultimoCambioISO ? new Date(s.ultimoCambioISO) : null
  };
}

function _olvidarSesion(token) {
  try { CacheService.getScriptCache().remove('ses_' + token); } catch (e) { }
}

function _exigirSesion(token) {
  const s = _sesion(token);
  if (!s) throw new Error('SESION_EXPIRADA');
  return s;
}


/** Cierra la sesión del gestor. */
function apiLogout(token) {
  try {
    const s = _sesion(token);
    if (s) {
      _hoja(CFG.H.SESIONES).getRange(s.fila, 6).setValue(false);
      _olvidarSesion(token);
      _log(s.gestor, 'LOGOUT', '');
    }
    return _ok();
  } catch (e) { return _err(e.message); }
}


/* ===================================================================
 *  2. VEHÍCULOS
 * =================================================================== */

/**
 * Quién trae cada vehículo en este momento.
 * Devuelve { 'suzuki 4b1228': 'Jose Luis', ... } con el nombre normalizado.
 *
 * Solo cuenta la sesión MÁS RECIENTE de cada gestor, si sigue viva y si
 * el vehículo se eligió HOY. El vehículo de ayer ya no bloquea a nadie.
 */
function _vehiculosOcupados() {
  const ocupados = {};
  try {
    const sh = _hoja(CFG.H.SESIONES);
    if (sh.getLastRow() < 2) return ocupados;

    const ahoraMs = Date.now();
    const hoy = _hoyISO();
    const nCols = Math.min(SES_COLS, Math.max(7, sh.getLastColumn()));
    const filas = sh.getRange(2, 1, sh.getLastRow() - 1, nCols).getValues();
    const vistos = {};                    // gestores que ya resolvimos

    for (let i = filas.length - 1; i >= 0; i--) {   // de la más nueva a la más vieja
      const f = filas[i];
      while (f.length < SES_COLS) f.push('');
      const gestor = String(f[1] || '');
      if (!gestor) continue;
      const g = _norm(gestor);
      if (vistos[g]) continue;            // ya tomamos su sesión más reciente
      vistos[g] = true;

      if (!_sesionViva(f, ahoraMs)) continue;
      if (_diaDe(_vehiculoElegidoEl(f)) !== hoy) continue;   // lo eligió otro día

      const veh = String(f[2] || '').trim();
      if (veh) ocupados[_norm(veh)] = gestor;
    }
  } catch (e) { _log('SISTEMA', 'ERROR_OCUPADOS', e.message); }
  return ocupados;
}


function apiVehiculos() {
  try {
    const sh = _hoja(CFG.H.VEHICULOS);
    if (sh.getLastRow() < 2) return _ok([]);
    const sinVeh = _norm(_cfgHoja('VEHICULO_SIN', 'Sin vehículo'));
    const ocupados = _vehiculosOcupados();
    const lista = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues()
      .filter(function (f) { return f[0] && f[2] !== false; })
      .map(function (f) {
        const nom = String(f[0]);
        const esSin = _norm(nom) === sinVeh;
        let tipo = _norm(f[4]).toUpperCase();
        if (['MOTO', 'AUTO', 'NINGUNO'].indexOf(tipo) < 0) tipo = 'AUTO';
        if (esSin) tipo = 'NINGUNO';
        // "Sin vehículo" nunca se ocupa: varios gestores pueden traerla a la vez
        const quien = esSin ? '' : (ocupados[_norm(nom)] || '');
        return { nombre: nom, placa: String(f[1] || ''), tipo: tipo, esSin: esSin,
                 ocupadoPor: quien };
      });
    // "Sin vehículo" siempre hasta abajo, para que no se toque por error
    lista.sort(function (a, b) { return (a.esSin ? 1 : 0) - (b.esSin ? 1 : 0); });
    return _ok(lista);
  } catch (e) { return _err(e.message); }
}


/**
 * Asigna o cambia el vehículo de la sesión.
 * Candado: no puede cambiar dos veces dentro de CANDADO_VEHICULO_MIN minutos.
 * La PRIMERA asignación del día nunca está bloqueada.
 */
function apiSetVehiculo(token, vehiculo, motivo) {
  try {
    const s = _exigirSesion(token);
    const v = String(vehiculo || '').trim();
    if (!v) return _err('Selecciona un vehículo.');
    if (_norm(v) === _norm(s.vehiculo)) return _ok({ vehiculo: v, cambio: false });

    const minutos = Number(_cfgHoja('CANDADO_VEHICULO_MIN', CFG.CANDADO_VEHICULO_MIN));

    // "Sin vehículo" es para entrar a consultar: ni activa el candado ni lo sufre.
    const sinVeh = _norm(_cfgHoja('VEHICULO_SIN', 'Sin vehículo'));
    const vaSin  = _norm(v) === sinVeh;
    const veniaSin = _norm(s.vehiculo) === sinVeh;

    /* ---- ¿Ya lo trae alguien más? ---- */
    if (!vaSin && _cfgHoja('BLOQUEAR_VEHICULO_OCUPADO', true) !== false) {
      const quien = _vehiculosOcupados()[_norm(v)];
      if (quien && _norm(quien) !== _norm(s.gestor)) {
        _log(s.gestor, 'VEHICULO_OCUPADO', v + ' lo trae ' + quien);
        return _err('OCUPADO: "' + v + '" lo está usando ' + quien + '. ' +
                    'Elige otro, o pide a administración que cierre su sesión.');
      }
    }

    if (!vaSin && !veniaSin && s.vehiculo && s.ultimoCambio) {
      const transcurridos = (Date.now() - s.ultimoCambio.getTime()) / 60000;
      if (transcurridos < minutos) {
        const faltan = Math.ceil(minutos - transcurridos);
        return _err('CANDADO: cambiaste de vehículo hace ' + Math.floor(transcurridos) +
                    ' min. Puedes volver a cambiar en ' + faltan + ' min. ' +
                    'Si es urgente, pide a administración que libere el candado.');
      }
    }

    const ahoraISO = new Date().toISOString();
    const sh = _hoja(CFG.H.SESIONES);
    _asegurarEncabezadosSesion(sh);
    sh.getRange(s.fila, 3).setValue(v);
    // Solo marcamos la hora del cambio cuando el vehículo es real: así
    // entrar "Sin vehículo" no arranca el candado de 30 minutos.
    sh.getRange(s.fila, 5).setValue(vaSin ? '' : ahoraISO);
    sh.getRange(s.fila, 9).setValue(ahoraISO);           // día en que lo eligió
    _olvidarSesion(token);                               // la sesión cambió

    _hoja(CFG.H.USO_VEH, true).appendRow([
      _ahora(), s.gestor, s.vehiculo || '(inicio de turno)', v, String(motivo || ''), token
    ]);
    _log(s.gestor, 'VEHICULO', (s.vehiculo || '-') + ' → ' + v);
    _cacheBorrar('cat');                        // cambió quién trae qué vehículo

    return _ok({ vehiculo: v, cambio: !!s.vehiculo });
  } catch (e) { return _err(e.message); }
}


/**
 * Convierte "Casco | Guantes | Seguro" en ['Casco','Guantes','Seguro'].
 */
function _listaChecklist(texto) {
  return String(texto || '')
    .split(/[|\n]/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}


/**
 * El gestor confirmó que revisó su equipo antes de salir.
 * Solo deja constancia en APP_Log con la hora.
 */
function apiChecklistOk(token, vehiculo, tipo) {
  try {
    const s = _exigirSesion(token);
    _log(s.gestor, 'CHECKLIST_OK',
         String(vehiculo || s.vehiculo || '') + ' (' + String(tipo || '') + ')');
    return _ok({ hora: _ahora() });
  } catch (e) { return _err(e.message); }
}


/**
 * Biblioteca de "Documentación". Lee la hoja APP_Documentos y devuelve los
 * documentos activos, agrupados por categoría y en el orden que indiques.
 */
function apiDocumentos(token) {
  try {
    _exigirSesion(token);
    const sh = _hoja(CFG.H.DOCUMENTOS);
    if (sh.getLastRow() < 2) return _ok([]);
    const filas = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
    const lista = filas
      .filter(function (f) { return f[1] && f[4] !== false; })   // con título y activo
      .map(function (f) {
        return {
          categoria: String(f[0] || 'General'),
          titulo:    String(f[1]),
          tipo:      (_norm(f[2]) === 'enlace') ? 'enlace' : 'texto',
          contenido: String(f[3] || ''),
          orden:     Number(f[5]) || 0
        };
      });
    lista.sort(function (a, b) {
      if (a.categoria !== b.categoria) return a.categoria < b.categoria ? -1 : 1;
      return a.orden - b.orden;
    });
    return _ok(lista);
  } catch (e) { return _err(e.message); }
}


/**
 * Cuántos dispositivos tienen abierta la cuenta de este gestor ahora mismo.
 * Como la sesión ya dura varios días, solo cuentan los que se USARON en las
 * últimas DURACION_SESION_HORAS (14 h): un celular viejo olvidado no alarma.
 */
function _dispositivosActivos(gestor) {
  try {
    const sh = _hoja(CFG.H.SESIONES);
    if (sh.getLastRow() < 2) return 1;
    const ahoraMs = Date.now();
    const horasRecientes = Number(_cfgHoja('DURACION_SESION_HORAS', CFG.DURACION_SESION_HORAS));
    const nCols = Math.min(SES_COLS, Math.max(7, sh.getLastColumn()));
    const filas = sh.getRange(2, 1, sh.getLastRow() - 1, nCols).getValues();
    const g = _norm(gestor);
    let n = 0;
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      while (f.length < SES_COLS) f.push('');
      if (_norm(f[1]) !== g) continue;
      if (!_sesionViva(f, ahoraMs)) continue;
      if ((ahoraMs - _ultimaActividad(f)) / 3600000 > horasRecientes) continue;
      n++;
    }
    return Math.max(1, n);
  } catch (e) { return 1; }
}


/* ===================================================================
 *  3. ESTADO GENERAL (lo que pinta el menú de 7 iconos)
 * =================================================================== */

/** Módulos del menú: los que guardó el admin, o los de 00_CONFIG.gs. */
function _modulosVigentes() {
  const guardado = _cfgHoja('MODULOS_JSON', '');
  if (guardado) {
    try {
      const m = JSON.parse(guardado);
      if (m && m.length) return m;
    } catch (e) { }
  }
  return CFG.MODULOS;
}

/* ===================================================================
 *  MEMORIA CORTA (CacheService)
 * -------------------------------------------------------------------
 *  El resultado pesado se guarda unos segundos y se comparte entre los
 *  gestores. Duración configurable en APP_Config → CACHE_SEG. 0 lo apaga.
 * =================================================================== */
function _cacheSeg() {
  const n = Number(_cfgHoja('CACHE_SEG', 15));
  return (isNaN(n) || n < 0) ? 15 : n;
}
function _cacheGet(clave) {
  if (_cacheSeg() === 0) return null;
  try { const s = CacheService.getScriptCache().get(clave); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}
function _cachePut(clave, obj, segundos) {
  const seg = segundos || _cacheSeg();
  if (_cacheSeg() === 0) return;
  try { CacheService.getScriptCache().put(clave, JSON.stringify(obj), seg); } catch (e) {}
}
function _cacheBorrar(clave) {
  try { CacheService.getScriptCache().remove(clave); } catch (e) {}
}
/** Al cerrar/cambiar algo, tiramos la memoria del gestor para que vea el cambio ya. */
function _invalidarGestor(gestor) {
  const g = _norm(gestor);
  _cacheBorrar('estado_' + g);
  _cacheBorrar('pedidos_' + g);
  _cacheBorrar('traspasos_' + g);
}


function apiEstado(token) {
  try {
    const s = _exigirSesion(token);

    // ¿Está en memoria? La parte pesada (contar pendientes) se reusa; lo
    // ligero que depende del momento (vehículo, candado) se recalcula abajo.
    let pendientes, traspasos;
    const ck = 'cont_' + _norm(s.gestor);
    const hit = _cacheGet(ck);
    if (hit) {
      pendientes = hit.p; traspasos = hit.t;
    } else {
      pendientes = _leerPendientes(s.gestor).length;
      traspasos  = _traspasosPendientes(s.gestor).length;
      _cachePut(ck, { p: pendientes, t: traspasos });
    }

    const minutos = Number(_cfgHoja('CANDADO_VEHICULO_MIN', CFG.CANDADO_VEHICULO_MIN));
    const sinVeh  = _norm(_cfgHoja('VEHICULO_SIN', 'Sin vehículo'));
    let puedeCambiar = true, faltanMin = 0;
    // Si trae "Sin vehículo", puede cambiar cuando quiera: no está trabajando aún
    if (s.vehiculo && s.ultimoCambio && _norm(s.vehiculo) !== sinVeh) {
      const t = (Date.now() - s.ultimoCambio.getTime()) / 60000;
      if (t < minutos) { puedeCambiar = false; faltanMin = Math.ceil(minutos - t); }
    }

    return _ok({
      gestor: s.gestor,
      vehiculo: s.vehiculo,
      dispositivosActivos: _dispositivosActivos(s.gestor),
      puedeCambiarVehiculo: puedeCambiar,
      minutosParaCambiar: faltanMin,
      modulos: _modulosVigentes(),
      contadores: { pedidos: pendientes, traspasos: traspasos },
      revisarCadaSeg: Number(_cfgHoja('REVISAR_NUEVOS_SEG', CFG.REVISAR_NUEVOS_SEG)),
      reglas: {
        exigirFotoEntrega:   _cfgHoja('EXIGIR_FOTO_ENTREGA', true) !== false,
        exigirFirmaEntrega:  _cfgHoja('EXIGIR_FIRMA_ENTREGA', true) !== false,
        exigirFotoNoEntrega: _cfgHoja('EXIGIR_FOTO_NOENTREGA', true) !== false,
        exigirFotoTraspaso:  _cfgHoja('EXIGIR_FOTO_TRASPASO', true) !== false,
        pedirGPS:            _cfgHoja('PEDIR_GPS', true) !== false,
        pedirQuienRecibio:   _cfgHoja('PEDIR_QUIEN_RECIBIO', true) !== false,
        exigirQuienRecibio:  _cfgHoja('EXIGIR_QUIEN_RECIBIO', false) === true
      },
      vehiculoSin: String(_cfgHoja('VEHICULO_SIN', 'Sin vehículo')),
      checklist: {
        activo: _cfgHoja('CHECKLIST_ACTIVO', true) !== false,
        MOTO:   _listaChecklist(_cfgHoja('CHECK_MOTO', '')),
        AUTO:   _listaChecklist(_cfgHoja('CHECK_AUTO', '')),
        nota:   String(_cfgHoja('CHECK_NOTA', ''))
      }
    });
  } catch (e) { return _err(e.message); }
}


/* ===================================================================
 *  4. PEDIDOS A DOMICILIO
 * =================================================================== */

/** IDs ya cerrados por la app (para que no reaparezcan).
 *  VELOCIDAD v3.0: se recuerdan 60 s en memoria; al cerrar un pedido se
 *  agrega a la memoria al momento. fresco=true obliga a leer la hoja. */
function _idsCerrados(fresco) {
  if (!fresco) {
    try {
      const c = CacheService.getScriptCache().get('cerrados');
      if (c) return JSON.parse(c);
    } catch (e) { }
  }
  const sh = _hoja(CFG.H.ENTREGAS);
  const set = {};
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues()
      .forEach(function (f) { if (f[0]) set[_norm(f[0])] = true; });
  }
  try { CacheService.getScriptCache().put('cerrados', JSON.stringify(set), 60); } catch (e) { }
  return set;
}

function _recordarCerrado(id) {
  try {
    const cache = CacheService.getScriptCache();
    const c = cache.get('cerrados');
    if (!c) return;
    const set = JSON.parse(c);
    set[_norm(id)] = true;
    cache.put('cerrados', JSON.stringify(set), 60);
  } catch (e) { }
}

/** Lee los pendientes de ESE gestor.
 *  CAMINO RÁPIDO (v2.8): si existe la hoja chica APP_Pedidos (la llena el
 *  robot de 08_SYNC.gs), lee de ahí → casi instantáneo. Si no existe o está
 *  vacía (aún no sincroniza), cae solo al CAMINO VIEJO de abajo: leer
 *  "Operaciones" directo. Así nunca se queda sin datos. */
function _leerPendientes(gestor) {
  try {
    if (typeof _leerPendientesRapido === 'function') {
      var rapido = _leerPendientesRapido(gestor);
      if (rapido !== null) return rapido;   // null = usar camino viejo
    }
  } catch (e) { /* cualquier problema → camino viejo */ }

  // --- CAMINO VIEJO (respaldo): leer "Operaciones" directo ---
  let t;
  try { t = _abrirTabla(CFG.HOJA_OPERACIONES, CFG.COL_OPERACIONES, CFG.FILA_ENC_OPERACIONES); }
  catch (e) { return []; }

  const c = t.mapa;
  if (c.id < 0 || c.gestor < 0) return [];

  const cerrados = _idsCerrados();
  const g = _norm(gestor);
  const fuera = CFG.ESTATUS_CERRADOS.map(_norm);
  const permitidos = (CFG.ESTATUS_PERMITIDOS || []).map(_norm).filter(Boolean);
  const salida = [];

  for (let i = 0; i < t.datos.length; i++) {
    const f = t.datos[i];
    const id = String(f[c.id] || '').trim();
    if (!id) continue;

    const asignado = _norm(f[c.gestor]);
    if (!asignado || asignado !== g) continue;

    const est = c.estatus >= 0 ? _norm(f[c.estatus]) : '';
    if (est && fuera.indexOf(est) >= 0) continue;
    if (permitidos.length && est && permitidos.indexOf(est) < 0) continue;
    if (cerrados[_norm(id)]) continue;

    salida.push({
      id: id,
      fila: t.filaPrimerDato + i,
      cliente:    c.nombre    >= 0 ? String(f[c.nombre] || '')    : '',
      direccion:  c.direccion >= 0 ? String(f[c.direccion] || '') : '',
      notas:      c.notas     >= 0 ? String(f[c.notas] || '')     : '',
      area:       c.area      >= 0 ? String(f[c.area] || '')      : '',
      subarea:    c.subarea   >= 0 ? String(f[c.subarea] || '')   : '',
      fecha:      c.fecha     >= 0 ? _fechaTexto(f[c.fecha])      : ''
    });
  }
  return salida;
}

function apiPedidosPendientes(token) {
  try {
    const s = _exigirSesion(token);
    return _ok(_leerPendientes(s.gestor));
  } catch (e) { return _err(e.message); }
}


/** Catálogo de motivos, por tipo (PEDIDO o TRASPASO). */
function apiMotivos(tipo) {
  try {
    const sh = _hoja(CFG.H.MOTIVOS);
    if (sh.getLastRow() < 2) return _ok([]);
    const t = _norm(tipo);
    const lista = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
      .filter(function (f) { return _norm(f[0]) === t && f[1] && f[3] !== false; })
      .map(function (f) { return { motivo: String(f[1]), pideComentario: f[2] === true }; });
    return _ok(lista);
  } catch (e) { return _err(e.message); }
}


/* ---- "Operaciones" en segundo plano ---------------------------------
 *  Columna R (18) de APP_Entregas = 'EnOperaciones':
 *    PENDIENTE → el robot de 08_SYNC.gs aún no lo escribe en Operaciones
 *    OK …      → ya está escrito
 *    (vacío)   → cierres anteriores a la v3.0 (ya se escribieron en su momento)
 *  Si el robot no está instalado, se escribe como antes, al momento.
 * -------------------------------------------------------------------- */
var ENT_COL_ENOPS = 18;

function _robotInstalado() {
  try {
    const cache = CacheService.getScriptCache();
    const c = cache.get('robot_ok');
    if (c) return c === '1';
    const hay = ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === 'sincronizarPedidos';
    });
    cache.put('robot_ok', hay ? '1' : '0', 600);
    return hay;
  } catch (e) { return false; }
}

function _operacionesEnSegundoPlano() {
  if (_cfgHoja('OPERACIONES_EN_SEGUNDO_PLANO', true) === false) return false;
  return _robotInstalado();
}

/**
 * Cierra un pedido. p = {
 *   id, resultado:'ENTREGADO'|'CANCELADO'|'RETORNO', motivo, comentario,
 *   foto (dataURL), firma (dataURL), lat, lng,
 *   cliente, direccion, notas, area, subarea
 * }
 */
function apiCerrarPedido(token, p) {
  try {
    const s = _exigirSesion(token);
    if (!s.vehiculo) return _err('Primero selecciona el vehículo que estás usando.');
    if (!p || !p.id) return _err('Falta el ID del pedido.');

    const res = String(p.resultado || '').toUpperCase();
    if (['ENTREGADO', 'CANCELADO', 'RETORNO'].indexOf(res) < 0) {
      return _err('Resultado no válido: ' + res);
    }
    const entregado = res === 'ENTREGADO';

    if (entregado) {
      if (_cfgHoja('EXIGIR_FOTO_ENTREGA', true)  !== false && !p.foto)  return _err('Falta la foto de la fachada.');
      if (_cfgHoja('EXIGIR_FIRMA_ENTREGA', true) !== false && !p.firma) return _err('Falta la firma del cliente.');
      if (_cfgHoja('EXIGIR_QUIEN_RECIBIO', false) === true && !String(p.recibio || '').trim()) {
        return _err('Anota quién recibió el pedido.');
      }
    } else {
      if (!p.motivo) return _err('Selecciona el motivo.');
      if (_cfgHoja('EXIGIR_FOTO_NOENTREGA', true) !== false && !p.foto) return _err('Falta la foto de evidencia.');
    }

    // Evitar doble cierre (revisión rápida; abajo se confirma con candado)
    if (_idsCerrados()[_norm(p.id)]) return _err('Ese pedido ya fue cerrado.');

    /* 1) EVIDENCIAS — FUERA del candado.
       Subir a Drive es lo más lento del cierre y no toca nada compartido.
       Antes se hacía con el candado puesto y TODOS los gestores esperaban. */
    const urlFoto  = p.foto  ? _guardarEvidencia(p.foto,  p.id, res) : '';
    const urlFirma = p.firma ? _guardarEvidencia(p.firma, p.id, 'FIRMAS') : '';

    /* 2) REGISTRO — con candado, y dura menos de un segundo */
    const enSegundoPlano = _operacionesEnSegundoPlano();
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return _err('El servidor está ocupado. Intenta de nuevo en un momento.');
    try {
      if (_idsCerrados(true)[_norm(p.id)]) return _err('Ese pedido ya fue cerrado.');
      const shE = _hoja(CFG.H.ENTREGAS, true);
      if (enSegundoPlano && !shE.getRange(1, ENT_COL_ENOPS).getValue()) {
        shE.getRange(1, ENT_COL_ENOPS).setValue('EnOperaciones');
      }
      shE.appendRow([
        _ahora(), p.id, s.gestor, s.vehiculo,
        res,                                   // ENTREGADO | CANCELADO | RETORNO
        String(p.motivo || ''),
        String(p.cliente || ''), String(p.direccion || ''), String(p.notas || ''),
        String(p.area || ''), String(p.subarea || ''),
        urlFoto, urlFirma,
        p.lat || '', p.lng || '',
        String(p.comentario || ''),
        String(p.recibio || ''),               // quién recibió (columna Q)
        enSegundoPlano ? 'PENDIENTE' : ''      // columna R: lo escribe el robot
      ]);
      _recordarCerrado(p.id);
    } finally {
      try { lock.releaseLock(); } catch (e) { }
    }

    /* 3) "Operaciones": el robot lo escribe en segundo plano (≤ 1 min).
          Si el robot no está instalado, se escribe ahora como antes. */
    if (!enSegundoPlano) {
      _escribirEnOperaciones(p.id, res, {
        gestor: s.gestor, vehiculo: s.vehiculo,
        lat: p.lat, lng: p.lng, foto: urlFoto, firma: urlFirma,
        motivo: p.motivo, comentario: p.comentario
      });
    }

    _log(s.gestor, 'CIERRE_' + res, p.id + ' ' + (p.motivo || ''));
    _cacheBorrar('cont_' + _norm(s.gestor));   // el conteo cambió: refréscalo ya
    try { if (typeof _quitarDePedidos === 'function') _quitarDePedidos(p.id); } catch (e) {}
    return _ok({ id: p.id, resultado: res, foto: urlFoto, firma: urlFirma });

  } catch (e) {
    return _err(e.message);
  }
}


/**
 * Llena en "Operaciones" SOLO las columnas que indica CFG.ESCRIBIR_EN_OPERACIONES.
 * Nunca toca la columna ESTATUS: ese lo calcula la fórmula del usuario.
 * (Camino de respaldo: normalmente lo hace el robot con _escribirFilaOps.)
 */
function _escribirEnOperaciones(id, resultado, d) {
  const cfg = CFG.ESCRIBIR_EN_OPERACIONES || {};
  if (cfg.activo === false) return;
  if (_cfgHoja('ESCRIBIR_EN_OPERACIONES', true) === false) return;

  try {
    const t = _abrirTabla(CFG.HOJA_OPERACIONES, CFG.COL_OPERACIONES, CFG.FILA_ENC_OPERACIONES);
    if (t.mapa.id < 0) return;

    const objetivo = _norm(id);
    let fila = -1;
    for (let i = 0; i < t.datos.length; i++) {
      if (_norm(t.datos[i][t.mapa.id]) === objetivo) { fila = t.filaPrimerDato + i; break; }
    }
    if (fila < 0) { _log('SISTEMA', 'NO_ENCONTRE_FILA', id); return; }

    _escribirFilaOps(t, fila, resultado, d, new Date());
  } catch (e) {
    _log('SISTEMA', 'ERROR_ESCRIBIR_OPS', id + ' ' + e.message);
  }
}

/** Escribe en una fila ya localizada de "Operaciones". */
function _escribirFilaOps(t, fila, resultado, d, fecha) {
  const cfg = CFG.ESCRIBIR_EN_OPERACIONES || {};
  const escribir = function (ref, valor) {
    if (!ref || valor === '' || valor == null) return;
    const c = _idxCol(t.enc, ref);
    if (c >= 0) t.sh.getRange(fila, c + 1).setValue(valor);
  };

  // Fecha y palomita según el botón que apretó el gestor
  const bloque = cfg[resultado] || {};
  escribir(bloque.fecha, fecha || new Date());
  if (bloque.check) escribir(bloque.check, true);

  // Comunes
  escribir(cfg.gestor, d.gestor);
  escribir(cfg.vehiculo, d.vehiculo);
  escribir(cfg.gps, (d.lat && d.lng) ? (d.lat + ', ' + d.lng) : '');
  escribir(cfg.foto, d.foto);
  escribir(cfg.firma, d.firma);
  escribir(cfg.motivo, d.motivo);
  escribir(cfg.comentario, d.comentario);
}


/* ===================================================================
 *  5. EVIDENCIAS EN DRIVE
 * =================================================================== */

/**
 * El nombre del archivo es EL ID DEL PEDIDO Y NADA MÁS ("#15780"),
 * para que el buscador de rastreo lo encuentre escribiendo solo el ID.
 * Drive no acepta \ / : * ? " < > | — esos se cambian por guion.
 */
function _nombreArchivo(id, mime) {
  let n = String(id).trim().replace(/[\\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
  if (CFG.EXTENSION_EN_NOMBRE === true) {
    n += (String(mime).indexOf('png') >= 0 ? '.png' : '.jpg');
  }
  return n;
}

/**
 * Carpeta destino según el tipo: ENTREGADO, CANCELADO, RETORNO,
 * FIRMAS o TRASPASOS. Si no tiene ID configurado, crea (una vez) una
 * subcarpeta con ese nombre dentro de la carpeta de ENTREGADO.
 */
function _carpetaDestino(tipo) {
  const c = CFG.CARPETAS_DRIVE || {};
  const idDirecto = c[tipo];
  if (idDirecto) return DriveApp.getFolderById(idDirecto);

  const base = DriveApp.getFolderById(c.ENTREGADO);
  if (tipo === 'ENTREGADO') return base;

  const it = base.getFoldersByName(tipo);
  if (it.hasNext()) return it.next();
  const nueva = base.createFolder(tipo);
  _log('SISTEMA', 'CARPETA_CREADA', tipo + ' → ' + nueva.getId());
  return nueva;
}

/**
 * Guarda una imagen dataURL en la carpeta que le toca, con el ID como nombre.
 * Si ya había un archivo con ese ID ahí, el viejo se va a la papelera,
 * para que siempre haya UNO SOLO por pedido.
 */
function _guardarEvidencia(dataUrl, id, tipo) {
  const partes = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!partes) return '';
  const mime = partes[1];
  let nombre = _nombreArchivo(id, mime);
  if (tipo === 'FIRMAS') {
    const suf = String(_cfgHoja('SUFIJO_FIRMA', ' FIRMA'));
    nombre = _nombreArchivo(String(id).trim() + suf, mime);
  }

  const intentos = [tipo];
  if (tipo !== 'ENTREGADO' && tipo !== 'FIRMAS') intentos.push('ENTREGADO');

  let ultimoError = '';
  for (let i = 0; i < intentos.length; i++) {
    try {
      const carpeta = _carpetaDestino(intentos[i]);
      const nom = (i === 0) ? nombre : (nombre + ' (' + tipo + ')');

      if (CFG.REEMPLAZAR_SI_EXISTE !== false) {
        const viejos = carpeta.getFilesByName(nom);
        while (viejos.hasNext()) viejos.next().setTrashed(true);
      }

      const blob = Utilities.newBlob(Utilities.base64Decode(partes[2]), mime, nom);
      const archivo = carpeta.createFile(blob);
      archivo.setDescription('Pedido ' + id + ' | ' + tipo + ' | ' + _ahora());

      if (i > 0) {
        _log('SISTEMA', 'DRIVE_RESPALDO',
             tipo + ' no aceptó escritura; ' + id + ' se guardó en ENTREGADO. ' + ultimoError);
      }
      return archivo.getUrl();

    } catch (e) {
      ultimoError = e.message;
      _log('SISTEMA', 'ERROR_DRIVE', id + ' ' + intentos[i] + ' :: ' + e.message);
    }
  }

  return 'SIN GUARDAR (' + tipo + '): ' + ultimoError;
}


/* ===================================================================
 *  6. TRASPASOS DE SUCURSALES
 * =================================================================== */

function apiSucursales() {
  try {
    const sh = _hoja(CFG.H.SUCURSALES);
    if (sh.getLastRow() < 2) return _ok([]);
    const lista = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
      .filter(function (f) { return f[0] && f[3] !== false; })
      .map(function (f) { return { nombre: String(f[0]), direccion: String(f[1] || ''), maps: String(f[2] || '') }; });
    return _ok(lista);
  } catch (e) { return _err(e.message); }
}


/** Busca un folio en el catálogo opcional (el export del Excel). */
function _buscarCatalogoTraspaso(folio) {
  try {
    const sh = _hoja(CFG.H.CAT_TRAS);
    if (sh.getLastRow() < 2) return null;
    const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    const f = _normCodigo(folio);
    for (let i = 0; i < datos.length; i++) {
      if (_normCodigo(datos[i][0]) === f) {
        return {
          origen:    String(datos[i][1] || ''),
          destino:   String(datos[i][2] || ''),
          area:      String(datos[i][3] || ''),
          contenido: String(datos[i][4] || '')
        };
      }
    }
  } catch (e) { }
  return null;
}


/**
 * RECOLECTAR — modo ráfaga.
 * Recibe un arreglo de folios escaneados y los guarda de golpe.
 * Devuelve el resultado de cada uno para que la app pinte la palomita.
 */
function apiRecolectarTraspasos(token, folios) {
  const lock = LockService.getScriptLock();
  let guardados = [];
  let gestor = '', vehiculo = '';
  try {
    const s = _exigirSesion(token);
    if (!s.vehiculo) return _err('Primero selecciona el vehículo que estás usando.');
    if (!folios || !folios.length) return _err('No recibí folios.');
    gestor = s.gestor; vehiculo = s.vehiculo;

    if (!lock.tryLock(20000)) return _err('El servidor está ocupado. Intenta de nuevo en un momento.');

    const sh = _hoja(CFG.H.TRASPASOS, true);
    const existentes = {};
    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues().forEach(function (f) {
        if (f[0] && _norm(f[8]) !== 'entregado' && _norm(f[8]) !== 'no entregado') {
          existentes[_normCodigo(f[0])] = true;
        }
      });
    }

    const nuevas = [];
    const hist = [];
    const resultados = [];
    const yaEnEsteLote = {};

    folios.forEach(function (raw) {
      const folio = String(raw || '').trim();
      const k = _normCodigo(folio);
      if (!k) { resultados.push({ folio: folio, ok: false, msg: 'Folio vacío' }); return; }
      if (existentes[k] || yaEnEsteLote[k]) {
        resultados.push({ folio: folio, ok: false, msg: 'Ya estaba recolectado' });
        return;
      }
      yaEnEsteLote[k] = true;

      let cat = null;
      try { if (typeof _tnBuscar === 'function') cat = _tnBuscar(folio); } catch (e) { cat = null; }
      cat = cat || _buscarCatalogoTraspaso(folio) || { origen: '', destino: '', area: '', contenido: '' };
      nuevas.push([folio, _ahora(), s.gestor, s.vehiculo, cat.origen, cat.destino,
                   cat.area, cat.contenido, 'POR ENTREGAR', '']);
      hist.push([_ahora(), folio, s.gestor, s.vehiculo, 'RECOLECTADO', cat.origen, cat.destino,
                 cat.area, cat.contenido, '', '', '', '', '', '']);
      resultados.push({ folio: folio, ok: true, msg: 'Recolectado', destino: cat.destino });
    });

    if (nuevas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, 10).setValues(nuevas);
      const shH = _hoja(CFG.H.TRAS_HIST, true);
      shH.getRange(shH.getLastRow() + 1, 1, hist.length, 15).setValues(hist);
      guardados = nuevas.map(function (n) { return n[0]; });
    }

    try { lock.releaseLock(); } catch (e) { }

    // Avisar al sistema de traspasos de sucursales, ya sin el candado puesto
    if (guardados.length) {
      try { if (typeof _tnRecolectados === 'function') _tnRecolectados(guardados, gestor, vehiculo); } catch (e) { }
    }

    _log(s.gestor, 'RECOLECTAR_TRASPASOS', nuevas.length + ' de ' + folios.length);
    _cacheBorrar('cont_' + _norm(s.gestor));   // cambió el conteo de traspasos
    return _ok({ resultados: resultados, guardados: nuevas.length });

  } catch (e) {
    return _err(e.message);
  } finally {
    try { lock.releaseLock(); } catch (e) { }
  }
}


/** Traspasos que ese gestor trae cargados y aún no entrega. */
function _traspasosPendientes(gestor) {
  const sh = _hoja(CFG.H.TRASPASOS);
  if (sh.getLastRow() < 2) return [];
  const g = _norm(gestor);
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
  const out = [];
  for (let i = 0; i < datos.length; i++) {
    const f = datos[i];
    if (!f[0]) continue;
    if (_norm(f[2]) !== g) continue;
    if (_norm(f[8]) !== 'por entregar') continue;
    out.push({
      folio: String(f[0]), fila: i + 2, fecha: String(f[1] || ''),
      gestor: String(f[2]), vehiculo: String(f[3] || ''),
      origen: String(f[4] || ''), destino: String(f[5] || ''),
      area: String(f[6] || ''), contenido: String(f[7] || '')
    });
  }
  return out;
}

function apiTraspasosPendientes(token) {
  try {
    const s = _exigirSesion(token);
    return _ok(_traspasosPendientes(s.gestor));
  } catch (e) { return _err(e.message); }
}


/** Permite corregir/completar datos de un traspaso antes de entregarlo. */
function apiActualizarTraspaso(token, p) {
  try {
    const s = _exigirSesion(token);
    const sh = _hoja(CFG.H.TRASPASOS);
    const fila = _filaTraspaso(sh, p.folio, s.gestor);
    if (fila < 0) return _err('No encontré ese folio entre tus traspasos.');
    if (p.origen    != null) sh.getRange(fila, 5).setValue(String(p.origen));
    if (p.destino   != null) sh.getRange(fila, 6).setValue(String(p.destino));
    if (p.area      != null) sh.getRange(fila, 7).setValue(String(p.area));
    if (p.contenido != null) sh.getRange(fila, 8).setValue(String(p.contenido));
    _log(s.gestor, 'EDITA_TRASPASO', p.folio);
    return _ok();
  } catch (e) { return _err(e.message); }
}

function _filaTraspaso(sh, folio, gestor) {
  if (sh.getLastRow() < 2) return -1;
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  const f = _normCodigo(folio), g = _norm(gestor);
  for (let i = 0; i < datos.length; i++) {
    if (_normCodigo(datos[i][0]) === f && _norm(datos[i][2]) === g && _norm(datos[i][8]) === 'por entregar') {
      return i + 2;
    }
  }
  return -1;
}


/**
 * Cierra un traspaso. p = {
 *   folio, resultado:'ENTREGADO'|'NO_ENTREGADO', motivo, comentario,
 *   foto, destino, lat, lng
 * }
 */
function apiCerrarTraspaso(token, p) {
  try {
    const s = _exigirSesion(token);
    if (!s.vehiculo) return _err('Primero selecciona el vehículo que estás usando.');
    if (!p || !p.folio) return _err('Falta el folio.');

    const entregado = String(p.resultado) === 'ENTREGADO';
    if (entregado) {
      if (!p.destino) return _err('Selecciona la sucursal destino.');
      if (_cfgHoja('EXIGIR_FOTO_TRASPASO', true) !== false && !p.foto) return _err('Falta la foto de la entrega.');
    } else {
      if (!p.motivo) return _err('Selecciona el motivo.');
      if (_norm(p.motivo) === 'otro' && !String(p.comentario || '').trim()) {
        return _err('Escribe qué pasó.');
      }
    }

    // Revisión rápida antes de subir la foto (abajo se confirma con candado)
    if (_filaTraspaso(_hoja(CFG.H.TRASPASOS), p.folio, s.gestor) < 0) {
      return _err('Ese folio ya no está en tu lista de pendientes.');
    }

    // La foto se sube FUERA del candado (es lo más lento)
    const url = p.foto ? _guardarEvidencia(p.foto, p.folio, 'TRASPASOS') : '';

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return _err('El servidor está ocupado. Intenta de nuevo en un momento.');
    try {
      const sh = _hoja(CFG.H.TRASPASOS);
      const fila = _filaTraspaso(sh, p.folio, s.gestor);
      if (fila < 0) return _err('Ese folio ya no está en tu lista de pendientes.');

      const actual = sh.getRange(fila, 1, 1, 10).getValues()[0];
      if (p.destino) sh.getRange(fila, 6).setValue(String(p.destino));
      sh.getRange(fila, 9).setValue(entregado ? 'ENTREGADO' : 'NO ENTREGADO');

      _hoja(CFG.H.TRAS_HIST, true).appendRow([
        _ahora(), p.folio, s.gestor, s.vehiculo,
        entregado ? 'ENTREGADO' : 'NO ENTREGADO',
        String(actual[4] || ''), String(p.destino || actual[5] || ''),
        String(actual[6] || ''), String(actual[7] || ''),
        entregado ? 'ENTREGADO' : 'NO ENTREGADO',
        String(p.motivo || ''), String(p.comentario || ''),
        url, p.lat || '', p.lng || ''
      ]);
    } finally {
      try { lock.releaseLock(); } catch (e) { }
    }

    // Avisar al sistema de traspasos de sucursales, ya sin el candado puesto
    try {
      if (typeof _tnCierreGestor === 'function') {
        _tnCierreGestor(p.folio, s.gestor, entregado, url, p.motivo, p.comentario);
      }
    } catch (e) { }

    _log(s.gestor, entregado ? 'TRASPASO_ENTREGADO' : 'TRASPASO_NO_ENTREGADO',
         p.folio + ' ' + (p.motivo || ''));
    _cacheBorrar('cont_' + _norm(s.gestor));   // el conteo cambió: refréscalo ya
    return _ok({ folio: p.folio, foto: url });

  } catch (e) {
    return _err(e.message);
  }
}


/* ===================================================================
 *  7. HISTORIAL (búsqueda inteligente por ID)
 * =================================================================== */

/**
 * tipo: 'PEDIDOS' | 'TRASPASOS'
 * q: texto libre (ID, cliente, dirección, folio, motivo…)
 * soloMios: true = solo los de este gestor
 */
function apiHistorial(token, tipo, q, soloMios, limite) {
  try {
    const s = _exigirSesion(token);
    const busca = _norm(q);
    const max = limite || 200;

    if (String(tipo).toUpperCase() === 'TRASPASOS') {
      const sh = _hoja(CFG.H.TRAS_HIST);
      if (sh.getLastRow() < 2) return _ok([]);
      const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues();
      const out = [];
      for (let i = datos.length - 1; i >= 0 && out.length < max; i--) {
        const f = datos[i];
        if (soloMios !== false && _norm(f[2]) !== _norm(s.gestor)) continue;
        const blob = _norm([f[1], f[5], f[6], f[7], f[8], f[9], f[10], f[11]].join(' '));
        if (busca && blob.indexOf(busca) < 0) continue;
        out.push({
          fechaHora: String(f[0]), id: String(f[1]), gestor: String(f[2]), vehiculo: String(f[3]),
          evento: String(f[4]), origen: String(f[5]), destino: String(f[6]),
          area: String(f[7]), contenido: String(f[8]), resultado: String(f[9]),
          motivo: String(f[10]), comentario: String(f[11]), foto: String(f[12]), firma: ''
        });
      }
      return _ok(out);
    }

    const sh = _hoja(CFG.H.ENTREGAS);
    if (sh.getLastRow() < 2) return _ok([]);
    const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 17).getValues();
    const out = [];
    for (let i = datos.length - 1; i >= 0 && out.length < max; i--) {
      const f = datos[i];
      if (soloMios !== false && _norm(f[2]) !== _norm(s.gestor)) continue;
      const blob = _norm([f[1], f[4], f[5], f[6], f[7], f[8], f[9], f[15], f[16]].join(' '));
      if (busca && blob.indexOf(busca) < 0) continue;
      out.push({
        fechaHora: String(f[0]), id: String(f[1]), gestor: String(f[2]), vehiculo: String(f[3]),
        resultado: String(f[4]), motivo: String(f[5]), cliente: String(f[6]),
        direccion: String(f[7]), notas: String(f[8]), area: String(f[9]), subarea: String(f[10]),
        foto: String(f[11]), firma: String(f[12]),
        lat: String(f[13]), lng: String(f[14]), comentario: String(f[15]),
        recibio: String(f[16] || '')
      });
    }
    return _ok(out);
  } catch (e) { return _err(e.message); }
}


/* ===================================================================
 *  8. CONTROL DE USO DE VEHÍCULOS (módulo 6)
 * =================================================================== */

function apiUsoVehiculos(token) {
  try {
    const s = _exigirSesion(token);
    const sh = _hoja(CFG.H.USO_VEH);
    const out = [];
    if (sh.getLastRow() > 1) {
      const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
      for (let i = datos.length - 1; i >= 0 && out.length < 60; i--) {
        if (_norm(datos[i][1]) !== _norm(s.gestor)) continue;
        out.push({
          fechaHora: String(datos[i][0]), anterior: String(datos[i][2]),
          nuevo: String(datos[i][3]), motivo: String(datos[i][4])
        });
      }
    }

    // resumen: cuántos pedidos/traspasos cerró con cada vehículo hoy
    const hoy = _hoyISO();
    const resumen = {};
    const shE = _hoja(CFG.H.ENTREGAS);
    if (shE.getLastRow() > 1) {
      shE.getRange(2, 1, shE.getLastRow() - 1, 4).getValues().forEach(function (f) {
        if (_norm(f[2]) !== _norm(s.gestor)) return;
        if (String(f[0]).substring(0, 10) !== hoy) return;
        const v = String(f[3] || '(sin vehículo)');
        resumen[v] = resumen[v] || { pedidos: 0, traspasos: 0 };
        resumen[v].pedidos++;
      });
    }
    const shT = _hoja(CFG.H.TRAS_HIST);
    if (shT.getLastRow() > 1) {
      shT.getRange(2, 1, shT.getLastRow() - 1, 5).getValues().forEach(function (f) {
        if (_norm(f[2]) !== _norm(s.gestor)) return;
        if (String(f[0]).substring(0, 10) !== hoy) return;
        if (_norm(f[4]) === 'recolectado') return;
        const v = String(f[3] || '(sin vehículo)');
        resumen[v] = resumen[v] || { pedidos: 0, traspasos: 0 };
        resumen[v].traspasos++;
      });
    }

    return _ok({ actual: s.vehiculo, cambios: out, resumenHoy: resumen });
  } catch (e) { return _err(e.message); }
}
