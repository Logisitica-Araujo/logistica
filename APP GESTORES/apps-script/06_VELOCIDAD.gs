/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  06_VELOCIDAD.gs   (VERSIÓN LIGERA)
 * ---------------------------------------------------------------------
 * REEMPLAZA la versión anterior de este mismo archivo.
 *
 * POR QUÉ CAMBIÓ: la versión anterior repetía cada lectura 3 veces para
 * sacar un promedio. Con tu hoja eso se pasó de los 6 minutos que Apps
 * Script permite y nunca terminó. Esta versión hace UNA sola lectura de
 * cada cosa y avisa antes de intentar algo pesado.
 *
 * CÓMO SE USA:
 *   1. Lista desplegable junto a "▷ Ejecutar"  →  elige  medirVelocidad
 *   2. ▷ Ejecutar
 *   3. Debe terminar en menos de 2 minutos. Copia el Registro y mándamelo.
 ***********************************************************************/

/* Si una sola lectura pasa de esto, ya no intenta las siguientes pesadas. */
var LIMITE_MS = 60000;


function medirVelocidad() {
  var L = [];
  function p(t){ L.push(t); }
  function seg(ms){ return (ms/1000).toFixed(2) + ' s'; }

  p('╔════════════════════════════════════════════════════════════╗');
  p('║   MEDICIÓN LIGERA — ' + _fechaCortaVel());
  p('╚════════════════════════════════════════════════════════════╝');


  /* ---------- 1. MAPA DE TODAS LAS HOJAS (instantáneo) ---------- */
  p('');
  p('===== 1. TODAS LAS HOJAS DEL ARCHIVO =====');
  p('  (busco si ya tienes una hoja chica que sirva de atajo)');
  p('');

  var ss = SpreadsheetApp.openById(CFG.ID_HOJA);
  var hojas = ss.getSheets();
  p('  ' + _pad('HOJA', 34) + _pad('FILAS', 9) + _pad('COLS', 7) + 'CELDAS');
  p('  ' + new Array(64).join('-'));
  hojas.forEach(function (h) {
    var f = h.getLastRow(), c = h.getLastColumn();
    p('  ' + _pad(h.getName(), 34) + _pad(String(f), 9) + _pad(String(c) + ' (' + _letraVel(c) + ')', 7) +
      (f * c).toLocaleString());
  });


  /* ---------- 2. LA HOJA QUE LEE LA APP ---------- */
  p('');
  p('===== 2. LA HOJA "' + CFG.HOJA_OPERACIONES + '" =====');

  var shOp = ss.getSheetByName(CFG.HOJA_OPERACIONES);
  if (!shOp) { p('  NO EXISTE.'); _salidaVel(L); return; }

  var filasOp = shOp.getLastRow();
  var colsOp  = shOp.getLastColumn();
  var celdas  = filasOp * colsOp;
  p('  Filas: ' + filasOp + '   Columnas: ' + colsOp + ' (hasta ' + _letraVel(colsOp) + ')');
  p('  CELDAS TOTALES: ' + celdas.toLocaleString());

  // ¿Trae fórmulas? Las fórmulas hacen las lecturas MUCHO más lentas.
  var conFormula = 0, importrange = 0, muestra = '';
  try {
    var filaMuestra = Math.min(filasOp, CFG.FILA_ENC_OPERACIONES + 1);
    var fx = shOp.getRange(filaMuestra, 1, 1, colsOp).getFormulas()[0];
    for (var i = 0; i < fx.length; i++) {
      if (fx[i]) {
        conFormula++;
        if (/IMPORTRANGE/i.test(fx[i])) importrange++;
        if (!muestra) muestra = _letraVel(i + 1) + ': ' + fx[i].substring(0, 70);
      }
    }
  } catch (e) {}
  p('  Columnas con FÓRMULA (en una fila de muestra): ' + conFormula + ' de ' + colsOp);
  p('  De esas, con IMPORTRANGE: ' + importrange);
  if (muestra) p('  Ejemplo: ' + muestra);
  if (conFormula > 0) {
    p('  >>> Cada fórmula se recalcula cuando el script lee. Esto es lo que más pesa.');
  }


  /* ---------- 3. UNA SOLA LECTURA CRONOMETRADA ---------- */
  p('');
  p('===== 3. CUÁNTO TARDA UNA LECTURA (una sola vez) =====');

  var t0 = new Date().getTime();
  try { shOp.getRange(1, 1, filasOp, colsOp).getValues(); }
  catch (e) { p('  ERROR al leer: ' + e.message); _salidaVel(L); return; }
  var msTodo = new Date().getTime() - t0;
  p('  a) Leer TODA la hoja (' + celdas.toLocaleString() + ' celdas) ....... ' + seg(msTodo));

  if (msTodo > LIMITE_MS) {
    p('');
    p('  ############################################################');
    p('  #  UNA SOLA LECTURA TARDA ' + seg(msTodo) + '.');
    p('  #  La app se rinde a los 45 s. POR ESO DICE "SIN SEÑAL".');
    p('  #  Me detengo aquí: ya sabemos lo que había que saber.');
    p('  ############################################################');
    _veredicto(L, p, seg, filasOp, colsOp, msTodo, -1, -1, conFormula);
    _salidaVel(L);
    return;
  }

  // Solo las columnas que la app realmente usa
  var maxIdx = -1, usadas = [];
  try {
    var t = _abrirTabla(CFG.HOJA_OPERACIONES, CFG.COL_OPERACIONES, CFG.FILA_ENC_OPERACIONES);
    for (var k in t.mapa) {
      if (t.mapa[k] >= 0) { usadas.push(k + '=' + _letraVel(t.mapa[k] + 1)); if (t.mapa[k] > maxIdx) maxIdx = t.mapa[k]; }
    }
  } catch (e) { p('  (no pude mapear columnas: ' + e.message + ')'); }

  var msAngosto = -1;
  if (maxIdx >= 0 && (maxIdx + 1) < colsOp) {
    var t1 = new Date().getTime();
    try { shOp.getRange(1, 1, filasOp, maxIdx + 1).getValues(); } catch (e) {}
    msAngosto = new Date().getTime() - t1;
    p('  b) Leer SOLO hasta la columna ' + _letraVel(maxIdx + 1) + ' ............... ' + seg(msAngosto));
    p('       ahorro: ' + seg(msTodo - msAngosto) + '  (' +
      Math.round((msTodo - msAngosto) * 100 / msTodo) + '%)');
  } else {
    p('  b) La app ya usa casi todas las columnas: no hay nada que recortar ahí.');
  }
  if (usadas.length) p('     Columnas en uso: ' + usadas.join(', '));

  var t2 = new Date().getTime();
  try { _idsCerrados(); } catch (e) {}
  var msCerrados = new Date().getTime() - t2;
  p('  c) Revisar lo ya entregado (' + CFG.H.ENTREGAS + ') ....... ' + seg(msCerrados));

  p('');
  p('  ESTIMADO de lo que espera el gestor al abrir la app:');
  p('     abrir app    (estado)  ≈ ' + seg(msTodo + msCerrados));
  p('     tocar pedidos          ≈ ' + seg(msTodo + msCerrados) + '   (vuelve a leer lo mismo)');
  p('     ------------------------------------------');
  p('     TOTAL SERVIDOR         ≈ ' + seg((msTodo + msCerrados) * 2));
  p('     + internet y dibujado  ≈ 1.5 a 4 s');

  _veredicto(L, p, seg, filasOp, colsOp, msTodo, msAngosto, msCerrados, conFormula);
  _salidaVel(L);
  return L.join('\n');
}


