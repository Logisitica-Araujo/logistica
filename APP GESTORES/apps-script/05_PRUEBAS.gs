/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  05_PRUEBAS.gs
 * ---------------------------------------------------------------------
 * ARCHIVO NUEVO. NO REEMPLAZA NADA. Se AGREGA.
 *
 * Este archivo no hace funcionar la app. Sirve solo para revisarla.
 * Puedes borrarlo cuando ya todo esté funcionando.
 *
 * CÓMO SE USA:
 *   1. En el editor de Apps Script, arriba, junto al botón "▷ Ejecutar",
 *      hay una lista desplegable con nombres de funciones.
 *   2. Elige  revisionTotal  y presiona ▷ Ejecutar.
 *   3. Abajo se abre el panel "Registro de ejecución". Ahí sale el reporte.
 *   4. Copia TODO ese texto y pégamelo.
 *
 * Si quieres probar el login de un gestor en concreto, escribe su nombre
 * y su código aquí abajo, entre las comillas, antes de ejecutar.
 ***********************************************************************/

var PRUEBA_NOMBRE = '';      // ejemplo: 'Juan Antonio Araujo Rodriguez'
var PRUEBA_CODIGO = '';      // ejemplo: '1234567890'   (lo que da el escáner)


/* =====================================================================
 *  REVISIÓN COMPLETA
 * ===================================================================== */
