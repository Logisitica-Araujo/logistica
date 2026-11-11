/***********************************************************************
 * APP GESTORES 2 — 11_PENDIENTES.gs   (archivo NUEVO en la versión 0.5.0)
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * "Pendientes por recoger": una sola lista para todos (Gestoría y Facturación), por lugar:
 *   · Pedidos BOTICAN listos      → LOGISTICA BOTICAN 2026 / Envios (10_BOTICAN.gs)
 *   · Pedidos FADERMEX listos     → Operaciones, ESTATUS "PENDIENTE PARA RECOLECTAR"
 *   · Traspasos por recoger       → Sistema de Traspasos, Estatus NUEVO o EN_LOGISTICA
 * Lo que alguien ya recolectó (ya lo lleva) NO sale.
 *
 * "Lo recojo yo" = APARTAR: los demás lo ven "Va Fulano · desde 10:40". NO registra la
 * recolección: eso solo pasa al escanear la etiqueta. Un apartado se libera solo a las
 * APARTADO_HORAS (APP_Config, 2 por defecto), o al soltarlo.
 * Pestaña APP_Apartados: Codigo · Tipo · NumeroGestor · Gestor · Desde · Hasta · Estado · Cerrado · CerradoPor
 *   Estado: ACTIVO · SOLTADO · RECOGIDO (lo escaneó él) · TOMADO (lo escaneó otro)
 ***********************************************************************/

/* ---------- datos de Operaciones (el robot los deja en memoria cada minuto) ---------- */
function _robotPendFad() {
  var r = _ops('porRecolectar', {});
  if (!r.ok) {
    if (/desconocida/i.test(String(r.mensaje))) return 'OPERACIONES sin porRecolectar (pega el 04_Backend_App nuevo)';
    throw _falla(r.codigo || 'API-07', r.mensaje || r.error);
  }
  CacheService.getScriptCache().put('pendFad', JSON.stringify(r.pedidos.slice(0, 200)), 600);
  return r.pedidos.length;
}
function _pendFad() {
  var c = CacheService.getScriptCache().get('pendFad');
  if (c) { try { return JSON.parse(c); } catch (e) { } }
  try { _robotPendFad(); var d = CacheService.getScriptCache().get('pendFad'); return d ? JSON.parse(d) : []; } catch (e) { return []; }
}

/* ---------- apartados ---------- */
function _horasApartado() { var h = Number(_config().APARTADO_HORAS); return h > 0 ? h : 2; }
function _txtFecha(ms) { return Utilities.formatDate(new Date(ms), APPG.ZONA, 'yyyy-MM-dd HH:mm:ss'); }

/** { CLAVE: fila } de los apartados vigentes (ACTIVO y sin vencer). */
function _apartadosVigentes(t) {
  t = t || _tabla(APPG.H.APARTADOS);
  var ahora = _ahora(), out = {};
  t.filas.forEach(function (a) {
    if (String(a.Estado) === 'ACTIVO' && _fechaTxt(a.Hasta, 'yyyy-MM-dd HH:mm:ss') > ahora) out[_tnClave(a.Codigo)] = a;
  });
  return out;
}

function apiApartar(p) {
  var s = _exigirSesion(p.token), u = _buscarUsuario(s.Usuario);
  var t = _tabla(APPG.H.APARTADOS), vig = _apartadosVigentes(t);
  var rec = _recolectadosAbiertos();
  var hasta = _txtFecha(Date.now() + _horasApartado() * 3600000);
  var res = (p.codigos || []).slice(0, 30).map(function (x) {
    var codigo = String(x.codigo || '').trim(), k = _tnClave(codigo);
    if (!k) return { codigo: codigo, ok: false, mensaje: 'Código vacío.' };
    if (rec[k]) return { codigo: codigo, ok: false, mensaje: codigo + ' ya lo lleva ' + rec[k].Gestor + '.' };
    var a = vig[k];
    if (a && String(a.NumeroGestor) !== String(u.Numero)) return { codigo: codigo, ok: false, mensaje: codigo + ' ya lo apartó ' + a.Gestor + '.' };
    if (a) { t.sh.getRange(a._fila, t.col('Hasta')).setValue(hasta); return { codigo: codigo, ok: true, hasta: hasta }; }
    _agregar(APPG.H.APARTADOS, { Codigo: codigo, Tipo: String(x.tipo || ''), NumeroGestor: u.Numero, Gestor: u.Nombre, Desde: _ahora(), Hasta: hasta, Estado: 'ACTIVO' });
    return { codigo: codigo, ok: true, hasta: hasta };
  });
  _log(u.Nombre, 'APARTA', res.filter(function (r) { return r.ok; }).map(function (r) { return r.codigo; }).join(', '));
  return { resultados: res };
}

function apiSoltar(p) {
  var s = _exigirSesion(p.token), u = _buscarUsuario(s.Usuario);
  var t = _tabla(APPG.H.APARTADOS), k = _tnClave(p.codigo), n = 0;
  t.filas.forEach(function (a) {
    if (_tnClave(a.Codigo) === k && String(a.Estado) === 'ACTIVO' && String(a.NumeroGestor) === String(u.Numero)) {
      t.sh.getRange(a._fila, t.col('Estado')).setValue('SOLTADO'); t.sh.getRange(a._fila, t.col('Cerrado')).setValue(_ahora()); n++;
    }
  });
  _log(u.Nombre, 'SUELTA', p.codigo);
  return { soltados: n };
}