/* ---------- VEREDICTO ---------- */
function _veredicto(L, p, seg, filas, cols, msTodo, msAngosto, msCerrados, conFormula) {
  p('');
  p('===== 4. QUÉ SIRVE Y QUÉ NO, CON ESTOS NÚMEROS =====');
  var n = 0;

  if (conFormula > 0) {
    p('  ' + (++n) + ') FÓRMULAS: la hoja trae ' + conFormula + ' columnas con fórmula.');
    p('        Mientras el script lea esta hoja, va a ser lenta pase lo que pase.');
    p('        LA SOLUCIÓN DE FONDO es que la app NO lea "' + CFG.HOJA_OPERACIONES + '",');
    p('        sino una hoja chica y sin fórmulas que se llene sola.');
  }
  if (filas > 1500) {
    p('  ' + (++n) + ') TAMAÑO: ' + filas + ' filas. Los pedidos viejos pesan igual que los de hoy.');
    p('        Archivar lo cerrado reduce el tiempo de forma proporcional.');
  }
  if (msAngosto > 0 && (msTodo - msAngosto) > 1000) {
    p('  ' + (++n) + ') COLUMNAS: recortar la lectura ahorra ' + seg(msTodo - msAngosto) + ' por consulta. Sí conviene.');
  } else if (msAngosto > 0) {
    p('  ' + (++n) + ') COLUMNAS: recortar casi no ahorra. NO vale la pena.');
  }
  if (msCerrados > 1000) {
    p('  ' + (++n) + ') CACHÉ: revisar lo entregado cuesta ' + seg(msCerrados) + ' y es igual para los 5 gestores.');
  }
  p('  ' + (++n) + ') UN SOLO VIAJE: hoy la app pregunta dos veces y el servidor lee lo mismo dos veces.');
  p('        Juntarlo en una sola consulta corta el tiempo a la mitad, siempre.');

  p('');
  p('  Copia TODO este texto y mándamelo.');
}


/* ---------- utilidades ---------- */
function _pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s.substring(0, n);
}

function _salidaVel(L) {
  var texto = L.join('\n');
  Logger.log(texto);
  console.log(texto);
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(
        '<pre style="font:12px/1.45 monospace;white-space:pre-wrap">' +
        texto.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>'
      ).setWidth(780).setHeight(620),
      'Medición de velocidad'
    );
  } catch (e) {}
}

function _letraVel(n) {
  var s = '';
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function _fechaCortaVel() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}
