/***********************************************************************
 * APP GESTORES 2 — 13_CAMIONETA.gs   (0.5.2 · rediseño 0.5.4: "Salida especial")
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * Elegir vehículo es COMO ANTES: la lista de siempre (CHECK_AUTO / CHECK_MOTO) y sales.
 * "🚐 Salida especial" (foráneo, carga, todo el día u otro): SOLO si el gestor lo toca. Ahí sí:
 *   5 fotos (REV_FOTOS), qué lleva (REV_LLEVA), cómo está (REV_ESTADO, Bien/Detalle con foto),
 *   tablero, km, gasolina, notas, día, hora y lugar (GPS), y WhatsApp al salir y al entregar.
 *   Al regresar: "Entregar" en su inicio, con la misma revisión, dónde la dejó y a quién las llaves.
 * Alguien SIN app: lo registra un administrador en Administración → Vehículos →
 *   "Prestar vehículo a alguien sin app" (nombre, teléfono, para qué) y "Recibir de vuelta".
 * Pestaña APP_Bitacora_Vehiculo: un renglón por salida especial (EN USO → ENTREGADA · SIN ENTREGAR)
 *   y uno por salida normal de la camioneta (SALIDA: foto del tablero + destino, no se entrega).
 ***********************************************************************/

var APPG_GAS = ['Reserva', '¼', '½', '¾', 'Lleno'];
var APPG_NIVELES_VEH = ['COMPLETA', 'CAMBIO', 'BASICA', 'NINGUNA'];
var APPG_NIVEL_TXT = { COMPLETA: 'revisión completa siempre', CAMBIO: 'revisión completa solo si cambia de conductor', BASICA: 'solo revisión básica (tablero, km, gasolina)', NINGUNA: 'no pide revisión' };

function _nivelVehiculo(v) {
  var n = String((v && v.Revision) || '').trim().toUpperCase();
  if (APPG_NIVELES_VEH.indexOf(n) >= 0) return n;
  return v && _si(v.PideTablero) ? 'CAMBIO' : 'NINGUNA';
}
function _pideTablero(v) { return false; }   // 0.5.4: solo la "Salida especial" pide revisión
var APPG_PARA = ['Foráneo', 'Carga', 'Todo el día', 'Otro'];
function _leerEspecial(e) {
  e = e || {};
  var para = String(e.para || '');
  if (APPG_PARA.indexOf(para) < 0) throw _falla('CAP-01', 'Elige para qué es la salida especial.');
  if (para === 'Otro' && !String(e.destino || '').trim()) throw _falla('CAP-01', 'Escribe a dónde o para qué.');
  return { para: para, destino: String(e.destino || '').slice(0, 150) };
}
function _revConfig() {
  var c = _config();
  return { fotos: _lista(c.REV_FOTOS || 'Frente | Atrás | Lado piloto | Lado copiloto | Interior'), lleva: _lista(c.REV_LLEVA || ''), estado: _lista(c.REV_ESTADO || '') };
}

/** Todos los usos de la bitácora (o null si aún no se corre INSTALAR). */
function _bitTabla() { try { return _tabla(APPG.H.BITACORA); } catch (e) { return null; } }
function _bitacoraAbierta(filtro) {
  var t = _bitTabla(); if (!t) return null;
  var f = t.filas.filter(function (b) {
    return String(b.Estado) === 'EN USO' && (filtro.numero ? String(b.NumeroGestor) === String(filtro.numero) : _norm(b.Vehiculo) === _norm(filtro.vehiculo));
  });
  return f.length ? { t: t, b: f[f.length - 1] } : null;
}
/** El último uso cerrado (o abierto) de un vehículo. */
function _ultimoUso(t, vehiculo) {
  if (!t) return null;
  var f = t.filas.filter(function (b) { return _norm(b.Vehiculo) === _norm(vehiculo) && String(b.Estado) !== 'SALIDA'; });   // las salidas normales no traen revisión
  return f.length ? f[f.length - 1] : null;
}
function _jsonLeer(v) { try { return v ? JSON.parse(String(v)) : null; } catch (e) { return null; } }

