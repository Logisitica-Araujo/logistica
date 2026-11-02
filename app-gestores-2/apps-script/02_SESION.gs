/***********************************************************************
 * APP GESTORES 2 — 02_SESION.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * Usuarios y sesión.
 *   • Las contraseñas se guardan CIFRADAS (nadie puede leerlas, ni la
 *     administradora). Solo se pueden restablecer.
 *   • La sesión NO caduca por tiempo. Se cierra solo si:
 *       - el gestor toca "Cerrar sesión",
 *       - la administradora lo da de baja (Activo = NO), o
 *       - la administradora restablece su contraseña.
 *   • 5 intentos fallidos bloquean ese usuario 15 minutos.
 ***********************************************************************/

/* ==================== Cifrado ==================== */

function _sal() {
  var s = PropertiesService.getScriptProperties().getProperty('SAL');
  if (!s) throw _falla('APP-01', 'Falta la clave secreta del cifrado. Corre ⚙ App Gestores → Instalar / reparar.');
  return s;
}

/** Cifra una contraseña. Se repite varias vueltas para que adivinarla
 *  probando millones de combinaciones sea muy lento. */
function _cifrar(usuario, clave) {
  var sal = _sal();
  var h = String(clave);
  for (var i = 0; i < APPG.VUELTAS_CIFRADO; i++) {
    h = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(h + '|' + _norm(usuario), sal));
  }
  return h;
}

/** Contraseña temporal de 8 caracteres, sin letras que se confunden (0/O, 1/l). */
function _claveTemporal() {
  var abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  var hex = Utilities.getUuid().replace(/-/g, '');
  var out = '';
  for (var i = 0; i < 8; i++) out += abc.charAt(parseInt(hex.substr(i * 2, 2), 16) % abc.length);
  return out;
}


/* ==================== Token de sesión ==================== */
/* El token lleva: usuario | versión de sesión. Va firmado con la sal,
   así que nadie puede inventarse uno. Restablecer la contraseña sube la
   versión y deja inservibles los tokens viejos. */

function _firmar(texto) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, _sal())); }

function _crearToken(usuario, version) {
  var carga = Utilities.base64EncodeWebSafe(_norm(usuario) + '|' + version);
  return carga + '.' + _firmar(carga);
}

/** Devuelve el gestor dueño del token, o lanza CEL-06 (pedir entrar otra vez). */
function _exigirSesion(token) {
  var t = String(token || '');
  var p = t.split('.');
  if (p.length !== 2 || _firmar(p[0]) !== p[1]) throw _falla('CEL-06', 'Tu sesión no es válida. Entra de nuevo.');
  var datos = Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0])).getDataAsString().split('|');
  var u = _usuarioCache(datos[0]);
  if (!u || !_si(u.Activo)) throw _falla('CEL-06', 'Tu usuario está dado de baja. Habla con tu administradora.');
  if (String(u.VersionSesion || 1) !== String(datos[1])) throw _falla('CEL-06', 'Tu contraseña cambió. Entra de nuevo.');
  return u;
}

/** Busca un usuario recordándolo 5 minutos (así no se lee la pestaña en cada consulta). */
function _usuarioCache(usuario) {
  var cache = CacheService.getScriptCache();
  var k = 'usr_' + _norm(usuario);
  var c = cache.get(k);
  if (c) return JSON.parse(c);
  var u = _buscarUsuario(usuario);
  if (u) {
    var limpio = { Numero: u.Numero, Nombre: u.Nombre, NombreEnOperaciones: u.NombreEnOperaciones, Usuario: u.Usuario,
                   Rol: u.Rol, Activo: u.Activo, VersionSesion: u.VersionSesion, DebeCambiar: u.DebeCambiar };
    try { cache.put(k, JSON.stringify(limpio), APPG.CACHE_USUARIO_SEG); } catch (e) {}
    return limpio;
  }
  return null;
}

function _buscarUsuario(usuario) {
  var n = _norm(usuario);
  if (!n) return null;
  var t = _tabla(APPG.H.USUARIOS);
  for (var i = 0; i < t.filas.length; i++) {
    if (_norm(t.filas[i].Usuario) === n) { var f = t.filas[i]; f._t = t; return f; }
  }
  return null;
}

function _olvidarUsuario(usuario) { CacheService.getScriptCache().remove('usr_' + _norm(usuario)); }


/* ==================== Acciones de la app ==================== */

/** login {usuario, clave, dispositivo} → {token, nombre, numero, debeCambiar} */
function apiLogin(p) {
  var usuario = String(p.usuario || '').trim();
  var cache = CacheService.getScriptCache();
  var kBloq = 'bloq_' + _norm(usuario);
  var intentos = Number(cache.get(kBloq) || 0);
  if (intentos >= APPG.INTENTOS_MAX) {
    throw _falla('APP-02', 'Demasiados intentos. Espera ' + APPG.BLOQUEO_MIN + ' minutos o pide a tu administradora que restablezca tu contraseña.');
  }
  var cfg = _config();
  if (_si(cfg.APP_BLOQUEADA)) throw _falla('APP-07', String(cfg.MENSAJE_BLOQUEO || 'App en mantenimiento.'));

  var u = _buscarUsuario(usuario);
  var bien = u && _si(u.Activo) && String(u.ClaveCifrada) === _cifrar(usuario, String(p.clave || ''));
  _agregar(APPG.H.SESIONES, { FechaHora: _ahora(), Usuario: usuario, NumeroGestor: u ? u.Numero : '',
                              Dispositivo: String(p.dispositivo || '').slice(0, 200), Resultado: bien ? 'ENTRÓ' : 'FALLÓ' });
  if (!bien) {
    cache.put(kBloq, String(intentos + 1), APPG.BLOQUEO_MIN * 60);
    // Mismo mensaje si el usuario no existe o la contraseña está mal: así no se puede adivinar quién existe.
    throw _falla('APP-02', 'Usuario o contraseña incorrectos.');
  }
  cache.remove(kBloq);
  u._t.sh.getRange(u._fila, u._t.col('UltimoAcceso')).setValue(_ahora());
  _log(u.Nombre, 'LOGIN', String(p.dispositivo || '').slice(0, 120));
  return { token: _crearToken(u.Usuario, u.VersionSesion || 1), nombre: u.Nombre, numero: u.Numero,
           debeCambiar: _si(u.DebeCambiar) };
}

