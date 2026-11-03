/***********************************************************************
 * APP GESTORES 2 — 08_ADMIN.gs   (archivo NUEVO en la versión 0.4.0)
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * Perfil ADMINISTRADOR de la app (pantallas A1–A9).
 * Solo lo ve quien tenga Rol = Administrador en APP_Usuarios.
 *
 *   { accion: 'admin', que: '...', ...datos }
 *     hoy · gestor · buscar · corregir · reasignar · problemas · resolver
 *     equipo · equipoCambiar · alta · vehiculos · vehiculoCambiar · liberar
 *     ajustes · ajuste · motivo · sucursal
 *
 * Todo queda en APP_Log con el nombre de quien lo hizo.
 * Lo único que toca OPERACIONES (y por eso necesita su 04_Backend_App al día):
 *   reasignar (columna I) y corregir un cierre que ya se pasó (casillas S/U/W).
 ***********************************************************************/

var APPG_AJUSTES = ['EXIGIR_FOTO_ENTREGA', 'EXIGIR_FIRMA_ENTREGA', 'EXIGIR_QUIEN_RECIBIO', 'EXIGIR_FOTO_NOENTREGA', 'EXIGIR_ACUSE_IMSS',
  'APP_BLOQUEADA', 'MENSAJE_BLOQUEO', 'WA_MSG_ENTREGADO', 'CHECK_MOTO', 'CHECK_AUTO', 'AREAS_IMSS', 'MOTIVOS_CAMBIO_VEHICULO',
  'PALABRAS_EFECTIVO', 'PALABRAS_DOCUMENTOS', 'PALABRAS_IMSS', 'DIAS_PARA_ALERTA'];

function apiAdmin(p) {
  var s = _exigirSesion(p.token);
  var yo = _buscarUsuario(s.Usuario);
  if (!_esAdmin(yo)) throw _falla('APP-02', 'Esta sección es solo para administradores.');
  var f = {
    hoy: _admHoy, gestor: _admGestor, buscar: _admBuscar, corregir: _admCorregir, reasignar: _admReasignar,
    problemas: _admProblemas, resolver: _admResolver, equipo: _admEquipo, equipoCambiar: _admEquipoCambiar, alta: _admAlta,
    vehiculos: _admVehiculos, vehiculoCambiar: _admVehiculoCambiar, liberar: _admLiberar,
    ajustes: _admAjustes, ajuste: _admAjuste, motivo: _admMotivo, sucursal: _admSucursal
  }[String(p.que || '')];
  if (!f) throw _falla('APP-01', 'Acción de administración desconocida: ' + p.que);
  return f(p, yo);
}

/* ==================== Lectura común ==================== */

function _admDatos() {
  var hoy = _hoyTxt();
  var usuarios = _tabla(APPG.H.USUARIOS);
  var cierres = _tabla(APPG.H.CIERRES).filas;
  var pedidos = _tabla(APPG.H.PEDIDOS).filas;
  var recs = _tabla(APPG.H.RECOLECCIONES).filas;
  return { hoy: hoy, usuarios: usuarios, cierres: cierres, pedidos: pedidos, recs: recs,
           cierresHoy: cierres.filter(function (c) { return _fechaTxt(c.FechaHora) === hoy; }) };
}

/** Lo que el gestor ya cerró y aún no se refleja en APP_Pedidos (para no contarlo como pendiente). */
function _admOcultos(cierres) {
  var o = {}, hace15 = Date.now() - 15 * 60000;
  cierres.forEach(function (c) {
    var e = String(c.Estado);
    if (e === 'PENDIENTE' || e === 'LOCAL' || (e === 'ENVIADO' && _fechaMs(c.EnviadoEn || c.FechaHora) > hace15)) o[_norm(c.ID)] = true;
  });
  return o;
}

