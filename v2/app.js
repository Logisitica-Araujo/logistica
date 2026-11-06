/***********************************************************************
 * APP GESTORES 2 — app.js (el celular)
 * ---------------------------------------------------------------------
 * Habla SOLO con "App Gestores · Datos" (config.js → APPG_API).
 * Reglas de la casa:
 *   • Abre al instante con lo guardado en el celular y actualiza por detrás.
 *   • La sesión no se cierra sola.
 *   • Nada se pierde: cierres y recolecciones van a una fila en el celular
 *     (IndexedDB) y se suben solos; lo que se está capturando se guarda a
 *     cada paso (borrador).
 *   • Cada error trae el código de ERRORES_Y_SOLUCIONES.md.
 ***********************************************************************/
var VERSION_APP = '2.3.1';
var API = window.APPG_API || '';
var ESPERA_MS = 30000;
var CADA_SEG = 45;          // cada cuánto revisa si hay tareas nuevas (con la app abierta)

var S = {
  token: null, datos: null, vista: '', hayRed: navigator.onLine, ultimaSync: 0, cola: [],
  cierre: null, escaner: null, modoScan: 'recolectar', leidos: [], vistos: null, timer: null, docs: null
};

/* ==================== Guardado en el celular ==================== */
var DB = (function () {
  var db = null;
  function abrir() {
    if (db) return Promise.resolve(db);
    return new Promise(function (res, rej) {
      var r = indexedDB.open('gestores2', 1);
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        d.createObjectStore('kv', { keyPath: 'k' });
        d.createObjectStore('cola', { keyPath: 'idLocal' });
      };
      r.onsuccess = function () { db = r.result; res(db); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(st, modo, fn) {
    return abrir().then(function (d) { return new Promise(function (res, rej) {
      var t = d.transaction(st, modo), q = fn(t.objectStore(st));
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    }); });
  }
  return {
    get: function (k) { return tx('kv', 'readonly', function (s) { return s.get(k); }).then(function (r) { return r ? r.v : null; }).catch(function () { return null; }); },
    set: function (k, v) { return tx('kv', 'readwrite', function (s) { return s.put({ k: k, v: v }); }).catch(function () {}); },
    del: function (k) { return tx('kv', 'readwrite', function (s) { return s.delete(k); }).catch(function () {}); },
    cola: function () { return tx('cola', 'readonly', function (s) { return s.getAll(); }).catch(function () { return []; }); },
    encolar: function (it) { return tx('cola', 'readwrite', function (s) { return s.put(it); }); },
    quitar: function (id) { return tx('cola', 'readwrite', function (s) { return s.delete(id); }).catch(function () {}); }
  };
})();
function guardar(k, v) { try { localStorage.setItem('g2_' + k, v); } catch (e) {} }
function leer(k) { try { return localStorage.getItem('g2_' + k); } catch (e) { return null; } }
function borrar(k) { try { localStorage.removeItem('g2_' + k); } catch (e) {} }

/* ==================== Utilidades ==================== */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clave(v) { return String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase(); }
function hoyTxt() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function horaTxt() { var d = new Date(); return hoyTxt() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); }
function idLocal() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function pintar(html) { $('app').innerHTML = html; window.scrollTo(0, 0); }
var IC = {
  atras: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  campana: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  scan: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
  casa: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  lista: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  libro: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M8 7h8M8 11h6"/></svg>',
  caja: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg>',
  palomita: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  mapa: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  cam: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
};

/* ==================== Avisos ==================== */
function toast(msg, tipo) {
  var p = document.querySelector('.toast'); if (p) p.remove();
  var t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.remove(); }, tipo === 'err' ? 5000 : 2800);
}
function falla(e) { toast((e && e.message ? e.message : String(e)) + (e && e.codigo ? ' (' + e.codigo + ')' : ''), 'err'); sonido('error'); }
function cargando(t) { quitarCargando(); var d = document.createElement('div'); d.className = 'cargando'; d.id = 'cargando'; d.innerHTML = '<div class="spinner"></div><span>' + esc(t || 'Un momento…') + '</span>'; document.body.appendChild(d); }
function quitarCargando() { var d = $('cargando'); if (d) d.remove(); }
/* ---------- Sonidos (elegidos el 3-nov: tarea=B · traspaso=C · escaneo=D · escaneoMal=B · entregado=B · error=A · noEntregado=B · subido=A)
   Se generan en el celular (no hay archivos de audio). Timbres: marimba, campana, suave. ---------- */
var SONIDOS = {
  tarea:       { vibra: [120, 60, 120, 60, 220], notas: [{ f: 523, d: .5, tipo: 'marimba' }, { f: 659, t: .12, d: .5, tipo: 'marimba' }, { f: 784, t: .24, d: .7, tipo: 'marimba' }, { f: 1047, t: .36, d: .9, tipo: 'marimba', v: .9 }] },
  traspaso:    { vibra: [220, 100, 220], notas: [{ f: 440, d: .6, tipo: 'marimba' }, { f: 659, t: .16, d: .8, tipo: 'marimba' }] },
  escaneo:     { vibra: [30, 40, 30], notas: [{ f: 1568, d: .07, tipo: 'suave' }, { f: 2093, t: .08, d: .1, tipo: 'suave' }] },
  escaneoMal:  { vibra: [60, 60, 60], notas: [{ f: 220, d: .2, tipo: 'marimba' }, { f: 220, t: .14, d: .25, tipo: 'marimba' }] },
  entregado:   { vibra: [80, 60, 200], notas: [{ f: 784, d: .5, tipo: 'campana', v: .8 }, { f: 1568, t: .16, d: 1.4, tipo: 'campana' }] },
  error:       { vibra: [100, 60, 100, 60, 100], notas: [{ f: 659, d: .2, tipo: 'suave' }, { f: 523, t: .16, d: .2, tipo: 'suave' }, { f: 349, t: .32, d: .45, tipo: 'suave' }] },
  noEntregado: { vibra: [50, 50, 50], notas: [{ f: 587, d: .3, tipo: 'marimba' }, { f: 587, t: .14, d: .35, tipo: 'marimba' }] },
  subido:      { vibra: [40], notas: [{ f: 400, hasta: 1200, d: .35, tipo: 'suave', v: .7 }] }
};
var AC = null, SALIDA_AUDIO = null;
function sonido(nombre) {
  var sn = SONIDOS[nombre] || SONIDOS.escaneo;
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      var comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      SALIDA_AUDIO = AC.createGain(); SALIDA_AUDIO.gain.value = 0.9; SALIDA_AUDIO.connect(comp); comp.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    var t0 = AC.currentTime + 0.03;
    sn.notas.forEach(function (n) { notaAudio(n, t0); });
  } catch (e) {}
  try { if (navigator.vibrate && sn.vibra) navigator.vibrate(sn.vibra); } catch (e) {}
}
function notaAudio(n, t0) {
  var t = t0 + (n.t || 0), d = n.d || 0.25, v = (n.v || 1) * 0.5;
  var parciales = { marimba: [[1, 1], [4, 0.18], [10, 0.05]], campana: [[1, 1], [2.76, 0.4], [5.4, 0.18], [8.9, 0.06]], suave: [[1, 1], [2, 0.12]] }[n.tipo] || [[1, 1]];
  var filtro = AC.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 9000; filtro.connect(SALIDA_AUDIO);
  parciales.forEach(function (p) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(n.f * p[0], t);
    if (n.hasta) o.frequency.exponentialRampToValueAtTime(n.hasta * p[0], t + d * 0.8);
    var dec = n.tipo === 'campana' ? d / Math.sqrt(p[0]) : n.tipo === 'marimba' ? d / p[0] : d;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * p[1], t + (n.tipo === 'suave' ? 0.02 : 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, dec));
    o.connect(g); g.connect(filtro); o.start(t); o.stop(t + d + 0.05);
  });
}
/* Compatibilidad: beep() = escaneo correcto, beep('malo') = no se pudo, beep('aviso') = tarea nueva. */
function beep(tipo) { sonido(tipo === 'malo' ? 'escaneoMal' : tipo === 'aviso' ? 'tarea' : tipo || 'escaneo'); }

/* ==================== Servidor ==================== */
function srv(accion, datos) {
  if (!/\/exec$/.test(API)) return Promise.reject(errCod('APP-01', 'Falta configurar la dirección del servidor (config.js).'));
  var cuerpo = Object.assign({}, datos || {}, { accion: accion, token: S.token });
  var ctrl = window.AbortController ? new AbortController() : null;
  var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, ESPERA_MS);
  return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo), signal: ctrl ? ctrl.signal : undefined, redirect: 'follow' })
    .then(function (r) { return r.text(); })
    .then(function (txt) {
      clearTimeout(t);
      var d; try { d = JSON.parse(txt); } catch (e) { throw errCod('APP-01', 'El servidor contestó algo raro. Intenta en un momento.', true); }
      marcarRed(true);
      if (!d.ok) {
        if (d.codigo === 'CEL-06') { salir(d.mensaje); }
        throw errCod(d.codigo, d.mensaje);
      }
      return d;
    }, function (e) {
      clearTimeout(t);
      marcarRed(false);
      throw errCod('CEL-02', e && e.name === 'AbortError' ? 'El servidor tardó demasiado. Se guarda en tu celular.' : 'Sin señal. Se guarda en tu celular.', true);
    });
}
function errCod(codigo, msg, red) { var e = new Error(msg); e.codigo = codigo; e.red = !!red; return e; }
function marcarRed(hay) { var antes = S.hayRed; S.hayRed = hay; if (hay) S.ultimaSync = Date.now(); if (antes !== hay) pintarEstado(); }