function revisionTotal() {
  var L = [];
  var errores = 0;
  var avisos  = 0;

  function ok(t)    { L.push('  [OK]     ' + t); }
  function mal(t)   { L.push('  [ERROR]  ' + t); errores++; }
  function aviso(t) { L.push('  [AVISO]  ' + t); avisos++; }
  function titulo(t){ L.push(''); L.push('===== ' + t + ' ====='); }

  L.push('╔══════════════════════════════════════════════════════════╗');
  L.push('║   REVISIÓN DE LA APP DE LOGÍSTICA — ' + _fechaCorta() + '        ');
  L.push('╚══════════════════════════════════════════════════════════╝');


  /* ---------- 1. ¿ESTÁN LOS 5 ARCHIVOS PEGADOS? ---------- */
  titulo('1. ARCHIVOS DEL PROYECTO');

  // 00_CONFIG.gs
  if (typeof CFG === 'undefined') {
    mal('00_CONFIG.gs  NO está cargado. Sin este archivo nada funciona.');
  } else {
    ok('00_CONFIG.gs  cargado.');
    if (!CFG.CARPETAS_DRIVE) {
      mal('   ...pero es la version VIEJA (no tiene CARPETAS_DRIVE). Vuelve a pegarlo.');
    } else {
      ok('   ...y es la version NUEVA (tiene CARPETAS_DRIVE).');
    }
    if (String(CFG.CLAVE_ADMIN || '') === 'PON-AQUI-TU-CLAVE' || !CFG.CLAVE_ADMIN) {
      aviso('   ...no has escrito tu CLAVE_ADMIN. La puerta trasera no abrira.');
    } else {
      ok('   ...CLAVE_ADMIN escrita.');
    }
  }

  // 01_INSTALADOR.gs
  if (typeof instalar !== 'function') {
    mal('01_INSTALADOR.gs  NO está cargado.');
  } else {
    ok('01_INSTALADOR.gs  cargado.');
    if (typeof probarCarpetasDrive !== 'function') {
      mal('   ...pero es la version VIEJA (le falta "probarCarpetasDrive").');
      mal('   ...POR ESO NO TE APARECE LA OPCION 6 DEL MENU. Vuelve a pegarlo.');
    } else {
      ok('   ...y es la version NUEVA (opcion 6 del menu disponible).');
    }
  }

  // 02_BACKEND.gs
  if (typeof apiLogin !== 'function') {
    mal('02_BACKEND.gs  NO está cargado. Sin esto NO HAY LOGIN.');
  } else {
    ok('02_BACKEND.gs  cargado.');
    if (typeof _paginaWeb !== 'function') {
      mal('   ...pero es la version VIEJA (le falta "_paginaWeb").');
      mal('   ...Esto ROMPE la app instalada. Vuelve a pegarlo.');
    } else {
      ok('   ...y es la version NUEVA (tiene _paginaWeb).');
    }
  }

  // 03_ADMIN.gs
  if (typeof apiAdmin !== 'function') aviso('03_ADMIN.gs  NO está cargado. Solo afecta la puerta trasera.');
  else ok('03_ADMIN.gs  cargado.');

  // 04_API.gs
  if (typeof doPost !== 'function') {
    mal('04_API.gs  NO está cargado.');
    mal('   >>> ESTA ES LA CAUSA MAS PROBABLE DE QUE LA APP NO TE DEJE ENTRAR. <<<');
    mal('   La app del celular habla por POST. Sin doPost, no hay respuesta.');
  } else {
    ok('04_API.gs  cargado (doPost existe).');
    if (typeof _despachar !== 'function') mal('   ...pero le falta _despachar. Vuelve a pegarlo completo.');
    else ok('   ...y tiene _despachar.');
  }


  /* ---------- 2. ¿HAY DOS doGet / doPost PELEANDOSE? ---------- */
  titulo('2. CHOQUES ENTRE ARCHIVOS (lo mas dificil de ver a simple vista)');
  L.push('  Apps Script solo permite UN doGet y UN doPost en todo el proyecto.');
  L.push('  Si hay dos, uno gana en silencio y el otro deja de existir.');
  L.push('');

  if (typeof doGet !== 'function') {
    mal('No existe ningun doGet. La pagina web no abrira.');
  } else {
    var fuenteGet = String(doGet);
    if (fuenteGet.indexOf('e.parameter.api') >= 0) {
      ok('El doGet que MANDA es el de 04_API.gs. Correcto.');
    } else {
      mal('El doGet que MANDA **NO** es el de 04_API.gs.');
      mal('   Otro archivo tuyo tiene un doGet y le esta ganando.');
      mal('   Sospechosos: Rastreo_Codigo.gs, macros.gs, OPERACIONES v2.gs');
      L.push('   --- primeras lineas del doGet que esta ganando ---');
      L.push('   ' + fuenteGet.substring(0, 300).replace(/\n/g, '\n   '));
      L.push('   -------------------------------------------------');
    }
  }

  if (typeof doPost === 'function') {
    var fuentePost = String(doPost);
    if (fuentePost.indexOf('_despachar') >= 0) {
      ok('El doPost que MANDA es el de 04_API.gs. Correcto.');
    } else {
      mal('El doPost que MANDA **NO** es el de 04_API.gs. Otro archivo le gana.');
      L.push('   --- primeras lineas del doPost que esta ganando ---');
      L.push('   ' + fuentePost.substring(0, 300).replace(/\n/g, '\n   '));
      L.push('   --------------------------------------------------');
    }
  }

  if (typeof onOpen === 'function') {
    var fuenteOpen = String(onOpen);
    if (fuenteOpen.indexOf('Logística') >= 0 || fuenteOpen.indexOf('Logistica') >= 0) {
      ok('El onOpen que MANDA es el de 01_INSTALADOR.gs (menu de Logistica).');
      if (fuenteOpen.indexOf('probarCarpetasDrive') >= 0) {
        ok('   ...e incluye la opcion 6 del menu.');
      } else {
        mal('   ...pero NO incluye la opcion 6. El archivo 01 esta viejo.');
      }
    } else {
      aviso('El onOpen que MANDA es de otro archivo. Tu menu de Logistica NO saldra.');
    }
  }


  /* ---------- 3. LAS HOJAS DE LA APP ---------- */
  titulo('3. HOJAS DE LA APP');
  try {
    var ss = SpreadsheetApp.openById(CFG.ID_HOJA);
    ok('Abri el archivo: ' + ss.getName());

    var necesarias = [CFG.H.CONFIG, CFG.H.USUARIOS, CFG.H.VEHICULOS, CFG.H.SESIONES,
                      CFG.H.ENTREGAS, CFG.H.SUCURSALES, CFG.H.MOTIVOS, CFG.H.LOG];
    for (var i = 0; i < necesarias.length; i++) {
      var h = ss.getSheetByName(necesarias[i]);
      if (!h) mal('Falta la hoja "' + necesarias[i] + '". Corre: Logistica > 1. Instalar / Reparar hojas');
      else    ok('Hoja "' + necesarias[i] + '" existe (' + (h.getLastRow() - 1) + ' registros).');
    }

    var v = _cfgHoja('VERSION', '(sin version)');
    if (String(v) === '2.1.0') ok('VERSION instalada: 2.1.0  <- correcta');
    else mal('VERSION instalada: ' + v + '  <- deberia decir 2.1.0. Corre "1. Instalar / Reparar hojas".');

  } catch (e) {
    mal('No pude abrir la hoja de calculo: ' + e.message);
  }


  /* ---------- 4. LOS GESTORES Y SUS CODIGOS ---------- */
  titulo('4. GESTORES DADOS DE ALTA (esto decide si el login funciona)');
  try {
    var shU = _hoja(CFG.H.USUARIOS);
    if (shU.getLastRow() < 2) {
      mal('NO HAY NINGUN GESTOR. Corre: Logistica > 2. Sincronizar catalogos');
    } else {
      var fl = shU.getRange(2, 1, shU.getLastRow() - 1, 6).getValues();
      L.push('  Se escribe EXACTAMENTE asi en el celular:');
      L.push('');
      for (var j = 0; j < fl.length; j++) {
        var nom = String(fl[j][0] || '');
        var cod = String(fl[j][1] || '');
        var act = (fl[j][3] === false) ? 'DESACTIVADO' : 'activo';
        L.push('   ' + (j + 1) + ') NOMBRE: "' + nom + '"');
        L.push('      CODIGO: "' + cod + '"   (' + cod.length + ' caracteres) — ' + act);
        if (!cod) mal('      ^ Este gestor NO TIENE CODIGO. Nunca podra entrar.');
      }
      L.push('');
      ok('Total de gestores: ' + fl.length);
    }
  } catch (e) {
    mal('No pude leer los gestores: ' + e.message);
  }


  /* ---------- 5. PRUEBA DE LOGIN REAL ---------- */
  titulo('5. PRUEBA DE LOGIN');
  if (!PRUEBA_NOMBRE || !PRUEBA_CODIGO) {
    L.push('  (Saltada. Si quieres probarla, escribe PRUEBA_NOMBRE y PRUEBA_CODIGO');
    L.push('   hasta arriba de este archivo, guarda y vuelve a ejecutar.)');
  } else {
    try {
      var r = apiLogin(PRUEBA_NOMBRE, PRUEBA_CODIGO, 'PRUEBA-DESDE-EDITOR');
      if (r && r.ok) {
        ok('LOGIN CORRECTO para "' + r.datos.gestor + '".');
        ok('   El problema NO esta en el nombre ni en el codigo.');
        ok('   Entonces el problema esta en la conexion (revisa el paso 7).');
      } else {
        mal('LOGIN RECHAZADO. El servidor contesto: "' + (r ? r.error : '?') + '"');
      }
    } catch (e) {
      mal('El login reviento: ' + e.message);
    }
  }


  /* ---------- 6. CARPETAS DE DRIVE ---------- */
  titulo('6. CARPETAS DE DRIVE (¿dejan guardar fotos y firmas?)');
  var carpetas = (typeof CFG !== 'undefined' && CFG.CARPETAS_DRIVE) ? CFG.CARPETAS_DRIVE : {};
  var nombres = Object.keys(carpetas);
  if (!nombres.length) {
    mal('No hay carpetas configuradas en 00_CONFIG.gs');
  } else {
    for (var k = 0; k < nombres.length; k++) {
      var etiqueta = nombres[k];
      var id = String(carpetas[etiqueta] || '');
      if (!id) { aviso(etiqueta + ': sin ID configurado (se omite).'); continue; }
      try {
        var carp = DriveApp.getFolderById(id);
        var prueba = carp.createFile('PRUEBA_BORRAR.txt', 'prueba', MimeType.PLAIN_TEXT);
        prueba.setTrashed(true);
        ok(etiqueta + ': "' + carp.getName() + '" — LEE y ESCRIBE. Perfecto.');
      } catch (e2) {
        try {
          var c2 = DriveApp.getFolderById(id);
          mal(etiqueta + ': "' + c2.getName() + '" — la VEO pero NO puedo escribir.');
          mal('      >>> Abre esa carpeta en Drive > Compartir > pon tu correo como EDITOR.');
        } catch (e3) {
          mal(etiqueta + ': ni siquiera puedo abrirla. ID malo o sin permiso: ' + id);
        }
      }
    }
  }


  /* ---------- 7. LA DIRECCION QUE USA LA APP ---------- */
  titulo('7. LA DIRECCION (URL) — REVISALA A MANO');
  L.push('  Este reporte NO puede ver que URL tiene tu app del celular.');
  L.push('  Haz esto tu, en el navegador de la computadora:');
  L.push('');
  L.push('  a) Copia la URL de tu aplicacion web (la que termina en /exec).');
  L.push('  b) Pegala en el navegador y agregale al final:   ?api=ping');
  L.push('  c) Enter.');
  L.push('');
  L.push('  DEBE salir un texto parecido a:');
  L.push('     {"ok":true,"datos":{"version":"2.1.0","hora":"..."}}');
  L.push('');
  L.push('  Si sale la app (la pantalla de login) en vez del texto  -> 04_API.gs no esta pegado.');
  L.push('  Si sale una pantalla de Google pidiendo cuenta          -> el acceso NO esta en "Cualquier usuario".');
  L.push('  Si sale "Script function not found: doGet"              -> no has creado la implementacion.');
  L.push('  Si sale la version 2.0.x                               -> no creaste NUEVA VERSION al implementar.');


  /* ---------- VEREDICTO ---------- */
  L.push('');
  L.push('╔══════════════════════════════════════════════════════════╗');
  if (errores === 0) {
    L.push('║  RESULTADO: sin errores. ' + avisos + ' aviso(s).');
    L.push('║  Si aun asi no entra, el problema esta en el paso 7.      ');
  } else {
    L.push('║  RESULTADO: ' + errores + ' ERROR(ES) y ' + avisos + ' aviso(s).');
    L.push('║  Arregla primero los que dicen [ERROR], de arriba a abajo.');
  }
  L.push('╚══════════════════════════════════════════════════════════╝');

  var texto = L.join('\n');
  Logger.log(texto);
  console.log(texto);

  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(
        '<pre style="font:12px/1.45 monospace;white-space:pre-wrap">' +
        texto.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>'
      ).setWidth(720).setHeight(560),
      'Revision de la app'
    );
  } catch (e) { /* si se corrio desde el editor, basta con el registro */ }

  return texto;
}


/** Fecha corta para el encabezado del reporte. */
function _fechaCorta() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}
