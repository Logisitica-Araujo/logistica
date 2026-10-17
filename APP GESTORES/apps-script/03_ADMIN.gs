/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  ARCHIVO 4 de 6
 * 03_ADMIN.gs
 * ---------------------------------------------------------------------
 * LA PUERTA TRASERA. Solo tú.
 * Se entra tocando 5 veces el título en la pantalla de login y metiendo
 * la CLAVE_ADMIN que definiste en 00_CONFIG.gs.
 *
 * Desde ahí puedes, SIN TOCAR CÓDIGO:
 *   • prender/apagar cualquiera de los 7 módulos
 *   • agregar, editar o desactivar gestores, vehículos, sucursales y motivos
 *   • cambiar los candados y las reglas (foto obligatoria, firma, GPS…)
 *   • liberar el candado de vehículo de un gestor
 *   • cerrar sesiones, bloquear la app entera
 *   • ver la bitácora de todo lo que pasó
 ***********************************************************************/

/** Control de intentos: 5 fallos bloquean 15 minutos. */
function _adminPuedeIntentar() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('admin_fallos') || 0);
  return n < 5;
}
function _adminFallo() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('admin_fallos') || 0) + 1;
  cache.put('admin_fallos', String(n), 900);
}
function _adminExito() { CacheService.getScriptCache().remove('admin_fallos'); }

function _esAdmin(clave) {
  if (!_adminPuedeIntentar()) throw new Error('Demasiados intentos. Espera 15 minutos.');
  const ok = String(clave || '') === String(CFG.CLAVE_ADMIN);
  if (!ok) {
    _adminFallo();
    _log('?', 'ADMIN_FALLIDO', '');
    throw new Error('Clave incorrecta.');
  }
  _adminExito();
  return true;
}


/** Entrada única del panel. accion + datos. */
function apiAdmin(clave, accion, datos) {
  try {
    _esAdmin(clave);
    datos = datos || {};
    _log('ADMIN', 'PANEL:' + accion, JSON.stringify(datos).substring(0, 300));

    switch (String(accion)) {

      /* ---------- Tablero ---------- */
      case 'resumen': return _ok(_adminResumen());

      /* ---------- Leer / escribir cualquier catálogo ---------- */
      // tabla: USUARIOS | VEHICULOS | SUCURSALES | MOTIVOS | CONFIG | CAT_TRAS
      case 'leerTabla':    return _ok(_adminLeerTabla(datos.tabla));
      case 'guardarTabla': return _ok(_adminGuardarTabla(datos.tabla, datos.filas));
      case 'agregarFila':  return _ok(_adminAgregarFila(datos.tabla, datos.fila));
      case 'borrarFila':   return _ok(_adminBorrarFila(datos.tabla, datos.indice));

      /* ---------- Módulos del menú ---------- */
      case 'modulos':        return _ok(_adminModulos());
      case 'guardarModulos': return _ok(_adminGuardarModulos(datos.modulos));

      /* ---------- Operación ---------- */
      case 'liberarCandado':  return _ok(_adminLiberarCandado(datos.gestor));
      case 'cerrarSesiones':  return _ok(_adminCerrarSesiones(datos.gestor));
      case 'sesiones':        return _ok(_adminSesiones());
      case 'bloquearApp':     _setCfgHoja('APP_BLOQUEADA', datos.valor === true);
                              if (datos.mensaje) _setCfgHoja('MENSAJE_BLOQUEO', datos.mensaje);
                              return _ok({ bloqueada: datos.valor === true });

      /* ---------- Devolver un pedido a pendientes ---------- */
      case 'reabrirPedido':   return _ok(_adminReabrirPedido(datos.id));
      case 'reabrirTraspaso': return _ok(_adminReabrirTraspaso(datos.folio));

      /* ---------- Bitácora y diagnóstico ---------- */
      case 'bitacora':    return _ok(_adminBitacora(datos.limite || 200));
      case 'diagnostico': return _ok(diagnostico());
      case 'sincronizar': return _ok(sincronizarCatalogos(true));
      case 'instalar':    return _ok(instalar());

      /* ---------- Historial global (todos los gestores) ---------- */
      case 'historialGlobal':
        return _ok(_adminHistorialGlobal(datos.tipo, datos.q, datos.limite || 300));

      default: return _err('Acción desconocida: ' + accion);
    }
  } catch (e) { return _err(e.message); }
}


/* ==================== IMPLEMENTACIONES ==================== */

