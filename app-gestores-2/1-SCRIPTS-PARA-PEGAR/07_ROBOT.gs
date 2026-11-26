/***********************************************************************
 * APP GESTORES 2 — 07_ROBOT.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * EL ROBOT. Corre cada minuto (en ROBOT_HORARIO) y hace, en orden:
 *   1. Trae de OPERACIONES los pedidos abiertos con gestor → APP_Pedidos.
 *   2. Avisa las recolecciones nuevas: traspasos → RECOLECTADO en el sistema
 *      ("Recolectado por gestoría" en el rastreo); pedidos → APP_Traspasos_Hist vía API.
 *   3. Lleva los cierres PENDIENTES: pedidos a la API, traspasos al Sistema de Traspasos.
 *   4. Limpia: quita de la lista del gestor lo que ya terminó en su fuente o ya no trae
 *      (traspaso: columna Estatus de RES_Traspasos — terminado, o en recepción/otro estatus
 *      después de que él lo recolectó; pedido: ESTATUS de Operaciones).
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
    try { _archivosFaltantes().forEach(_avisarFaltante); } catch (e) { }   // ¿falta pegar algún archivo? → APP_Problemas (APP-03)
    paso('pedidos', function () { ruta = _robotPedidos(); return ruta.length; });
    // Primero las recolecciones: si alguien recoge y entrega en el mismo minuto, el traspaso ya
    // tiene que estar "RECOLECTADO" en el sistema cuando llegue su entrega.
    paso('recolecciones', function () { return _robotRecolecciones(); });
    paso('ligarLibres', function () { return _robotLigarLibres(ruta); });
    paso('llevaInfo', function () { return _robotLlevaInfo(); });
    paso('cierres', function () { return _robotCierres(ruta); });
    paso('correcciones', function () { return _robotCorrecciones(); });
    paso('limpieza', function () { return _robotLimpieza(); });
    paso('contraseñas', function () { return _procesarClavesNuevas(); });
    if (String(cfg.ID_BOTICAN || '').trim()) paso('botican', function () { return _robotBotican(); });
    if (String(cfg.ID_BOTICAN || '').trim()) paso('botSucursal', function () { return _robotBotSucursal(); });
    paso('pendientesFad', function () { return _robotPendFad(); });
    paso('porRecoger', function () {
      var hay = _tabla(APPG.H.USUARIOS).filas.some(function (u) { return _si(u.Activo) && _perfil(u).area === 'FACTURACION'; });
      return hay ? _calcularPorRecoger().length : 0;
    });
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
  // Varios usuarios pueden tener el mismo nombre en Operaciones (ej. el gestor y un usuario de prueba): todos ven sus pedidos.
  _tabla(APPG.H.USUARIOS).filas.forEach(function (u) {
    if (!_si(u.Activo)) return;
    _clavesOps(u).forEach(function (k) { (porNombre[k] = porNombre[k] || []).push(u); });
  });
  var desconocidos = {};
  var filas = [];
  r.pedidos.forEach(function (p) {
    var us = porNombre[_claveNombre(p.gestor)];
    if (!us) { desconocidos[p.gestor] = (desconocidos[p.gestor] || 0) + 1; return; }
    us.forEach(function (u) {
      filas.push([p.id, p.fila, u.Numero, u.Nombre, p.nombre, p.direccion, p.telefono || '', [p.incidencia, p.motivo].filter(String).join(' · '),
                  p.area, p.subarea, p.metodo, p.estatus, p.eta, '']);
    });
  });
  _avisarDesconocidos(desconocidos);

  /* Se escribe por NOMBRE de columna (si INSTALAR agregó columnas al final, el orden de la hoja
     ya no es el de APPG.ENC). Solo se reescribe si algo cambió (se compara una huella). */
  var sh = _hoja(APPG.H.PEDIDOS);
  var real = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var enc = APPG.ENC.APP_Pedidos;
  var huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, real.join('|') + '#' + JSON.stringify(filas)));
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('HUELLA_PEDIDOS') !== huella) {
    var ahora = _ahora();
    var salida = filas.map(function (f) {
      return real.map(function (h) { var k = enc.indexOf(h); return h === 'Actualizado' ? ahora : (k >= 0 ? f[k] : ''); });
    });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, real.length).clearContent();
    if (salida.length) sh.getRange(2, 1, salida.length, real.length).setValues(salida);
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
    _problema('ROB-02', 'robot', 'El gestor "' + n + '" tiene ' + mapa[n] + ' pedido(s) en Operaciones, pero no hay nadie en APP_Usuarios con ese "NombreEnOperaciones" ni ese Usuario.');
  });
}