/* ==================== Arranque ==================== */
function arrancar() {
  if ('serviceWorker' in navigator) {
    // Versión nueva de la app: se instala sola y la pantalla se recarga en un momento seguro (no a media captura).
    var habia = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60000);
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!habia) return;
      var recargar = function () { if (['inicio', 'pedidos', 'lleva', 'login', 'manual', 'adm'].indexOf(S.vista) >= 0 && !S.cierre) location.reload(); else setTimeout(recargar, 5000); };
      recargar();
    });
  }
  S.token = leer('token');
  DB.cola().then(function (c) { S.cola = c || []; });
  window.addEventListener('online', function () { subirCola(); actualizar(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { subirCola(); actualizar(); } });
  setInterval(function () { subirCola(); actualizar(); }, CADA_SEG * 1000);
  setInterval(pintarEstado, 15000);
  if (!S.token) return vistaLogin();
  DB.get('inicio').then(function (d) {
    if (d) { S.datos = d; S.vistos = d._vistos || null; aplicarTema(); decidirPrimeraVista(); }
    else cargando('Cargando tu día…');
    actualizar(true);
  });
  setTimeout(ofrecerBorrador, 800);
}

function decidirPrimeraVista() {
  var d = S.datos;
  if (leer('debeCambiar') === '1') return vistaCambiarClave(true);
  if (!d.vehiculo || leer('dia') !== hoyTxt()) return vistaVehiculo(true);
  if (!S.vista || S.vista === 'arranque') vistaInicio();
}

/** Pide el inicio al servidor; si llegó algo nuevo, suena. */
function actualizar(primera) {
  if (!S.token || S.actualizando) return Promise.resolve();
  S.actualizando = true;
  return srv('inicio').then(function (d) {
    quitarCargando();
    var nuevos = detectarNuevos(d);
    // lo que ya cerré y sigue en la fila del celular no se vuelve a mostrar
    var enCola = {}; S.cola.forEach(function (c) { if (c.accion === 'cerrar') enCola[clave(c.datos.id)] = true; });
    d.pedidos = d.pedidos.filter(function (p) { return !enCola[clave(p.id)]; });
    d.lleva = d.lleva.filter(function (p) { return !enCola[clave(p.codigo)]; });
    d._vistos = S.vistos;
    if (d.vehiculo) guardar('dia', hoyTxt());
    S.datos = d; DB.set('inicio', d);
    if (typeof aplicarTema === 'function') aplicarTema();
    if (primera || !S.vista) decidirPrimeraVista();
    else if (S.vista === 'inicio') vistaInicio();
    else if (S.vista === 'pedidos') vistaPedidos();
    else if (S.vista === 'lleva') vistaLleva();
    else if (S.vista === 'parada' && S.parada) vistaParada(S.parada.k);
    if (nuevos.length && !primera) avisarNuevos(nuevos);
  }).catch(function (e) {
    quitarCargando();
    if (!S.datos && S.token) pantallaSinDatos(e);
  }).then(function () { S.actualizando = false; pintarEstado(); });
}

function detectarNuevos(d) {
  var rec = d.perfil && d.perfil.area === 'FACTURACION' ? (d.porRecoger || []) : [];
  var ids = d.pedidos.map(function (p) { return 'P' + p.id; }).concat(d.lleva.map(function (l) { return 'L' + l.codigo; }), rec.map(function (r) { return 'R' + r.folio; }));
  var antes = S.vistos;
  S.vistos = ids;
  if (!antes) return [];
  var huboRec = antes.some(function (x) { return x.charAt(0) === 'R'; }) || !rec.length;   // la primera vez que llega la lista de "por recoger" no suena
  return d.pedidos.filter(function (p) { return antes.indexOf('P' + p.id) < 0; }).map(function (p) { return { tipo: 'tarea', texto: 'Pedido ' + p.id + ' · ' + p.cliente }; })
    .concat(huboRec ? rec.filter(function (r) { return antes.indexOf('R' + r.folio) < 0; }).map(function (r) { return { tipo: 'traspaso', texto: 'Traspaso ' + r.folio + ' por recoger · va a ' + r.destino }; }) : []);
}

function avisarNuevos(lista) {
  var hayPedido = lista.some(function (x) { return x.tipo === 'tarea'; });
  S.aviso = { texto: lista.length === 1 ? lista[0].texto : lista.length + (hayPedido ? ' tareas nuevas' : ' traspasos por recoger'), hora: Date.now() };
  sonido(hayPedido ? 'tarea' : 'traspaso');
  if (document.hidden && window.Notification && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(function (r) { r.showNotification('Nueva tarea', { body: S.aviso.texto, icon: '../iconos/icono-192.png', vibrate: [200, 100, 200], tag: 'tarea' }); }).catch(function () {});
  }
  if (S.vista === 'inicio') vistaInicio();
}

function pantallaSinDatos(e) {
  pintar('<div class="login"><div class="arriba"><img src="../iconos/icono-192.png" alt=""><b>No pude cargar tu día</b><span>' + esc(e.message) + '</span></div>' +
    '<div class="abajo"><div class="aviso warn">Tu sesión sigue abierta. En cuanto haya señal se carga solo.</div><button class="btn" onclick="cargando(\'Cargando…\');actualizar(true)">Reintentar</button></div></div>');
}

/* ==================== Entrar ==================== */
function vistaLogin(msg) {
  S.vista = 'login';
  pintar('<div class="login"><div class="arriba"><img src="../iconos/icono-192.png" alt="Logística FADERMEX">' +
    '<b>Logística<br>FADERMEX</b><span>Entras una sola vez. Después la app abre directo, aunque la cierres.</span></div>' +
    '<form class="abajo" onsubmit="entrar(event)">' +
    (msg ? '<div class="aviso warn">' + esc(msg) + '</div>' : '') +
    '<label class="et" for="inUsuario">Usuario</label><input class="campo" id="inUsuario" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required>' +
    '<label class="et" for="inClave">Contraseña</label><input class="campo" id="inClave" type="password" autocomplete="current-password" required>' +
    '<button class="btn" type="submit">Entrar</button>' +
    '<div class="aviso">La sesión no se cierra sola. Aunque salgas a WhatsApp o al mapa, al volver sigues en la misma pantalla.</div>' +
    '<p class="nota">¿Olvidaste tu contraseña? Pide a tu administradora que la restablezca.</p></form></div>');
}
function entrar(ev) {
  ev.preventDefault();
  var u = $('inUsuario').value.trim(), c = $('inClave').value;
  cargando('Entrando…');
  srv('login', { usuario: u, clave: c, dispositivo: navigator.userAgent.slice(0, 160) }).then(function (d) {
    S.token = d.token; guardar('token', d.token); guardar('nombre', d.nombre);
    guardar('debeCambiar', d.debeCambiar ? '1' : '0');
    return actualizar(true);
  }).catch(function (e) {
    quitarCargando();
    // Sin sesión todavía, un "sin señal" casi siempre es que el servidor no está abierto a "Cualquier persona".
    if (e.red && navigator.onLine) e = errCod('APP-01', 'No pude hablar con el servidor. Si tienes señal, avisa a tu administradora: el servidor debe estar publicado para "Cualquier persona".');
    falla(e);
  });
}
function vistaCambiarClave(obligatorio) {
  S.vista = 'clave';
  pintar('<div class="barra">' + (obligatorio ? '' : '<button class="volver" onclick="vistaInicio()" aria-label="Volver">' + IC.atras + '</button>') +
    '<div class="titulo"><b>' + (obligatorio ? 'Crea tu contraseña' : 'Cambiar contraseña') + '</b><small>Mínimo 6 caracteres. Es personal: no la compartas.</small></div></div>' +
    '<form class="cuerpo" onsubmit="cambiarClave(event)">' +
    '<label class="et" for="inActual">' + (obligatorio ? 'Contraseña temporal que te dieron' : 'Contraseña actual') + '</label><input class="campo" id="inActual" type="password" required>' +
    '<label class="et" for="inNueva">Nueva contraseña</label><input class="campo" id="inNueva" type="password" minlength="6" required>' +
    '<label class="et" for="inNueva2">Repite la nueva</label><input class="campo" id="inNueva2" type="password" minlength="6" required>' +
    '<button class="btn" type="submit">Guardar</button></form>');
}
function cambiarClave(ev) {
  ev.preventDefault();
  if ($('inNueva').value !== $('inNueva2').value) return toast('Las dos contraseñas nuevas no son iguales.', 'err');
  cargando('Guardando…');
  srv('cambiarClave', { actual: $('inActual').value, nueva: $('inNueva').value }).then(function (d) {
    quitarCargando(); S.token = d.token; guardar('token', d.token); guardar('debeCambiar', '0');
    toast('Contraseña guardada', 'ok'); S.vista = ''; decidirPrimeraVista();
  }).catch(function (e) { quitarCargando(); falla(e); });
}
function salir(motivo) {
  S.token = null; borrar('token'); borrar('dia'); DB.del('inicio'); S.datos = null; S.vistos = null; S.enAdmin = false; aplicarTema();
  vistaLogin(motivo || '');
}
function cerrarSesion() {
  if (S.cola.length) return toast('Tienes ' + S.cola.length + ' cosas por subir. Espera a tener señal antes de cerrar sesión.', 'err');
  modal('<h2>¿Cerrar sesión?</h2><p>No hace falta para salir de la app. Solo si vas a prestar el celular.</p>' +
    '<button class="btn rojo" onclick="cerrarModal();salir()">Cerrar sesión</button><button class="btn linea" onclick="cerrarModal()">Cancelar</button>');
}

