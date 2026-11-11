/***********************************************************************
 * APP GESTORES 2 — 12_AVISOS.gs   (archivo NUEVO en la versión 0.5.0)
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * AVISOS de Logística a los gestores.
 *   · Los manda la administradora desde la app (Administración → Avisos)
 *     o escribiéndolos en la pestaña APP_Avisos.
 *   · Para: Todos · Gestoría · Facturación · o el usuario de una persona.
 *   · Importante = sale arriba en rojo, suena y pide "Enterado".
 *   · Hasta: fecha y hora en que deja de mostrarse (vacío = hasta que lo quites).
 * Pestaña APP_Avisos: Id · FechaHora · Texto · Para · Importante · Hasta · Activo · Autor · Leidos
 *   Leidos = "G-06 2026-11-11 09:02 | G-03 2026-11-11 09:10" (lo llena la app).
 ***********************************************************************/

function _avisoParaMi(a, u) {
  var para = _norm(a.Para || 'todos');
  if (!para || para === 'todos') return true;
  var perfil = _perfil(u);
  if (/gestor/.test(para)) return perfil.area === 'GESTORIA';
  if (/factur/.test(para)) return perfil.area === 'FACTURACION';
  return para === _norm(u.Usuario) || para === _norm(u.Numero) || _claveNombre(para) === _claveNombre(u.Nombre);
}
function _avisoVigente(a) {
  if (!_si(a.Activo === '' ? true : a.Activo) || !String(a.Texto || '').trim()) return false;
  var h = _fechaTxt(a.Hasta, 'yyyy-MM-dd HH:mm:ss');
  return !h || h > _ahora();
}
function _leidoPor(a, numero) {
  var m = new RegExp('(?:^|\\|)\\s*' + String(numero).replace(/[-]/g, '\\-') + '\\s+([0-9-]+ [0-9:]+)').exec(String(a.Leidos || ''));
  return m ? m[1] : '';
}

/** Para el inicio del celular: vigentes (sin leer primero) y los leídos de los últimos 7 días. */
function _avisosInicio(u) {
  var hace7 = _txtFecha(Date.now() - 7 * 86400000);
  var out = [];
  _tabla(APPG.H.AVISOS).filas.forEach(function (a) {
    if (!_avisoParaMi(a, u)) return;
    var vig = _avisoVigente(a), leido = _leidoPor(a, u.Numero), fecha = _fechaTxt(a.FechaHora, 'yyyy-MM-dd HH:mm:ss');
    if (!vig && !(leido && fecha >= hace7)) return;
    out.push({ id: String(a.Id || a._fila), texto: String(a.Texto), importante: _si(a.Importante), fecha: fecha.slice(0, 16), hasta: _fechaTxt(a.Hasta, 'yyyy-MM-dd HH:mm'),
               autor: String(a.Autor || 'Logística'), leido: leido, vigente: vig });
  });
  out.sort(function (x, y) { return (x.leido ? 1 : 0) - (y.leido ? 1 : 0) || (x.fecha < y.fecha ? 1 : -1); });
  return out.slice(0, 30);
}

function apiAvisoLeido(p) {
  var s = _exigirSesion(p.token), u = _buscarUsuario(s.Usuario);
  var t = _tabla(APPG.H.AVISOS);
  var a = t.filas.filter(function (x) { return String(x.Id || x._fila) === String(p.id); })[0];
  if (!a) return { ok: true };
  if (!_leidoPor(a, u.Numero)) {
    var prev = String(a.Leidos || '').trim();
    t.sh.getRange(a._fila, t.col('Leidos')).setValue((prev ? prev + ' | ' : '') + u.Numero + ' ' + _ahora('yyyy-MM-dd HH:mm'));
  }
  return { leido: true };
}

/* ---------- Administración ---------- */
function _admAvisos() {
  var us = _tabla(APPG.H.USUARIOS).filas.filter(function (u) { return _si(u.Activo) && !/^prueba/i.test(String(u.Usuario)); });
  var lista = _tabla(APPG.H.AVISOS).filas.filter(_avisoVigente).map(function (a) {
    var para = us.filter(function (u) { return _avisoParaMi(a, u); });
    var leen = para.filter(function (u) { return _leidoPor(a, u.Numero); });
    var faltan = para.filter(function (u) { return !_leidoPor(a, u.Numero); }).map(function (u) { return String(u.Nombre); });
    return { id: String(a.Id || a._fila), texto: String(a.Texto), para: String(a.Para || 'Todos'), importante: _si(a.Importante),
             fecha: _fechaTxt(a.FechaHora, 'yyyy-MM-dd HH:mm'), hasta: _fechaTxt(a.Hasta, 'yyyy-MM-dd HH:mm'), leidos: leen.length, total: para.length, faltan: faltan };
  }).reverse();
  return { avisos: lista, personas: us.map(function (u) { return { usuario: String(u.Usuario), nombre: String(u.Nombre) }; }) };
}
function _admAvisoNuevo(p, yo) {
  var texto = String(p.texto || '').trim();
  if (!texto) throw _falla('CAP-01', 'Escribe el aviso.');
  var id = 'AV' + _ahora('yyMMddHHmm') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
  _agregar(APPG.H.AVISOS, { Id: id, FechaHora: _ahora(), Texto: texto.slice(0, 500), Para: String(p.para || 'Todos'), Importante: !!p.importante,
                            Hasta: String(p.hasta || ''), Activo: true, Autor: yo.Nombre, Leidos: '' });
  _log(yo.Nombre, 'AVISO', id + ' · ' + (p.para || 'Todos') + ' · ' + texto.slice(0, 80));
  return { mensaje: 'Aviso enviado. Les llega en menos de 1 minuto con la app abierta.', id: id };
}
function _admAvisoQuitar(p, yo) {
  var t = _tabla(APPG.H.AVISOS);
  var a = t.filas.filter(function (x) { return String(x.Id || x._fila) === String(p.id); })[0];
  if (!a) throw _falla('APP-01', 'No encontré ese aviso.');
  t.sh.getRange(a._fila, t.col('Activo')).setValue(false);
  _log(yo.Nombre, 'AVISO_QUITA', String(p.id));
  return { mensaje: 'Aviso quitado.' };
}