function _admResumen(u, d, ocultos) {
  var num = String(u.Numero);
  var cs = d.cierresHoy.filter(function (c) { return String(c.NumeroGestor) === num && ['ANULADO', 'CORREGIDO'].indexOf(String(c.Estado)) < 0; });
  var ent = cs.filter(function (c) { return c.Resultado === 'ENTREGADO'; }).length;
  var pend = d.pedidos.filter(function (x) { return String(x.NumeroGestor) === num && !ocultos[_norm(x.ID)]; }).length;
  var lleva = d.recs.filter(function (r) { return String(r.NumeroGestor) === num && String(r.Estado) === 'EN RUTA'; }).length;
  var ult = '';
  cs.concat(d.recs.filter(function (r) { return String(r.NumeroGestor) === num && _fechaTxt(r.FechaHora) === d.hoy; }))
    .forEach(function (x) { var t = _fechaTxt(x.FechaHora, 'yyyy-MM-dd HH:mm:ss'); if (t > ult) ult = t; });
  var acceso = _fechaTxt(u.UltimoAcceso, 'yyyy-MM-dd HH:mm:ss');
  var vehHoy = _fechaTxt(u.FechaVehiculo) === d.hoy ? String(u.VehiculoHoy || '') : '';
  var activoHoy = !!vehHoy || _fechaTxt(u.UltimoAcceso) === d.hoy || !!ult;
  var perfil = _perfil(u);
  return {
    numero: num, nombre: String(u.Nombre), usuario: String(u.Usuario), area: perfil.area, admin: perfil.admin,
    activo: _si(u.Activo), vehiculo: vehHoy, desde: vehHoy ? _fechaTxt(u.FechaVehiculo, 'yyyy-MM-dd HH:mm').slice(11) : '',
    entregados: ent, noEntregados: cs.length - ent, pendientes: pend, lleva: lleva,
    ultimo: ult ? ult.slice(11, 16) : '', minutos: ult ? Math.round((Date.now() - _fechaMs(ult)) / 60000) : null,
    ultimoAcceso: acceso, nuncaEntro: !acceso, entroHoy: activoHoy, vehiculoNota: String(u.VehiculoNota || '')
  };
}

/* ==================== A1 · Hoy ==================== */

function _admHoy(p, yo) {
  var d = _admDatos(), cfg = _config(), ocultos = _admOcultos(d.cierres);
  var equipo = d.usuarios.filas.filter(function (u) { return _si(u.Activo); }).map(function (u) { return _admResumen(u, d, ocultos); });
  var problemas = _tabla(APPG.H.PROBLEMAS).filas.filter(function (x) { return !_si(x.Resuelto); });
  var errores = d.cierres.filter(function (c) { return String(c.Estado) === 'ERROR'; });
  var atender = [];
  errores.slice(-3).forEach(function (c) { atender.push({ tipo: 'cierre', texto: c.ID + ' (' + c.Resultado + ') no llegó a su sistema: ' + String(c.UltimoError || '').slice(0, 90), id: String(c.ID) }); });
  problemas.slice(-4).reverse().forEach(function (x) { atender.push({ tipo: 'problema', texto: x.Numero + ' · ' + String(x.Detalle).slice(0, 100), numero: String(x.Numero) }); });
  equipo.filter(function (g) { return !g.entroHoy && !g.admin; }).forEach(function (g) { atender.push({ tipo: 'gestor', texto: g.nombre + (g.nuncaEntro ? ' nunca ha entrado a la app' : ' no ha entrado a la app hoy'), numero: g.numero }); });
  if (cfg.ULTIMO_ERROR_ROBOT) atender.unshift({ tipo: 'robot', texto: 'Robot: ' + String(cfg.ULTIMO_ERROR_ROBOT).slice(0, 140) });
  var tot = { entregados: 0, pendientes: 0, noEntregados: 0, lleva: 0 };
  equipo.forEach(function (g) { tot.entregados += g.entregados; tot.pendientes += g.pendientes; tot.noEntregados += g.noEntregados; tot.lleva += g.lleva; });
  tot.porRevisar = problemas.length + errores.length;
  var vuelta = String(cfg.ULTIMA_VUELTA_ROBOT || '');
  return { totales: tot, equipo: equipo, atender: atender.slice(0, 8), robot: vuelta,
           robotSeg: vuelta ? Math.round((Date.now() - _fechaMs(vuelta)) / 1000) : null, bloqueada: _si(cfg.APP_BLOQUEADA) };
}

/* ==================== A2 · Un gestor ==================== */