function _leerTablero(x, cuando) {
  x = x || {};
  if (!x.foto) throw _falla('CAP-04', 'Falta la foto del tablero (' + cuando + ').');
  var km = Number(String(x.km || '').replace(/[^\d.]/g, ''));
  if (!(km > 0)) throw _falla('CAP-01', 'Escribe el kilometraje del tablero.');
  var gas = String(x.gas || '');
  if (APPG_GAS.indexOf(gas) < 0) throw _falla('CAP-01', 'Elige cuánta gasolina tiene.');
  return { foto: x.foto, km: Math.round(km), gas: gas, lat: x.lat || '', lng: x.lng || '' };
}

/** Revisa y guarda lo que pide el nivel. Devuelve { rev (para JSON), faltantes, detalles, obs }. */
function _leerRevision(nivel, x, v, u, momento) {
  x = x || {};
  var cfg = _revConfig(), carpeta = _config().CARPETA_TABLERO, base = v.Vehiculo + ' ' + momento + ' ' + _ahora('yyyy-MM-dd HH.mm') + ' ' + u.Nombre;
  var guarda = function (b64, que) { return _guardarImagen(b64, 'image/jpeg', base + ' · ' + que, carpeta, u.Nombre); };
  var rev = { nivel: nivel, obs: String(x.obs || '').slice(0, 500) }, faltantes = [], detalles = [];
  if (nivel === 'COMPLETA') {
    var fotos = x.fotos || {};
    cfg.fotos.forEach(function (f) { if (!fotos[f]) throw _falla('CAP-04', 'Falta la foto: ' + f + '.'); });
    (x.detalles || []).forEach(function (d) {
      if (!String(d.nota || '').trim()) throw _falla('CAP-01', 'Escribe qué tiene: ' + d.punto + '.');
      if (!d.foto) throw _falla('CAP-04', 'Falta la foto del detalle: ' + d.punto + '.');
    });
    rev.fotos = {}; cfg.fotos.forEach(function (f) { rev.fotos[f] = guarda(fotos[f], f); });
    faltantes = (x.falta || []).map(String).filter(function (f) { return cfg.lleva.indexOf(f) >= 0; });
    rev.falta = faltantes;
    rev.detalles = (x.detalles || []).map(function (d) { var o = { punto: String(d.punto), nota: String(d.nota).slice(0, 200), foto: guarda(d.foto, 'Detalle ' + d.punto) }; detalles.push(o.punto + ': ' + o.nota); return o; });
  } else if (nivel === 'CONFIRMA') {
    rev.confirma = x.confirma === 'NUEVO' ? 'NUEVO' : 'IGUAL';
    if (rev.confirma === 'NUEVO') {
      if (!String((x.nuevo || {}).nota || '').trim()) throw _falla('CAP-01', 'Escribe qué encontraste.');
      if (!(x.nuevo || {}).foto) throw _falla('CAP-04', 'Falta la foto de lo que encontraste.');
      rev.nuevo = { nota: String(x.nuevo.nota).slice(0, 300), foto: guarda(x.nuevo.foto, 'Encontré algo nuevo') };
      detalles.push('Nuevo al recibir: ' + rev.nuevo.nota);
    }
  } else if (nivel === 'BASICA') {
    rev.todoBien = x.todoBien !== false;
    if (!rev.todoBien) {
      if (!String((x.algo || {}).nota || '').trim()) throw _falla('CAP-01', 'Escribe qué tiene.');
      rev.algo = { nota: String(x.algo.nota).slice(0, 300), foto: x.algo.foto ? guarda(x.algo.foto, 'Hay algo') : '' };
      detalles.push(rev.algo.nota);
    }
  }
  return { rev: rev, faltantes: faltantes, detalles: detalles };
}

