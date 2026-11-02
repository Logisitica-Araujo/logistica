/***********************************************************************
 * APP GESTORES 2 — 07_ROBOT.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * EL ROBOT. Corre cada minuto (en ROBOT_HORARIO) y hace, en orden:
 *   1. Trae de OPERACIONES los pedidos abiertos con gestor → APP_Pedidos.
 *   2. Lleva los cierres PENDIENTES: pedidos a la API, traspasos al Sistema de Traspasos.
 *   3. Avisa las recolecciones nuevas: traspasos → RECOLECTADO en el sistema
 *      ("Recolectado por gestoría" en el rastreo); pedidos → APP_Traspasos_Hist vía API.
 *   4. Limpia: quita de la lista del gestor lo que ya terminó en su fuente
 *      (traspaso: columna Estatus de RES_Traspasos; pedido: ESTATUS de Operaciones).
 *   5. Anota la hora en APP_Config → ULTIMA_VUELTA_ROBOT.
 * Si un paso falla, los demás siguen; el error queda en ULTIMO_ERROR_ROBOT y APP_Log.
 *
 * Instalar: ⚙ App Gestores → Instalar robot (una vez).
 ***********************************************************************/

var APPG_ROBOT = { MAX_SEG: 270, CIERRES_POR_VUELTA: 25, INTENTOS_MAX: 10 };

function robot(forzar) {
  var cfg = _config();
  if (!forzar && !_dentroDeHorario(cfg.ROBOT_HORARIO)) return 'Fuera de horario';
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(2000)) return 'Otra vuelta sigue corriendo';
  var inicio = Date.now(), errores = [], hecho = {};
  function paso(nombre, fn) {
    if ((Date.now() - inicio) / 1000 > APPG_ROBOT.MAX_SEG) { errores.push(nombre + ': sin tiempo (ROB-06)'); return; }
    try { hecho[nombre] = fn(); }
    catch (e) { errores.push(nombre + ': ' + (e.codigo ? '[' + e.codigo + '] ' : '') + e.message); _log('robot', 'ERROR_' + nombre.toUpperCase(), e.stack || e.message); }
  }
  try {
    var ruta = null;
    paso('pedidos', function () { ruta = _robotPedidos(); return ruta.length; });
    paso('cierres', function () { return _robotCierres(ruta); });
    paso('recolecciones', _robotRecolecciones);
    paso('limpieza', _robotLimpieza);
  } finally {
    _ponerConfig('ULTIMA_VUELTA_ROBOT', _ahora());
    _ponerConfig('ULTIMO_ERROR_ROBOT', errores.length ? _ahora('dd/MM HH:mm') + ' · ' + errores.join(' | ') : '');
    candado.releaseLock();
  }
  return JSON.stringify({ hecho: hecho, errores: errores, seg: Math.round((Date.now() - inicio) / 1000) });
}

/* ---------- 1. Pedidos de OPERACIONES → APP_Pedidos ---------- */
function _robotPedidos() {
  var r = _ops('rutaGestores', {});
  if (!r.ok) throw _falla(r.codigo, r.mensaje || r.error);
  var porNombre = {};
  _tabla(APPG.H.USUARIOS).filas.forEach(function (u) { if (_si(u.Activo) && u.NombreEnOperaciones) porNombre[_norm(u.NombreEnOperaciones)] = u; });
  var desconocidos = {};
  var filas = [];
  r.pedidos.forEach(function (p) {
    var u = porNombre[_norm(p.gestor)];
    if (!u) { desconocidos[p.gestor] = (desconocidos[p.gestor] || 0) + 1; return; }
    filas.push([p.id, p.fila, u.Numero, u.Nombre, p.nombre, p.direccion, p.telefono || '', [p.incidencia, p.motivo].filter(String).join(' · '),
                p.area, p.subarea, p.metodo, p.estatus, p.eta, '']);
  });
  _avisarDesconocidos(desconocidos);

  /* Solo se reescribe si algo cambió (se compara una huella). */
  var huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(filas)));
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('HUELLA_PEDIDOS') !== huella) {
    var sh = _hoja(APPG.H.PEDIDOS);
    var enc = APPG.ENC.APP_Pedidos;
    var ahora = _ahora();
    filas.forEach(function (f) { f[enc.indexOf('Actualizado')] = ahora; });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, enc.length).clearContent();
    if (filas.length) sh.getRange(2, 1, filas.length, enc.length).setValues(filas);
    props.setProperty('HUELLA_PEDIDOS', huella);
  }
  return r.pedidos;
}

function _avisarDesconocidos(mapa) {
  var cache = CacheService.getScriptCache();
  Object.keys(mapa).forEach(function (n) {
    var k = 'desc_' + _norm(n).replace(/[^a-z0-9]/g, '');
    if (cache.get(k)) return;
    cache.put(k, '1', 6 * 3600);
    _problema('ROB-02', 'robot', 'El gestor "' + n + '" tiene ' + mapa[n] + ' pedido(s) en Operaciones, pero no hay nadie en APP_Usuarios con ese "NombreEnOperaciones".');
  });
}

