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
    .addItem('Dar de alta varios gestores', 'menuAltaVarios')
    .addItem('Nuevo gestor', 'menuNuevoGestor')
    .addItem('Poner contraseña a un gestor', 'menuPonerClave')
    .addItem('Restablecer contraseña (temporal al azar)', 'menuRestablecer')
    .addItem('Dar de baja a un gestor', 'menuBaja')
    .addSeparator()
    .addItem('Conectar con OPERACIONES', 'menuConectarOperaciones')
    .addItem('Instalar robot', 'instalarRobot')
    .addItem('Correr el robot ahora', 'correrRobotAhora')
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
  if (_tabla(APPG.H.SUCURSALES).filas.length === 0) {
    APPG.SUCURSALES_INICIALES.forEach(function (x) {
      _agregar(APPG.H.SUCURSALES, { Sucursal: x[0], ID: x[1], Direccion: x[2], URLMaps: x[3], Activo: true });
    });
    hecho.push('Sucursales cargadas con su dirección (revisa Botican y Morelia: no tenían dirección).');
  }
  if (_tabla(APPG.H.DOCUMENTOS).filas.length === 0) {
    var base = 'https://logisitica-araujo.github.io/logistica/';
    [['Protocolos', 'Cómo entregar un pedido a domicilio', 'texto',
      '1. Saluda y preséntate con tu credencial.\n2. Confirma el nombre del cliente y el número de pedido.\n3. Toma la foto de la fachada desde la app (que se vea el número).\n4. Pide la firma o anota quién recibió. Si llevas efectivo o documentos, las dos.\n5. Toca «Finalizar entrega» y manda el aviso por WhatsApp.', 1],
     ['Protocolos', 'Qué hacer si el cliente no está', 'texto',
      '1. Llama o manda mensaje al cliente.\n2. Espera unos minutos.\n3. Si no aparece: «No entregué» → Retorno → «No se encontraba cliente», con foto de la fachada.\n4. Regresa el pedido a Logística.', 2],
     ['Vehículos', 'Póliza de seguro · Saveiro', 'enlace', base + 'poliza-seguro-saveiro.pdf', 3],
     ['Vehículos', 'Póliza de seguro · Suzuki Gixxer', 'enlace', base + 'poliza-suzuki-gixxer.pdf', 4],
     ['Vehículos', 'Permiso de carga · Saveiro', 'enlace', base + 'permiso-carga-saveiro.pdf', 5]
    ].forEach(function (d) {
      _agregar(APPG.H.DOCUMENTOS, { Categoria: d[0], Titulo: d[1], Tipo: d[2], Contenido: d[3].replace(/\\n/g, '\n'), Activo: true, Orden: d[4] });
    });
    hecho.push('Documentos iniciales cargados (protocolos y pólizas).');
  }

  /* 4b) Listas desplegables en APP_Usuarios: Area (Gestoría / Facturación) y Rol (Gestor / Administrador).
         Los renglones sin área quedan en Gestoría. */
  try {
    var us = _tabla(APPG.H.USUARIOS), filasU = Math.max(us.sh.getMaxRows() - 1, 1);
    var dv = function (lista) { return SpreadsheetApp.newDataValidation().requireValueInList(lista, true).setAllowInvalid(false).build(); };
    us.sh.getRange(2, us.col('Area'), filasU, 1).setDataValidation(dv(APPG.AREAS));
    us.sh.getRange(2, us.col('Rol'), filasU, 1).setDataValidation(dv(APPG.ROLES));
    var sinArea = 0;
    us.filas.forEach(function (f) { if (!String(f.Area || '').trim()) { us.sh.getRange(f._fila, us.col('Area')).setValue('Gestoría'); sinArea++; } });
    if (sinArea) hecho.push('APP_Usuarios: ' + sinArea + ' persona(s) quedaron en Área = Gestoría. Cambia a "Facturación" a quien haga traslados (Alejandro, Belarmino).');
    var ve = _tabla(APPG.H.VEHICULOS);
    ve.sh.getRange(2, ve.col('EnTaller'), Math.max(ve.sh.getMaxRows() - 1, 1), 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  } catch (e) { hecho.push('No pude poner las listas de Área/Rol: ' + e.message); }

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
  var fac = ui.alert('¿Es del área de Facturación?', 'Sí = Facturación (traslados: traspasos, efectivo, documentos, IMSS).\nNo = Gestoría (pedidos a domicilio y recolecciones).', ui.ButtonSet.YES_NO);
  try {
    var r = altaGestor(nombre, enOps, usuario, fac === ui.Button.YES ? 'Facturación' : 'Gestoría');
    ui.alert('Gestor dado de alta',
      'Número: ' + r.numero + '\nUsuario: ' + r.usuario + '\nContraseña temporal: ' + r.clave +
      '\n\nDásela EN PERSONA. Al entrar por primera vez la app le pide cambiarla.\nEsta contraseña no se vuelve a mostrar.',
      ui.ButtonSet.OK);
  } catch (e) { ui.alert('No se pudo', e.message, ui.ButtonSet.OK); }
}

