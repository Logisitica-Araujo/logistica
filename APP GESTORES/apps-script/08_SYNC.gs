/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  08_SYNC.gs   (VERSIÓN 3.0)
 * ---------------------------------------------------------------------
 * EL ROBOT: cada minuto lee "Operaciones" UNA sola vez, en segundo plano,
 * y copia SOLO los pedidos pendientes a la hoja chica APP_Pedidos, que es
 * la que lee la app.
 *
 * CAMBIOS DE LA 3.0:
 *  • YA NO BLOQUEA A LOS GESTORES. Antes leía "Operaciones" con el candado
 *    general puesto: mientras leía, nadie podía cerrar pedidos ni
 *    recolectar. Ahora lee sin candado y solo lo usa un instante al final.
 *  • SOLO ESCRIBE SI ALGO CAMBIÓ. Antes borraba y reescribía APP_Pedidos
 *    cada minuto aunque todo estuviera igual.
 *  • ESCRIBE LOS CIERRES EN "Operaciones". Antes lo hacía el gestor al
 *    cerrar, esperando con el candado puesto. Ahora el gestor cierra en
 *    segundos y el robot lo pasa a "Operaciones" en el siguiente minuto.
 *  • HORARIO. Fuera de SYNC_HORARIO (APP_Config, por defecto 6-22) no
 *    corre: ahorra la cuota diaria de Google, que este robot gastaba de
 *    noche sin que nadie lo usara.
 *
 * QUÉ TOCA / QUÉ NO
 *   • Lee "Operaciones" y escribe en ella SOLO las columnas de
 *     ESCRIBIR_EN_OPERACIONES (00_CONFIG). NUNCA toca ESTATUS.
 *   • No toca "Cat", ni Drive, ni tus Bots.
 *
 * INSTALACIÓN (una sola vez, desde el editor):
 *   Lista junto a "▷ Ejecutar"  →  elige  instalarSyncPedidos  →  ▷ Ejecutar
 *   (Si ya lo habías instalado, NO hace falta volver a correrlo.)
 ***********************************************************************/

/* Nombre de la hoja chica. Si algún día quieres cambiarlo, aquí es. */
var SYNC_HOJA_PEDIDOS = 'APP_Pedidos';

/* Encabezados de la hoja chica (en este orden). */
var SYNC_ENCABEZADOS = ['ID', 'Gestor', 'Cliente', 'Direccion', 'Notas',
                        'Area', 'SubArea', 'Fecha', 'Estatus', 'FilaOps',
                        'Actualizado'];

/* Cuántos cierres pasa a "Operaciones" en cada vuelta, como máximo. */
var SYNC_CIERRES_POR_VUELTA = 40;


/* ===================================================================
 *  INSTALADOR — córrelo UNA vez desde el editor
 * =================================================================== */
function instalarSyncPedidos() {
  var ss = _libro();

  /* 1) Crear/asegurar la hoja chica con sus encabezados */
  var sh = ss.getSheetByName(SYNC_HOJA_PEDIDOS);
  if (!sh) sh = ss.insertSheet(SYNC_HOJA_PEDIDOS);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, SYNC_ENCABEZADOS.length).setValues([SYNC_ENCABEZADOS]);
    sh.setFrozenRows(1);
  }

  /* 2) Borrar robots viejos de este mismo trabajo (para no duplicar) */
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarPedidos') ScriptApp.deleteTrigger(t);
  });

  /* 3) Programar el robot cada 1 minuto */
  ScriptApp.newTrigger('sincronizarPedidos').timeBased().everyMinutes(1).create();
  try { CacheService.getScriptCache().remove('robot_ok'); } catch (e) { }

  /* 4) Llenarla ya, de una vez, para no esperar al primer minuto */
  var n = sincronizarPedidos(true);

  try {
    SpreadsheetApp.getUi().alert(
      'Robot de pedidos instalado.\n\n' +
      '• Hoja creada: ' + SYNC_HOJA_PEDIDOS + '\n' +
      '• Se actualizará sola cada 1 minuto (en horario ' + _horarioRobotTexto() + ').\n' +
      '• Pendientes cargados ahora: ' + n
    );
  } catch (e) {}
  return n;
}


