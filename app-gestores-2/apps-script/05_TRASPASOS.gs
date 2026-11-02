/***********************************************************************
 * APP GESTORES 2 — 05_TRASPASOS.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * Conexión con el Sistema de Traspasos (Traspasos_FADERMEX_BD).
 * Es la misma lógica que hoy usa la app actual (09_TRASPASOS_NUEVOS.gs):
 *   • Al recolectar: Estatus → RECOLECTADO, se anota en RES_Movimientos y
 *     se avisa al destino en RES_Avisos ("Recolectado por gestoría").
 *   • Al entregar: Estatus → ENTREGADO_GESTOR (el destino confirma al escanear).
 * Y lo NUEVO: el robot lee la columna Estatus para quitar de la lista del
 * gestor lo que el destino ya recibió (ENTREGADO), se eliminó o se extravió.
 * Se lee por NOMBRE de columna: si renombran un encabezado, ver TRA-04.
 ***********************************************************************/

var APPG_TN = {
  FILA_ENC: 2,
  H: { T: 'RES_Traspasos', MOV: 'RES_Movimientos', AVISOS: 'RES_Avisos' },
  RECOLECTABLES: ['NUEVO', 'EN_LOGISTICA', 'EN_RECEPCION', 'RECOLECTADO'],
  // Estatus con los que el traspaso ya NO le toca al gestor.
  TERMINADOS: ['ENTREGADO', 'ELIMINADO', 'EXTRAVIADO', 'ENTREGADO_GESTOR']
};

var __APPG_TN_LIBRO = null, __APPG_TN_T = null;
function _tnLibro() {
  if (!__APPG_TN_LIBRO) {
    var id = String(_config().ID_TRASPASOS || '').trim();
    if (!id) throw _falla('TRA-03', 'Falta ID_TRASPASOS en APP_Config.');
    __APPG_TN_LIBRO = SpreadsheetApp.openById(id);
  }
  return __APPG_TN_LIBRO;
}
function _tnClave(v) { return String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase(); }