/* ==================== Vehículo ==================== */
function vistaVehiculo(primera) {
  S.vista = 'vehiculo';
  var d = S.datos; S.vehSel = S.vehSel || d.vehiculo || '';
  var html = '<div class="cab">' + (primera ? '' : '<div class="cab-fila"><button class="btn-ic" onclick="vistaInicio()" aria-label="Volver">' + IC.atras + '</button></div>') +
    '<div class="cab-nombre"><small>Hola, ' + esc(d.gestor.nombre) + '</small><b>¿Con qué sales hoy?</b></div></div><div class="cuerpo">';
  d.vehiculos.forEach(function (v, i) {
    var sel = S.vehSel === v.nombre;
    html += '<button class="veh' + (sel ? ' sel' : '') + '" ' + (v.ocupadoPor || v.enTaller ? 'disabled' : '') + ' onclick="elegirVeh(' + i + ')">' +
      '<span class="ic">' + (v.tipo === 'MOTO' ? 'M' : v.tipo === 'NINGUNO' ? '—' : 'C') + '</span><span class="tx"><b>' + esc(v.nombre) + '</b><span>' +
      (v.enTaller ? 'En taller' : v.ocupadoPor ? 'Lo trae ' + esc(v.ocupadoPor) : v.tipo === 'MOTO' ? 'Moto' : v.tipo === 'NINGUNO' ? 'A pie o transporte público' : 'Auto') + '</span></span><span class="radio"></span></button>';
  });
  var v = d.vehiculos.filter(function (x) { return x.nombre === S.vehSel; })[0];
  if (v && v.tipo !== 'NINGUNO') {
    var lista = d.checklist[v.tipo] || d.checklist.AUTO || [];
    if (lista.length) {
      html += '<div class="bloque"><div class="cab-b"><b>Antes de salir</b></div>';
      lista.forEach(function (c, j) { html += '<label class="check"><input type="checkbox" id="chk' + j + '" data-t="' + esc(c) + '">' + esc(c) + '</label>'; });
      html += '<p class="opc">Si te falta algo, avisa a tu supervisor antes de salir.</p></div>';
    }
  }
  if (d.vehiculo && S.vehSel && S.vehSel !== d.vehiculo && leer('dia') === hoyTxt()) {
    var mot = (d.reglas && d.reglas.motivosCambioVehiculo) || [];
    html += '<div class="bloque"><div class="cab-b"><label class="et" for="selMotVeh" style="flex:1">¿Por qué cambias de vehículo?</label><span class="opc">opcional</span></div>' +
      '<select class="campo" id="selMotVeh" onchange="S.motVeh=this.value"><option value="">— Elige —</option>' + mot.map(function (m) { return '<option' + (S.motVeh === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select></div>';
  }
  html += '</div><div class="pie"><button class="btn" ' + (S.vehSel ? '' : 'disabled') + ' onclick="guardarVehiculo()">' + (d.vehiculo && leer('dia') === hoyTxt() ? 'Cambiar de vehículo' : 'Salir a ruta') + '</button></div>';
  pintar(html);
}
function elegirVeh(i) { S.vehSel = S.datos.vehiculos[i].nombre; vistaVehiculo(S.vista === 'vehiculo' && !S.datos.vehiculo); }
function guardarVehiculo() {
  var checklist = Array.prototype.map.call(document.querySelectorAll('.check input'), function (c) { return { texto: c.dataset.t, ok: c.checked }; });
  var motivo = $('selMotVeh') ? $('selMotVeh').value : ''; S.motVeh = '';
  cargando('Guardando…');
  srv('vehiculo', { vehiculo: S.vehSel, checklist: checklist, motivo: motivo }).then(function () {
    quitarCargando(); S.datos.vehiculo = S.vehSel; guardar('dia', hoyTxt()); DB.set('inicio', S.datos); vistaInicio(); actualizar();
  }).catch(function (e) {
    quitarCargando();
    if (e.red) { S.datos.vehiculo = S.vehSel; guardar('dia', hoyTxt()); encolar('vehiculo', { vehiculo: S.vehSel, checklist: checklist, motivo: motivo }, 'Vehículo ' + S.vehSel); vistaInicio(); }
    else falla(e);
  });
}

/* ==================== Inicio ==================== */
function estadoTexto() {
  if (S.cola.length) return { amb: true, t: (S.hayRed ? 'Subiendo ' : 'Sin señal · ') + S.cola.length + ' por subir' };
  if (!S.hayRed) return { amb: true, t: 'Sin señal · todo se guarda en tu celular' };
  if (!S.ultimaSync) return { amb: false, t: 'Al día' };
  var s = Math.round((Date.now() - S.ultimaSync) / 1000);
  return { amb: false, t: 'Al día · hace ' + (s < 60 ? s + ' s' : Math.round(s / 60) + ' min') };
}
function pintarEstado() { var e = $('estado'); if (!e) return; var x = estadoTexto(); e.innerHTML = '<i class="' + (x.amb ? 'amb' : '') + '"></i>' + esc(x.t); }

function vistaInicio() {
  S.enAdmin = false;
  if (S.datos && esFac()) return vistaRuta();
  S.vista = 'inicio'; pararEscaner(); aplicarTema();
  var d = S.datos; if (!d) return;
  var x = estadoTexto();
  var aviso = S.aviso && Date.now() - S.aviso.hora < 30 * 60000 ? S.aviso : null;
  var conTarjeta = !!aviso || (window.Notification && Notification.permission === 'default');
  var html = '<div class="cab' + (conTarjeta ? ' con-tarjeta' : '') + '"><div class="cab-fila"><img src="../iconos/icono-192.png" alt="">' +
    '<div class="cab-nombre"><small>' + saludo() + ' · Gestoría</small><b>' + esc(d.gestor.nombre) + '</b></div>' +
    (perfil().admin ? '<button class="btn-ic" onclick="entrarAdmin()" aria-label="Administración">' + ICP.escudo + '</button>' : '') +
    '<button class="btn-ic" onclick="vistaYo()" aria-label="Mi cuenta">' + IC.campana + (aviso ? '<span class="punto"></span>' : '') + '</button></div>' +
    '<div class="chips"><button class="chip" onclick="vistaVehiculo(false)">' + esc(d.vehiculo || 'Sin vehículo') + ' · cambiar</button>' +
    '<span class="chip" id="estado" onclick="verCola()"><i class="' + (x.amb ? 'amb' : '') + '"></i>' + esc(x.t) + '</span></div></div>';
  if (aviso) html += '<div class="tarjeta-aviso"><span class="ic">' + IC.campana + '</span><span class="tx"><small>Nueva tarea · ' + haceTxt(aviso.hora) + '</small><b>' + esc(aviso.texto) + '</b></span><button class="b" onclick="S.aviso=null;vistaPedidos()">Ver</button></div>';
  else if (window.Notification && Notification.permission === 'default') html += '<div class="tarjeta-aviso bien"><span class="ic">' + IC.campana + '</span><span class="tx"><small>Avisos</small><b>Activa el sonido de tareas nuevas</b></span><button class="b" onclick="pedirAvisos()">Activar</button></div>';

  html += '<div class="cuerpo con-nav"><div class="rejilla">' +
    '<button class="grande" onclick="vistaEscaner(\'recolectar\')"><span class="ic">' + IC.scan + '</span><span><b>Escanear</b><small>Recolecta o entrega con la cámara</small></span></button>' +
    '<button class="mosaico" onclick="vistaPedidos()"><span class="fila"><span style="color:var(--azul)">' + IC.casa + '</span><span class="num">' + d.pedidos.length + '</span></span><b>Pedidos a domicilio</b></button>' +
    '<button class="mosaico" onclick="vistaLleva()"><span class="fila"><span style="color:var(--verde)">' + IC.caja + '</span><span class="num">' + d.lleva.length + '</span></span><b>Lo que llevo</b></button>' +
    '<button class="grande linea registrar" onclick="vistaLibre()"><span><b>+ Registrar entrega</b><small>Algo que no estaba en tu lista: documentos, medicamento, efectivo…</small></span></button>' +
    '</div>' + bloqueLibresHoy() + '<span class="etiqueta">Hoy</span><div class="hoy"><div><b style="color:var(--verde)">' + d.hoy.entregados + '</b><span>Entregados</span></div>' +
    '<div><b style="color:var(--azul)">' + d.hoy.recolectados + '</b><span>Recolectados</span></div><div><b style="color:var(--rojo)">' + d.hoy.noEntregados + '</b><span>No entregados</span></div></div></div>' + nav('inicio');
  pintar(html);
}
function saludo() { var h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
function haceTxt(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'ahora' : 'hace ' + m + ' min'; }
function nav(act) {
  if (S.datos && esFac()) return navFac(act === 'pedidos' ? 'lleva' : act);
  var b = function (id, ic, t, fn) { return '<button class="' + (act === id ? 'act' : '') + '" onclick="' + fn + '">' + ic + t + '</button>'; };
  return '<nav class="nav" aria-label="Secciones">' + b('inicio', IC.casa, 'Inicio', 'vistaInicio()') + b('escaner', IC.scan.replace(/30/g, '22'), 'Escanear', "vistaEscaner('recolectar')") +
    b('pedidos', IC.lista, 'Pendientes', 'vistaPedidos()') + b('manual', IC.libro, 'Manual', 'vistaManual()') + '</nav>';
}
function pedirAvisos() {
  sonido('tarea');
  if (!window.Notification) return toast('Este celular no permite avisos; sonará con la app abierta.');
  Notification.requestPermission().then(function () { vistaInicio(); });
}
function vistaYo() {
  modal('<h2>' + esc(S.datos.gestor.nombre) + ' · ' + esc(S.datos.gestor.numero) + '</h2><p>App ' + VERSION_APP + ' · servidor ' + esc(S.datos.version) + '</p>' +
    (perfil().admin ? '<button class="btn" onclick="cerrarModal();entrarAdmin()">Administración</button>' : '') +
    '<button class="btn linea" onclick="cerrarModal();verCola()">Lo que falta subir (' + S.cola.length + ')</button>' +
    '<button class="btn linea" onclick="cerrarModal();vistaCambiarClave(false)">Cambiar contraseña</button>' +
    '<button class="btn linea" onclick="cerrarModal();reportar()">Reportar un problema</button>' +
    '<button class="btn linea" style="color:var(--rojo)" onclick="cerrarModal();cerrarSesion()">Cerrar sesión</button>');
}
function modal(html) { cerrarModal(); var m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = '<div class="hoja">' + html + '</div>'; m.onclick = function (e) { if (e.target === m) cerrarModal(); }; document.body.appendChild(m); }
function cerrarModal() { var m = $('modal'); if (m) m.remove(); }

/* ==================== Pedidos ==================== */
function vistaPedidos() {
  S.vista = 'pedidos'; pararEscaner();
  var d = S.datos, q = clave(S.busca || '');
  var lista = d.pedidos.filter(function (p) { return !q || clave(p.id + p.cliente + p.direccion).indexOf(q) >= 0; });
  var html = '<div class="barra"><button class="volver" onclick="vistaInicio()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>Pedidos a domicilio</b><small>' + d.pedidos.length + ' por entregar</small></div></div>' +
    '<div class="cuerpo con-nav"><label class="busca" for="inBusca"><input id="inBusca" placeholder="Buscar pedido, cliente o calle" value="' + esc(S.busca || '') + '" oninput="S.busca=this.value;filtrarPedidos()"></label><div id="listaPed">';
  html += tarjetasPedidos(lista) + '</div></div>' + nav('pedidos');
  pintar(html);
}
function filtrarPedidos() { var q = clave(S.busca || ''); $('listaPed').innerHTML = tarjetasPedidos(S.datos.pedidos.filter(function (p) { return !q || clave(p.id + p.cliente + p.direccion).indexOf(q) >= 0; })); }
function tarjetasPedidos(lista) {
  if (!lista.length) return '<div class="vacio"><b>Sin pedidos pendientes</b><span>Cuando te asignen uno, suena y aparece aquí.</span></div>';
  return lista.map(function (p) {
    var i = S.datos.pedidos.indexOf(p);
    return '<div class="card"><div class="linea"><span class="id">' + esc(p.id) + '</span>' + (/RECOLECT/i.test(p.estatus) ? '<span class="tag a">RECOLECTADO</span>' : '') +
      '<span class="espacio"></span><span class="hora">' + esc(p.area) + '</span></div>' +
      '<div><div class="t1">' + esc(p.cliente) + '</div><div class="t2">' + esc(p.direccion) + '</div>' + (p.notas ? '<div class="t2" style="color:var(--ambar)">' + esc(p.notas) + '</div>' : '') + '</div>' +
      '<div class="botones"><button class="b verde" onclick="abrirCierre(\'PEDIDO\',' + i + ',\'ENTREGADO\')">Entregar</button>' +
      '<button class="b" onclick="abrirCierre(\'PEDIDO\',' + i + ',\'RETORNO\')">No entregué</button>' +
      '<a class="b" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.direccion) + '" target="_blank" rel="noopener">' + IC.mapa + 'Mapa</a></div>' +
      (p.telefono ? '<a class="b" href="tel:' + esc(p.telefono) + '">Llamar · ' + esc(p.telefono) + '</a>' : '') + '</div>';
  }).join('');
}

/* ==================== Lo que llevo ==================== */
function vistaLleva() {
  S.vista = 'lleva'; pararEscaner();
  var d = S.datos;
  var html = '<div class="barra"><button class="volver" onclick="vistaInicio()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>Lo que llevo</b><small>Traspasos y recolecciones por entregar</small></div></div><div class="cuerpo con-nav">';
  if (!d.lleva.length) html += '<div class="vacio"><b>No llevas nada pendiente</b><span>Lo que recolectes con el escáner aparece aquí. Cuando el destino le da entrada, se quita solo.</span></div>';
  d.lleva.forEach(function (l, i) {
    var tras = l.tipo === 'TRASPASO';
    html += '<div class="card"><div class="linea"><span class="id">' + esc(l.codigo) + '</span><span class="tag ' + (tras ? 'a' : 'n') + '">' + (tras ? 'TRASPASO' : l.tipo === 'PEDIDO' ? 'PEDIDO' : 'OTRO') + '</span>' +
      '<span class="espacio"></span><span class="hora">' + esc(String(l.fecha).slice(5)) + '</span></div>' +
      '<div><div class="t2">Va a</div><div class="t1">' + esc(l.destino) + '</div>' + (l.destinoDireccion ? '<div class="t2">' + esc(l.destinoDireccion) + '</div>' : '') +
      '<div class="t2">' + esc(l.contenido) + (l.origen ? ' · viene de ' + esc(l.origen) : '') + '</div>' +
      (l.estado ? '<div class="t2" style="color:var(--azul);font-weight:600">' + esc(l.estado) + '</div>' : '') + '</div>' +
      '<div class="botones"><button class="b verde" onclick="abrirCierre(\'' + (tras ? 'TRASPASO' : 'RECOLECCION') + '\',' + i + ',\'ENTREGADO\')">Entregar</button>' +
      '<button class="b" onclick="abrirCierre(\'' + (tras ? 'TRASPASO' : 'RECOLECCION') + '\',' + i + ',\'NO_ENTREGADO\')">No entregué</button>' +
      (l.destinoMaps || l.destinoDireccion ? '<a class="b" href="' + esc(l.destinoMaps || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.destinoDireccion))) + '" target="_blank" rel="noopener">' + IC.mapa + 'Mapa</a>' : '<span></span>') + '</div>' +
      '<button class="b wa-b" onclick="waLleva(' + i + ')">Enviar por WhatsApp</button></div>';
  });
  pintar(html + '</div>' + nav(''));
}

/* ==================== Cierre (entregar / no entregué / paquetería) ==================== */
function abrirCierre(tipo, i, resultado) {
  var x = tipo === 'PEDIDO' ? S.datos.pedidos[i] : S.datos.lleva[i];
  if (!x) return;
  S.volverA = tipo === 'PEDIDO' ? 'pedidos' : 'lleva';
  if (S.vista !== 'parada') S.volverParada = null;
  S.cierre = { tipo: tipo, resultado: resultado, id: tipo === 'PEDIDO' ? x.id : x.codigo, fila: x.fila || '', cliente: x.cliente || x.destino || '',
               direccion: x.direccion || x.contenido || '', exigeFirma: false, foto: null, firma: null, recibio: '', motivo: '', comentario: '',
               sucursal: x.destinoSucursal || '', clase: x.clase || '', esperado: x.esperado || 0, areaImss: '', matricula: '', monto: '' };
  pintarCierre();
}
function reglaFoto(c) {
  var r = S.datos.reglas;
  if (c.resultado === 'PAQUETERIA') return true;
  if (c.tipo !== 'PEDIDO') return false;
  return c.resultado === 'ENTREGADO' ? r.exigirFotoEntrega : r.exigirFotoNoEntrega;
}
function pintarCierre() {
  S.vista = 'cierre';
  var c = S.cierre, entrega = c.resultado === 'ENTREGADO', paq = c.resultado === 'PAQUETERIA';
  var titulo = entrega ? 'Entregar' : paq ? 'Entregado a paquetería' : 'No entregué';
  var pideFoto = reglaFoto(c), firmaObl = entrega && c.exigeFirma, recObl = entrega && (c.exigeFirma || S.datos.reglas.exigirQuienRecibio);
  var fac = esFac() && !c.comoNumero ? bloqueCierreFac(c, 1) : null;
  if (fac) titulo = fac.titulo;
  var html = '<div class="barra"><button class="volver" onclick="cancelarCierre()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>' + titulo + '</b>' +
    '<small><span class="mono" style="color:var(--azul);font-weight:600">' + esc(c.id) + '</span> · ' + esc(c.cliente) + '</small></div></div><div class="cuerpo">';
  if (c.comoNumero) html += '<div class="aviso warn">Lo estás cerrando a nombre de <b>' + esc(c.comoNombre) + '</b>. Queda anotado que fuiste tú.</div>';
  if (fac) {
    html += fac.html + '<p class="nota">Se guarda en tu celular a cada paso.</p></div><div class="pie"><button class="btn verde" onclick="enviarCierre()">' + fac.boton + '</button></div>';
    pintar(html); guardarBorrador(); return;
  }
  var n = 1;
  if (!entrega && !paq) {
    var esPedido = c.tipo === 'PEDIDO';
    if (esPedido) html += '<div class="dosop"><button class="' + (c.resultado === 'RETORNO' ? 'sel-ret' : '') + '" onclick="tipoNoEntrega(\'RETORNO\')"><b>Retorno</b><small>Regresa a Logística</small></button>' +
      '<button class="' + (c.resultado === 'CANCELADO' ? 'sel-can' : '') + '" onclick="tipoNoEntrega(\'CANCELADO\')"><b>Cancelado</b><small>Ya no se entrega</small></button></div>';
    var motivos = S.datos.motivos[esPedido ? c.resultado : 'TRASPASO'] || [];
    html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.motivo ? ' ok' : '') + '">' + (n++) + '</span><b>¿Por qué no se entregó?</b>' + (esPedido ? '<span class="req">obligatorio</span>' : '<span class="opc">opcional</span>') + '</div><div class="opciones">';
    motivos.forEach(function (m, j) { html += '<button class="opcion' + (c.motivo === m.motivo ? ' sel' : '') + '" onclick="elegirMotivo(' + j + ')"><span class="radio"></span><span>' + esc(m.motivo) + '</span></button>'; });
    html += '</div><label class="et" for="inComent">Comentario <span class="opc">(opcional)</span></label><textarea class="campo" id="inComent" rows="2" placeholder="Ej. se llamó 3 veces sin respuesta">' + esc(c.comentario) + '</textarea></div>';
  }
  if (entrega && c.tipo !== 'PEDIDO') {
    var sucs = S.datos.sucursales || [];
    html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.sucursal ? ' ok' : '') + '">' + (n++) + '</span><label class="et" for="selSuc" style="flex:1">¿Dónde lo entregaste?</label><span class="opc">opcional</span></div>' +
      '<select class="campo" id="selSuc" onchange="S.cierre.sucursal=this.value;guardarBorrador()"><option value="">— Elige la sucursal —</option>' +
      sucs.map(function (x) { return '<option' + (x.nombre === c.sucursal ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') +
      '<option' + (c.sucursal === 'Otro lugar' ? ' selected' : '') + '>Otro lugar</option></select>' +
      '<label class="et" for="inComent">Nota <span class="opc">(opcional)</span></label><textarea class="campo" id="inComent" rows="2" placeholder="Ej. se lo dejé a Lalo en mostrador">' + esc(c.comentario) + '</textarea></div>';
  }
  html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.foto ? ' ok' : '') + '">' + (n++) + '</span><b>' + (entrega ? (c.tipo === 'PEDIDO' ? 'Foto de la fachada' : 'Foto de la entrega') : paq ? 'Foto de la guía o comprobante' : 'Foto de evidencia') + '</b>' +
    (pideFoto ? '<span class="req">obligatoria</span>' : '<span class="opc">opcional</span>') + '</div>' +
    (c.foto ? '<div class="previa"><img src="' + c.foto + '" alt="Foto tomada"><button onclick="tomarFoto()">Repetir</button></div>'
            : '<button class="zona-foto" onclick="tomarFoto()">' + IC.cam + '<b>Tomar foto</b><small>' + (entrega ? (c.tipo === 'PEDIDO' ? 'Que se vea el número de la casa o el negocio' : 'Dónde y a quién lo entregaste') : 'Dónde y qué pasó') + '</small></button>') + '</div>';
  if (entrega && c.tipo === 'PEDIDO') {
    html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.recibio ? ' ok' : '') + '">' + (n++) + '</span><label class="et" for="inRecibio" style="flex:1">¿Quién recibió?</label>' +
      (recObl ? '<span class="req">obligatorio</span>' : '<span class="opc">opcional</span>') + '</div>' +
      '<input class="campo" id="inRecibio" autocomplete="off" placeholder="Nombre de quien recibió" value="' + esc(c.recibio) + '" oninput="S.cierre.recibio=this.value;guardarBorrador()"></div>' +
      '<div class="bloque"><div class="cab-b"><span class="paso">' + (n++) + '</span><b>Firma' + (firmaObl ? '' : ' del cliente') + '</b>' + (firmaObl ? '<span class="req">obligatoria</span>' : '<span class="opc">opcional</span>') +
      '<button class="b rojo" style="height:34px;border:0" onclick="limpiarFirma()">Borrar</button></div><canvas id="firmaCanvas"></canvas>' +
      (firmaObl ? '<p class="opc" style="color:var(--rojo)">Lleva efectivo o documentos: nombre y firma son obligatorios.</p>' : '') + '</div>';
  }
  html += '<p class="nota">Se guarda en tu celular a cada paso. Si se cierra la app, sigues donde te quedaste.</p></div>' +
    '<div class="pie"><button class="btn ' + (entrega ? 'verde' : paq ? '' : c.resultado === 'CANCELADO' ? 'rojo' : 'ambar') + '" onclick="enviarCierre()">' +
    (entrega ? 'Finalizar entrega' : paq ? 'Registrar entrega a paquetería' : c.resultado === 'CANCELADO' ? 'Registrar cancelación' : c.resultado === 'RETORNO' ? 'Registrar retorno' : 'Registrar') + '</button></div>';
  pintar(html);
  if (entrega && c.tipo === 'PEDIDO') prepararFirma();
  guardarBorrador();
}
function preservar() {
  var c = S.cierre; if (!c) return;
  if ($('inComent')) c.comentario = $('inComent').value;
  if ($('inRecibio')) c.recibio = $('inRecibio').value;
  if ($('selSuc')) c.sucursal = $('selSuc').value;
  if ($('selArea')) c.areaImss = $('selArea').value;
  if ($('inMatricula')) c.matricula = $('inMatricula').value;
  if ($('inMonto')) c.monto = $('inMonto').value.trim();
  var f = leerFirma(); if (f) c.firma = f;
}
function tipoNoEntrega(t) { preservar(); S.cierre.resultado = t; S.cierre.motivo = ''; pintarCierre(); }
function elegirMotivo(j) {
  preservar();
  var c = S.cierre, lista = S.datos.motivos[c.tipo === 'PEDIDO' ? c.resultado : 'TRASPASO'] || [];
  c.motivo = lista[j] ? lista[j].motivo : ''; pintarCierre();
}
function cancelarCierre() {
  var c = S.cierre; S.cierre = null; DB.del('borrador');
  if (c && c.comoNumero) return admGestor(c.comoNumero);
  if (S.volverParada) return vistaParada(S.volverParada);
  if (S.volverA === 'lleva') vistaLleva(); else vistaPedidos();
}

function enviarCierre() {
  preservar();
  var c = S.cierre, entrega = c.resultado === 'ENTREGADO';
  if (c.tipo === 'PEDIDO' && !entrega && c.resultado !== 'PAQUETERIA' && !c.motivo) return falla(errCod('CAP-05', 'Elige el motivo.'));
  if (reglaFoto(c) && !c.foto) return falla(errCod('CAP-04', 'Falta la foto.'));
  if (c.tipo === 'PEDIDO' && entrega && c.clase !== 'IMSS' && S.datos.reglas.exigirQuienRecibio && !String(c.recibio).trim()) return falla(errCod('CAP-08', 'Anota quién recibió.'));
  var fac = esFac() && !c.comoNumero;
  if (fac) { var ef = revisarCierreFac(c); if (ef) return falla(ef); }
  cargando('Guardando…');
  obtenerGPS().then(function (g) {
    var datos = { idLocal: idLocal(), tipo: c.tipo, id: c.id, fila: c.fila, resultado: c.resultado, motivo: c.motivo, comentario: c.comentario,
                  recibio: c.recibio, foto: c.foto, firma: c.firma, sucursal: c.sucursal || '', lat: g.lat, lng: g.lng, horaCelular: horaTxt() };
    if (fac) { datos.clase = c.clase || ''; datos.areaImss = c.areaImss || ''; datos.matricula = c.matricula || ''; datos.monto = c.monto || ''; datos.esperado = c.esperado || 0; }
    if (c.comoNumero) datos.comoNumero = c.comoNumero;
    var etiqueta = c.id + ' · ' + ({ ENTREGADO: 'Entregado', RETORNO: 'Retorno', CANCELADO: 'Cancelado', PAQUETERIA: 'Paquetería', NO_ENTREGADO: 'No entregado' })[c.resultado];
    if (c.comoNumero) {
      return srv('cerrar', datos).then(function () { quitarCargando(); sonido(entrega ? 'entregado' : 'noEntregado'); S.cierre = null; DB.del('borrador'); toast(etiqueta + ' · a nombre de ' + c.comoNombre, 'ok'); admGestor(c.comoNumero); });
    }
    return encolar('cerrar', datos, etiqueta).then(function () {
      // fuera de la lista al instante, aunque no haya señal
      S.datos.pedidos = S.datos.pedidos.filter(function (p) { return clave(p.id) !== clave(c.id); });
      S.datos.lleva = S.datos.lleva.filter(function (p) { return clave(p.codigo) !== clave(c.id); });
      if (entrega) S.datos.hoy.entregados++; else if (c.resultado !== 'PAQUETERIA') S.datos.hoy.noEntregados++;
      DB.set('inicio', S.datos); DB.del('borrador');
      quitarCargando(); sonido(entrega ? 'entregado' : 'noEntregado');
      var hecho = c; S.cierre = null;
      var parada = S.volverParada && armarParadas().porK[S.volverParada];
      if (entrega && c.tipo === 'PEDIDO' && !fac) vistaListo(hecho);
      else {
        var volver = parada && (parada.items.length || parada.recoger.length) ? "vistaParada('" + esc(S.volverParada) + "')" : 'vistaInicio()';
        if (!parada && !S.volverParada && !fac) volver = c.tipo === 'PEDIDO' ? 'vistaPedidos()' : 'vistaLleva()';
        waDespuesDeCierre(hecho, volver);   // todos: entrega, retorno, cancelado o no entregué → opción de WhatsApp
      }
      subirCola();
    });
  }).catch(function (e) { quitarCargando(); falla(e); });
}

function vistaListo(c) {
  S.vista = 'listo';
  var tpl = (S.datos.whatsapp && S.datos.whatsapp.ENTREGADO) || 'Entrega realizada\n{id} · {cliente}\nRecibió: {recibio}\nGestor: {gestor}\n{fecha} {hora}';
  var ahora = new Date();
  var msg = tpl.replace(/\{(\w+)\}/g, function (_, k) {
    return ({ id: c.id, cliente: c.cliente, direccion: c.direccion, recibio: c.recibio || '—', gestor: S.datos.gestor.nombre, vehiculo: S.datos.vehiculo,
              fecha: ahora.toLocaleDateString('es-MX'), hora: ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) })[k] || '';
  });
  S.wa = { msg: msg, foto: c.foto, id: c.id };
  pintar('<div class="listo"><div class="verde-top"><span class="palomita">' + IC.palomita + '</span><b>Entrega registrada</b><span><span class="mono">' + esc(c.id) + '</span> · ya salió de tus pendientes</span></div>' +
    '<div class="cuerpo"><b>¿Avisar por WhatsApp?</b><p class="nota" style="text-align:left;margin:0">Tú eliges a quién se lo mandas: al cliente, al vendedor o al grupo.</p>' +
    '<div class="wa-burbuja"><div>' + (c.foto ? '<img src="' + c.foto + '" alt="">' : '') + '<pre>' + esc(msg) + '</pre></div></div>' +
    (c.foto ? '<label class="check"><input type="checkbox" id="waFoto" checked> Incluir la foto de la fachada</label>' : '') + '</div>' +
    '<div class="pie"><button class="btn wa" onclick="mandarWA()">Enviar por WhatsApp</button><button class="btn linea" onclick="vistaPedidos()">Ahora no · siguiente pedido</button></div></div>');
}
function mandarWA() {
  var w = S.wa, conFoto = w.foto && $('waFoto') && $('waFoto').checked;
  if (conFoto && navigator.canShare) {
    fetch(w.foto).then(function (r) { return r.blob(); }).then(function (b) {
      var f = new File([b], w.id.replace(/[^\w-]/g, '') + '.jpg', { type: 'image/jpeg' });
      if (!navigator.canShare({ files: [f] })) throw new Error('no');
      return navigator.share({ files: [f], text: w.msg });
    }).catch(function (e) { if (!e || e.name !== 'AbortError') location.href = 'https://wa.me/?text=' + encodeURIComponent(w.msg); });
  } else location.href = 'https://wa.me/?text=' + encodeURIComponent(w.msg);
}