/* ---------- 2. Cierres pendientes ---------- */
function _robotCierres(ruta) {
  var t = _tabla(APPG.H.CIERRES);
  var pend = t.filas.filter(function (c) { return String(c.Estado) === 'PENDIENTE'; }).slice(0, APPG_ROBOT.CIERRES_POR_VUELTA);
  var filaPorId = {};
  (ruta || []).forEach(function (p) { filaPorId[_norm(p.id)] = p.fila; });
  var n = 0;
  pend.forEach(function (c) {
    var res;
    try {
      if (String(c.Tipo) === 'TRASPASO') res = _robotCierreTraspaso(c);
      else res = _ops('cierreGestor', {
        fila: Number(c.Fila) || filaPorId[_norm(c.ID)] || 0, id: String(c.ID), gestor: _nombreEnOps(c.NumeroGestor), vehiculo: String(c.Vehiculo),
        resultado: String(c.Resultado), motivo: String(c.Motivo), comentario: String(c.Comentario), recibio: String(c.Recibio),
        lat: c.Lat, lng: c.Lng, urlFoto: String(c.URLFoto), urlFirma: String(c.URLFirma), cliente: String(c.Cliente), direccion: String(c.Direccion),
        fecha: _horaReal(c)
      });
    } catch (e) { res = { ok: false, codigo: e.codigo || 'APP-01', mensaje: e.message, reintentar: true }; }

    var intentos = (Number(c.Intentos) || 0) + 1;
    var col = function (h) { return t.col(h); };
    t.sh.getRange(c._fila, col('Intentos')).setValue(intentos);
    if (res.ok) {
      t.sh.getRange(c._fila, col('Estado')).setValue('ENVIADO');
      t.sh.getRange(c._fila, col('EnviadoEn')).setValue(_ahora());
      t.sh.getRange(c._fila, col('UltimoError')).setValue('');
      n++;
      return;
    }
    // La fila cambió de lugar: se corrige y se reintenta en la siguiente vuelta.
    if (res.codigo === 'API-03' && filaPorId[_norm(c.ID)]) t.sh.getRange(c._fila, col('Fila')).setValue(filaPorId[_norm(c.ID)]);
    var temporal = res.reintentar || res.codigo === 'API-01' || res.codigo === 'API-03' || res.codigo === 'API-04' || res.codigo === 'API-07';
    t.sh.getRange(c._fila, col('UltimoError')).setValue('[' + res.codigo + '] ' + (res.mensaje || ''));
    if (!temporal || intentos >= APPG_ROBOT.INTENTOS_MAX) {
      t.sh.getRange(c._fila, col('Estado')).setValue('ERROR');
      _problema(res.codigo, String(c.Gestor), 'No se pudo pasar el cierre ' + c.IdCierre + ' (' + c.ID + ' · ' + c.Resultado + ') a su sistema: ' + (res.mensaje || ''));
    }
  });
  return n;
}

function _robotCierreTraspaso(c) {
  var r = String(c.Resultado);
  var est = _tnCierre(String(c.ID), String(c.Gestor), r === 'ENTREGADO', String(c.URLFoto), String(c.Motivo), String(c.Comentario), String(c.Recibio));
  return { ok: true, estado: est };
}

/** Hora real de la entrega: la del celular si es coherente (sirve cuando se cerró sin señal). */
function _horaReal(c) {
  var hc = String(c.HoraCelular || '');
  var ms = _fechaMs(hc), srv = _fechaMs(c.FechaHora) || Date.now();
  if (ms && ms <= srv + 5 * 60000 && srv - ms < 3 * 86400000) return hc.replace(' ', 'T').slice(0, 16);
  return _fechaTxt(c.FechaHora, 'yyyy-MM-dd HH:mm').replace(' ', 'T');
}

function _nombreEnOps(numero) {
  var u = _tabla(APPG.H.USUARIOS).filas.filter(function (x) { return String(x.Numero) === String(numero); })[0];
  return u ? String(u.NombreEnOperaciones) : '';
}