function _admGestor(p) {
  var d = _admDatos(), ocultos = _admOcultos(d.cierres);
  var u = d.usuarios.filas.filter(function (x) { return String(x.Numero) === String(p.numero); })[0];
  if (!u) throw _falla('APP-01', 'No existe ' + p.numero + '.');
  var num = String(u.Numero);
  return {
    gestor: _admResumen(u, d, ocultos),
    pedidos: d.pedidos.filter(function (x) { return String(x.NumeroGestor) === num && !ocultos[_norm(x.ID)]; }).map(function (x) {
      return { id: String(x.ID), fila: Number(x.Fila), cliente: String(x.Cliente), direccion: String(x.Direccion), area: String(x.Area), notas: String(x.Notas || '') };
    }),
    lleva: d.recs.filter(function (r) { return String(r.NumeroGestor) === num && String(r.Estado) === 'EN RUTA'; }).map(function (r) {
      return { codigo: String(r.Codigo), tipo: String(r.Tipo), destino: String(r.Destino), contenido: String(r.Contenido), desde: _fechaTxt(r.FechaHora, 'yyyy-MM-dd HH:mm') };
    }),
    hizo: d.cierresHoy.filter(function (c) { return String(c.NumeroGestor) === num; }).map(_admCierreCorto)
      .concat(d.recs.filter(function (r) { return String(r.NumeroGestor) === num && _fechaTxt(r.FechaHora) === d.hoy; }).map(function (r) {
        return { id: String(r.Codigo), resultado: 'RECOLECTADO', hora: _fechaTxt(r.FechaHora, 'yyyy-MM-dd HH:mm').slice(11), detalle: [r.Origen, r.Destino].filter(String).join(' → '), estado: String(r.Estado) };
      })).sort(function (a, b) { return a.hora < b.hora ? 1 : -1; })
  };
}

function _admCierreCorto(c) {
  return { idCierre: String(c.IdCierre), id: String(c.ID), tipo: String(c.Tipo), resultado: String(c.Resultado), estado: String(c.Estado),
           hora: _fechaTxt(c.FechaHora, 'yyyy-MM-dd HH:mm').slice(11), fecha: _fechaTxt(c.FechaHora, 'yyyy-MM-dd HH:mm'),
           gestor: String(c.Gestor), numero: String(c.NumeroGestor), motivo: String(c.Motivo || ''), recibio: String(c.Recibio || ''),
           comentario: String(c.Comentario || ''), donde: String(c.DondeEntrego || ''), monto: c.Monto === '' ? '' : String(c.Monto),
           foto: String(c.URLFoto || ''), firma: String(c.URLFirma || ''), gps: c.Lat && c.Lng ? c.Lat + ',' + c.Lng : '',
           error: String(c.UltimoError || ''), corregido: String(c.Corregido || ''), cliente: String(c.Cliente || ''),
           detalle: [c.Motivo, c.Recibio ? 'Recibió: ' + c.Recibio : '', c.DondeEntrego].filter(String).join(' · ') };
}

/* ==================== A3 · Buscar ==================== */

function _admBuscar(p) {
  var q = String(p.q || '').trim();
  if (q.length < 2) throw _falla('CAP-01', 'Escribe al menos 2 letras o números.');
  var k = _tnClave(q), n = _norm(q);
  var d = _admDatos();
  var porId = {};
  function caja(id) { var c = _tnClave(id); return porId[c] = porId[c] || { id: String(id), historial: [], cierres: [], pedido: null }; }
  var coincide = function (id, otros) { return (k.length >= 2 && _tnClave(id).indexOf(k) >= 0) || (n.length >= 3 && _norm(otros).indexOf(n) >= 0); };
  d.pedidos.forEach(function (x) {
    if (!coincide(x.ID, [x.Cliente, x.Direccion, x.Gestor].join(' '))) return;
    var b = caja(x.ID);
    b.pedido = { id: String(x.ID), fila: Number(x.Fila), cliente: String(x.Cliente), direccion: String(x.Direccion), gestor: String(x.Gestor), numero: String(x.NumeroGestor), estatus: String(x.Estatus || '') };
    b.historial.push({ hora: '', texto: 'Abierto en Operaciones · lo lleva ' + x.Gestor + (x.Estatus ? ' · ' + x.Estatus : '') });
  });
  d.recs.forEach(function (r) {
    if (!coincide(r.Codigo, [r.Destino, r.Origen, r.Gestor].join(' '))) return;
    caja(r.Codigo).historial.push({ hora: _fechaTxt(r.FechaHora, 'yyyy-MM-dd HH:mm'), texto: r.Gestor + ' lo recolectó' + (r.Destino ? ' · va a ' + r.Destino : '') + ' · ' + r.Estado });
  });
  d.cierres.forEach(function (c) {
    if (!coincide(c.ID, [c.Cliente, c.Gestor, c.Recibio].join(' '))) return;
    var b = caja(c.ID), x = _admCierreCorto(c);
    b.cierres.push(x);
    b.historial.push({ hora: x.fecha, texto: c.Gestor + ': ' + String(c.Resultado).toLowerCase() + (x.detalle ? ' · ' + x.detalle : '') +
      ' · ' + ({ PENDIENTE: 'por pasar a su sistema', ENVIADO: 'ya en su sistema', ERROR: 'NO llegó: ' + x.error, LOCAL: 'solo en la app', ANULADO: 'anulado', CORREGIDO: 'corregido: ' + x.corregido })[x.estado] });
  });
  var lista = Object.keys(porId).map(function (c) { var b = porId[c]; b.historial.sort(function (a, z) { return a.hora < z.hora ? -1 : 1; }); return b; });
  lista.sort(function (a, b) { return (b.cierres.length ? b.cierres[b.cierres.length - 1].fecha : '') > (a.cierres.length ? a.cierres[a.cierres.length - 1].fecha : '') ? 1 : -1; });
  return { resultados: lista.slice(0, 15), total: lista.length };
}