/* ---------- borrador: lo que se está capturando sobrevive si Android cierra la app ---------- */
function guardarBorrador() { if (S.cierre) { preservar(); DB.set('borrador', { c: S.cierre, t: Date.now() }); } }
function ofrecerBorrador() {
  if (!S.token) return;
  DB.get('borrador').then(function (b) {
    if (!b || !b.c || Date.now() - b.t > 12 * 3600000) return;
    if (S.vista === 'cierre') return;
    var c = b.c, hecho = [c.foto ? 'foto' : '', c.firma ? 'firma' : '', c.recibio ? 'recibió: ' + c.recibio : '', c.motivo].filter(String);
    modal('<h2>Tienes una captura a medias</h2><p><b class="mono">' + esc(c.id) + '</b> · ' + esc(c.cliente) + '</p>' +
      '<div class="aviso">El celular cerró la app antes de terminar. Lo que llevabas quedó guardado' + (hecho.length ? ': <b>' + esc(hecho.join(' · ')) + '</b>' : '') + '.</div>' +
      '<button class="btn verde" onclick="cerrarModal();retomarBorrador()">Continuar</button><button class="btn linea" onclick="cerrarModal();DB.del(\'borrador\')">Descartar</button>');
  });
}
function retomarBorrador() { DB.get('borrador').then(function (b) { if (b) { S.cierre = b.c; pintarCierre(); } }); }

