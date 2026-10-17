/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  07_FIRMAS.gs
 * ---------------------------------------------------------------------
 * ARCHIVO NUEVO. NO REEMPLAZA NADA. Se AGREGA.
 *
 * SOLO LISTA. NO MUEVE, NO RENOMBRA, NO BORRA NADA.
 * Puedes ejecutarlo las veces que quieras sin ningún riesgo.
 *
 * PARA QUÉ SIRVE:
 *   Entre el 28 y el 30 de septiembre, la carpeta "Firmas" no aceptaba
 *   escritura, así que el respaldo guardó esas firmas dentro de la carpeta
 *   de entregados, con el sufijo "(FIRMAS)" en el nombre.
 *   Esto te arma la lista exacta de cuáles son y dónde están, para que las
 *   muevas a mano en Drive.
 *
 * CÓMO SE USA:
 *   1. Lista desplegable junto a "▷ Ejecutar"  →  elige  listarFirmasMalGuardadas
 *   2. ▷ Ejecutar
 *   3. Se abre una ventana con la tabla y además se crea/actualiza la hoja
 *      "APP_Firmas_Revisar" con la misma lista, para que la trabajes cómodo.
 *
 * CÓMO MOVERLAS A MANO (en Drive):
 *   • Abre la carpeta "Pedidos entregados Logistica"
 *   • En el buscador de esa carpeta escribe:  (FIRMAS)
 *   • Selecciona todas (Ctrl+A), clic derecho → Organizar → Mover
 *   • Destino: carpeta "Firmas"
 *   • Luego renómbralas quitando el "(FIRMAS)" y dejando " FIRMA"
 *     Ejemplo:  "#15847 (FIRMAS)"  →  "#15847 FIRMA"
 ***********************************************************************/