/* ==================== A4 · Corregir un cierre ==================== */
/* p = { idCierre, modo: 'datos'|'resultado'|'reabrir', resultado, motivo, recibio, comentario, porque } */
function _admCorregir(p, yo) {
  var porque = String(p.porque || '').trim();
  if (!porque) throw _falla('CAP-01', 'Escribe por qué lo corriges.');
  var t = _tabla(APPG.H.CIERRES);
  var c = t.filas.filter(function (x) { return String(x.IdCierre) === String(p.idCierre); })[0];
  if (!c) throw _falla('APP-01', 'No encontré ese cierre.');
  var est = String(c.Estado), tipo = String(c.Tipo), modo = String(p.modo || '');
  if (est === 'ANULADO' || est === 'CORREGIDO') throw _falla('APP-01', 'Ese cierre ya se había corregido. Busca el más nuevo.');
  var marca = yo.Nombre + ' ' + _ahora('dd/MM HH:mm') + ': ' + porque;
  var set = function (h, v) { t.sh.getRange(c._fila, t.col(h)).setValue(v); };

  if (modo === 'datos') {
    if (p.recibio != null) set('Recibio', String(p.recibio).slice(0, 120));
    if (p.motivo != null) set('Motivo', String(p.motivo));
    if (p.comentario != null) set('Comentario', String(p.comentario).slice(0, 1000));
    set('Corregido', 'Datos · ' + marca);
    _log(yo.Nombre, 'ADMIN_CORRIGE_DATOS', c.ID + ' · ' + porque);
    return { mensaje: 'Datos corregidos en la app.' + (est === 'ENVIADO' ? ' En Operaciones quedan los anteriores; si hace falta, corrígelos ahí (AC motivo, AD nota, AI recibió).' : '') };
  }
  var nuevo = modo === 'reabrir' ? '' : String(p.resultado || '').toUpperCase();
  if (modo === 'resultado' && ['ENTREGADO', 'RETORNO', 'CANCELADO', 'NO_ENTREGADO'].indexOf(nuevo) < 0) throw _falla('APP-01', 'Elige el resultado nuevo.');
  if (modo === 'resultado' && tipo === 'PEDIDO' && (nuevo === 'RETORNO' || nuevo === 'CANCELADO') && !String(p.motivo || '').trim()) throw _falla('CAP-05', 'Elige el motivo.');
  if (nuevo && nuevo === String(c.Resultado)) throw _falla('APP-01', 'Es el mismo resultado que ya tenía.');

  var yaPasado = est === 'ENVIADO';
  var nuevoEstado = 'PENDIENTE';
  if (yaPasado && tipo === 'PEDIDO') {
    var r = _ops('corregirCierre', { fila: Number(c.Fila), id: String(c.ID), antes: String(c.Resultado), nuevo: nuevo, motivo: String(p.motivo || ''),
                                     comentario: porque, recibio: String(p.recibio || ''), gestor: _nombreEnOps(c.NumeroGestor), quien: yo.Nombre });
    if (!r.ok) {
      if (/desconocida/i.test(String(r.mensaje))) throw _falla('API-07', 'OPERACIONES todavía no tiene la corrección. Pega el 04_Backend_App nuevo en OPERACIONES y crea su versión nueva.');
      throw _falla(r.codigo || 'API-07', 'Operaciones no aceptó la corrección: ' + (r.mensaje || r.error));
    }
    nuevoEstado = 'ENVIADO';   // Operaciones ya quedó con lo nuevo
  } else if (yaPasado && tipo === 'TRASPASO') {
    var tn = _tnBuscar(c.ID);
    if (tn && (tn.estatus === 'ENTREGADO_GESTOR' || tn.estatus === 'EXTRAVIADO')) {
      _tnSet(tn.fila, { 'Estatus': 'RECOLECTADO' });
      _tnMov(tn.folio, 'CORREGIDO DESDE LA APP (vuelve a "en camino")', tn.estatus, 'RECOLECTADO', yo.Nombre, porque);
    } else if (tn && tn.estatus === 'ENTREGADO') {
      throw _falla('TRA-05', 'La sucursal ya le dio entrada en el Sistema de Traspasos. Corrígelo ahí.');
    }
  }
  set('Estado', est === 'ENVIADO' ? 'CORREGIDO' : 'ANULADO');
  set('Corregido', (nuevo ? '→ ' + nuevo : 'Reabierto') + ' · ' + marca);

  // Lo que lleva vuelve a "Lo que llevo" (reabrir, o si ya no quedó entregado).
  if (tipo !== 'PEDIDO' && nuevo !== 'ENTREGADO') {
    var tr = _tabla(APPG.H.RECOLECCIONES);
    tr.filas.filter(function (r) { return String(r.NumeroGestor) === String(c.NumeroGestor) && _tnClave(r.Codigo) === _tnClave(c.ID) && String(r.Estado) !== 'EN RUTA'; })
      .slice(-1).forEach(function (r) { tr.sh.getRange(r._fila, tr.col('Estado')).setValue('EN RUTA'); tr.sh.getRange(r._fila, tr.col('Actualizado')).setValue(_ahora()); });
  }
  if (nuevo) {
    var o = {};
    APPG.ENC.APP_Cierres.forEach(function (h) { o[h] = c[h]; });
    o.IdCierre = 'adm' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    o.FechaHora = _ahora(); o.Resultado = nuevo; o.Motivo = String(p.motivo || ''); o.Estado = tipo === 'RECOLECCION' ? 'LOCAL' : nuevoEstado;
    o.Intentos = 0; o.UltimoError = ''; o.EnviadoEn = nuevoEstado === 'ENVIADO' ? _ahora() : '';
    o.Comentario = 'Corregido por ' + yo.Nombre + ': ' + porque; o.Corregido = 'Corrección de ' + c.IdCierre;
    if (p.recibio != null && String(p.recibio).trim()) o.Recibio = String(p.recibio).trim();
    _agregar(APPG.H.CIERRES, o);
  }
  _log(yo.Nombre, 'ADMIN_CORRIGE', c.ID + ' · ' + c.Resultado + ' → ' + (nuevo || 'REABIERTO') + ' · ' + porque);
  return { mensaje: nuevo ? c.ID + ': ahora dice ' + nuevo.toLowerCase() + '.' : c.ID + ' volvió a la lista de ' + c.Gestor + '.' };
}

