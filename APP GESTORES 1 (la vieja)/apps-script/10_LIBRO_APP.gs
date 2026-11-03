/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  10_LIBRO_APP.gs   (NUEVO, v3.0)
 * ---------------------------------------------------------------------
 * ARCHIVO NUEVO. No reemplaza nada: se agrega.
 *
 * QUÉ HACE
 *   Pasa las hojas de la app (APP_Config, APP_Sesiones, APP_Log…) a un
 *   libro PROPIO y ligero. "Operaciones", "Datos" y APP_Entregas se quedan
 *   donde están: la columna V de "Operaciones" tiene una fórmula que lee
 *   APP_Entregas, y esa conexión no se debe romper.
 *
 * POR QUÉ
 *   Hoy las hojas de la app viven dentro de "Logística Operaciones", que
 *   tiene unos 3 millones de celdas, fórmulas e IMPORTRANGE, y en el que
 *   trabaja toda la oficina. Cada login, cada cambio de vehículo y cada
 *   cierre escribe en ese libro gigante y espera a que Google termine de
 *   recalcularlo. Con su propio libro, esas escrituras son casi instantáneas.
 *
 * CUÁNDO CORRERLO
 *   Cuando NADIE esté usando la app (de noche o en fin de semana), y
 *   después de pegar la versión 3.0 de los demás archivos.
 *
 * CÓMO
 *   Lista junto a "▷ Ejecutar"  →  elige  migrarAppALibroPropio  →  ▷ Ejecutar
 *   Al terminar, en el Registro sale el enlace del libro nuevo.
 *
 * QUÉ PASA CON LAS HOJAS VIEJAS
 *   Se renombran a "OLD_APP_…" para que nadie las use por error. No se
 *   borran: bórralas tú cuando todo lleve unos días funcionando.
 *   OJO: si alguna fórmula o reporte tuyo leía otra hoja APP_ (que no sea
 *   APP_Entregas), ahora debe leer la del libro nuevo. Revisado en el
 *   repositorio: la única que se usa en fórmulas es APP_Entregas.
 *
 * PARA DESHACER (solo si algo sale mal ese mismo día)
 *   Ejecuta  deshacerMigracionLibroApp . La app vuelve a usar las hojas
 *   OLD_ (les quita el prefijo). Lo que se haya capturado en el libro nuevo
 *   mientras tanto NO se copia de regreso.
 ***********************************************************************/

function _nombresHojasApp() {
  var nombres = [];
  Object.keys(CFG.H).forEach(function (k) {
    // APP_Entregas NO se mueve: la fórmula de la columna V de "Operaciones" la lee
    if (_quedaEnLibroOficina(CFG.H[k])) return;
    nombres.push(CFG.H[k]);
  });
  if (typeof SYNC_HOJA_PEDIDOS !== 'undefined') nombres.push(SYNC_HOJA_PEDIDOS);
  return nombres;
}

function migrarAppALibroPropio() {
  var props = PropertiesService.getScriptProperties();
  var ya = props.getProperty('ID_HOJA_APP');
  if (ya) {
    var msg0 = 'Ya estaba migrada. Libro de la app: https://docs.google.com/spreadsheets/d/' + ya;
    Logger.log(msg0);
    return msg0;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Alguien está usando la app. Intenta más tarde.');
  try {
    var origen = SpreadsheetApp.openById(CFG.ID_HOJA);
    var nuevo = SpreadsheetApp.create('Logística App — Base de datos');
    var nombres = _nombresHojasApp();
    var copiadas = [];

    nombres.forEach(function (n) {
      var sh = origen.getSheetByName(n);
      if (!sh) return;
      var copia = sh.copyTo(nuevo);
      copia.setName(n);
      copiadas.push(n + ' (' + Math.max(0, sh.getLastRow() - 1) + ' filas)');
    });
    if (!copiadas.length) throw new Error('No encontré ninguna hoja APP_ que copiar.');

    // Quitar la hoja vacía con la que nace el libro nuevo
    nuevo.getSheets().forEach(function (s) {
      if (nombres.indexOf(s.getName()) < 0 && nuevo.getSheets().length > 1) nuevo.deleteSheet(s);
    });

    // Guardarlo junto al libro de siempre (si se puede)
    try {
      var carpeta = DriveApp.getFileById(CFG.ID_HOJA).getParents();
      if (carpeta.hasNext()) DriveApp.getFileById(nuevo.getId()).moveTo(carpeta.next());
    } catch (e) { }

    // Desde aquí la app usa el libro nuevo
    props.setProperty('ID_HOJA_APP', nuevo.getId());

    // Las viejas se renombran para que nadie las use por error
    nombres.forEach(function (n) {
      var sh = origen.getSheetByName(n);
      if (sh) sh.setName('OLD_' + n);
    });

    // Memoria limpia para que nadie lea datos del libro viejo
    try {
      CacheService.getScriptCache().removeAll(['cat', 'cerrados', 'robot_ok', 'sync_ok']);
    } catch (e) { }
    props.deleteProperty('sync_huella');

    var msg = 'MIGRACIÓN TERMINADA\n\n' +
      'Libro nuevo de la app:\n  ' + nuevo.getUrl() + '\n\n' +
      'Hojas copiadas:\n  • ' + copiadas.join('\n  • ') + '\n\n' +
      'Las hojas viejas quedaron como OLD_… en "' + origen.getName() + '".\n' +
      'Bórralas cuando todo lleve unos días funcionando bien.';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }
    return msg;
  } finally {
    try { lock.releaseLock(); } catch (e) { }
  }
}


function deshacerMigracionLibroApp() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ID_HOJA_APP');
  if (!id) { Logger.log('No hay migración que deshacer.'); return; }

  var origen = SpreadsheetApp.openById(CFG.ID_HOJA);
  _nombresHojasApp().forEach(function (n) {
    var vieja = origen.getSheetByName('OLD_' + n);
    if (vieja && !origen.getSheetByName(n)) vieja.setName(n);
  });
  props.deleteProperty('ID_HOJA_APP');
  props.deleteProperty('sync_huella');
  try {
    CacheService.getScriptCache().removeAll(['cat', 'cerrados', 'robot_ok', 'sync_ok']);
  } catch (e) { }

  var msg = 'Migración deshecha. La app vuelve a usar las hojas de "' + origen.getName() + '".\n' +
            'El libro nuevo NO se borró: https://docs.google.com/spreadsheets/d/' + id;
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }
  return msg;
}