/* ==================== Fila del celular (nada se pierde) ==================== */
function encolar(accion, datos, etiqueta) {
  var it = { idLocal: datos.idLocal || idLocal(), accion: accion, datos: datos, etiqueta: etiqueta, creado: horaTxt(), intentos: 0 };
  S.cola.push(it);
  return DB.encolar(it).then(pintarEstado);
}
function subirCola() {
  if (S.subiendo || !S.cola.length || !S.token) return Promise.resolve();
  S.subiendo = true;
  var lista = S.cola.slice();
  function siguiente() {
    var it = lista.shift();
    if (!it) return Promise.resolve();
    return srv(it.accion, it.datos).then(function (d) {
      S.cola = S.cola.filter(function (x) { return x.idLocal !== it.idLocal; });
      DB.quitar(it.idLocal);
      if (it.accion === 'recolectar') avisarRecoleccionesSubidas(d);
      return siguiente();
    }, function (e) {
      if (e.red) { S.huboSinRed = true; throw e; }        // sin señal: se intenta luego, en orden
      it.error = '[' + e.codigo + '] ' + e.message; it.intentos++;
      DB.encolar(it);
      toast(it.etiqueta + ': ' + e.message + ' (' + e.codigo + ')', 'err');
      return siguiente();
    });
  }
  return siguiente().catch(function () {}).then(function () {
    S.subiendo = false; pintarEstado();
    if (S.huboSinRed && !S.cola.length) { S.huboSinRed = false; sonido('subido'); toast('Volvió la señal: ya se subió todo', 'ok'); }
  });
}
function verCola() {
  if (!S.cola.length) return toast('Todo está subido.', 'ok');
  modal('<h2>Por subir (' + S.cola.length + ')</h2><p>Se suben solos cuando hay señal. No borres los datos del navegador mientras haya algo aquí.</p>' +
    S.cola.map(function (c) { return '<div class="leido ' + (c.error ? 'mal' : 'esp') + '"><span class="ic">' + (c.error ? '!' : '…') + '</span><span class="tx"><b>' + esc(c.etiqueta) + '</b><span>' + esc(c.error || 'Guardado ' + c.creado) + '</span></span></div>'; }).join('') +
    '<button class="btn" onclick="cerrarModal();subirCola()">Subir ahora</button>');
}