/* ==================== A5 · Reasignar ==================== */
/* p = { id, a (número del gestor nuevo) } */
function _admReasignar(p, yo) {
  var d = _admDatos();
  var ped = d.pedidos.filter(function (x) { return _norm(x.ID) === _norm(p.id); })[0];
  if (!ped) throw _falla('APP-01', 'Ese pedido ya no está abierto con un gestor.');
  var a = d.usuarios.filas.filter(function (u) { return String(u.Numero) === String(p.a) && _si(u.Activo); })[0];
  if (!a) throw _falla('APP-01', 'Ese gestor no está activo.');
  if (!String(a.NombreEnOperaciones || '').trim()) throw _falla('APP-01', a.Nombre + ' no tiene "NombreEnOperaciones" en APP_Usuarios.');
  var pendiente = d.cierres.filter(function (c) { return _norm(c.ID) === _norm(p.id) && String(c.Estado) === 'PENDIENTE'; })[0];
  if (pendiente && !p.aunAsi) return { aviso: pendiente.Gestor + ' ya lo cerró (' + pendiente.Resultado.toLowerCase() + ') y se está pasando a Operaciones. ¿Reasignarlo de todos modos?' };
  var r = _ops('reasignarGestor', { fila: Number(ped.Fila), id: String(ped.ID), gestor: String(a.NombreEnOperaciones), quien: yo.Nombre });
  if (!r.ok) {
    if (/desconocida/i.test(String(r.mensaje))) throw _falla('API-07', 'OPERACIONES todavía no tiene "reasignar". Pega el 04_Backend_App nuevo en OPERACIONES y crea su versión nueva.');
    throw _falla(r.codigo || 'API-07', 'Operaciones no aceptó el cambio: ' + (r.mensaje || r.error));
  }
  var t = _tabla(APPG.H.PEDIDOS);
  t.filas.filter(function (x) { return _norm(x.ID) === _norm(p.id); }).forEach(function (x, i) {
    if (i === 0) { t.sh.getRange(x._fila, t.col('NumeroGestor')).setValue(a.Numero); t.sh.getRange(x._fila, t.col('Gestor')).setValue(a.Nombre); }
  });
  PropertiesService.getScriptProperties().deleteProperty('HUELLA_PEDIDOS');   // el robot la reescribe completa en su vuelta
  _log(yo.Nombre, 'ADMIN_REASIGNA', ped.ID + ' · ' + ped.Gestor + ' → ' + a.Nombre);
  return { mensaje: ped.ID + ' ahora lo lleva ' + a.Nombre + '. A él le suena como tarea nueva.' };
}

