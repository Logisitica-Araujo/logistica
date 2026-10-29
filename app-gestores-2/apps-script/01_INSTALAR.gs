/***********************************************************************
 * APP GESTORES 2 — 01_INSTALAR.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * INSTALAR(): se corre una vez (y cuantas veces quieras para reparar).
 *   • Crea las pestañas que falten, con sus encabezados.
 *   • Agrega a APP_Config y APP_Motivos solo lo que falte.
 *   • Protege las pestañas que no se editan a mano (solo aviso).
 *   • Crea la "sal" secreta del cifrado en Propiedades del script.
 *   NUNCA borra pestañas, renglones ni valores que ya existan.
 *
 * Menú ⚙ App Gestores (aparece al abrir el archivo):
 *   Instalar / reparar · Nuevo gestor · Restablecer contraseña · Dar de baja
 ***********************************************************************/

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚙ App Gestores')
    .addItem('Instalar / reparar', 'INSTALAR')
    .addSeparator()
    .addItem('Nuevo gestor', 'menuNuevoGestor')
    .addItem('Restablecer contraseña', 'menuRestablecer')
    .addItem('Dar de baja a un gestor', 'menuBaja')
    .addSeparator()
    .addItem('Probar etapa 1', 'PRUEBA_ETAPA1')
    .addToUi();
}

function INSTALAR() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || _libro();
  var props = PropertiesService.getScriptProperties();
  var hecho = [];

  /* 1) Recordar qué archivo es (para las consultas desde el celular). */
  props.setProperty('ID_ARCHIVO', ss.getId());
  __APPG_LIBRO = ss;

  /* 2) Sal secreta del cifrado: se crea UNA vez y no se cambia nunca
        (si cambiara, ninguna contraseña guardada serviría). */
  if (!props.getProperty('SAL')) {
    props.setProperty('SAL', Utilities.getUuid() + Utilities.getUuid());
    hecho.push('Se creó la clave secreta del cifrado (Propiedades del script).');
  }

  /* 3) Pestañas con sus encabezados. */
  Object.keys(APPG.ENC).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre);
    if (!sh) {
      sh = ss.insertSheet(nombre);
      hecho.push('Pestaña nueva: ' + nombre);
    }
    var enc = APPG.ENC[nombre];
    var actual = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    // Agrega al final las columnas que falten, sin mover las existentes.
    var faltan = enc.filter(function (h) { return actual.indexOf(h) < 0; });
    if (faltan.length) {
      sh.getRange(1, actual.filter(String).length + 1, 1, faltan.length).setValues([faltan]);
      if (actual.filter(String).length) hecho.push(nombre + ': columnas agregadas ' + faltan.join(', '));
    }
    sh.getRange(1, 1, 1, Math.max(enc.length, sh.getLastColumn())).setFontWeight('bold').setBackground('#0B3D91').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  });

  /* 4) Valores iniciales que falten. */
  var cfg = _tabla(APPG.H.CONFIG);
  var claves = cfg.filas.map(function (f) { return String(f.Clave).trim(); });
  APPG.CONFIG_INICIAL.forEach(function (c) {
    if (claves.indexOf(c[0]) < 0) { _agregar(APPG.H.CONFIG, { 'Clave': c[0], 'Valor': c[1], 'Descripción': c[2] }); }
  });
  if (_tabla(APPG.H.MOTIVOS).filas.length === 0) {
    APPG.MOTIVOS_INICIALES.forEach(function (m) {
      _agregar(APPG.H.MOTIVOS, { Tipo: m[0], Motivo: m[1], PideComentario: m[2], Activo: m[3] });
    });
    hecho.push('Motivos iniciales cargados (iguales a la app actual).');
  }

  /* 5) Proteger lo que no se edita a mano. Solo AVISO: Google pregunta
        "¿seguro?" antes de dejar editar; no bloquea a la administradora. */
  Object.keys(APPG.ENC).forEach(function (nombre) {
    if (APPG.EDITABLES.indexOf(nombre) >= 0) return;
    var sh = ss.getSheetByName(nombre);
    try {
      if (!sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
        sh.protect().setDescription('La llena la app. No editar a mano.').setWarningOnly(true);
      }
    } catch (e) { /* en el simulador no hay protecciones */ }
  });

  CacheService.getScriptCache().remove('cfg');
  _log('administradora', 'INSTALAR', 'versión ' + APPG.VERSION + ' · ' + hecho.length + ' cambios');
  var msg = 'App Gestores ' + APPG.VERSION + ' instalada.\n\n' + (hecho.length ? '• ' + hecho.join('\n• ') : 'Todo estaba en orden; no hubo cambios.');
  _avisar(msg);
  return msg;
}


/* ==================== Menú: gestores ==================== */

function menuNuevoGestor() {
  var ui = SpreadsheetApp.getUi();
  var nombre = _preguntar(ui, 'Nuevo gestor (1 de 3)', 'Nombre para mostrar (ej. Jose Luis):'); if (!nombre) return;
  var enOps = _preguntar(ui, 'Nuevo gestor (2 de 3)',
    'Nombre EXACTO como aparece en la columna I de Operaciones\n(lista de gestores de la hoja "Datos", columna A):'); if (!enOps) return;
  var usuario = _preguntar(ui, 'Nuevo gestor (3 de 3)', 'Usuario para entrar (corto, sin espacios, ej. joseluis):'); if (!usuario) return;
  try {
    var r = altaGestor(nombre, enOps, usuario);
    ui.alert('Gestor dado de alta',
      'Número: ' + r.numero + '\nUsuario: ' + r.usuario + '\nContraseña temporal: ' + r.clave +
      '\n\nDásela EN PERSONA. Al entrar por primera vez la app le pide cambiarla.\nEsta contraseña no se vuelve a mostrar.',
      ui.ButtonSet.OK);
  } catch (e) { ui.alert('No se pudo', e.message, ui.ButtonSet.OK); }
}

function menuRestablecer() {
  var ui = SpreadsheetApp.getUi();
  var usuario = _preguntar(ui, 'Restablecer contraseña', 'Usuario del gestor:'); if (!usuario) return;
  try {
    var clave = restablecerClave(usuario);
    ui.alert('Contraseña restablecida',
      'Contraseña temporal de ' + usuario + ': ' + clave +
      '\n\nSu sesión anterior se cerró en todos sus celulares. Dásela en persona.', ui.ButtonSet.OK);
  } catch (e) { ui.alert('No se pudo', e.message, ui.ButtonSet.OK); }
}

function menuBaja() {
  var ui = SpreadsheetApp.getUi();
  var usuario = _preguntar(ui, 'Dar de baja', 'Usuario del gestor (no se borra su historial):'); if (!usuario) return;
  try { bajaGestor(usuario); ui.alert('Listo', usuario + ' ya no puede entrar. Su app se cierra en menos de 5 minutos.', ui.ButtonSet.OK); }
  catch (e) { ui.alert('No se pudo', e.message, ui.ButtonSet.OK); }
}

function _preguntar(ui, titulo, texto) {
  var r = ui.prompt(titulo, texto, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return '';
  return String(r.getResponseText() || '').trim();
}

function _avisar(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}