/** Quita el robot (por si alguna vez quieres apagarlo). */
function desinstalarSyncPedidos() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarPedidos') ScriptApp.deleteTrigger(t);
  });
  try { CacheService.getScriptCache().remove('robot_ok'); } catch (e) { }
}


/* ---- Horario del robot ---- */
function _horarioRobot() {
  var txt = String(_cfgHoja('SYNC_HORARIO', '6-22'));
  var m = txt.match(/(\d{1,2})\D+(\d{1,2})/);
  if (!m) return { desde: 0, hasta: 24 };
  return { desde: Number(m[1]), hasta: Number(m[2]) };
}
function _horarioRobotTexto() {
  var h = _horarioRobot();
  return h.desde + ':00 a ' + h.hasta + ':00';
}
function _enHorarioRobot() {
  var h = _horarioRobot();
  var hora = Number(Utilities.formatDate(new Date(), 'America/Mexico_City', 'H'));
  return hora >= h.desde && hora < h.hasta;
}


/* ===================================================================
 *  EL ROBOT — lo corre el disparador cada minuto
 * -------------------------------------------------------------------
 *  forzar = true → corre aunque esté fuera de horario (instalador).
 *  Devuelve cuántos pendientes hay (o -1 si no pudo, -2 si no le tocaba).
 * =================================================================== */