/* ==================== A6 · Problemas ==================== */

function _admProblemas() {
  var t = _tabla(APPG.H.PROBLEMAS).filas;
  var abiertos = t.filter(function (x) { return !_si(x.Resuelto); }).reverse().slice(0, 60).map(function (x) {
    return { numero: String(x.Numero), fecha: _fechaTxt(x.FechaHora, 'yyyy-MM-dd HH:mm'), codigo: String(x.Codigo), quien: String(x.Quien), detalle: String(x.Detalle) };
  });
  var errores = _tabla(APPG.H.CIERRES).filas.filter(function (c) { return String(c.Estado) === 'ERROR'; }).map(_admCierreCorto);
  return { problemas: abiertos, errores: errores, resueltos: t.length - abiertos.length };
}

/* p = { numero, nota } o { idCierre, reintentar: true } */
function _admResolver(p, yo) {
  if (p.idCierre) {
    var tc = _tabla(APPG.H.CIERRES);
    var c = tc.filas.filter(function (x) { return String(x.IdCierre) === String(p.idCierre); })[0];
    if (!c) throw _falla('APP-01', 'No encontré ese cierre.');
    if (p.reintentar) {
      tc.sh.getRange(c._fila, tc.col('Estado')).setValue('PENDIENTE');
      tc.sh.getRange(c._fila, tc.col('Intentos')).setValue(0);
      _log(yo.Nombre, 'ADMIN_REINTENTA', c.ID);
      return { mensaje: 'El robot lo vuelve a intentar en menos de 1 minuto.' };
    }
    tc.sh.getRange(c._fila, tc.col('Estado')).setValue('ANULADO');
    tc.sh.getRange(c._fila, tc.col('Corregido')).setValue('Descartado · ' + yo.Nombre + ' ' + _ahora('dd/MM HH:mm') + (p.nota ? ': ' + p.nota : ''));
    _log(yo.Nombre, 'ADMIN_DESCARTA', c.ID);
    return { mensaje: 'Descartado. Si el pedido sigue abierto, vuelve a la lista del gestor.' };
  }
  var t = _tabla(APPG.H.PROBLEMAS);
  var f = t.filas.filter(function (x) { return String(x.Numero) === String(p.numero); })[0];
  if (!f) throw _falla('APP-01', 'No encontré ' + p.numero + '.');
  var celda = t.sh.getRange(f._fila, t.col('Resuelto'));
  celda.setValue(true).setNote('Resuelto por ' + yo.Nombre + ' ' + _ahora('dd/MM HH:mm') + (p.nota ? ': ' + p.nota : ''));
  _log(yo.Nombre, 'ADMIN_RESUELVE', p.numero + (p.nota ? ' · ' + p.nota : ''));
  return { mensaje: p.numero + ' resuelto.' };
}

/* ==================== A7 · Equipo y accesos ==================== */

function _admEquipo() {
  var d = _admDatos(), ocultos = _admOcultos(d.cierres);
  return { equipo: d.usuarios.filas.map(function (u) {
    var r = _admResumen(u, d, ocultos);
    r.nombreOps = String(u.NombreEnOperaciones || ''); r.debeCambiar = _si(u.DebeCambiar);
    return r;
  }), areas: APPG.AREAS, roles: APPG.ROLES };
}

