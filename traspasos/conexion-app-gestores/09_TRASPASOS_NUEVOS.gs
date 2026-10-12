/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  09_TRASPASOS_NUEVOS.gs
 * ---------------------------------------------------------------------
 * ARCHIVO NUEVO. Se agrega al proyecto de Apps Script de la app de
 * gestores. No reemplaza nada.
 *
 * Conecta el módulo "Traspasos" de la app del gestor con el sistema
 * nuevo de traspasos (archivo Traspasos_FADERMEX_BD):
 *
 *  • Cuando el gestor ESCANEA un folio que existe en el sistema nuevo,
 *    la app le muestra origen, destino y contenido, y el traspaso pasa
 *    a "Recolectado por gestoría" (el destino recibe su aviso).
 *  • Cuando el gestor lo marca ENTREGADO (con o sin foto), pasa a
 *    "Entregado por gestor, falta confirmar". Queda en verde (Entregado)
 *    hasta que el destino lo escanea.
 *  • Si el folio NO existe en el sistema nuevo (pedidos, remisiones,
 *    lo que sea), la app sigue funcionando EXACTAMENTE como antes.
 *
 * Todo va protegido: si el archivo nuevo no abre o algo falla, la app
 * del gestor no se entera y sigue igual.
 ***********************************************************************/

const TN = {
  ACTIVO: true,                                                // false = apaga la conexión sin borrar nada
  ID_ARCHIVO: '1Fn5VKZZ-gUS_QRYIbos1WwCFzXpnIF_g7ofApN5vIxg',  // Traspasos_FADERMEX_BD
  FILA_ENC: 2,
  H: { T: 'RES_Traspasos', MOV: 'RES_Movimientos', AVISOS: 'RES_Avisos' },
  // Solo se recolectan traspasos en estos estatus. Es el candado extra
  // para que un folio viejo con el mismo texto nunca mueva uno nuevo.
  RECOLECTABLES: ['NUEVO', 'EN_LOGISTICA']
};

var __TN_LIBRO = null;
function _tnLibro() {
  if (!__TN_LIBRO) __TN_LIBRO = SpreadsheetApp.openById(TN.ID_ARCHIVO);
  return __TN_LIBRO;
}
function _tnAhora(f) { return Utilities.formatDate(new Date(), 'America/Mexico_City', f || 'yyyy-MM-dd HH:mm'); }
function _tnClave(v) { return String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase(); }