/** Lo llama apiVehiculo cuando el vehículo elegido pide revisión. */
function _bitacoraSalida(u, v, tablero, especial, registro) {
  var mia = u.Numero && !registro ? _bitacoraAbierta({ numero: u.Numero }) : null;
  if (mia) throw _falla('VEH-02', 'Primero entrega ' + mia.b.Vehiculo + ' (botón "Entregar" en tu inicio).');
  var t = _bitTabla(), ultimo = _ultimoUso(t, v.Vehiculo);
  var esp = _leerEspecial(especial), nivel = 'COMPLETA';
  var d = _leerTablero(tablero, 'al tomarla');
  var r = _leerRevision(nivel, tablero, v, u, 'SALIDA');
  var otro = _bitacoraAbierta({ vehiculo: v.Vehiculo });
  if (otro) {
    otro.t.sh.getRange(otro.b._fila, otro.t.col('Estado')).setValue('SIN ENTREGAR');
    otro.t.sh.getRange(otro.b._fila, otro.t.col('Nota')).setValue('La tomó ' + u.Nombre + ' ' + _ahora('dd/MM HH:mm') + ' sin que ' + otro.b.Gestor + ' la entregara');
    _problema('VEH-01', u.Nombre, v.Vehiculo + ': ' + otro.b.Gestor + ' no la entregó en la app (salió ' + _fechaTxt(otro.b.Salida, 'yyyy-MM-dd HH:mm') + ').');
  }
  if (r.detalles.length || r.faltantes.length) {
    _problema('VEH-03', u.Nombre, v.Vehiculo + ' al salir (' + u.Nombre + ')' + (ultimo ? ' · antes la usó ' + ultimo.Gestor : '') + ': ' + r.detalles.concat(r.faltantes.map(function (f) { return 'falta ' + f; })).join(' · '));
  }
  var foto = _guardarImagen(d.foto, 'image/jpeg', v.Vehiculo + ' SALIDA ' + _ahora('yyyy-MM-dd HH.mm') + ' ' + u.Nombre + ' · Tablero', _config().CARPETA_TABLERO, u.Nombre);
  _agregar(APPG.H.BITACORA, { Id: 'VB' + _ahora('yyMMddHHmm') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase(), Vehiculo: String(v.Vehiculo),
    NumeroGestor: u.Numero, Gestor: u.Nombre, Estado: 'EN USO', Salida: _ahora(), KmSalida: d.km, GasSalida: d.gas, FotoSalida: foto, LatSalida: d.lat, LngSalida: d.lng,
    NivelSalida: nivel, RevSalida: JSON.stringify(r.rev), Faltantes: r.faltantes.join(', '), Detalles: r.detalles.join(' · '), Observaciones: r.rev.obs ? 'Al tomar: ' + r.rev.obs : '',
    Motivo: esp.para, Destino: esp.destino, Telefono: registro ? String(registro.telefono || '') : '', RegistroPor: registro ? registro.por : '' });
  _log(registro ? registro.por : u.Nombre, 'SALIDA_ESPECIAL', v.Vehiculo + ' · ' + u.Nombre + ' · ' + esp.para + (esp.destino ? ' · ' + esp.destino : '') + ' · ' + d.km + ' km · ' + d.gas);
}

/** Salida NORMAL de la camioneta (sin "Salida especial"): foto del tablero + a dónde va. No pide entregarla.
    Queda en la bitácora con Estado "SALIDA" (no "EN USO"). p = { tablero: { foto, lat, lng }, destino, checklist } */
function _bitacoraNormal(u, v, p) {
  var tab = p.tablero || {};
  if (!tab.foto) throw _falla('CAP-04', 'Falta la foto del tablero (que se vea el kilometraje y la gasolina).');
  var destino = String(p.destino || '').trim();
  if (!destino) throw _falla('CAP-01', 'Escribe a dónde vas (destino o ruta).');
  var falta = (p.checklist || []).filter(function (c) { return c && c.ok === false; }).map(function (c) { return String(c.texto); });
  var foto = _guardarImagen(tab.foto, 'image/jpeg', v.Vehiculo + ' SALIDA ' + _ahora('yyyy-MM-dd HH.mm') + ' ' + u.Nombre + ' · Tablero', _config().CARPETA_TABLERO, u.Nombre);
  _agregar(APPG.H.BITACORA, { Id: 'VB' + _ahora('yyMMddHHmm') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase(), Vehiculo: String(v.Vehiculo),
    NumeroGestor: u.Numero, Gestor: u.Nombre, Estado: 'SALIDA', Salida: _ahora(), FotoSalida: foto, LatSalida: tab.lat || '', LngSalida: tab.lng || '',
    NivelSalida: 'NORMAL', Faltantes: falta.join(', '), Motivo: 'Normal', Destino: destino.slice(0, 150) });
  _log(u.Nombre, 'SALIDA_CAMIONETA', v.Vehiculo + ' · ' + destino + (falta.length ? ' · le falta: ' + falta.join(', ') : ''));
}