/** RES_Traspasos completo, una vez por ejecución. */
function _tnTabla() {
  if (__APPG_TN_T) return __APPG_TN_T;
  var sh = _tnLibro().getSheetByName(APPG_TN.H.T);
  var lc = sh.getLastColumn();
  var enc = sh.getRange(APPG_TN.FILA_ENC, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
  var c = function (n) { var i = enc.indexOf(n); if (i < 0) throw _falla('TRA-04', 'Falta la columna "' + n + '" en RES_Traspasos.'); return i; };
  var n = sh.getLastRow() - APPG_TN.FILA_ENC;
  var datos = n > 0 ? sh.getRange(APPG_TN.FILA_ENC + 1, 1, n, lc).getValues() : [];
  var idx = {};
  var cf = c('Folio');
  for (var i = 0; i < datos.length; i++) idx[_tnClave(datos[i][cf])] = i;   // si se repite, gana el más nuevo (abajo)
  __APPG_TN_T = { sh: sh, enc: enc, c: c, datos: datos, idx: idx };
  return __APPG_TN_T;
}

/** {fila, folio, estatus, origen, destino, destinoPrefijo, contenido} o null. */
function _tnBuscar(codigo) {
  var t = _tnTabla();
  var i = t.idx[_tnClave(codigo)];
  if (i == null) return null;
  var v = t.datos[i];
  var bultos = Number(v[t.c('Bultos')]) || 1;
  return {
    fila: APPG_TN.FILA_ENC + 1 + i, folio: String(v[t.c('Folio')]), estatus: String(v[t.c('Estatus')]).trim().toUpperCase(),
    origen: String(v[t.c('Origen')]), destino: String(v[t.c('Destino')]), destinoPrefijo: String(v[t.c('Destino (prefijo)')]),
    contenido: String(v[t.c('Descripción')]) + ' · ' + bultos + (bultos > 1 ? ' bultos' : ' bulto'),
    eliminar: String(v[t.c('Eliminación solicitada')]).trim().toUpperCase() === 'SI'
  };
}

function _tnSet(fila, cambios) {
  var t = _tnTabla();
  cambios['Última actualización'] = _ahora('yyyy-MM-dd HH:mm');
  Object.keys(cambios).forEach(function (h) { t.sh.getRange(fila, t.c(h) + 1).setValue(cambios[h]); });
}
function _tnAnotar(hoja, o) {
  var sh = _tnLibro().getSheetByName(hoja);
  var enc = sh.getRange(APPG_TN.FILA_ENC, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(enc.map(function (h) { return o[h] != null ? o[h] : ''; }));
}
function _tnMov(folio, accion, antes, despues, persona, detalle) {
  _tnAnotar(APPG_TN.H.MOV, { 'ID': 'M' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase(),
    'Fecha': _ahora('yyyy-MM-dd'), 'Hora': _ahora('HH:mm'), 'Folio': folio, 'Acción': accion, 'Estatus anterior': antes,
    'Estatus nuevo': despues, 'Persona': persona, 'Medio': 'APP GESTORES 2', 'Detalle': detalle || '' });
}
function _tnAviso(para, folio, msg) {
  _tnAnotar(APPG_TN.H.AVISOS, { 'Fecha': _ahora('yyyy-MM-dd'), 'Hora': _ahora('HH:mm'), 'Para (área)': para, 'Folio': folio, 'Mensaje': msg, 'Visto': 'NO' });
}

/** El gestor lo recolectó. Devuelve true si se marcó en el sistema. */
function _tnRecolectar(codigo, gestor, vehiculo) {
  var r = _tnBuscar(codigo);
  if (!r || r.eliminar) return false;
  if (APPG_TN.RECOLECTABLES.indexOf(r.estatus) < 0) return false;
  if (r.estatus === 'RECOLECTADO') return true;            // ya estaba (otra lectura); no se duplica el aviso
  _tnSet(r.fila, { 'Estatus': 'RECOLECTADO', 'Gestor': gestor, 'Fecha recolección': _ahora('yyyy-MM-dd HH:mm'), 'Ubicación actual': '' });
  _tnMov(r.folio, 'RECOLECTADO POR GESTORÍA', r.estatus, 'RECOLECTADO', gestor, 'Vehículo: ' + (vehiculo || '—'));
  _tnAviso(r.destinoPrefijo, r.folio, 'Va en camino para ti · lo lleva ' + gestor);
  return true;
}

/** El gestor lo entregó (o no). */
function _tnCierre(codigo, gestor, entregado, urlFoto, motivo, comentario, recibio) {
  var r = _tnBuscar(codigo);
  if (!r) return 'NO_EXISTE';
  if (r.estatus !== 'RECOLECTADO' && r.estatus !== 'UBICADO') return r.estatus;   // solo lo que trae el gestor
  if (entregado) {
    _tnSet(r.fila, { 'Estatus': 'ENTREGADO_GESTOR' });
    _tnMov(r.folio, 'ENTREGADO POR GESTOR (FALTA CONFIRMAR)', r.estatus, 'ENTREGADO_GESTOR', gestor,
           (recibio ? 'Recibió: ' + recibio + ' · ' : '') + (urlFoto ? 'Foto: ' + urlFoto : 'Sin foto'));
    _tnAviso(r.destinoPrefijo, r.folio, 'El gestor ' + gestor + ' dice que ya te lo entregó. Escanéalo para confirmar.');
    return 'ENTREGADO_GESTOR';
  }
  if (/extravi/i.test(String(motivo || ''))) {
    _tnSet(r.fila, { 'Estatus': 'EXTRAVIADO' });
    _tnMov(r.folio, 'EXTRAVIADO (REPORTADO POR GESTOR)', r.estatus, 'EXTRAVIADO', gestor, String(comentario || ''));
    _tnAviso('ADMIN', r.folio, 'El gestor ' + gestor + ' reportó extraviado este traspaso');
    return 'EXTRAVIADO';
  }
  _tnMov(r.folio, 'NO ENTREGADO: ' + String(motivo || ''), r.estatus, r.estatus, gestor, String(comentario || ''));
  return r.estatus;
}