function _tablaHoja(tabla) {
  const mapa = {
    USUARIOS:   CFG.H.USUARIOS,
    VEHICULOS:  CFG.H.VEHICULOS,
    SUCURSALES: CFG.H.SUCURSALES,
    MOTIVOS:    CFG.H.MOTIVOS,
    CONFIG:     CFG.H.CONFIG,
    CAT_TRAS:   CFG.H.CAT_TRAS
  };
  const nombre = mapa[String(tabla).toUpperCase()];
  if (!nombre) throw new Error('Tabla no permitida: ' + tabla);
  return _hoja(nombre, true);
}

function _adminLeerTabla(tabla) {
  const sh = _tablaHoja(tabla);
  const nCols = Math.max(1, sh.getLastColumn());
  const enc = sh.getRange(1, 1, 1, nCols).getValues()[0];
  const filas = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, nCols).getValues()
        .filter(function (f) { return f.join('').trim() !== ''; })
        .map(function (f) { return f.map(function (v) { return v instanceof Date ? _fechaTexto(v) : v; }); })
    : [];
  return { hoja: sh.getName(), encabezados: enc, filas: filas };
}

function _adminGuardarTabla(tabla, filas) {
  const sh = _tablaHoja(tabla);
  const nCols = Math.max(1, sh.getLastColumn());
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, nCols).clearContent();
  const limpias = (filas || []).filter(function (f) { return f.join('').trim() !== ''; });
  if (limpias.length) {
    const norm = limpias.map(function (f) {
      const r = f.slice(0, nCols);
      while (r.length < nCols) r.push('');
      return r;
    });
    sh.getRange(2, 1, norm.length, nCols).setValues(norm);
  }
  return { guardadas: limpias.length };
}

function _adminAgregarFila(tabla, fila) {
  const sh = _tablaHoja(tabla);
  sh.appendRow(fila || []);
  return { filas: sh.getLastRow() - 1 };
}

function _adminBorrarFila(tabla, indice) {
  const sh = _tablaHoja(tabla);
  const fila = Number(indice) + 2;           // indice 0-based sobre los datos
  if (fila < 2 || fila > sh.getLastRow()) throw new Error('Fila fuera de rango.');
  sh.deleteRow(fila);
  return { filas: Math.max(0, sh.getLastRow() - 1) };
}


/* ---------- Módulos (los 7 iconos) ---------- */
function _adminModulos() {
  return _modulosVigentes();
}

function _adminGuardarModulos(modulos) {
  if (!modulos || !modulos.length) throw new Error('Lista de módulos vacía.');
  _setCfgHoja('MODULOS_JSON', JSON.stringify(modulos));
  return { guardados: modulos.length };
}


/* ---------- Operación ---------- */
function _adminSesiones() {
  const sh = _hoja(CFG.H.SESIONES, true);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      return {
        token: String(f[0]).substring(0, 6) + '…',
        gestor: String(f[1]), vehiculo: String(f[2] || ''),
        inicio: String(f[3] || ''), ultimoCambioVeh: String(f[4] || ''),
        activa: f[5] !== false
      };
    })
    .reverse().slice(0, 100);
}

function _adminLiberarCandado(gestor) {
  const sh = _hoja(CFG.H.SESIONES, true);
  if (sh.getLastRow() < 2) return { liberados: 0 };
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  let n = 0;
  for (let i = 0; i < datos.length; i++) {
    if (!gestor || _norm(datos[i][1]) === _norm(gestor)) {
      if (datos[i][5] !== false) { sh.getRange(i + 2, 5).setValue(''); n++; }
    }
  }
  return { liberados: n };
}

function _adminCerrarSesiones(gestor) {
  const sh = _hoja(CFG.H.SESIONES, true);
  if (sh.getLastRow() < 2) return { cerradas: 0 };
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  let n = 0;
  for (let i = 0; i < datos.length; i++) {
    if (!gestor || _norm(datos[i][1]) === _norm(gestor)) {
      if (datos[i][5] !== false) { sh.getRange(i + 2, 6).setValue(false); n++; }
    }
  }
  return { cerradas: n };
}


/* ---------- Reabrir ---------- */
function _adminReabrirPedido(id) {
  const sh = _hoja(CFG.H.ENTREGAS);
  if (sh.getLastRow() < 2) throw new Error('No hay entregas registradas.');
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const objetivo = _norm(id);
  for (let i = datos.length - 1; i >= 0; i--) {
    if (_norm(datos[i][1]) === objetivo) {
      sh.deleteRow(i + 2);
      _limpiarEnOperaciones(id);
      return { reabierto: id };
    }
  }
  throw new Error('No encontré el pedido ' + id + ' en el historial.');
}