/** Al escanear: cierra el apartado (RECOGIDO si era suyo, TOMADO si era de otro). */
function _cerrarApartado(codigo, u) {
  var t = _tabla(APPG.H.APARTADOS), k = _tnClave(codigo), otro = '';
  t.filas.forEach(function (a) {
    if (_tnClave(a.Codigo) !== k || String(a.Estado) !== 'ACTIVO') return;
    var mio = String(a.NumeroGestor) === String(u.Numero);
    if (!mio) otro = String(a.Gestor);
    t.sh.getRange(a._fila, t.col('Estado')).setValue(mio ? 'RECOGIDO' : 'TOMADO');
    t.sh.getRange(a._fila, t.col('Cerrado')).setValue(_ahora());
    t.sh.getRange(a._fila, t.col('CerradoPor')).setValue(u.Nombre);
  });
  return otro;
}

/** Lo que ya lleva alguien (APP_Recolecciones en ruta): { CLAVE: fila }. */
function _recolectadosAbiertos() {
  var out = {}, hace = Date.now() - 30 * 86400000;
  _tabla(APPG.H.RECOLECCIONES).filas.forEach(function (r) {
    if (_fechaMs(r.FechaHora) > hace && !/ANULAD/.test(String(r.Estado))) out[_tnClave(r.Codigo)] = r;
  });
  return out;
}

/* ---------- la lista para el celular ---------- */
function _pendientesInicio(u, botican) {
  var rec = _recolectadosAbiertos(), vig = _apartadosVigentes();
  var sucs = {}; _tabla(APPG.H.SUCURSALES).filas.forEach(function (x) { sucs[String(x.ID).toUpperCase()] = String(x.Sucursal); });
  var items = [];
  function ap(codigo) {
    var a = vig[_tnClave(codigo)];
    return a ? { numero: String(a.NumeroGestor), nombre: String(a.Gestor), desde: _fechaTxt(a.Desde, 'yyyy-MM-dd HH:mm').slice(11), hasta: _fechaTxt(a.Hasta, 'yyyy-MM-dd HH:mm').slice(11) } : null;
  }
  // BOTICAN (ya viene sin lo recolectado)
  ((botican && botican.porRecolectar) || []).forEach(function (p) {
    items.push({ codigo: p.id, tipo: 'BOTICAN', lugar: p.suc === 'COAPA' ? 'Coapa' : p.suc === 'ECATEPEC' ? 'Ecatepec' : 'Vértiz · Producción BOTICAN',
      texto: (p.semaforo === 'rojo' ? 'Venció: ' : 'Vence: ') + p.vence + (p.area ? ' · ' + p.area : ''), semaforo: p.semaforo, hoy: p.enRuta, apartado: ap(p.id) });
  });
  // FADERMEX: Operaciones "PENDIENTE PARA RECOLECTAR"
  _pendFad().forEach(function (p) {
    if (rec[_tnClave(p.id)]) return;
    var g = String(p.gestor || '').trim(), asignado = g && !/^no aplica$/i.test(g) ? g : '';
    var mioOps = asignado && _claveNombre(asignado) === _claveNombre(u.NombreEnOperaciones);
    items.push({ codigo: String(p.id), tipo: 'FADERMEX', lugar: 'Recolecciones FADERMEX', texto: [p.nombre, p.direccion].filter(String).join(' · ').slice(0, 140),
      hoy: true, apartado: ap(p.id), asignadoOps: asignado && !mioOps ? asignado : '', asignadoAMi: !!mioOps });
  });
  // Traspasos: Sistema de Traspasos NUEVO / EN_LOGISTICA
  _porRecoger().forEach(function (r) {
    if (rec[_tnClave(r.folio)]) return;
    items.push({ codigo: r.folio, tipo: 'TRASPASO', lugar: sucs[r.sucursalId] || r.origen || r.sucursalId, texto: 'Va a ' + r.destino + (r.contenido ? ' · ' + r.contenido : ''), hoy: true, apartado: ap(r.folio) });
  });
  items.forEach(function (i) { i.mio = !!(i.apartado && i.apartado.numero === String(u.Numero)); });

  // Grupos por lugar: primero los de la ruta del momento.
  var ruta = _norm(botican && botican.ruta ? botican.ruta.sucursales + ' ' + botican.ruta.extra : '');
  var grupos = {}, orden = [];
  items.forEach(function (i) { if (!grupos[i.lugar]) { grupos[i.lugar] = []; orden.push(i.lugar); } grupos[i.lugar].push(i); });
  var peso = function (l) { var n = _norm(l).split(/[\s·]+/)[0]; return ruta && n && ruta.indexOf(n) >= 0 ? 0 : /fadermex/i.test(l) ? 2 : 1; };
  orden.sort(function (a, b) { return peso(a) - peso(b); });

  // Lo mío: apartados vigentes + lo que recogí (o me tomaron) en las últimas 3 horas.
  var mios = items.filter(function (i) { return i.mio; });
  var hace3 = _txtFecha(Date.now() - 3 * 3600000);
  _tabla(APPG.H.APARTADOS).filas.forEach(function (a) {
    if (String(a.NumeroGestor) !== String(u.Numero) || !/RECOGIDO|TOMADO/.test(String(a.Estado)) || _fechaTxt(a.Cerrado, 'yyyy-MM-dd HH:mm:ss') < hace3) return;
    mios.push({ codigo: String(a.Codigo), tipo: String(a.Tipo), cerrado: String(a.Estado), por: String(a.CerradoPor), hora: _fechaTxt(a.Cerrado, 'yyyy-MM-dd HH:mm').slice(11) });
  });
  return { grupos: orden.map(function (l) { return { lugar: l, items: grupos[l] }; }), total: items.length, mios: mios, horas: _horasApartado() };
}