/* p = { usuario, campo: area|rol|activo|sesion|clave|ponerClave|nombreOps, valor } */
function _admEquipoCambiar(p, yo) {
  var u = _buscarUsuario(p.usuario);
  if (!u) throw _falla('APP-01', 'No existe el usuario ' + p.usuario + '.');
  var set = function (h, v) { u._t.sh.getRange(u._fila, u._t.col(h)).setValue(v); _olvidarUsuario(u.Usuario); };
  var campo = String(p.campo || ''), v = p.valor, msg;
  if (campo === 'area') {
    var area = APPG.AREAS.filter(function (a) { return _norm(a) === _norm(v); })[0];
    if (!area) throw _falla('APP-01', 'Área desconocida.');
    set('Area', area); msg = u.Nombre + ' ahora es de ' + area + '. Su app cambia en su siguiente actualización (menos de 1 minuto con la app abierta).';
  } else if (campo === 'rol') {
    var rol = APPG.ROLES.filter(function (a) { return _norm(a) === _norm(v); })[0];
    if (!rol) throw _falla('APP-01', 'Rol desconocido.');
    if (_norm(u.Usuario) === _norm(yo.Usuario) && rol !== 'Administrador') throw _falla('APP-01', 'No puedes quitarte a ti mismo el rol de administrador.');
    set('Rol', rol); msg = u.Nombre + ': rol ' + rol + '.';
  } else if (campo === 'activo') {
    if (_norm(u.Usuario) === _norm(yo.Usuario)) throw _falla('APP-01', 'No puedes darte de baja a ti mismo.');
    set('Activo', !!v); msg = u.Nombre + (v ? ' puede entrar otra vez.' : ' ya no puede entrar. Su app se cierra en su siguiente actualización.');
  } else if (campo === 'sesion') {
    set('VersionSesion', Number(u.VersionSesion || 1) + 1); msg = 'Sesión de ' + u.Nombre + ' cerrada en todos sus celulares. Entra con su misma contraseña.';
  } else if (campo === 'clave') {
    var temporal = restablecerClave(u.Usuario);
    _log(yo.Nombre, 'ADMIN_CLAVE', u.Usuario);
    return { mensaje: 'Contraseña temporal de ' + u.Nombre + ': ' + temporal + '. Dásela en persona; al entrar crea la suya.', temporal: temporal };
  } else if (campo === 'ponerClave') {
    ponerClave(u.Usuario, String(v || ''), !!p.debeCambiar); msg = 'Contraseña de ' + u.Nombre + ' cambiada.';
  } else if (campo === 'nombreOps') {
    if (!String(v || '').trim()) throw _falla('APP-01', 'Escribe el nombre como está en Operaciones.');
    set('NombreEnOperaciones', String(v).trim()); msg = 'Listo. El robot le trae sus pedidos en su siguiente vuelta.';
  } else throw _falla('APP-01', 'Cambio desconocido.');
  _log(yo.Nombre, 'ADMIN_EQUIPO', u.Usuario + ' · ' + campo + (campo === 'ponerClave' ? '' : ' = ' + v));
  return { mensaje: msg };
}

function _admAlta(p, yo) {
  var r = altaGestor(p.nombre, p.nombreOps, p.usuario, p.area);
  _log(yo.Nombre, 'ADMIN_ALTA', r.numero + ' · ' + r.usuario);
  return { mensaje: r.numero + ' · ' + r.usuario + ' · contraseña temporal: ' + r.clave + '. Dásela en persona.', temporal: r.clave, numero: r.numero };
}

/* ==================== A8 · Vehículos ==================== */

function _admVehiculos() {
  var hoy = _hoyTxt();
  var us = _tabla(APPG.H.USUARIOS).filas.filter(function (u) { return _si(u.Activo); });
  return { vehiculos: _tabla(APPG.H.VEHICULOS).filas.map(function (v) {
    var quien = us.filter(function (u) { return _fechaTxt(u.FechaVehiculo) === hoy && _norm(u.VehiculoHoy) === _norm(v.Vehiculo); })[0];
    return { nombre: String(v.Vehiculo), tipo: String(v.Tipo || 'AUTO').toUpperCase(), placa: String(v.Placa || ''), activo: _si(v.Activo), enTaller: _si(v.EnTaller),
             quien: quien ? String(quien.Nombre) : '', numero: quien ? String(quien.Numero) : '',
             desde: quien ? _fechaTxt(quien.FechaVehiculo, 'yyyy-MM-dd HH:mm').slice(11) : '', nota: quien ? String(quien.VehiculoNota || '') : '' };
  }) };
}

/* p = { vehiculo, enTaller } */
function _admVehiculoCambiar(p, yo) {
  var t = _tabla(APPG.H.VEHICULOS);
  var v = t.filas.filter(function (x) { return _norm(x.Vehiculo) === _norm(p.vehiculo); })[0];
  if (!v) throw _falla('APP-01', 'No existe ese vehículo.');
  t.sh.getRange(v._fila, t.col('EnTaller')).setValue(!!p.enTaller);
  _log(yo.Nombre, 'ADMIN_VEHICULO', v.Vehiculo + (p.enTaller ? ' · en taller' : ' · disponible'));
  return { mensaje: v.Vehiculo + (p.enTaller ? ' en taller: nadie la puede elegir.' : ' disponible otra vez.') };
}