/** p = { foto, km, gas, lat, lng, fotos, falta, detalles, obs, donde, llaves } */
function apiEntregarVehiculo(p) {
  var s = _exigirSesion(p.token), u = _buscarUsuario(s.Usuario);
  var a = _bitacoraAbierta({ numero: u.Numero });
  if (!a) throw _falla('APP-01', 'No tienes ningún vehículo por entregar.');
  var r = _cerrarBitacora(a, u, p, null);
  if (_norm(u.VehiculoHoy) === _norm(a.b.Vehiculo)) {   // ya no trae vehículo: la app le pregunta en qué sigue
    u._t.sh.getRange(u._fila, u._t.col('VehiculoHoy')).setValue('');
    u._t.sh.getRange(u._fila, u._t.col('FechaVehiculo')).setValue('');
  }
  return r;
}
/** Cierra un uso abierto con la revisión de regreso. quien = { Nombre } de quien la entrega (o de quien la recibe de vuelta). */
function _cerrarBitacora(a, u, p, recibio) {
  var v = _tabla(APPG.H.VEHICULOS).filas.filter(function (x) { return _norm(x.Vehiculo) === _norm(a.b.Vehiculo); })[0] || { Vehiculo: a.b.Vehiculo };
  var nivel = 'COMPLETA';
  var d = _leerTablero(p, 'al entregarla');
  var kmSal = Number(a.b.KmSalida) || 0;
  if (kmSal && d.km < kmSal) throw _falla('CAP-01', 'El kilometraje (' + d.km + ') es menor al de salida (' + kmSal + '). Revisa el tablero.');
  var r = _leerRevision(nivel, p, v, u, 'REGRESO');
  r.rev.donde = String(p.donde || '').slice(0, 150); r.rev.llaves = String(p.llaves || '').slice(0, 100);
  var foto = _guardarImagen(d.foto, 'image/jpeg', a.b.Vehiculo + ' REGRESO ' + _ahora('yyyy-MM-dd HH.mm') + ' ' + u.Nombre + ' · Tablero', _config().CARPETA_TABLERO, u.Nombre);
  var set = function (h, val) { a.t.sh.getRange(a.b._fila, a.t.col(h)).setValue(val); };
  set('Regreso', _ahora()); set('KmRegreso', d.km); set('GasRegreso', d.gas); set('FotoRegreso', foto);
  set('LatRegreso', d.lat); set('LngRegreso', d.lng); set('Km', kmSal ? d.km - kmSal : ''); set('Estado', 'ENTREGADA');
  set('NivelRegreso', nivel); set('RevRegreso', JSON.stringify(r.rev));
  set('Faltantes', [String(a.b.Faltantes || '')].concat(r.faltantes).filter(String).join(', '));
  set('Detalles', [String(a.b.Detalles || '')].concat(r.detalles).filter(String).join(' · '));
  set('Observaciones', [String(a.b.Observaciones || ''), r.rev.obs ? 'Al entregar: ' + r.rev.obs : ''].filter(String).join(' · '));
  set('DondeLaDejo', r.rev.donde); set('Llaves', r.rev.llaves);
  if (recibio) set('RecibioPor', recibio);
  var min = Math.round((Date.now() - _fechaMs(a.b.Salida)) / 60000);
  _log(recibio || u.Nombre, 'ENTREGA_VEHICULO', a.b.Vehiculo + ' · ' + a.b.Gestor + ' · ' + d.km + ' km (' + (kmSal ? d.km - kmSal : '?') + ' recorridos) · ' + d.gas);
  return { vehiculo: String(a.b.Vehiculo), kmSalida: kmSal, kmRegreso: d.km, km: kmSal ? d.km - kmSal : '', gasSalida: String(a.b.GasSalida), gasRegreso: d.gas,
           salida: _fechaTxt(a.b.Salida, 'yyyy-MM-dd HH:mm'), regreso: _ahora('yyyy-MM-dd HH:mm'), minutos: min > 0 ? min : 0, urlFoto: foto,
           nivel: nivel, faltantes: r.faltantes, detalles: r.detalles, para: String(a.b.Motivo || ''), destino: String(a.b.Destino || '') };
}

