/***********************************************************************
 * APP GESTORES 2 — 03_API.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * La puerta de entrada del celular.
 *   POST (texto JSON)  { "accion": "...", "token": "...", ...datos }
 *   Respuesta          { "ok": true, ... }  o
 *                      { "ok": false, "codigo": "CEL-06", "mensaje": "..." }
 *   El "codigo" es el de la guía ERRORES_Y_SOLUCIONES.md.
 *
 * Prueba rápida: abre la dirección /exec con ?ping=1 al final.
 * Contrato completo: app-gestores-2/CONTRATO.md
 ***********************************************************************/

/* Acciones de la etapa 1. Las demás del contrato llegan en la etapa 2. */
var APPG_ACCIONES = {
  login:       { fn: function (p) { return apiLogin(p); },       sinSesion: true },
  cambiarClave:{ fn: function (p) { return apiCambiarClave(p); } },
  yo:          { fn: function (p) { return apiYo(p); } }
};
var APPG_PROXIMAS = ['inicio', 'vehiculo', 'cerrar', 'recolectar', 'problema', 'documentos'];

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) {
    return _json({ ok: true, app: 'App Gestores 2', version: APPG.VERSION, hora: _ahora() });
  }
  return _json({ ok: true, app: 'App Gestores 2', nota: 'Esta dirección la usa la app del celular.' });
}

function doPost(e) {
  var p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return _json({ ok: false, codigo: 'APP-01', mensaje: 'La consulta llegó dañada.' }); }
  return _json(manejar(p));
}

/** Separado de doPost para poder probarlo desde el editor. */
function manejar(p) {
  var accion = String((p && p.accion) || '');
  try {
    var a = APPG_ACCIONES[accion];
    if (!a) {
      if (APPG_PROXIMAS.indexOf(accion) >= 0) return { ok: false, codigo: 'APP-09', mensaje: 'Esta función llega en la siguiente versión.' };
      return { ok: false, codigo: 'APP-01', mensaje: 'Acción desconocida: ' + accion };
    }
    if (!a.sinSesion) {
      var cfg = _config();
      if (_si(cfg.APP_BLOQUEADA)) return { ok: false, codigo: 'APP-07', mensaje: String(cfg.MENSAJE_BLOQUEO || 'App en mantenimiento.') };
    }
    var r = a.fn(p) || {};
    r.ok = true;
    return r;
  } catch (err) {
    if (err && err.codigo) return { ok: false, codigo: err.codigo, mensaje: err.message };
    _log('sistema', 'ERROR', accion + ' · ' + (err && err.stack ? err.stack : err));
    return { ok: false, codigo: 'APP-01', mensaje: 'Error interno. Ya quedó anotado; avisa a tu administradora.' };
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