/** Borra en "Operaciones" lo que la app había escrito para ese pedido. */
function _limpiarEnOperaciones(id) {
  const cfg = CFG.ESCRIBIR_EN_OPERACIONES || {};
  if (cfg.activo === false) return;
  try {
    const t = _abrirTabla(CFG.HOJA_OPERACIONES, CFG.COL_OPERACIONES, CFG.FILA_ENC_OPERACIONES);
    if (t.mapa.id < 0) return;
    const objetivo = _norm(id);
    let fila = -1;
    for (let i = 0; i < t.datos.length; i++) {
      if (_norm(t.datos[i][t.mapa.id]) === objetivo) { fila = t.filaPrimerDato + i; break; }
    }
    if (fila < 0) return;

    const refs = [];
    ['ENTREGADO', 'CANCELADO', 'RETORNO'].forEach(function (r) {
      const b = cfg[r] || {};
      if (b.fecha) refs.push({ ref: b.fecha, valor: '' });
      if (b.check) refs.push({ ref: b.check, valor: false });
    });
    ['gps', 'foto', 'firma', 'motivo', 'comentario'].forEach(function (k) {
      if (cfg[k]) refs.push({ ref: cfg[k], valor: '' });
    });

    refs.forEach(function (x) {
      const c = _idxCol(t.enc, x.ref);
      if (c >= 0) t.sh.getRange(fila, c + 1).setValue(x.valor);
    });
  } catch (e) { _log('ADMIN', 'ERROR_LIMPIAR_OPS', id + ' ' + e.message); }
}

function _adminReabrirTraspaso(folio) {
  const sh = _hoja(CFG.H.TRASPASOS);
  if (sh.getLastRow() < 2) throw new Error('No hay traspasos.');
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  const f = _normCodigo(folio);
  for (let i = datos.length - 1; i >= 0; i--) {
    if (_normCodigo(datos[i][0]) === f) {
      sh.getRange(i + 2, 9).setValue('POR ENTREGAR');
      return { reabierto: folio };
    }
  }
  throw new Error('No encontré el folio ' + folio + '.');
}


/* ---------- Bitácora y resumen ---------- */
function _adminBitacora(limite) {
  const sh = _hoja(CFG.H.LOG, true);
  if (sh.getLastRow() < 2) return [];
  const n = Math.min(limite, sh.getLastRow() - 1);
  return sh.getRange(sh.getLastRow() - n + 1, 1, n, 4).getValues()
    .reverse()
    .map(function (f) {
      return { fechaHora: String(f[0]), gestor: String(f[1]), accion: String(f[2]), detalle: String(f[3]) };
    });
}

function _adminResumen() {
  const hoy = _hoyISO();
  const r = { fecha: hoy, entregados: 0, noEntregados: 0, traspasosEntregados: 0,
              traspasosRecolectados: 0, traspasosEnRuta: 0, gestoresActivos: 0, porGestor: {} };

  const shE = _hoja(CFG.H.ENTREGAS, true);
  if (shE.getLastRow() > 1) {
    shE.getRange(2, 1, shE.getLastRow() - 1, 5).getValues().forEach(function (f) {
      if (String(f[0]).substring(0, 10) !== hoy) return;
      const g = String(f[2] || '-');
      r.porGestor[g] = r.porGestor[g] || { entregados: 0, noEntregados: 0, traspasos: 0 };
      if (_norm(f[4]) === 'entregado') { r.entregados++; r.porGestor[g].entregados++; }
      else { r.noEntregados++; r.porGestor[g].noEntregados++; }
    });
  }

  const shT = _hoja(CFG.H.TRAS_HIST, true);
  if (shT.getLastRow() > 1) {
    shT.getRange(2, 1, shT.getLastRow() - 1, 5).getValues().forEach(function (f) {
      if (String(f[0]).substring(0, 10) !== hoy) return;
      const g = String(f[2] || '-');
      r.porGestor[g] = r.porGestor[g] || { entregados: 0, noEntregados: 0, traspasos: 0 };
      if (_norm(f[4]) === 'recolectado') r.traspasosRecolectados++;
      else { r.traspasosEntregados++; r.porGestor[g].traspasos++; }
    });
  }

  const shP = _hoja(CFG.H.TRASPASOS, true);
  if (shP.getLastRow() > 1) {
    shP.getRange(2, 9, shP.getLastRow() - 1, 1).getValues().forEach(function (f) {
      if (_norm(f[0]) === 'por entregar') r.traspasosEnRuta++;
    });
  }

  const shS = _hoja(CFG.H.SESIONES, true);
  if (shS.getLastRow() > 1) {
    const vistos = {};
    shS.getRange(2, 1, shS.getLastRow() - 1, 6).getValues().forEach(function (f) {
      if (f[5] !== false && f[1]) vistos[_norm(f[1])] = true;
    });
    r.gestoresActivos = Object.keys(vistos).length;
  }

  r.appBloqueada = _cfgHoja('APP_BLOQUEADA', false) === true;
  return r;
}

