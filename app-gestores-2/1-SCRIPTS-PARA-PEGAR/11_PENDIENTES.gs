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

/* ---------- FADERMEX listos para recolectar ----------
   Fuente principal: "Pedidos Logistica-Fadermex 2026" / Envios (APP_Config → ID_FADERMEX):
     A Identificador · C Estatus · D Contacto · E Dirección · F Sucursal · G Día estimado de recolección ·
     H Pedido listo para recolección · J Ingreso a logística · L Fecha salida
   Sale si H tiene fecha y J y L están vacías (y el estatus no dice entregado / en ruta / cancelado).
   También los de Operaciones con ESTATUS "PENDIENTE PARA RECOLECTAR" (si OPERACIONES contesta). */
var APPG_FAD = { FILA: 3, ULTIMAS: 400 };
function _robotPendFad() {
  var lista = [], vistos = {}, err = '';
  var id = String(_config().ID_FADERMEX || '').trim();
  if (id) {
    var sh = SpreadsheetApp.openById(_idDrive(id)).getSheetByName('Envios');
    var ult = sh.getLastRow();
    if (ult >= APPG_FAD.FILA) {   // hay cientos de renglones vacíos con casillas FALSE: se busca el último con Identificador
      var colA = sh.getRange(APPG_FAD.FILA, 1, ult - APPG_FAD.FILA + 1, 1).getValues(), k = colA.length - 1;
      while (k >= 0 && !String(colA[k][0]).trim()) k--;
      ult = APPG_FAD.FILA + k;
    }
    var desde = Math.max(APPG_FAD.FILA, ult - APPG_FAD.ULTIMAS + 1), n = ult - desde + 1;
    var txt = function (v) { return Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, APPG.ZONA, 'EEE d MMM, HH:mm') : String(v || '').trim(); };
    (n > 0 ? sh.getRange(desde, 1, n, 12).getValues() : []).forEach(function (r) {
      var codigo = String(r[0] || '').trim(), listo = txt(r[7]);
      if (!codigo || !listo || txt(r[9]) || txt(r[11])) return;
      if (/entregad|en ruta|cancel|retorn|devuel/i.test(_norm(r[2]))) return;
      vistos[_tnClave(codigo)] = true;
      lista.push({ id: codigo, nombre: String(r[3] || ''), direccion: String(r[4] || ''), sucursal: String(r[5] || ''), listo: listo, estimado: txt(r[6]), estatus: String(r[2] || '') });
    });
  }
  try {
    var r = _ops('porRecolectar', {});
    if (r.ok) r.pedidos.forEach(function (p) { if (!vistos[_tnClave(p.id)]) lista.push(p); });
  } catch (e) { err = e.message; }
  CacheService.getScriptCache().put('pendFad', JSON.stringify(lista.slice(0, 200)), 600);
  return lista.length + (err ? ' (Operaciones no contestó)' : '');
}
function _pendFad() {
  var c = CacheService.getScriptCache().get('pendFad');
  if (c) { try { return JSON.parse(c); } catch (e) { } }
  try { _robotPendFad(); var d = CacheService.getScriptCache().get('pendFad'); return d ? JSON.parse(d) : []; } catch (e) { return []; }
}
/** 'NUEVA ROMA PV' → 'Nueva Roma' (para agrupar con los traspasos de la misma sucursal). */
function _lugarSucursal(v) {
  var t = String(v || '').replace(/\b(PV|SUCURSAL)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return t.replace(/(^|\s)\S/g, function (x) { return x.toUpperCase(); });
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

/* ---------- la lista para el celular (solo para VER: desde 0.5.2 ya no se aparta) ---------- */
function _pendientesInicio(u, botican) {
  var rec = _recolectadosAbiertos();
  var sucs = {}; _tabla(APPG.H.SUCURSALES).filas.forEach(function (x) { sucs[String(x.ID).toUpperCase()] = String(x.Sucursal); });
  var items = [];
  // BOTICAN (ya viene sin lo recolectado)
  ((botican && botican.porRecolectar) || []).forEach(function (p) {
    items.push({ codigo: p.id, tipo: 'BOTICAN', lugar: p.suc === 'COAPA' ? 'Coapa' : p.suc === 'ECATEPEC' ? 'Ecatepec' : 'Vértiz · Producción BOTICAN',
      texto: (p.semaforo === 'rojo' ? 'Venció: ' : 'Vence: ') + p.vence + (p.area ? ' · ' + p.area : ''), semaforo: p.semaforo, hoy: p.enRuta });
  });
  // FADERMEX listos para recolectar
  _pendFad().forEach(function (p) {
    if (rec[_tnClave(p.id)]) return;
    var g = String(p.gestor || '').trim(), asignado = g && !/^no aplica$/i.test(g) ? g : '';
    var mioOps = _esMiNombreOps(asignado, u);
    items.push({ codigo: String(p.id), tipo: 'FADERMEX', lugar: p.sucursal ? _lugarSucursal(p.sucursal) : 'Recolecciones FADERMEX',
      origen: p.sucursal ? _lugarSucursal(p.sucursal) : '', destino: 'domicilio', cliente: String(p.nombre || ''), direccion: String(p.direccion || '').slice(0, 140),
      listo: String(p.listo || ''), estimado: String(p.estimado || ''), texto: [p.nombre, p.direccion].filter(String).join(' · ').slice(0, 140),
      hoy: true, asignadoOps: asignado && !mioOps ? asignado : '', asignadoAMi: !!mioOps });
  });
  // Traspasos: Sistema de Traspasos NUEVO / EN_LOGISTICA (al escanearlo o cambiar de estatus, desaparece)
  _porRecoger().forEach(function (r) {
    if (rec[_tnClave(r.folio)]) return;
    var lugar = sucs[r.sucursalId] || r.origen || r.sucursalId;
    items.push({ codigo: r.folio, tipo: 'TRASPASO', lugar: lugar, origen: r.origen || lugar, destino: r.destino, contenido: r.contenido || '',
      creado: r.creado || '', bultos: r.bultos || '', texto: 'Va a ' + r.destino + (r.contenido ? ' · ' + r.contenido : ''), hoy: true });
  });

  // Grupos por lugar: primero los de la ruta del momento.
  var ruta = _norm(botican && botican.ruta ? botican.ruta.sucursales + ' ' + botican.ruta.extra : '');
  var grupos = {}, orden = [];
  items.forEach(function (i) { if (!grupos[i.lugar]) { grupos[i.lugar] = []; orden.push(i.lugar); } grupos[i.lugar].push(i); });
  var peso = function (l) { var n = _norm(l).split(/[\s·]+/)[0]; return ruta && n && ruta.indexOf(n) >= 0 ? 0 : /fadermex/i.test(l) ? 2 : 1; };
  orden.sort(function (a, b) { return peso(a) - peso(b); });
  // Dentro de cada lugar: lo más viejo arriba.
  orden.forEach(function (l) { grupos[l].sort(function (a, b) { return String(a.creado || '9') < String(b.creado || '9') ? -1 : 1; }); });
  return { grupos: orden.map(function (l) { return { lugar: l, items: grupos[l] }; }), total: items.length, mios: [], soloVer: true };
}