function listarFirmasMalGuardadas() {
  var L = [];
  function p(t) { L.push(t); }

  p('╔════════════════════════════════════════════════════════════╗');
  p('║   FIRMAS GUARDADAS EN LA CARPETA EQUIVOCADA');
  p('║   ' + _fechaFir());
  p('╚════════════════════════════════════════════════════════════╝');
  p('');
  p('  Este reporte NO mueve nada. Solo te dice qué hay.');


  /* ---------- 1. LO QUE DICE LA BITÁCORA ---------- */
  p('');
  p('===== 1. SEGÚN APP_Log =====');

  var deLog = {};
  var nLog = 0;
  try {
    var shLog = _hoja(CFG.H.LOG);
    if (shLog.getLastRow() > 1) {
      var filas = shLog.getRange(2, 1, shLog.getLastRow() - 1, 4).getValues();
      filas.forEach(function (f) {
        if (String(f[2]) !== 'DRIVE_RESPALDO') return;
        var det = String(f[3] || '');
        // "FIRMAS no aceptó escritura; #15847 se guardó en ENTREGADO. ..."
        var m = det.match(/escritura;\s*(.+?)\s+se guardó/i);
        var id = m ? m[1].trim() : '(no pude leer el ID)';
        if (!deLog[id]) { deLog[id] = String(f[0]); nLog++; }
      });
    }
  } catch (e) { p('  No pude leer APP_Log: ' + e.message); }

  p('  Firmas que el respaldo desvió: ' + nLog);
  if (nLog) {
    p('');
    Object.keys(deLog).forEach(function (id, i) {
      p('   ' + (i + 1) + ') ' + _padFir(id, 22) + deLog[id]);
    });
  }


  /* ---------- 2. LO QUE HAY DE VERDAD EN DRIVE ---------- */
  p('');
  p('===== 2. ARCHIVOS REALES EN LA CARPETA DE ENTREGADOS =====');

  var encontrados = [];
  try {
    var carpeta = DriveApp.getFolderById(CFG.CARPETAS_DRIVE.ENTREGADO);
    p('  Carpeta: "' + carpeta.getName() + '"');
    p('');

    var it = carpeta.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      var nom = f.getName();
      if (nom.indexOf('(FIRMAS)') < 0) continue;
      encontrados.push({
        nombre: nom,
        idSugerido: nom.replace(/\s*\(FIRMAS\)\s*/i, '').trim(),
        url: f.getUrl(),
        fecha: Utilities.formatDate(f.getDateCreated(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
      });
    }
  } catch (e) {
    p('  ERROR al leer la carpeta: ' + e.message);
  }

  if (!encontrados.length) {
    p('  No hay ningún archivo con "(FIRMAS)" en el nombre.');
    p('  >>> O ya los moviste, o el respaldo nunca llegó a escribir.');
  } else {
    p('  Encontrados: ' + encontrados.length);
    p('');
    p('  ' + _padFir('NOMBRE ACTUAL', 26) + _padFir('DEBERÍA LLAMARSE', 24) + 'CREADO');
    p('  ' + new Array(72).join('-'));
    encontrados.forEach(function (e) {
      p('  ' + _padFir(e.nombre, 26) +
        _padFir(e.idSugerido + ' FIRMA', 24) + e.fecha);
    });
  }


  /* ---------- 3. LA HOJA PARA TRABAJAR ---------- */
  var hoja = 'APP_Firmas_Revisar';
  try {
    var ss = SpreadsheetApp.openById(CFG.ID_HOJA);
    var sh = ss.getSheetByName(hoja);
    if (!sh) sh = ss.insertSheet(hoja);
    sh.clear();

    var enc = ['Nombre actual', 'Debería llamarse', 'ID del pedido', 'Creado', 'Enlace', 'Ya lo moví'];
    sh.getRange(1, 1, 1, enc.length).setValues([enc])
      .setFontWeight('bold').setBackground('#F4B183').setFontColor('#000');
    sh.setFrozenRows(1);

    if (encontrados.length) {
      var datos = encontrados.map(function (e) {
        return [e.nombre, e.idSugerido + ' FIRMA', e.idSugerido, e.fecha, e.url, false];
      });
      sh.getRange(2, 1, datos.length, 6).setValues(datos);
      sh.getRange(2, 6, datos.length, 1).insertCheckboxes();
    }
    sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 200);
    sh.setColumnWidth(5, 320);

    p('');
    p('===== 3. HOJA DE TRABAJO =====');
    p('  Creé/actualicé la hoja "' + hoja + '" con esta lista.');
    p('  Tiene una casilla "Ya lo moví" para que vayas marcando.');
    p('  Esa hoja es tuya: la app no la lee ni la toca.');
  } catch (e) {
    p('  No pude crear la hoja de trabajo: ' + e.message);
  }


  /* ---------- 4. CÓMO MOVERLAS ---------- */
  p('');
  p('===== 4. CÓMO MOVERLAS (a mano, en Drive) =====');
  p('  1. Abre la carpeta "Pedidos entregados Logistica"');
  p('  2. En el buscador de ESA carpeta escribe:   (FIRMAS)');
  p('  3. Ctrl+A para seleccionarlas todas');
  p('  4. Clic derecho → Organizar → Mover → carpeta "Firmas"');
  p('  5. Renombra cada una quitando "(FIRMAS)" y poniendo " FIRMA"');
  p('        "#15847 (FIRMAS)"  →  "#15847 FIRMA"');
  p('');
  p('  OJO: al mover un archivo en Drive, el enlace NO cambia.');
  p('  Los links que ya están en APP_Entregas y en Operaciones siguen');
  p('  funcionando igual. No hay que corregir ninguna celda.');

  p('');
  p('  Copia este texto y mándamelo si algo no cuadra.');

  _salidaFir(L);
  return L.join('\n');
}


/* ---------- utilidades ---------- */
function _padFir(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s.substring(0, n);
}

function _fechaFir() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}

function _salidaFir(L) {
  var texto = L.join('\n');
  Logger.log(texto);
  console.log(texto);
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(
        '<pre style="font:12px/1.45 monospace;white-space:pre-wrap">' +
        texto.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>'
      ).setWidth(780).setHeight(600),
      'Firmas por revisar'
    );
  } catch (e) {}
}