/* ==================== Escáner ==================== */
function vistaEscaner(modo) {
  S.vista = 'escaner'; S.modoScan = modo || S.modoScan; pararEscaner();
  if (S.modoScan === 'recolectar') S.leidos = S.leidos || [];
  pintar('<div class="escaner"><div class="top"><button class="volver" onclick="salirEscaner()" aria-label="Volver">' + IC.atras + '</button>' +
    '<div class="modo"><button class="' + (S.modoScan === 'recolectar' ? 'act' : '') + '" onclick="vistaEscaner(\'recolectar\')">Recolectar</button>' +
    '<button class="' + (S.modoScan === 'entregar' ? 'act' : '') + '" onclick="vistaEscaner(\'entregar\')">Entregar</button></div></div>' +
    '<div class="visor" id="visor"></div><div class="ctrl-cam" id="ctrlCam"></div>' +
    '<div class="leidos"><div class="titulo"><b>' + (S.modoScan === 'recolectar' ? 'Leídos' : 'Lee el folio que vas a entregar') + '</b><span>' +
    (S.modoScan === 'recolectar' ? 'Ya se ven en el rastreo' : 'Se abre su pantalla de entrega') + '</span></div><div id="listaLeidos"></div>' +
    '<form class="teclear" onsubmit="teclear(event)"><input class="campo" id="inCodigo" placeholder="O teclea el folio" autocapitalize="characters" autocomplete="off"><button class="b" style="height:50px">OK</button></form>' +
    '<button class="b" onclick="codigoDeFoto()">No lo lee: tomar foto del código</button>' +
    (S.modoScan === 'recolectar' ? '<button class="btn" onclick="salirEscaner()">Listo</button>' : '') + '</div></div>');
  pintarLeidos();
  S.escaner = abrirCamara('visor', 'ctrlCam', alLeer, function (m) { var v = $('visor'); if (v) v.innerHTML = '<div class="visor-err">' + esc(m) + '</div>'; });
}
function salirEscaner() {
  pararEscaner();
  var ok = (S.leidos || []).filter(function (l) { return l.estado === 'ok'; });
  S.leidos = [];
  if (S.modoScan === 'recolectar' && ok.length) return waRecoleccion(ok.slice().reverse(), 'vistaInicio()');   // lo recolectado: opción de mandarlo por WhatsApp
  vistaInicio();
}
function pararEscaner() { if (S.escaner) { S.escaner.parar(); S.escaner = null; } }
function teclear(ev) { ev.preventDefault(); var v = $('inCodigo').value.trim(); if (v) { $('inCodigo').value = ''; alLeer(v, true); } }