/** Lee RES_Traspasos una vez por ejecución. */
var __TN_T = null;
function _tnTabla() {
  if (__TN_T) return __TN_T;
  const sh = _tnLibro().getSheetByName(TN.H.T);
  const lc = sh.getLastColumn();
  const enc = sh.getRange(TN.FILA_ENC, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
  const c = function (n) { const i = enc.indexOf(n); if (i < 0) throw new Error('Falta columna ' + n); return i; };
  const n = sh.getLastRow() - TN.FILA_ENC;
  const datos = n > 0 ? sh.getRange(TN.FILA_ENC + 1, 1, n, lc).getValues() : [];
  __TN_T = { sh: sh, enc: enc, c: c, datos: datos };
  return __TN_T;
}

/** Busca el folio (sin importar guiones/espacios). Devuelve {fila, v(valores), ...} o null. */
function _tnFila(folio) {
  const t = _tnTabla();
  const k = _tnClave(folio);
  const cf = t.c('Folio');
  for (let i = t.datos.length - 1; i >= 0; i--) {
    if (_tnClave(t.datos[i][cf]) === k) return { fila: TN.FILA_ENC + 1 + i, v: t.datos[i] };
  }
  return null;
}

function _tnSet(fila, cambios) {
  const t = _tnTabla();
  cambios['Última actualización'] = _tnAhora();
  Object.keys(cambios).forEach(function (h) { t.sh.getRange(fila, t.c(h) + 1).setValue(cambios[h]); });
}

function _tnMov(folio, accion, antes, despues, persona, medio, detalle) {
  const sh = _tnLibro().getSheetByName(TN.H.MOV);
  const enc = sh.getRange(TN.FILA_ENC, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const o = { 'ID': 'M' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase(), 'Fecha': _tnAhora('yyyy-MM-dd'), 'Hora': _tnAhora('HH:mm'),
              'Folio': folio, 'Acción': accion, 'Estatus anterior': antes, 'Estatus nuevo': despues,
              'Persona': persona, 'Medio': medio, 'Detalle': detalle || '' };
  sh.appendRow(enc.map(function (h) { return o[h] != null ? o[h] : ''; }));
}

function _tnAviso(para, folio, msg) {
  const sh = _tnLibro().getSheetByName(TN.H.AVISOS);
  const enc = sh.getRange(TN.FILA_ENC, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const o = { 'Fecha': _tnAhora('yyyy-MM-dd'), 'Hora': _tnAhora('HH:mm'), 'Para (área)': para, 'Folio': folio, 'Mensaje': msg, 'Visto': 'NO' };
  sh.appendRow(enc.map(function (h) { return o[h] != null ? o[h] : ''; }));
}


/* ======================= LO QUE LLAMA 02_BACKEND ======================= */

/**
 * Para el escaneo del gestor: si el folio es un traspaso del sistema nuevo,
 * regresa {origen, destino, area, contenido} para llenar APP_Traspasos.
 * Si no, regresa null y la app usa su catálogo de siempre.
 */
function _tnBuscar(folio) {
  if (!TN.ACTIVO) return null;
  try {
    const r = _tnFila(folio);
    if (!r) return null;
    const t = _tnTabla();
    const est = String(r.v[t.c('Estatus')]).trim().toUpperCase();
    if (TN.RECOLECTABLES.indexOf(est) < 0 && est !== 'RECOLECTADO') return null;
    const bultos = Number(r.v[t.c('Bultos')]) || 1;
    return {
      origen: String(r.v[t.c('Origen')]),
      destino: String(r.v[t.c('Destino')]),
      area: '',
      contenido: String(r.v[t.c('Descripción')]) + ' · ' + bultos + (bultos > 1 ? ' bultos' : ' bulto')
    };
  } catch (e) { try { _log('SISTEMA', 'TN_BUSCAR', folio + ' ' + e.message); } catch (x) { } return null; }
}

/** Después de guardar la ráfaga: marca como Recolectado los que sean del sistema nuevo. */
function _tnRecolectados(folios, gestor, vehiculo) {
  if (!TN.ACTIVO || !folios || !folios.length) return;
  try {
    const t = _tnTabla();
    folios.forEach(function (folio) {
      const r = _tnFila(folio);
      if (!r) return;
      const est = String(r.v[t.c('Estatus')]).trim().toUpperCase();
      if (TN.RECOLECTABLES.indexOf(est) < 0) return;
      if (String(r.v[t.c('Eliminación solicitada')]).trim().toUpperCase() === 'SI') return;
      const f = String(r.v[t.c('Folio')]);
      _tnSet(r.fila, { 'Estatus': 'RECOLECTADO', 'Gestor': gestor, 'Fecha recolección': _tnAhora(), 'Ubicación actual': '' });
      _tnMov(f, 'RECOLECTADO POR GESTORÍA', est, 'RECOLECTADO', gestor, 'APP DEL GESTOR', 'Vehículo: ' + (vehiculo || '—'));
      _tnAviso(String(r.v[t.c('Destino (prefijo)')]), f, 'Va en camino para ti · lo lleva ' + gestor);
    });
  } catch (e) { try { _log('SISTEMA', 'TN_RECOLECTAR', e.message); } catch (x) { } }
}

/** Cuando el gestor cierra el traspaso en su app (ENTREGADO / NO ENTREGADO). */
function _tnCierreGestor(folio, gestor, entregado, urlFoto, motivo, comentario) {
  if (!TN.ACTIVO) return;
  try {
    const r = _tnFila(folio);
    if (!r) return;
    const t = _tnTabla();
    const est = String(r.v[t.c('Estatus')]).trim().toUpperCase();
    const f = String(r.v[t.c('Folio')]);
    const dest = String(r.v[t.c('Destino (prefijo)')]);
    if (est !== 'RECOLECTADO' && est !== 'UBICADO') return;   // solo lo que trae el gestor
    if (entregado) {
      _tnSet(r.fila, { 'Estatus': 'ENTREGADO_GESTOR' });
      _tnMov(f, 'ENTREGADO POR GESTOR (FALTA CONFIRMAR)', est, 'ENTREGADO_GESTOR', gestor, 'APP DEL GESTOR',
             urlFoto ? 'Foto: ' + urlFoto : 'Sin foto');
      _tnAviso(dest, f, 'El gestor ' + gestor + ' dice que ya te lo entregó. Escanéalo para confirmar.');
    } else if (/extravi/i.test(String(motivo || ''))) {
      _tnSet(r.fila, { 'Estatus': 'EXTRAVIADO' });
      _tnMov(f, 'EXTRAVIADO (REPORTADO POR GESTOR)', est, 'EXTRAVIADO', gestor, 'APP DEL GESTOR', String(comentario || ''));
      _tnAviso('ADMIN', f, 'El gestor ' + gestor + ' reportó extraviado este traspaso');
    } else {
      _tnMov(f, 'NO ENTREGADO: ' + String(motivo || ''), est, est, gestor, 'APP DEL GESTOR', String(comentario || ''));
    }
  } catch (e) { try { _log('SISTEMA', 'TN_CIERRE', folio + ' ' + e.message); } catch (x) { } }
}