/** cambiarClave {token, actual, nueva} → {token} (token nuevo; los demás celulares siguen dentro) */
function apiCambiarClave(p) {
  var s = _exigirSesion(p.token);
  var nueva = String(p.nueva || '');
  if (nueva.length < APPG.CLAVE_MIN) throw _falla('CAP-01', 'La contraseña debe tener al menos ' + APPG.CLAVE_MIN + ' caracteres.');
  var u = _buscarUsuario(s.Usuario);
  if (String(u.ClaveCifrada) !== _cifrar(u.Usuario, String(p.actual || ''))) throw _falla('APP-02', 'La contraseña actual no es correcta.');
  if (String(p.actual) === nueva) throw _falla('CAP-01', 'La nueva contraseña debe ser distinta.');
  u._t.sh.getRange(u._fila, u._t.col('ClaveCifrada')).setValue(_cifrar(u.Usuario, nueva));
  u._t.sh.getRange(u._fila, u._t.col('DebeCambiar')).setValue(false);
  _olvidarUsuario(u.Usuario);
  _log(u.Nombre, 'CAMBIA_CLAVE', '');
  return { token: _crearToken(u.Usuario, u.VersionSesion || 1), debeCambiar: false };
}

/** yo {token} → perfil del gestor y reglas que la app necesita. */
function apiYo(p) {
  var u = _exigirSesion(p.token);
  var cfg = _config();
  return {
    numero: u.Numero, nombre: u.Nombre, debeCambiar: _si(u.DebeCambiar),
    reglas: {
      exigirFotoEntrega: _si(cfg.EXIGIR_FOTO_ENTREGA), exigirFirmaEntrega: _si(cfg.EXIGIR_FIRMA_ENTREGA),
      exigirQuienRecibio: _si(cfg.EXIGIR_QUIEN_RECIBIO), exigirFotoNoEntrega: _si(cfg.EXIGIR_FOTO_NOENTREGA),
      palabrasExigenFirma: String(cfg.PALABRAS_EXIGEN_FIRMA || '').split('|').map(function (x) { return x.trim(); }).filter(String)
    },
    versionServidor: APPG.VERSION
  };
}


/* ==================== Administración (desde el menú) ==================== */

function altaGestor(nombre, nombreEnOps, usuario) {
  usuario = String(usuario || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('El usuario debe tener de 3 a 30 letras o números, sin espacios ni acentos.');
  if (!String(nombre || '').trim() || !String(nombreEnOps || '').trim()) throw new Error('Faltan el nombre o el nombre en Operaciones.');
  if (_buscarUsuario(usuario)) throw new Error('Ya existe el usuario ' + usuario + '.');
  var t = _tabla(APPG.H.USUARIOS);
  var max = 0;
  t.filas.forEach(function (f) { var m = /G-(\d+)/.exec(String(f.Numero)); if (m) max = Math.max(max, Number(m[1])); });
  var numero = 'G-' + (max < 9 ? '0' : '') + (max + 1);
  var clave = _claveTemporal();
  _agregar(APPG.H.USUARIOS, {
    Numero: numero, Nombre: String(nombre).trim(), NombreEnOperaciones: String(nombreEnOps).trim(), Usuario: usuario,
    ClaveCifrada: _cifrar(usuario, clave), Rol: 'Gestor', Activo: true, DebeCambiar: true, VersionSesion: 1,
    Alta: _ahora(), UltimoAcceso: '', Notas: ''
  });
  _log('administradora', 'ALTA_GESTOR', numero + ' · ' + usuario);
  return { numero: numero, usuario: usuario, clave: clave };
}

function restablecerClave(usuario) {
  var u = _buscarUsuario(usuario);
  if (!u) throw new Error('No existe el usuario ' + usuario + '.');
  var clave = _claveTemporal();
  var sh = u._t.sh;
  sh.getRange(u._fila, u._t.col('ClaveCifrada')).setValue(_cifrar(u.Usuario, clave));
  sh.getRange(u._fila, u._t.col('DebeCambiar')).setValue(true);
  sh.getRange(u._fila, u._t.col('VersionSesion')).setValue(Number(u.VersionSesion || 1) + 1);   // cierra sesiones abiertas
  CacheService.getScriptCache().remove('bloq_' + _norm(usuario));
  _olvidarUsuario(usuario);
  _log('administradora', 'RESTABLECE_CLAVE', u.Numero + ' · ' + u.Usuario);
  return clave;
}

function bajaGestor(usuario) {
  var u = _buscarUsuario(usuario);
  if (!u) throw new Error('No existe el usuario ' + usuario + '.');
  u._t.sh.getRange(u._fila, u._t.col('Activo')).setValue(false);
  _olvidarUsuario(usuario);
  _log('administradora', 'BAJA_GESTOR', u.Numero + ' · ' + u.Usuario);
}