function alLeer(texto) {
  var codigo = String(texto || '').trim().toUpperCase();
  if (!codigo) return;
  if (S.modoScan === 'entregar') return entregarLeido(codigo);
  if (S.leidos.some(function (l) { return clave(l.codigo) === clave(codigo); }) || S.datos.lleva.some(function (l) { return clave(l.codigo) === clave(codigo); })) {
    sonido('escaneoMal'); return toast('Ya leíste ' + codigo);
  }
  var l = { codigo: codigo, estado: 'esp', texto: 'Registrando…' };
  S.leidos.unshift(l); pintarLeidos(); beep();
  mandarRecoleccion([codigo], [l]);
}
function mandarRecoleccion(codigos, items) {
  srv('recolectar', { codigos: codigos }).then(function (d) { aplicarResultados(d.resultados, items); actualizar(); })
    .catch(function (e) {
      if (!e.red) { items.forEach(function (l) { l.estado = 'mal'; l.texto = e.message; }); return pintarLeidos(); }
      encolar('recolectar', { codigos: codigos }, 'Recolección ' + codigos.join(', '));
      items.forEach(function (l) { l.estado = 'esp'; l.texto = 'Sin señal · se registra solo al tener señal'; });
      pintarLeidos();
    });
}
function aplicarResultados(res, items) {
  res.forEach(function (r, i) {
    var l = items[i] || {};
    l.codigo = r.codigo;
    if (r.ok) { l.origen = r.origen; l.destino = r.destino + (r.direccion ? ' (' + r.direccion + ')' : ''); l.contenido = r.contenido; l.estado = 'ok'; l.texto = 'Va a ' + (r.destino || '—') + (r.direccion ? ' · ' + r.direccion : '') + (r.enPedidos ? ' · ya está en tus pedidos' : ''); }
    else if (r.pideDestino) { l.estado = 'esp'; l.texto = r.mensaje; l.pideDestino = true; }
    else { l.estado = 'mal'; l.texto = r.mensaje; if (!r.repetido) sonido('escaneoMal'); }
  });
  pintarLeidos();
}
function avisarRecoleccionesSubidas(d) { if (d && d.resultados) toast('Recolecciones registradas: ' + d.resultados.filter(function (r) { return r.ok; }).length, 'ok'); }
function pintarLeidos() {
  var c = $('listaLeidos'); if (!c) return;
  if (S.modoScan !== 'recolectar') { c.innerHTML = ''; return; }
  c.innerHTML = (S.leidos || []).slice(0, 12).map(function (l, i) {
    return '<div class="leido ' + l.estado + '"><span class="ic">' + (l.estado === 'ok' ? '✓' : l.estado === 'mal' ? '!' : '…') + '</span><span class="tx"><b>' + esc(l.codigo) + '</b><span>' + esc(l.texto) + '</span></span>' +
      (l.pideDestino ? '<button class="b" onclick="pedirDestino(' + i + ')">Destino</button>' : '') +
      (l.estado === 'ok' ? '<button class="b wa-b" onclick="waLeido(' + i + ')">WhatsApp</button>' : '') + '</div>';
  }).join('');
}
function pedirDestino(i) {
  var l = S.leidos[i];
  modal('<h2>' + esc(l.codigo) + '</h2><p>No está en el Sistema de Traspasos. Escribe a dónde va para registrarlo.</p>' +
    '<label class="et" for="inDestino">¿A dónde va?</label><input class="campo" id="inDestino" placeholder="Ej. Oficinas · Logística">' +
    '<label class="et" for="inCont">¿Qué es? <span class="opc">(opcional)</span></label><input class="campo" id="inCont">' +
    '<button class="btn" onclick="confirmarDestino(' + i + ')">Registrar</button>');
}
function confirmarDestino(i) {
  var l = S.leidos[i], dest = $('inDestino').value.trim();
  if (!dest) return toast('Escribe el destino.', 'err');
  var o = { codigo: l.codigo, destino: dest, contenido: $('inCont').value.trim() };
  cerrarModal(); l.pideDestino = false; l.texto = 'Registrando…'; pintarLeidos();
  mandarRecoleccion([o], [l]);
}
function entregarLeido(codigo) {
  var k = clave(codigo);
  var i = S.datos.lleva.findIndex(function (l) { return clave(l.codigo) === k; });
  if (i >= 0) { beep(); pararEscaner(); S.volverA = 'lleva'; return abrirCierre(S.datos.lleva[i].tipo === 'TRASPASO' ? 'TRASPASO' : 'RECOLECCION', i, 'ENTREGADO'); }
  var j = S.datos.pedidos.findIndex(function (p) { return clave(p.id) === k; });
  if (j >= 0) { beep(); pararEscaner(); S.volverA = 'pedidos'; return abrirCierre('PEDIDO', j, 'ENTREGADO'); }
  sonido('escaneoMal'); toast(codigo + ' no está en lo que llevas. Recolecta primero.', 'err');
}

/* ---------- lector de códigos (motor del celular o zxing-cpp) ---------- */
var LECTOR_FORMATOS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'codabar', 'upc_a', 'upc_e', 'qr_code'];
var _detector = null;
function obtenerDetector() {
  if (_detector) return Promise.resolve(_detector);
  var nativo = Promise.resolve(null);
  if (window.BarcodeDetector && window.BarcodeDetector.getSupportedFormats) {
    nativo = window.BarcodeDetector.getSupportedFormats().then(function (sop) {
      var f = LECTOR_FORMATOS.filter(function (x) { return sop.indexOf(x) >= 0; });
      return f.indexOf('code_128') >= 0 ? new window.BarcodeDetector({ formats: f }) : null;
    }).catch(function () { return null; });
  }
  return nativo.then(function (det) {
    if (det) { _detector = det; return det; }
    var api = window.BarcodeDetectionAPI;
    if (!api) throw new Error('El lector no cargó. Conéctate una vez para descargarlo.');
    api.prepareZXingModule({ overrides: { locateFile: function (ruta, prefijo) { return /\.wasm$/.test(ruta) ? '../lib/' + ruta : prefijo + ruta; } } });
    _detector = new api.BarcodeDetector({ formats: LECTOR_FORMATOS });
    return _detector;
  });
}
function codigoDelCentro(cods, w, h) {
  if (!cods || !cods.length) return null;
  var cx = w / 2, cy = h / 2, mejor = null, dist = Infinity;
  cods.forEach(function (c) {
    var b = c.boundingBox || { x: 0, y: 0, width: 0, height: 0 };
    var dx = Math.max(b.x - cx, 0, cx - (b.x + b.width)), dy = Math.max(b.y - cy, 0, cy - (b.y + b.height)), d = dx * dx + dy * dy;
    if (d < dist) { dist = d; mejor = c; }
  });
  return mejor;
}
/* Un código borroso a veces se lee con un dígito mal: se pide leer lo mismo 2 veces seguidas (QR a la primera). */
function conConfirmacion(fn) {
  var ult = '', veces = 0, cuando = 0, ultAceptado = '', cuandoAceptado = 0;
  return function (t, formato) {
    t = String(t || '').trim(); if (!t) return;
    var ahora = Date.now();
    if (t === ultAceptado && ahora - cuandoAceptado < 3000) return;      // sigue frente a la cámara: no lo cuenta otra vez
    if (t === ult && ahora - cuando < 1500) veces++; else { ult = t; veces = 1; }
    cuando = ahora;
    if (formato === 'qr_code' || veces >= 2) { ult = ''; veces = 0; ultAceptado = t; cuandoAceptado = ahora; fn(t); }
  };
}
function abrirCamara(idVisor, idCtrl, alLeerFn, alError) {
  var ctrl = { parado: false, stream: null };
  var visor = $(idVisor);
  visor.innerHTML = '<video playsinline muted autoplay></video><div class="visor-marco"></div><div class="visor-linea"></div><div class="visor-txt">Pon el código sobre la línea roja</div>';
  var video = visor.querySelector('video'), aceptar = conConfirmacion(alLeerFn);
  ctrl.parar = function () { ctrl.parado = true; if (ctrl.stream) ctrl.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); try { video.srcObject = null; } catch (e) {} };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setTimeout(function () { alError('Este navegador no deja usar la cámara. Teclea el folio.'); }, 0); return ctrl; }
  obtenerDetector().then(function (det) {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }).then(function (st) {
      if (ctrl.parado) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      ctrl.stream = st; var track = st.getVideoTracks()[0];
      try { track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {}); } catch (e) {}
      video.srcObject = st;
      return Promise.resolve(video.play()).catch(function () {}).then(function () { controlesCamara(track, idCtrl); leerCuadro(det); });
    });
  }).catch(function (e) {
    if (ctrl.parado) return;
    var m = String((e && (e.name || e.message)) || e);
    alError(/NotAllowed|Permission/i.test(m) ? 'Sin permiso para usar la cámara. Actívalo en los ajustes del navegador o teclea el folio. (CEL-03)' : 'No pude abrir la cámara (CEL-03). Teclea el folio o usa "tomar foto del código".');
  });
  var fase = 0, lienzo = null;
  function cuadro() {
    if (fase === 0) return video;
    var w = video.videoWidth, h = video.videoHeight;
    if (!lienzo) lienzo = document.createElement('canvas');
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    var g = lienzo.getContext('2d'); g.save(); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2); g.rotate((fase === 1 ? 10 : -10) * Math.PI / 180); g.drawImage(video, -w / 2, -h / 2, w, h); g.restore();
    return lienzo;
  }
  function leerCuadro(det) {
    if (ctrl.parado) return;
    if (video.readyState < 2 || !video.videoWidth) { setTimeout(function () { leerCuadro(det); }, 80); return; }
    det.detect(cuadro()).then(function (cods) {
      if (ctrl.parado) return;
      var c = codigoDelCentro(cods, video.videoWidth, video.videoHeight);
      if (c) aceptar(c.rawValue, c.format); else fase = (fase + 1) % 3;
    }).catch(function () { fase = 0; }).then(function () { if (!ctrl.parado) setTimeout(function () { leerCuadro(det); }, 30); });
  }
  return ctrl;
}
function controlesCamara(track, id) {
  var c = $(id); if (!c || !track || !track.getCapabilities) return;
  var caps; try { caps = track.getCapabilities() || {}; } catch (e) { return; }
  var html = '', zoom = caps.zoom && caps.zoom.max > caps.zoom.min;
  if (zoom) html += '<label>Acercar<input type="range" id="zoomCam" min="' + caps.zoom.min + '" max="' + caps.zoom.max + '" step="' + (caps.zoom.step || 0.1) + '"></label>';
  if (caps.torch) html += '<button id="luzCam">Luz</button>';
  c.innerHTML = html;
  if (zoom) {
    var ini = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.5)); $('zoomCam').value = ini;
    track.applyConstraints({ advanced: [{ zoom: ini }] }).catch(function () {});
    $('zoomCam').oninput = function () { track.applyConstraints({ advanced: [{ zoom: parseFloat(this.value) }] }).catch(function () {}); };
  }
  if (caps.torch) { var on = false; $('luzCam').onclick = function () { var b = this; track.applyConstraints({ advanced: [{ torch: !on }] }).then(function () { on = !on; b.textContent = on ? 'Apagar luz' : 'Luz'; }).catch(function () {}); }; }
}
function codigoDeFoto() {
  pararEscaner();
  elegirArchivo(function (f) {
    cargando('Buscando el código en la foto…');
    Promise.all([obtenerDetector(), reducirFoto(f, 2000)]).then(function (r) {
      return r[0].detect(r[1]).then(function (cods) { var c = codigoDelCentro(cods, r[1].width, r[1].height); if (!c) throw new Error('sin código'); return c.rawValue; });
    }).then(function (t) { quitarCargando(); vistaEscaner(S.modoScan); alLeer(t); })
      .catch(function () { quitarCargando(); vistaEscaner(S.modoScan); falla(errCod('CEL-08', 'No encontré el código en la foto. Que salga enfocado y llenando la foto.')); });
  });
}