function sincronizarPedidos(forzar) {
  forzar = (forzar === true);
  var cache = CacheService.getScriptCache();
  if (!forzar && !_enHorarioRobot()) return -2;

  // Que no corran dos robots a la vez (si una vuelta tarda más de 1 min)
  if (cache.get('sync_corriendo')) return -1;
  cache.put('sync_corriendo', '1', 170);

  try {
    var ss = _libro();
    var sh = ss.getSheetByName(SYNC_HOJA_PEDIDOS);
    if (!sh) { sh = ss.insertSheet(SYNC_HOJA_PEDIDOS);
               sh.getRange(1, 1, 1, SYNC_ENCABEZADOS.length).setValues([SYNC_ENCABEZADOS]);
               sh.setFrozenRows(1); }

    /* 1) Leer Operaciones (el paso pesado; SIN candado: aquí nadie espera) */
    var t;
    try { t = _abrirTabla(CFG.HOJA_OPERACIONES, CFG.COL_OPERACIONES, CFG.FILA_ENC_OPERACIONES); }
    catch (e) { return -1; }

    var c = t.mapa;
    if (c.id < 0 || c.gestor < 0) return -1;

    /* 2) Pasar a "Operaciones" los cierres que esperan */
    try { _pasarCierresAOperaciones(t); }
    catch (e) { _log('SISTEMA', 'ERROR_CIERRES_OPS', e.message); }

    var cerrados = _idsCerrados(true);                     // ya entregados por la app
    var fuera    = CFG.ESTATUS_CERRADOS.map(_norm);
    var permit   = (CFG.ESTATUS_PERMITIDOS || []).map(_norm).filter(Boolean);

    /* Lista de gestores REALES (de APP_Usuarios). Solo esos pasan a la hoja. */
    var gestores = {};
    try {
      var shU = _hoja(CFG.H.USUARIOS);
      if (shU.getLastRow() > 1) {
        shU.getRange(2, 1, shU.getLastRow() - 1, 1).getValues().forEach(function (r) {
          var g = _norm(r[0]); if (g) gestores[g] = true;
        });
      }
    } catch (e) {}
    var hayLista = false; for (var kk in gestores) { hayLista = true; break; }

    /* 3) Filtrar pendientes (mismas reglas que _leerPendientes) */
    var filas = [];
    for (var i = 0; i < t.datos.length; i++) {
      var f  = t.datos[i];
      var id = String(f[c.id] || '').trim();
      if (!id) continue;

      var gestor = (c.gestor >= 0) ? String(f[c.gestor] || '').trim() : '';
      var gnorm  = _norm(gestor);
      if (!gestor) continue;
      if (gnorm === 'no aplica') continue;
      if (hayLista && !gestores[gnorm]) continue;

      var est = c.estatus >= 0 ? _norm(f[c.estatus]) : '';
      if (est && fuera.indexOf(est) >= 0) continue;
      if (permit.length && est && permit.indexOf(est) < 0) continue;
      if (cerrados[_norm(id)]) continue;

      filas.push([
        id,
        gestor,
        c.nombre    >= 0 ? String(f[c.nombre] || '')    : '',
        c.direccion >= 0 ? String(f[c.direccion] || '') : '',
        c.notas     >= 0 ? String(f[c.notas] || '')     : '',
        c.area      >= 0 ? String(f[c.area] || '')      : '',
        c.subarea   >= 0 ? String(f[c.subarea] || '')   : '',
        c.fecha     >= 0 ? _fechaTexto(f[c.fecha])      : '',
        est,
        t.filaPrimerDato + i
      ]);
    }

    /* 4) ¿Cambió algo desde la vuelta anterior? Si no, no se escribe nada */
    var huella = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(filas)));
    var props = PropertiesService.getScriptProperties();
    var igual = (props.getProperty('sync_huella') === huella) && sh.getLastRow() >= 1;

    if (!igual) {
      var hoy = _ahora();
      var conFecha = filas.map(function (r) { return r.concat([hoy]); });

      /* 5) Reescribir la hoja chica. El candado solo dura este instante */
      var lock = LockService.getScriptLock();
      if (lock.tryLock(10000)) {
        try {
          var ultFila = sh.getLastRow();
          if (ultFila > 1) sh.getRange(2, 1, ultFila - 1, SYNC_ENCABEZADOS.length).clearContent();
          if (conFecha.length) sh.getRange(2, 1, conFecha.length, SYNC_ENCABEZADOS.length).setValues(conFecha);
          props.setProperty('sync_huella', huella);
        } finally {
          try { lock.releaseLock(); } catch (e) {}
        }
      }
    }

    cache.put('sync_ok', String(Date.now()), 900);       // el robot está vivo
    return filas.length;

  } catch (e) {
    try { _log('SISTEMA', 'ERROR_SYNC', e.message); } catch (e2) {}
    return -1;
  } finally {
    try { cache.remove('sync_corriendo'); } catch (e) {}
  }
}


/* ===================================================================
 *  CIERRES → "Operaciones" (en segundo plano)
 * -------------------------------------------------------------------
 *  Busca en APP_Entregas los cierres marcados PENDIENTE en la columna R
 *  y llena sus columnas en "Operaciones" (fecha, palomita, GPS, foto,
 *  firma, motivo…). Usa la lectura de "Operaciones" que el robot ya hizo,
 *  así que no cuesta otra lectura.
 * =================================================================== */