/** Pega los nombres tal como están en la hoja "Datos" (columna A, Gestores), uno por renglón.
 *  El usuario se arma solo (sin acentos, comillas ni espacios): Antonio "A" → antonio. */
function menuAltaVarios() {
  var ui = SpreadsheetApp.getUi();
  var txt = _preguntar(ui, 'Dar de alta varios gestores',
    'Escribe los nombres EXACTOS como están en "Datos" (columna Gestores), separados por punto y coma ;\nEjemplo:  Antonio "A"; Jose Luis; Alejandro');
  if (!txt) return;
  var r = altaVarios(txt);
  var out = r.map(function (x) { return x.error ? '✘ ' + x.nombre + ': ' + x.error : x.numero + '  ' + x.usuario + '  →  contraseña: ' + x.clave; });
  var html = '<pre style="font:14px/1.6 monospace;white-space:pre-wrap">' +
    ('Anota estas contraseñas temporales y dáselas EN PERSONA. No se vuelven a mostrar.\n\n' + out.join('\n')).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(380), 'Gestores dados de alta');
}

function altaVarios(texto) {
  var vistos = {};
  return String(texto || '').split(/\r?\n|;/).map(function (n) { return n.trim(); }).filter(String).map(function (n) {
    var base = _norm(n).replace(/"[^"]*"/g, '').replace(/[^a-z0-9]/g, '') || 'gestor';
    var usuario = base, k = 2;
    while (vistos[usuario] || _buscarUsuario(usuario)) usuario = base + (k++);
    vistos[usuario] = true;
    var mostrar = n.replace(/\s*"[^"]*"\s*/g, ' ').trim() || n;
    try { var a = altaGestor(mostrar, n, usuario); return { nombre: n, numero: a.numero, usuario: a.usuario, clave: a.clave }; }
    catch (e) { return { nombre: n, error: e.message }; }
  });
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

function menuPonerClave() {
  var ui = SpreadsheetApp.getUi();
  var usuario = _preguntar(ui, 'Poner contraseña (1 de 2)', 'Usuario del gestor (ej. joseluis):'); if (!usuario) return;
  var clave = _preguntar(ui, 'Poner contraseña (2 de 2)', 'Contraseña nueva (mínimo ' + APPG.CLAVE_MIN + ' caracteres).\nNo se guarda a la vista: queda cifrada.'); if (!clave) return;
  var r = ui.alert('¿Le pido que la cambie al entrar?', 'Sí = al entrar crea su propia contraseña (recomendado).\nNo = se queda con la que acabas de poner.', ui.ButtonSet.YES_NO);
  try {
    ponerClave(usuario, clave, r === ui.Button.YES);
    ui.alert('Listo', 'Contraseña de ' + usuario + ' cambiada. Su sesión anterior se cerró en todos sus celulares.', ui.ButtonSet.OK);
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