/* ---------- Alguien SIN app (lo registra un administrador) ---------- */
/* p = { nombre, telefono, vehiculo, especial: {para, destino}, tablero: {foto, km, gas, fotos, falta, detalles, obs, lat, lng} } */
function _admPrestar(p, yo) {
  var nombre = String(p.nombre || '').trim();
  if (!nombre) throw _falla('CAP-01', 'Escribe el nombre de quien se lo lleva.');
  var v = _tabla(APPG.H.VEHICULOS).filas.filter(function (x) { return _si(x.Activo) && _norm(x.Vehiculo) === _norm(p.vehiculo); })[0];
  if (!v) throw _falla('CAP-06', 'Ese vehículo no está en la lista.');
  if (_si(v.EnTaller)) throw _falla('CAP-06', v.Vehiculo + ' está en taller.');
  var persona = { Numero: 'EXT', Nombre: nombre + ' (sin app)' };
  _bitacoraSalida(persona, v, p.tablero, p.especial, { telefono: p.telefono, por: yo.Nombre });
  return { mensaje: v.Vehiculo + ' prestada a ' + nombre + '. Cuando la regrese: Vehículos → "Recibir de vuelta".' };
}
/* p = { id, tablero: {...} } */
function _admRecibirPrestado(p, yo) {
  var t = _bitTabla(); if (!t) throw _falla('APP-01', 'No hay bitácora.');
  var b = t.filas.filter(function (x) { return String(x.Id) === String(p.id) && String(x.Estado) === 'EN USO'; })[0];
  if (!b) throw _falla('APP-01', 'Ese préstamo ya se cerró.');
  return _cerrarBitacora({ t: t, b: b }, { Nombre: String(b.Gestor), Numero: 'EXT' }, p.tablero || {}, yo.Nombre);
}
function _prestadosAbiertos() {
  var t = _bitTabla(); if (!t) return [];
  return t.filas.filter(function (b) { return String(b.Estado) === 'EN USO' && String(b.RegistroPor || ''); }).map(function (b) {
    return { id: String(b.Id), vehiculo: String(b.Vehiculo), persona: String(b.Gestor), telefono: String(b.Telefono || ''), salida: _fechaTxt(b.Salida, 'yyyy-MM-dd HH:mm'),
             km: Number(b.KmSalida) || '', gas: String(b.GasSalida || ''), para: String(b.Motivo || ''), destino: String(b.Destino || ''), por: String(b.RegistroPor) };
  });
}

/** Para el inicio: el vehículo que trae, y qué revisión le toca al entregarlo. */
function _bitacoraInicio(u) {
  try {
    var a = _bitacoraAbierta({ numero: u.Numero }); if (!a) return null;
    return { vehiculo: String(a.b.Vehiculo), salida: _fechaTxt(a.b.Salida, 'yyyy-MM-dd HH:mm'), km: Number(a.b.KmSalida) || '', gas: String(a.b.GasSalida), nivel: 'COMPLETA',
             para: String(a.b.Motivo || ''), destino: String(a.b.Destino || '') };
  } catch (e) { return null; }
}
/** Para la lista de vehículos del inicio: qué revisión le toca al tomarlo y, si es "confirmar", cómo lo dejaron. */
function _revisionAlTomar(u, v, t) {
  var ultimo = _ultimoUso(t, v.Vehiculo), out = { revision: 'NINGUNA', especial: _tipoVehiculo(v) !== 'NINGUNO' };
  if (out.especial && ultimo && String(ultimo.Estado) !== 'EN USO') {
    var rev = _jsonLeer(ultimo.RevRegreso) || {};
    out.anterior = { gestor: String(ultimo.Gestor), cuando: _fechaTxt(ultimo.Regreso || ultimo.Salida, 'yyyy-MM-dd HH:mm'), km: Number(ultimo.KmRegreso) || '',
      gas: String(ultimo.GasRegreso || ''), fotos: rev.fotos || {}, falta: rev.falta || [], detalles: rev.detalles || [], obs: String(ultimo.Observaciones || ''),
      donde: String(ultimo.DondeLaDejo || ''), llaves: String(ultimo.Llaves || ''), sinEntregar: String(ultimo.Estado) === 'SIN ENTREGAR' };
  }
  return out;
}