/* p = { numero } : le quita el vehículo de hoy (para que otro lo pueda tomar) */
function _admLiberar(p, yo) {
  var t = _tabla(APPG.H.USUARIOS);
  var u = t.filas.filter(function (x) { return String(x.Numero) === String(p.numero); })[0];
  if (!u) throw _falla('APP-01', 'No existe ' + p.numero + '.');
  var antes = String(u.VehiculoHoy || '');
  t.sh.getRange(u._fila, t.col('VehiculoHoy')).setValue('');
  t.sh.getRange(u._fila, t.col('FechaVehiculo')).setValue('');
  _log(yo.Nombre, 'ADMIN_LIBERA', u.Nombre + ' · ' + antes);
  return { mensaje: antes + ' quedó libre. A ' + u.Nombre + ' la app le pide elegir vehículo otra vez.' };
}

/* ==================== A9 · Ajustes ==================== */

function _admAjustes() {
  var cfg = _config();
  var ajustes = {};
  APPG_AJUSTES.forEach(function (k) { ajustes[k] = cfg[k] == null ? '' : cfg[k]; });
  return {
    ajustes: ajustes,
    motivos: _tabla(APPG.H.MOTIVOS).filas.map(function (m) { return { fila: m._fila, tipo: String(m.Tipo), motivo: String(m.Motivo), activo: _si(m.Activo) }; }),
    sucursales: _tabla(APPG.H.SUCURSALES).filas.map(function (x) { return { fila: x._fila, nombre: String(x.Sucursal), id: String(x.ID), direccion: String(x.Direccion || ''), maps: String(x.URLMaps || ''), activo: _si(x.Activo) }; })
  };
}

function _admAjuste(p, yo) {
  var k = String(p.clave || '');
  if (APPG_AJUSTES.indexOf(k) < 0) throw _falla('APP-01', 'Ese ajuste no se cambia desde la app.');
  var v = typeof p.valor === 'boolean' ? p.valor : String(p.valor == null ? '' : p.valor).slice(0, 1000);
  _ponerConfig(k, v);
  _log(yo.Nombre, 'ADMIN_AJUSTE', k + ' = ' + v);
  return { mensaje: 'Guardado. Se aplica a todos en menos de 1 minuto.' };
}

/* p = { fila, activo } o { tipo, motivo } (agregar) */
function _admMotivo(p, yo) {
  var t = _tabla(APPG.H.MOTIVOS);
  if (p.fila) {
    var m = t.filas.filter(function (x) { return x._fila === Number(p.fila); })[0];
    if (!m) throw _falla('APP-01', 'No encontré ese motivo.');
    t.sh.getRange(m._fila, t.col('Activo')).setValue(!!p.activo);
    _log(yo.Nombre, 'ADMIN_MOTIVO', m.Tipo + ' · ' + m.Motivo + ' · ' + (p.activo ? 'activo' : 'inactivo'));
    return { mensaje: 'Listo.' };
  }
  var tipo = String(p.tipo || '').toUpperCase(), motivo = String(p.motivo || '').trim();
  if (['RETORNO', 'CANCELADO', 'TRASPASO'].indexOf(tipo) < 0 || !motivo) throw _falla('APP-01', 'Elige el tipo y escribe el motivo.');
  if (t.filas.some(function (x) { return String(x.Tipo).toUpperCase() === tipo && _norm(x.Motivo) === _norm(motivo); })) throw _falla('APP-01', 'Ese motivo ya existe.');
  _agregar(APPG.H.MOTIVOS, { Tipo: tipo, Motivo: motivo, PideComentario: false, Activo: true });
  _log(yo.Nombre, 'ADMIN_MOTIVO', 'nuevo · ' + tipo + ' · ' + motivo);
  return { mensaje: 'Motivo agregado.' };
}

/* p = { fila, direccion, maps, activo } */
function _admSucursal(p, yo) {
  var t = _tabla(APPG.H.SUCURSALES);
  var x = t.filas.filter(function (f) { return f._fila === Number(p.fila); })[0];
  if (!x) throw _falla('APP-01', 'No encontré esa sucursal.');
  if (p.direccion != null) t.sh.getRange(x._fila, t.col('Direccion')).setValue(String(p.direccion).trim());
  if (p.maps != null) t.sh.getRange(x._fila, t.col('URLMaps')).setValue(String(p.maps).trim());
  if (p.activo != null) t.sh.getRange(x._fila, t.col('Activo')).setValue(!!p.activo);
  _log(yo.Nombre, 'ADMIN_SUCURSAL', x.Sucursal);
  return { mensaje: x.Sucursal + ' guardada.' };
}