/* ==================== Cámara para fotos (dentro de la app) ==================== */
/* La cámara normal del celular hacía que Android cerrara el navegador en celulares con poca memoria. */
var camFoto = null;
function tomarFoto() {
  preservar(); guardarBorrador(); if (S.vista === 'libre') libPres();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return fotoDeArchivo();
  cerrarCamFoto();
  document.body.insertAdjacentHTML('beforeend', '<div class="cam-foto" id="camFoto"><video playsinline muted autoplay></video><div class="cam-aviso" id="camAviso">Abriendo cámara…</div>' +
    '<div class="cam-barra"><button class="cam-lado" onclick="cerrarCamFoto()">Cancelar</button><button class="cam-disparo" id="camDisparo" onclick="dispararFoto()" aria-label="Tomar foto" disabled></button>' +
    '<button class="cam-lado" id="camLuz" onclick="luzFoto()" style="visibility:hidden">Luz</button></div>' +
    '<button class="cam-alterna" onclick="cerrarCamFoto();fotoDeArchivo()">Usar la cámara del celular o la galería</button></div>');
  var cam = camFoto = { stream: null, track: null, luz: false }, video = $('camFoto').querySelector('video');
  navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } }).then(function (st) {
    if (camFoto !== cam) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
    cam.stream = st; cam.track = st.getVideoTracks()[0]; video.srcObject = st;
    return Promise.resolve(video.play()).catch(function () {}).then(function () {
      if (camFoto !== cam) return;
      $('camAviso').style.display = 'none'; $('camDisparo').disabled = false;
      var caps = cam.track.getCapabilities ? cam.track.getCapabilities() : {};
      if (caps && caps.torch) $('camLuz').style.visibility = 'visible';
    });
  }).catch(function (e) {
    if (camFoto !== cam) return;
    $('camAviso').innerHTML = (/NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? 'Sin permiso para usar la cámara (CEL-03).<br>Actívalo en los ajustes del navegador' : 'No pude abrir la cámara (CEL-03)') + ' o usa el botón de abajo.';
  });
}
function dispararFoto() {
  var cf = $('camFoto'); if (!cf || !camFoto) return;
  var v = cf.querySelector('video'), w = v.videoWidth, h = v.videoHeight; if (!w || !h) return;
  var k = Math.min(1, 1280 / Math.max(w, h)), cv = document.createElement('canvas');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
  var foto = cv.toDataURL('image/jpeg', 0.72); cv.width = cv.height = 0;
  cerrarCamFoto(); ponerFoto(foto);
}
function luzFoto() { if (!camFoto || !camFoto.track) return; var p = !camFoto.luz; camFoto.track.applyConstraints({ advanced: [{ torch: p }] }).then(function () { camFoto.luz = p; $('camLuz').textContent = p ? 'Apagar' : 'Luz'; }).catch(function () {}); }
function cerrarCamFoto() { if (camFoto && camFoto.stream) camFoto.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); camFoto = null; var c = $('camFoto'); if (c) c.remove(); }
function ponerFoto(f) {
  if (!S.cierre && S.vista === 'listo' && S.waOpts) { S.waOpts.foto = f; beep(); return vistaWA(S.waOpts); }
  if (!S.cierre && S.vista === 'libre' && S.libre) { S.libre.foto = f; beep(); return vistaLibre(); }
  if (!S.cierre && S.vista === 'parada' && S.parada) { S.parada.foto = f; beep(); return vistaParada(S.parada.k); }
  if (!S.cierre) return; S.cierre.foto = f; beep(); pintarCierre();
}
function fotoDeArchivo() {
  preservar(); guardarBorrador(); if (S.vista === 'libre') libPres();
  elegirArchivo(function (f) {
    cargando('Procesando foto…');
    reducirFoto(f, 1280).then(function (cv) { var u = cv.toDataURL('image/jpeg', 0.72); cv.width = cv.height = 0; quitarCargando(); ponerFoto(u); })
      .catch(function () { quitarCargando(); falla(errCod('CEL-03', 'No pude leer la imagen.')); });
  });
}
function elegirArchivo(fn) { var i = $('inputCamara'); i.value = ''; i.onchange = function () { var f = i.files && i.files[0]; if (f) fn(f); }; i.click(); }
function reducirFoto(file, max) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () { var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h)), cv = document.createElement('canvas');
      cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv); };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('foto')); };
    img.src = url;
  });
}

/* ==================== Firma ==================== */
var firmaCtx = null, firmando = false, hayFirma = false;
function prepararFirma() {
  var cv = $('firmaCanvas'); if (!cv) return;
  var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  firmaCtx = cv.getContext('2d'); firmaCtx.scale(dpr, dpr);
  firmaCtx.fillStyle = '#fff'; firmaCtx.fillRect(0, 0, r.width, r.height);
  firmaCtx.strokeStyle = '#111'; firmaCtx.lineWidth = 2.6; firmaCtx.lineCap = 'round'; firmaCtx.lineJoin = 'round';
  hayFirma = false;
  if (S.cierre && S.cierre.firma) { var im = new Image(); im.onload = function () { firmaCtx.drawImage(im, 0, 0, r.width, r.height); hayFirma = true; }; im.src = S.cierre.firma; }
  function xy(e) { var b = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return { x: t.clientX - b.left, y: t.clientY - b.top }; }
  function ini(e) { e.preventDefault(); firmando = true; hayFirma = true; var p = xy(e); firmaCtx.beginPath(); firmaCtx.moveTo(p.x, p.y); }
  function mov(e) { if (!firmando) return; e.preventDefault(); var p = xy(e); firmaCtx.lineTo(p.x, p.y); firmaCtx.stroke(); }
  function fin(e) { if (e) e.preventDefault(); if (firmando) { firmando = false; guardarBorrador(); } }
  cv.addEventListener('touchstart', ini, { passive: false }); cv.addEventListener('touchmove', mov, { passive: false }); cv.addEventListener('touchend', fin, { passive: false });
  cv.addEventListener('mousedown', ini); cv.addEventListener('mousemove', mov); cv.addEventListener('mouseup', fin); cv.addEventListener('mouseleave', fin);
}
function limpiarFirma() { var cv = $('firmaCanvas'); if (!cv || !firmaCtx) return; var r = cv.getBoundingClientRect(); firmaCtx.fillStyle = '#fff'; firmaCtx.fillRect(0, 0, r.width, r.height); hayFirma = false; if (S.cierre) { S.cierre.firma = null; guardarBorrador(); } }
function leerFirma() { var cv = $('firmaCanvas'); return cv && hayFirma ? cv.toDataURL('image/png') : null; }

/* ==================== GPS ==================== */
function obtenerGPS() {
  return new Promise(function (res) {
    if (!navigator.geolocation) return res({ lat: '', lng: '' });
    var listo = false, t = setTimeout(function () { if (!listo) { listo = true; res({ lat: '', lng: '' }); } }, 6000);
    navigator.geolocation.getCurrentPosition(function (p) { if (listo) return; listo = true; clearTimeout(t); res({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }); },
      function () { if (listo) return; listo = true; clearTimeout(t); res({ lat: '', lng: '' }); }, { enableHighAccuracy: true, timeout: 5500, maximumAge: 30000 });
  });
}

/* ==================== Manual y problemas ==================== */
function vistaManual() {
  S.vista = 'manual'; pararEscaner();
  var pinta = function (docs) {
    var html = '<div class="barra"><button class="volver" onclick="vistaInicio()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>Manual y documentos</b><small>Se abren aunque no haya señal</small></div></div><div class="cuerpo con-nav">';
    if (!docs) html += '<div class="vacio"><b>Cargando…</b></div>';
    else if (!docs.length) html += '<div class="vacio"><b>Sin documentos</b></div>';
    else docs.forEach(function (d) {
      html += d.tipo === 'enlace' ? '<a class="doc" href="' + esc(d.contenido) + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><div style="padding:14px;font-weight:700">' + esc(d.titulo) + ' <span class="tag r">PDF</span><div class="opc" style="font-weight:500">' + esc(d.categoria) + '</div></div></a>'
        : '<details class="doc"><summary><span class="tag a">' + esc(d.categoria.toUpperCase()) + '</span>' + esc(d.titulo) + '</summary><div class="cuerpo-doc">' + esc(d.contenido) + '</div></details>';
    });
    pintar(html + '</div>' + nav('manual'));
  };
  DB.get('docs').then(function (d) { if (S.vista === 'manual') pinta(d); });
  srv('documentos').then(function (r) { DB.set('docs', r.documentos); if (S.vista === 'manual') pinta(r.documentos); }).catch(function () {});
}
function reportar() {
  modal('<h2>Reportar un problema</h2><p>Llega a tu administradora con un número para darle seguimiento.</p>' +
    '<label class="et" for="inProbId">Pedido o folio <span class="opc">(opcional)</span></label><input class="campo" id="inProbId">' +
    '<label class="et" for="inProb">¿Qué pasó?</label><textarea class="campo" id="inProb" rows="3"></textarea>' +
    '<button class="btn" onclick="mandarReporte()">Enviar</button>');
}
function mandarReporte() {
  var det = $('inProb').value.trim(); if (!det) return toast('Escribe qué pasó.', 'err');
  var d = { codigo: 'CEL', id: $('inProbId').value.trim(), detalle: det + ' · App ' + VERSION_APP + ' · ' + navigator.userAgent.slice(0, 80) };
  cerrarModal();
  srv('problema', d).then(function (r) { toast('Reporte ' + r.numero + ' enviado', 'ok'); })
    .catch(function (e) { if (e.red) { encolar('problema', d, 'Reporte de problema'); toast('Se envía al tener señal'); } else falla(e); });
}

if (!window.__PRUEBA__) document.addEventListener('DOMContentLoaded', arrancar);