function _adminHistorialGlobal(tipo, q, limite) {
  const busca = _norm(q);
  if (String(tipo).toUpperCase() === 'TRASPASOS') {
    const sh = _hoja(CFG.H.TRAS_HIST, true);
    if (sh.getLastRow() < 2) return [];
    const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues();
    const out = [];
    for (let i = datos.length - 1; i >= 0 && out.length < limite; i--) {
      const f = datos[i];
      if (busca && _norm(f.join(' ')).indexOf(busca) < 0) continue;
      out.push({ fechaHora: String(f[0]), id: String(f[1]), gestor: String(f[2]), vehiculo: String(f[3]),
                 evento: String(f[4]), origen: String(f[5]), destino: String(f[6]),
                 contenido: String(f[8]), resultado: String(f[9]), motivo: String(f[10]),
                 comentario: String(f[11]), foto: String(f[12]) });
    }
    return out;
  }
  const sh = _hoja(CFG.H.ENTREGAS, true);
  if (sh.getLastRow() < 2) return [];
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 16).getValues();
  const out = [];
  for (let i = datos.length - 1; i >= 0 && out.length < limite; i--) {
    const f = datos[i];
    if (busca && _norm(f.join(' ')).indexOf(busca) < 0) continue;
    out.push({ fechaHora: String(f[0]), id: String(f[1]), gestor: String(f[2]), vehiculo: String(f[3]),
               resultado: String(f[4]), motivo: String(f[5]), cliente: String(f[6]),
               direccion: String(f[7]), notas: String(f[8]), foto: String(f[11]), firma: String(f[12]),
               comentario: String(f[15]) });
  }
  return out;
}


/* ===================================================================
 *  NOTIFICACIÓN POR CORREO (opcional)
 *  Se activa poniendo NOTIFICAR_POR_CORREO = TRUE en APP_Config
 *  y creando un activador de tiempo cada 15 min sobre revisarPedidosNuevos.
 * =================================================================== */
function revisarPedidosNuevos() {
  if (_cfgHoja('NOTIFICAR_POR_CORREO', false) !== true) return;

  const props = PropertiesService.getScriptProperties();
  const yaAvisados = JSON.parse(props.getProperty('avisados') || '{}');

  const shU = _hoja(CFG.H.USUARIOS, true);
  if (shU.getLastRow() < 2) return;
  const usuarios = shU.getRange(2, 1, shU.getLastRow() - 1, 4).getValues();

  usuarios.forEach(function (u) {
    const gestor = String(u[0] || ''), correo = String(u[2] || '').trim();
    if (!gestor || !correo || u[3] === false) return;

    const pend = _leerPendientes(gestor);
    const nuevos = pend.filter(function (p) { return !yaAvisados[p.id]; });
    if (!nuevos.length) return;

    try {
      MailApp.sendEmail({
        to: correo,
        subject: '🚚 Tienes ' + nuevos.length + ' pedido(s) nuevo(s) — ' + CFG.NOMBRE_APP,
        htmlBody:
          '<p>Hola <b>' + gestor + '</b>, se te asignaron ' + nuevos.length + ' pedido(s):</p><ul>' +
          nuevos.map(function (p) {
            return '<li><b>' + p.id + '</b> — ' + p.cliente + '<br><small>' + p.direccion + '</small></li>';
          }).join('') +
          '</ul><p>Abre la app para cerrarlos.</p>'
      });
      nuevos.forEach(function (p) { yaAvisados[p.id] = Date.now(); });
    } catch (e) { _log('SISTEMA', 'ERROR_CORREO', correo + ' ' + e.message); }
  });

  // limpia avisos de más de 7 días
  const corte = Date.now() - 7 * 86400000;
  Object.keys(yaAvisados).forEach(function (k) { if (yaAvisados[k] < corte) delete yaAvisados[k]; });
  props.setProperty('avisados', JSON.stringify(yaAvisados));
}
