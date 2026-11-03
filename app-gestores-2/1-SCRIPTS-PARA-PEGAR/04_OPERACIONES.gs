/***********************************************************************
 * APP GESTORES 2 — 04_OPERACIONES.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * Cómo habla el ROBOT con la API de OPERACIONES (nunca los celulares).
 *   • La dirección /exec va en APP_Config → OPERACIONES_URL.
 *   • El usuario y PIN del usuario de servicio (rol "App" en OPS_Usuarios)
 *     van en Propiedades del script (OPS_USUARIO, OPS_PIN). NUNCA en el código.
 *   • Menú ⚙ App Gestores → Conectar con OPERACIONES los guarda y prueba.
 ***********************************************************************/

/* Códigos de error de la API → códigos de la guía ERRORES_Y_SOLUCIONES.md */
var APPG_ERR_API = { SESION: 'API-01', PERMISO: 'API-02', FILA: 'API-03', OCUPADO: 'API-04', LISTA: 'API-05', MOTIVO: 'API-06' };

/** Llama a una acción de la API. Devuelve su respuesta {ok, ...}.
 *  Si la sesión venció, entra de nuevo una vez y reintenta. */
function _ops(accion, datos) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('OPS_TOKEN') || _opsEntrar();
  var cuerpo = Object.assign({}, datos || {}, { accion: accion, token: token });
  var r = _opsFetch(cuerpo);
  if (!r.ok && r.error === 'SESION') {
    cuerpo.token = _opsEntrar();
    r = _opsFetch(cuerpo);
  }
  if (!r.ok) r.codigo = APPG_ERR_API[r.error] || 'API-07';
  return r;
}

function _opsEntrar() {
  var props = PropertiesService.getScriptProperties();
  var u = props.getProperty('OPS_USUARIO'), pin = props.getProperty('OPS_PIN');
  if (!u || !pin) throw _falla('API-01', 'Falta conectar con OPERACIONES (⚙ App Gestores → Conectar con OPERACIONES).');
  var r = _opsFetch({ accion: 'login', correo: u, pin: pin });
  if (!r.ok || !r.token) throw _falla('API-01', 'OPERACIONES no aceptó el usuario de la app: ' + (r.mensaje || r.error || ''));
  if (r.rol !== 'App' && r.rol !== 'Administrador') throw _falla('API-02', 'El usuario de la app en OPS_Usuarios debe tener rol "App" (tiene "' + r.rol + '").');
  props.setProperty('OPS_TOKEN', r.token);
  return r.token;
}

function _opsFetch(cuerpo) {
  var url = String(_config().OPERACIONES_URL || '').trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) throw _falla('API-07', 'Falta o está mal la dirección de OPERACIONES en APP_Config → OPERACIONES_URL.');
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'text/plain', payload: JSON.stringify(cuerpo), muteHttpExceptions: true,
    // Con esto la API contesta aunque su implementación sea "solo personas de fadermex.com".
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  var txt = resp.getContentText();
  try { return JSON.parse(txt); }
  catch (e) { throw _falla('API-07', 'OPERACIONES contestó una página en vez de datos (código ' + resp.getResponseCode() + '). Revisa su implementación.'); }
}


/* ==================== Menú ==================== */

function menuConectarOperaciones() {
  var ui = SpreadsheetApp.getUi();
  var url = _preguntar(ui, 'Conectar con OPERACIONES (1 de 3)',
    'Dirección /exec de OPERACIONES · Backend\n(Implementar → Gestionar implementaciones → copia la URL):'); if (!url) return;
  var usuario = _preguntar(ui, 'Conectar con OPERACIONES (2 de 3)', 'Usuario de la app en OPS_Usuarios (rol "App"):'); if (!usuario) return;
  var pin = _preguntar(ui, 'Conectar con OPERACIONES (3 de 3)', 'PIN de ese usuario:'); if (!pin) return;
  try { ui.alert('Listo', conectarOperaciones(url, usuario, pin), ui.ButtonSet.OK); }
  catch (e) { ui.alert('No se pudo conectar', '[' + (e.codigo || '') + '] ' + e.message, ui.ButtonSet.OK); }
}

function conectarOperaciones(url, usuario, pin) {
  var t = _tabla(APPG.H.CONFIG);
  var f = t.filas.filter(function (x) { return x.Clave === 'OPERACIONES_URL'; })[0];
  if (f) t.sh.getRange(f._fila, t.col('Valor')).setValue(String(url).trim());
  CacheService.getScriptCache().remove('cfg');
  var props = PropertiesService.getScriptProperties();
  props.setProperty('OPS_USUARIO', String(usuario).trim());
  props.setProperty('OPS_PIN', String(pin).trim());
  props.deleteProperty('OPS_TOKEN');
  _opsEntrar();
  var r = _ops('rutaGestores', {});
  if (!r.ok) throw _falla(r.codigo, r.mensaje || 'La API no contestó la ruta de gestores.');
  var veh = _importarVehiculos();
  _log('administradora', 'CONECTAR_OPERACIONES', r.pedidos.length + ' pedidos abiertos con gestor');
  return 'Conectado. OPERACIONES tiene ' + r.pedidos.length + ' pedidos abiertos con gestor asignado.' +
         (veh ? '\nSe importaron ' + veh + ' vehículos a APP_Vehiculos (revisa la columna Tipo: MOTO o AUTO).' : '');
}

/** Si APP_Vehiculos está vacía, la llena con la lista de vehículos de "Datos" (vía API). */
function _importarVehiculos() {
  if (_tabla(APPG.H.VEHICULOS).filas.length) return 0;
  var r = _ops('listas', {});
  if (!r.ok || !r.listas || !r.listas.vehiculos) return 0;
  var n = 0;
  r.listas.vehiculos.forEach(function (v) {
    if (!v || /^no aplica$/i.test(v)) return;
    var moto = /suzuki|moto|gixxer|italika|honda|yamaha|bajaj|vento|dinamo|fed/i.test(v);
    _agregar(APPG.H.VEHICULOS, { Vehiculo: v, Tipo: /^(sin veh|a pie|camin)/.test(_norm(v)) ? 'NINGUNO' : moto ? 'MOTO' : 'AUTO', Placa: '', Activo: true });
    n++;
  });
  var hayPie = r.listas.vehiculos.some(function (v) { return /^(sin veh|a pie|camin)/.test(_norm(v)); });
  if (!hayPie) _agregar(APPG.H.VEHICULOS, { Vehiculo: 'Sin vehículo', Tipo: 'NINGUNO', Placa: '', Activo: true });
  return n;
}