/* ---------- Administración ---------- */
function _admBitacora() {
  var t = _bitTabla(), hoy = _hoyTxt();
  if (!t) return { bitacora: [] };
  var ultimoKm = {};   // por vehículo, en orden de tiempo: para ver si el km de salida cuadra
  var lista = t.filas.map(function (b) {
    var k = _norm(b.Vehiculo), prev = ultimoKm[k];
    var kmSal = Number(b.KmSalida) || 0;
    var descuadre = prev && kmSal && Math.abs(kmSal - prev) > 1 ? kmSal - prev : 0;
    var ultimo = Number(b.KmRegreso) || kmSal;   // lo último que se supo del tablero (si no la entregó, el de salida)
    if (ultimo) ultimoKm[k] = ultimo;
    var est = String(b.Estado), rs = _jsonLeer(b.RevSalida) || {}, rr = _jsonLeer(b.RevRegreso) || {};
    var fotos = [];
    if (b.FotoSalida) fotos.push(['Tablero al tomar', String(b.FotoSalida)]);
    Object.keys(rs.fotos || {}).forEach(function (f) { fotos.push([f + ' (al tomar)', rs.fotos[f]]); });
    (rs.detalles || []).forEach(function (d) { fotos.push(['Detalle al tomar: ' + d.punto, d.foto]); });
    if (rs.nuevo) fotos.push(['Nuevo al tomar', rs.nuevo.foto]);
    if (rs.algo && rs.algo.foto) fotos.push(['"Hay algo" al tomar', rs.algo.foto]);
    if (b.FotoRegreso) fotos.push(['Tablero al entregar', String(b.FotoRegreso)]);
    Object.keys(rr.fotos || {}).forEach(function (f) { fotos.push([f + ' (al entregar)', rr.fotos[f]]); });
    (rr.detalles || []).forEach(function (d) { fotos.push(['Detalle: ' + d.punto, d.foto]); });
    if (rr.algo && rr.algo.foto) fotos.push(['"Hay algo" al entregar', rr.algo.foto]);
    var alRecibir = [].concat(rs.nuevo ? ['Nuevo: ' + rs.nuevo.nota] : [], (rs.detalles || []).map(function (d) { return d.punto + ': ' + d.nota; }), (rs.falta || []).map(function (f) { return 'falta ' + f; }), rs.algo ? [rs.algo.nota] : []);
    return { id: String(b.Id), vehiculo: String(b.Vehiculo), gestor: String(b.Gestor), estado: est, normal: est === 'SALIDA',
      sinEntregar: est === 'SIN ENTREGAR' || (est === 'EN USO' && _fechaTxt(b.Salida) < hoy),
      salida: _fechaTxt(b.Salida, 'yyyy-MM-dd HH:mm'), regreso: _fechaTxt(b.Regreso, 'yyyy-MM-dd HH:mm'),
      kmSalida: kmSal || '', kmRegreso: Number(b.KmRegreso) || '', km: b.Km === '' ? '' : Number(b.Km), gasSalida: String(b.GasSalida || ''), gasRegreso: String(b.GasRegreso || ''),
      fotoSalida: String(b.FotoSalida || ''), fotoRegreso: String(b.FotoRegreso || ''), descuadre: descuadre, nota: String(b.Nota || ''),
      nivelSalida: String(b.NivelSalida || ''), nivelRegreso: String(b.NivelRegreso || ''), faltantes: String(b.Faltantes || ''), detalles: String(b.Detalles || ''),
      observaciones: String(b.Observaciones || ''), donde: String(b.DondeLaDejo || ''), llaves: String(b.Llaves || ''), fotos: fotos, alRecibir: alRecibir,
      para: String(b.Motivo || ''), destino: String(b.Destino || ''), telefono: String(b.Telefono || ''), registroPor: String(b.RegistroPor || ''), recibioPor: String(b.RecibioPor || ''),
      // Lugar exacto (GPS del celular) al tomarla y al entregarla
      mapaSalida: b.LatSalida && b.LngSalida ? 'https://www.google.com/maps?q=' + b.LatSalida + ',' + b.LngSalida : '',
      mapaRegreso: b.LatRegreso && b.LngRegreso ? 'https://www.google.com/maps?q=' + b.LatRegreso + ',' + b.LngRegreso : '' };
  });
  // "Daño nuevo": lo que reportó quien la recibió es responsabilidad del uso anterior.
  for (var i = 1; i < lista.length; i++) {
    if (!lista[i].alRecibir.length) continue;
    for (var j = i - 1; j >= 0; j--) if (_norm(lista[j].vehiculo) === _norm(lista[i].vehiculo)) { lista[i].antes = lista[j].gestor + ' (' + lista[j].salida.slice(0, 10) + ')'; break; }
  }
  return { bitacora: lista.reverse().slice(0, 60) };
}