/* ---------- 2. Cierres pendientes ---------- */
function _robotCierres(ruta) {
  var t = _tabla(APPG.H.CIERRES);
  var pend = t.filas.filter(function (c) { return String(c.Estado) === 'PENDIENTE'; }).slice(0, APPG_ROBOT.CIERRES_POR_VUELTA);
  var filaPorId = {}, gestorPorId = {};
  (ruta || []).forEach(function (p) { filaPorId[_norm(p.id)] = p.fila; gestorPorId[_norm(p.id)] = p.gestor; });
  var n = 0;
  pend.forEach(function (c) {
    var res, sos = null;
    try {
      if (String(c.Clase) === 'SOS') {   // "Entrega a domicilio" SOS: primero se asigna a su nombre en Operaciones
        sos = _sosPreparar(c, filaPorId, gestorPorId);
        if (sos.esperar) { t.sh.getRange(c._fila, t.col('UltimoError')).setValue(sos.mensaje); return; }
        if (!sos.ok) res = sos;
        else if (sos.fila && Number(c.Fila) !== Number(sos.fila)) t.sh.getRange(c._fila, t.col('Fila')).setValue(sos.fila);
      }
      if (res) { /* ya falló al asignar */ }
      else if (String(c.Tipo) === 'TRASPASO') res = _robotCierreTraspaso(c);
      else res = _ops('cierreGestor', {
        fila: (sos && sos.fila) || Number(c.Fila) || filaPorId[_norm(c.ID)] || 0, id: String(c.ID), gestor: sos ? sos.gestor : _gestorParaOps(gestorPorId[_norm(c.ID)], c.NumeroGestor), vehiculo: String(c.Vehiculo),
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
  var est = _tnCierre(String(c.ID), String(c.Gestor), r === 'ENTREGADO', String(c.URLFoto), String(c.Motivo), String(c.Comentario), String(c.Recibio), String(c.DondeEntrego || ''));
  return { ok: true, estado: est };
}

/** Hora real de la entrega: la del celular si es coherente (sirve cuando se cerró sin señal). */
function _horaReal(c) {
  var hc = String(c.HoraCelular || '');
  var ms = _fechaMs(hc), srv = _fechaMs(c.FechaHora) || Date.now();
  if (ms && ms <= srv + 5 * 60000 && srv - ms < 3 * 86400000) return hc.replace(' ', 'T').slice(0, 16);
  return _fechaTxt(c.FechaHora, 'yyyy-MM-dd HH:mm').replace(' ', 'T');
}

function _usuarioPorNumero(numero) {
  return _tabla(APPG.H.USUARIOS).filas.filter(function (x) { return String(x.Numero) === String(numero); })[0];
}
function _nombreEnOps(numero) {
  var u = _usuarioPorNumero(numero);
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
      // Envios (BOTICAN) columna H: la hora de recolección, solo si está vacía y sin fórmula.
      if (String(_config().ID_BOTICAN || '').trim()) {
        try { var h = _btEscribirH(String(r.Codigo), r.FechaHora, String(r.Gestor)); if (h === 'escrita') _log('robot', 'BOT_H', r.Codigo + ' · ' + r.FechaHora); }
        catch (e) { _log('robot', 'BOT_H_ERROR', r.Codigo + ' · ' + e.message); }
      }
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
  var n = 0, usuarios = {};
  _tabla(APPG.H.USUARIOS).filas.forEach(function (x) { usuarios[String(x.Numero)] = x; });
  abiertos.forEach(function (r) {
    var cerrar = '', fuente = '';
    if (String(r.Tipo) === 'TRASPASO') {
      var tn = _tnBuscar(String(r.Codigo));
      fuente = tn ? tn.estatus : 'NO EXISTE';
      if (tn && APPG_TN.TERMINADOS.indexOf(tn.estatus) >= 0) cerrar = 'CERRADO EN DESTINO';
      // Ya se marcó RECOLECTADO por este gestor y ahora el sistema dice otra cosa (EN_RECEPCION, EN_LOGISTICA,
      // NUEVO…): alguien más ya lo recibió o lo tiene. Ya no lo trae él → sale de su lista.
      else if (tn && String(r.Enviado) === 'SI' && tn.estatus !== 'RECOLECTADO' && tn.estatus !== 'UBICADO') cerrar = 'YA NO LO TRAE (' + tn.estatus + ')';
    } else if (String(r.Tipo) === 'PEDIDO' && Object.prototype.hasOwnProperty.call(estados, String(r.Codigo))) {
      fuente = estados[String(r.Codigo)] || 'NO EXISTE EN OPERACIONES';
      if (/ENTREGADO|CANCELADO|RETORNADO/i.test(fuente)) cerrar = 'CERRADO';
      else if (/^ENVIADO POR/i.test(fuente)) {
        // Ya salió con paquetería o en la ruta de un gestor: el que lo recolectó ya no lo trae.
        //  · cambió a "ENVIADO POR…" después de escanearlo, o
        //  · ya es suyo en Operaciones (lo ve en "Pedidos a domicilio"), o
        //  · lo escaneó otro día (ya lo dejó).
        // Si el mismo día lo escaneó ya asignado a otro, se queda (lo trae él: "Lo dejé en sucursal" o SOS).
        var antes = String(r.EstadoFuente || '').replace(/ · ALERTA$/, '');
        if (/^(ANOTADO|NO EXISTE|\[)/i.test(antes)) antes = '';   // eso no es un estatus de Operaciones
        var inf = _llevaInfo()[_tnClave(r.Codigo)] || {}, u = usuarios[String(r.NumeroGestor)];
        var mio = !!(inf.gestor && u && _esMiNombreOps(inf.gestor, u));
        if ((antes && !/^ENVIADO POR/i.test(antes)) || mio || _fechaTxt(r.FechaHora) < _hoyTxt()) cerrar = mio ? 'YA ESTÁ EN SUS PEDIDOS' : 'YA SALIÓ (' + fuente + ')';
      }
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

/* ---------- 2a. Datos de los pedidos que llevan (para "Entrega a domicilio" SOS) ----------
   Cliente, dirección, teléfono y a quién está asignado: de Operaciones; si aún no está capturado,
   de LOGISTICA BOTICAN 2026 o de Pedidos Logistica-Fadermex 2026. Queda en memoria 15 min. */
function _clavePed(v) { return String(v || '').trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase(); }
function _llevaInfo() { return (_hay('_cacheGrandeLeer') && _cacheGrandeLeer('llevaInfo')) || {}; }
function _robotLlevaInfo() {
  var codigos = {};
  _tabla(APPG.H.RECOLECCIONES).filas.forEach(function (r) { if (String(r.Tipo) === 'PEDIDO' && String(r.Estado) === 'EN RUTA') codigos[_tnClave(r.Codigo)] = String(r.Codigo); });
  var ks = Object.keys(codigos); if (!ks.length) return 0;
  var ops = {};
  try {
    var r = _ops('buscarPedidos', { ids: ks.map(function (k) { return codigos[k]; }) });
    if (r.ok) ops = r.pedidos || {};
  } catch (e) { }
  var bot = (_hay('_btDatos') ? (_btDatos() || {}).dirs : null) || {}, fad = (_hay('_cacheGrandeLeer') ? _cacheGrandeLeer('fadDirs') : null) || {};
  var out = {};
  ks.forEach(function (k) {
    var o = ops[_clavePed(codigos[k])];
    if (o) { out[k] = { fuente: 'OPS', area: String(o.area || ''), fila: o.fila, cliente: String(o.nombre || ''), direccion: String(o.direccion || ''), telefono: String(o.telefono || ''), gestor: /^no aplica$/i.test(String(o.gestor || '').trim()) ? '' : String(o.gestor || ''), abierto: !!o.abierto, estatus: String(o.estatus || '') }; return; }
    var b = bot[k] || fad[k];
    out[k] = b ? { fuente: bot[k] ? 'BOTICAN' : 'FADERMEX', cliente: b[0], direccion: b[1], telefono: '', gestor: '' } : { fuente: '' };
  });
  if (_hay('_cacheGrandeGuardar')) _cacheGrandeGuardar('llevaInfo', out, 900);
  return ks.length;
}
/** Antes de pasar una entrega SOS: la asigna a su nombre en Operaciones (Logística Interna + vehículo). */
function _sosPreparar(c, filaPorId, gestorPorId) {
  var u = _usuarioPorNumero(c.NumeroGestor) || {}, mio = _nombreEnOps(c.NumeroGestor), k = _norm(c.ID);
  if (gestorPorId[k] && _esMiNombreOps(gestorPorId[k], u)) return { ok: true, fila: filaPorId[k], gestor: String(gestorPorId[k]) };
  var b = _ops('buscarPedidos', { ids: [String(c.ID)] });
  if (!b.ok) return { ok: false, codigo: b.codigo || 'API-07', mensaje: /desconocida/i.test(String(b.mensaje)) ? 'OPERACIONES todavía no tiene la entrega SOS: pega su 04_Backend_App nuevo y haz su versión nueva.' : (b.mensaje || b.error), reintentar: true };
  var p = (b.pedidos || {})[_clavePed(c.ID)];
  if (!p) {
    var cache = CacheService.getScriptCache(), ck = 'sos_' + _clavePed(c.ID);
    if (!cache.get(ck)) { cache.put(ck, '1', 6 * 3600); _problema('SOS-02', String(c.Gestor), 'Captura ' + c.ID + ' en Operaciones: ' + c.Gestor + (/sucursal/i.test(String(c.Comentario)) ? ' lo dejó en sucursal' : ' lo entregó a domicilio (SOS)') + ' y todavía no existe. En cuanto lo captures, el robot lo pone a su nombre y lo marca entregado. Cliente: ' + (c.Cliente || '—') + ' · ' + (c.Direccion || '')); }
    return { esperar: true, mensaje: 'Esperando que capturen ' + c.ID + ' en Operaciones (entrega SOS)' };
  }
  var a = _ops('autoasignar', { fila: p.fila, id: p.id, gestor: mio, vehiculo: String(c.Vehiculo || ''), quien: String(c.Gestor), forzar: true });
  if (!a.ok) return { ok: false, codigo: a.error === 'LISTA' ? 'ROB-02' : a.error === 'CERRADO' ? 'SOS-03' : (a.codigo || 'API-07'), mensaje: a.mensaje || a.error, reintentar: a.error !== 'CERRADO' && a.error !== 'LISTA' };
  if (a.antes && !/^no aplica$/i.test(a.antes) && _claveNombre(a.antes) !== _claveNombre(mio)) _problema('SOS-01', String(c.Gestor), c.ID + ' estaba asignado a ' + a.antes + ' en Operaciones y lo entregó ' + c.Gestor + ' (SOS). Quedó a nombre de ' + c.Gestor + '.');
  return { ok: true, fila: p.fila, gestor: mio };
}

/* ---------- 2b. "Entrega sin asignar" que en realidad era un pedido suyo ----------
   Si el gestor usó "+ Registrar entrega" y escribió el número de un pedido o TAREA que está abierto
   en Operaciones A SU NOMBRE, se convierte solo en la entrega de ese pedido (con su foto, quién recibió,
   ubicación y hora real) y Operaciones queda marcado. La "sin asignar" queda ANULADA con la nota. */
function _robotLigarLibres(ruta) {
  if (!ruta || !ruta.length) return 0;
  var t = _tabla(APPG.H.CIERRES);
  var hace3 = Date.now() - 3 * 86400000;
  var libres = t.filas.filter(function (c) { return String(c.Tipo) === 'LIBRE' && String(c.Estado) === 'LOCAL' && _fechaMs(c.FechaHora) > hace3; });
  if (!libres.length) return 0;
  var abiertos = {};
  ruta.forEach(function (p) { abiertos[_tnClave(p.id)] = p; });
  var yaCerrados = {};
  t.filas.forEach(function (c) { if (String(c.Tipo) === 'PEDIDO' && ['ANULADO', 'CORREGIDO'].indexOf(String(c.Estado)) < 0) yaCerrados[_tnClave(c.ID)] = true; });
  var n = 0;
  libres.forEach(function (c) {
    var u = _usuarioPorNumero(c.NumeroGestor);
    if (!u) return;
    var txt = [c.ID, c.Comentario, c.Cliente, c.Direccion, c.Recibio].join(' ');
    var re = /(TAREA\s*#\s*\d+|NRREM-?\s?\d+|#\s?\d{4,6})/gi, m, p = null;
    while ((m = re.exec(txt)) && !p) {
      var k = _tnClave(m[1]), cand = abiertos[k];
      if (cand && !yaCerrados[k] && _esMiNombreOps(cand.gestor, u)) p = cand;
    }
    // Sin número: si la dirección que escribió se parece a la de UNO SOLO de sus pedidos abiertos, es ese.
    // Ej. "Unidad nacional condominio 25" ↔ "calle Unidad nacional, Condominio 25 casa 62…" (#16169).
    if (!p) {
      var mios = ruta.filter(function (x) { return _esMiNombreOps(x.gestor, u) && !yaCerrados[_tnClave(x.id)]; });
      var parecidos = mios.filter(function (x) { return _direccionParecida(c.Direccion || c.DondeEntrego, [x.direccion, x.nombre].join(' ')); });
      if (parecidos.length === 1) p = parecidos[0];
    }
    if (!p) return;
    var o = {};
    APPG.ENC.APP_Cierres.forEach(function (h) { o[h] = c[h]; });
    o.IdCierre = 'lig' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    o.FechaHora = _ahora(); o.Tipo = 'PEDIDO'; o.ID = String(p.id); o.Fila = Number(p.fila); o.Resultado = 'ENTREGADO';
    o.Estado = 'PENDIENTE'; o.Intentos = 0; o.UltimoError = ''; o.EnviadoEn = ''; o.DondeEntrego = ''; o.Monto = ''; o.Clase = '';
    o.Cliente = String(p.nombre || ''); o.Direccion = String(p.direccion || '');
    o.Comentario = 'Lo registró como entrega sin asignar (' + c.ID + ')' + (c.Comentario ? ' · ' + c.Comentario : '');
    o.Corregido = 'Ligado solo desde ' + c.IdCierre;
    _agregar(APPG.H.CIERRES, o);
    t.sh.getRange(c._fila, t.col('Estado')).setValue('ANULADO');
    t.sh.getRange(c._fila, t.col('Corregido')).setValue('Pasado solo al pedido ' + p.id + ' ' + _ahora('dd/MM HH:mm'));
    yaCerrados[_tnClave(p.id)] = true;
    _log('robot', 'LIGA_LIBRE', c.ID + ' → ' + p.id + ' · ' + c.Gestor);
    n++;
  });
  return n;
}

/* ---------- utilidades ---------- */
/** ¿La dirección que escribió el gestor (corta) está dentro de la del pedido? Al menos 2 palabras
 *  importantes (4+ letras o números) y 3 de cada 4 de las suyas aparecen en la del pedido. */
function _direccionParecida(corta, larga) {
  var vacias = { calle: 1, colonia: 1, entre: 1, cliente: 1, entrega: 1, entrego: 1, deje: 1, dejo: 1, casa: 1, numero: 1, sucursal: 1, para: 1, local: 1, depto: 1, departamento: 1, interior: 1, medicamento: 1, botican: 1, fadermex: 1 };
  var pal = function (t) { return _norm(t).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w && !vacias[w] && (w.length >= 4 || /^\d+$/.test(w)); }); };
  var a = pal(corta), b = pal(larga);
  if (a.length < 2) return false;
  var hay = a.filter(function (w) { return b.indexOf(w) >= 0; }).length;
  return hay >= 2 && hay / a.length >= 0.75;
}
/** "Jose Luis", "JoseLuis", "jose luis", 'Antonio "A"' → misma clave (sin espacios, acentos ni comillas). */
function _claveNombre(v) { return _norm(v).replace(/[^a-z0-9]/g, ''); }
/** Con qué nombres puede venir este gestor en la columna I de Operaciones (sin importar mayúsculas,
 *  acentos, espacios ni signos): su NombreEnOperaciones, ese mismo sin la letra entre comillas
 *  ('Antonio "A"' → antonio), su Usuario y su Nombre en la app. */
function _clavesOps(u) {
  var ops = String(u.NombreEnOperaciones || '');
  var ks = [_claveNombre(ops), _claveNombre(ops.replace(/["“”'][^"“”']*["“”']/g, '')), _claveNombre(u.Usuario), _claveNombre(u.Nombre)];
  return ks.filter(function (k, i) { return k && ks.indexOf(k) === i; });
}
function _esMiNombreOps(enOps, u) { return !!enOps && _clavesOps(u).indexOf(_claveNombre(enOps)) >= 0; }
/** El nombre tal como está HOY en la columna I de Operaciones, si es el de este gestor (aunque cambie un espacio). */
function _gestorParaOps(enOps, numero) {
  var mio = _nombreEnOps(numero), u = _usuarioPorNumero(numero);
  return u && _esMiNombreOps(enOps, u) ? String(enOps) : mio;
}
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