function _pasarCierresAOperaciones(t) {
  if ((CFG.ESCRIBIR_EN_OPERACIONES || {}).activo === false) return;
  if (_cfgHoja('ESCRIBIR_EN_OPERACIONES', true) === false) return;

  var sh = _hoja(CFG.H.ENTREGAS);
  var n = sh.getLastRow() - 1;
  if (n < 1 || sh.getLastColumn() < ENT_COL_ENOPS) return;

  var datos = sh.getRange(2, 1, n, ENT_COL_ENOPS).getValues();
  var pendientes = [];
  for (var i = 0; i < datos.length && pendientes.length < SYNC_CIERRES_POR_VUELTA; i++) {
    if (String(datos[i][ENT_COL_ENOPS - 1]) === 'PENDIENTE') pendientes.push(i);
  }
  if (!pendientes.length) return;

  // Índice ID → fila real de "Operaciones" (se arma una sola vez)
  var idx = {};
  for (var j = 0; j < t.datos.length; j++) {
    var id = _norm(t.datos[j][t.mapa.id]);
    if (id && !idx[id]) idx[id] = t.filaPrimerDato + j;
  }

  pendientes.forEach(function (i) {
    var f = datos[i];
    var marca;
    try {
      var fila = idx[_norm(f[1])];
      if (!fila) {
        marca = 'NO ENCONTRADO EN OPERACIONES';
        _log('SISTEMA', 'NO_ENCONTRE_FILA', f[1]);
      } else {
        _escribirFilaOps(t, fila, String(f[4]).toUpperCase(), {
          gestor: f[2], vehiculo: f[3], lat: f[13], lng: f[14],
          foto: f[11], firma: f[12], motivo: f[5], comentario: f[15]
        }, _fechaDeCierre(f[0]));
        marca = 'OK ' + _ahora();
      }
    } catch (e) {
      marca = 'ERROR: ' + String(e.message).substring(0, 120);
      _log('SISTEMA', 'ERROR_ESCRIBIR_OPS', f[1] + ' ' + e.message);
    }
    sh.getRange(i + 2, ENT_COL_ENOPS).setValue(marca);
  });
}

/** La fecha real del cierre (columna A de APP_Entregas), no la del robot. */
function _fechaDeCierre(v) {
  if (v instanceof Date) return v;
  var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                  Number(m[4]), Number(m[5]), Number(m[6] || 0));
}


/* ===================================================================
 *  LECTURA RÁPIDA — la usa _leerPendientes (camino veloz)
 * -------------------------------------------------------------------
 *  Devuelve los pendientes de ESE gestor leyendo SOLO la hoja chica.
 *  Devuelve null si la hoja no existe, o si está vacía y el robot no ha
 *  corrido hace poco: en ese caso _leerPendientes usa el camino viejo.
 * =================================================================== */
function _leerPendientesRapido(gestor) {
  var sh = _libro().getSheetByName(SYNC_HOJA_PEDIDOS);
  if (!sh) return null;                 // hoja no existe → camino viejo
  var ultFila = sh.getLastRow();
  if (ultFila < 2) {
    // Vacía de verdad (nadie tiene pendientes) o el robot no ha corrido.
    // Si el robot corrió hace poco, la respuesta correcta es "nada".
    var vivo = null;
    try { vivo = CacheService.getScriptCache().get('sync_ok'); } catch (e) {}
    return vivo ? [] : null;
  }

  var datos = sh.getRange(2, 1, ultFila - 1, SYNC_ENCABEZADOS.length).getValues();
  var g = _norm(gestor);
  var cerrados = _idsCerrados();        // por si cerró algo entre sincronizaciones
  var out = [];

  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var id = String(f[0] || '').trim();
    if (!id) continue;
    if (_norm(f[1]) !== g) continue;              // no es de este gestor
    if (cerrados[_norm(id)]) continue;            // lo cerró hace un momento

    out.push({
      id: id,
      fila: Number(f[9]) || 0,                    // fila en Operaciones
      cliente:   String(f[2] || ''),
      direccion: String(f[3] || ''),
      notas:     String(f[4] || ''),
      area:      String(f[5] || ''),
      subarea:   String(f[6] || ''),
      fecha:     String(f[7] || '')
    });
  }
  return out;
}


/** Al cerrar un pedido, lo quitamos de la hoja chica al instante (sin
 *  esperar al siguiente minuto del robot), para que desaparezca ya. */
function _quitarDePedidos(id) {
  try {
    var sh = _libro().getSheetByName(SYNC_HOJA_PEDIDOS);
    if (!sh || sh.getLastRow() < 2) return;
    var objetivo = _norm(id);
    var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (_norm(ids[i][0]) === objetivo) sh.deleteRow(i + 2);
    }
    // La hoja ya no es igual a la huella: que el robot vuelva a escribir
    PropertiesService.getScriptProperties().deleteProperty('sync_huella');
  } catch (e) {}
}