/* ---------- 3. Recolecciones nuevas → su sistema ---------- */
function _robotRecolecciones() {
  var t = _tabla(APPG.H.RECOLECCIONES);
  var n = 0;
  t.filas.forEach(function (r) {
    if (String(r.Enviado) !== 'NO') return;
    var ok = true, nota = '';
    if (String(r.Tipo) === 'TRASPASO') {
      ok = true;
      try { nota = _tnRecolectar(String(r.Codigo), String(r.Gestor), String(r.Vehiculo)) ? 'RECOLECTADO' : 'NO RECOLECTABLE'; }
      catch (e) { ok = false; nota = e.message; }
    } else if (String(r.Tipo) === 'PEDIDO') {
      var a = _ops('recoleccion', { id: String(r.Codigo), gestor: _nombreEnOps(r.NumeroGestor), vehiculo: String(r.Vehiculo), fecha: _fechaTxt(r.FechaHora, 'yyyy-MM-dd HH:mm').replace(' ', 'T') });
      ok = a.ok; nota = a.ok ? 'ANOTADO' : '[' + a.codigo + '] ' + a.mensaje;
    }
    if (ok) { t.sh.getRange(r._fila, t.col('Enviado')).setValue('SI'); n++; }
    t.sh.getRange(r._fila, t.col('EstadoFuente')).setValue(nota);
  });
  return n;
}

/* ---------- 4. Limpieza: lo que ya terminó sale de la lista ---------- */
function _robotLimpieza() {
  var t = _tabla(APPG.H.RECOLECCIONES);
  var abiertos = t.filas.filter(function (r) { return /^EN RUTA/.test(String(r.Estado)); });
  if (!abiertos.length) return 0;
  var cfg = _config();
  var dias = Number(cfg.DIAS_PARA_ALERTA) || 3;
  var idsPedido = abiertos.filter(function (r) { return String(r.Tipo) === 'PEDIDO'; }).map(function (r) { return String(r.Codigo); });
  var estados = {};
  if (idsPedido.length) {
    var e = _ops('estadoPedidos', { ids: idsPedido });
    if (e.ok) estados = e.estados;
  }
  var n = 0;
  abiertos.forEach(function (r) {
    var cerrar = '', fuente = '';
    if (String(r.Tipo) === 'TRASPASO') {
      var tn = _tnBuscar(String(r.Codigo));
      fuente = tn ? tn.estatus : 'NO EXISTE';
      if (tn && APPG_TN.TERMINADOS.indexOf(tn.estatus) >= 0) cerrar = 'CERRADO EN DESTINO';
    } else if (String(r.Tipo) === 'PEDIDO' && Object.prototype.hasOwnProperty.call(estados, String(r.Codigo))) {
      fuente = estados[String(r.Codigo)] || 'NO EXISTE EN OPERACIONES';
      if (/ENTREGADO|CANCELADO|RETORNADO/i.test(fuente)) cerrar = 'CERRADO';
    }
    if (cerrar) {
      t.sh.getRange(r._fila, t.col('Estado')).setValue(cerrar);
      t.sh.getRange(r._fila, t.col('Actualizado')).setValue(_ahora());
      n++;
    }
    if (fuente && fuente !== String(r.EstadoFuente)) t.sh.getRange(r._fila, t.col('EstadoFuente')).setValue(fuente);
    // Lleva días sin moverse: a APP_Problemas, una sola vez.
    if (!cerrar && Date.now() - _fechaMs(r.FechaHora) > dias * 86400000 && String(r.EstadoFuente).indexOf('ALERTA') < 0) {
      _problema('DIS-02', String(r.Gestor), r.Tipo + ' ' + r.Codigo + ' lleva más de ' + dias + ' días sin entregarse (' + (fuente || r.Tipo) + ').');
      t.sh.getRange(r._fila, t.col('EstadoFuente')).setValue((fuente || '') + ' · ALERTA');
    }
  });
  return n;
}

/* ---------- utilidades ---------- */
function _dentroDeHorario(txt) {
  var m = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(String(txt || '6-22').trim());
  if (!m) return true;
  var h = Number(_ahora('H'));
  return h >= Number(m[1]) && h < Number(m[2]);
}

function _ponerConfig(clave, valor) {
  var t = _tabla(APPG.H.CONFIG);
  var f = t.filas.filter(function (x) { return String(x.Clave) === clave; })[0];
  if (f) t.sh.getRange(f._fila, t.col('Valor')).setValue(valor);
  else _agregar(APPG.H.CONFIG, { 'Clave': clave, 'Valor': valor, 'Descripción': '' });
  CacheService.getScriptCache().remove('cfg');
}

/** Menú: instala el robot cada ROBOT_CADA_MIN minutos (borra los anteriores para no duplicar). */
function instalarRobot() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'robot') ScriptApp.deleteTrigger(t); });
  var cada = Number(_config().ROBOT_CADA_MIN) || 1;
  cada = [1, 5, 10, 15, 30].filter(function (x) { return x >= cada; })[0] || 1;
  ScriptApp.newTrigger('robot').timeBased().everyMinutes(cada).create();
  var r = robot(true);
  _avisar('Robot instalado: corre cada ' + cada + ' minuto(s) en el horario ' + _config().ROBOT_HORARIO + '.\n\nPrimera vuelta: ' + r);
  return r;
}

function correrRobotAhora() { _avisar('Vuelta del robot: ' + robot(true)); }
