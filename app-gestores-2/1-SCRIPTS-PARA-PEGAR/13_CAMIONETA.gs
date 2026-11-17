/***********************************************************************
 * APP GESTORES 2 — 13_CAMIONETA.gs   (archivo NUEVO en 0.5.2 · niveles de revisión en 0.5.3)
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * BITÁCORA DE VEHÍCULO al TOMARLO y al ENTREGARLO, en la app de cada quien.
 *
 * Qué revisión pide cada vehículo (APP_Vehiculos → Revision; se cambia en Administración → Vehículos):
 *   COMPLETA  Siempre completa: al ENTREGAR fotos (REV_FOTOS), qué lleva (REV_LLEVA), cómo está
 *             (REV_ESTADO, Bien/Detalle con foto) y notas. Al TOMAR: ve cómo la dejaron y confirma
 *             "Sí, está igual" o "Encontré algo nuevo" (foto + qué es).
 *   CAMBIO    Completa solo si cambia de conductor: al TOMARLA, si el anterior fue otra persona, hace
 *             la revisión completa (así cualquier daño queda a nombre de quien la entregó); si es el
 *             mismo, básica. Al entregar: básica.
 *   BASICA    Tablero (km, gasolina) + "¿Lleva todo y está bien?" (Sí / Hay algo: foto + nota).
 *   NINGUNA   No pide nada.
 * En TODOS (menos NINGUNA): foto del tablero, km y gasolina, y botón de WhatsApp al tomar y al entregar.
 * Excepción por persona (APP_Usuarios → RevisionVehiculo): COMPLETA · BASICA · NINGUNA (vacío = como el vehículo).
 * "Pedir completa la próxima vez" (APP_Vehiculos → CompletaProxima): una sola vez.
 *
 * Pestaña APP_Bitacora_Vehiculo: un renglón por uso (EN USO → ENTREGADA · SIN ENTREGAR).
 ***********************************************************************/

var APPG_GAS = ['Reserva', '¼', '½', '¾', 'Lleno'];
var APPG_NIVELES_VEH = ['COMPLETA', 'CAMBIO', 'BASICA', 'NINGUNA'];
var APPG_NIVEL_TXT = { COMPLETA: 'revisión completa siempre', CAMBIO: 'revisión completa solo si cambia de conductor', BASICA: 'solo revisión básica (tablero, km, gasolina)', NINGUNA: 'no pide revisión' };

function _nivelVehiculo(v) {
  var n = String((v && v.Revision) || '').trim().toUpperCase();
  if (APPG_NIVELES_VEH.indexOf(n) >= 0) return n;
  return v && _si(v.PideTablero) ? 'CAMBIO' : 'NINGUNA';
}
function _pideTablero(v) { return _nivelVehiculo(v) !== 'NINGUNA'; }
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
  var f = t.filas.filter(function (b) { return _norm(b.Vehiculo) === _norm(vehiculo); });
  return f.length ? f[f.length - 1] : null;
}
function _jsonLeer(v) { try { return v ? JSON.parse(String(v)) : null; } catch (e) { return null; } }

/** Qué se le pide a esta persona con este vehículo: COMPLETA · CONFIRMA · BASICA · NINGUNA. momento = SALIDA | REGRESO */
function _nivelPara(u, v, momento, ultimo) {
  var veh = _nivelVehiculo(v);
  if (veh === 'NINGUNA') return 'NINGUNA';
  var per = String(u.RevisionVehiculo || '').trim().toUpperCase();
  if (per === 'NINGUNA') return 'NINGUNA';
  var completa = _si(v.CompletaProxima) || per === 'COMPLETA' || veh === 'COMPLETA';
  if (per === 'BASICA' && !_si(v.CompletaProxima)) return 'BASICA';
  if (completa) {
    if (momento === 'REGRESO') return 'COMPLETA';
    var rev = ultimo && _jsonLeer(ultimo.RevRegreso);   // si la última entrega trae la revisión completa, solo se confirma
    return rev && rev.nivel === 'COMPLETA' && !_si(v.CompletaProxima) ? 'CONFIRMA' : 'COMPLETA';
  }
  if (veh === 'CAMBIO' && momento === 'SALIDA' && ultimo && String(ultimo.NumeroGestor) !== String(u.Numero)) return 'COMPLETA';
  if (veh === 'CAMBIO' && momento === 'SALIDA' && !ultimo) return 'COMPLETA';
  return 'BASICA';
}

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
function _bitacoraSalida(u, v, tablero) {
  var mia = _bitacoraAbierta({ numero: u.Numero });
  if (mia && _norm(mia.b.Vehiculo) === _norm(v.Vehiculo)) return;   // ya la trae (volvió a elegirla): nada que pedir
  if (mia) throw _falla('VEH-02', 'Primero entrega ' + mia.b.Vehiculo + ' (botón "Entregar" en tu inicio).');
  var t = _bitTabla(), ultimo = _ultimoUso(t, v.Vehiculo);
  var nivel = _nivelPara(u, v, 'SALIDA', ultimo);
  if (nivel === 'NINGUNA') return;
  var d = _leerTablero(tablero, 'al tomarla');
  var r = _leerRevision(nivel, tablero, v, u, 'SALIDA');
  var otro = _bitacoraAbierta({ vehiculo: v.Vehiculo });
  if (otro) {
    otro.t.sh.getRange(otro.b._fila, otro.t.col('Estado')).setValue('SIN ENTREGAR');
    otro.t.sh.getRange(otro.b._fila, otro.t.col('Nota')).setValue('La tomó ' + u.Nombre + ' ' + _ahora('dd/MM HH:mm') + ' sin que ' + otro.b.Gestor + ' la entregara');
    _problema('VEH-01', u.Nombre, v.Vehiculo + ': ' + otro.b.Gestor + ' no la entregó en la app (salió ' + _fechaTxt(otro.b.Salida, 'yyyy-MM-dd HH:mm') + ').');
  }
  if (r.detalles.length || r.faltantes.length) {
    _problema('VEH-03', u.Nombre, v.Vehiculo + ' al recibirla' + (ultimo ? ' (la entregó ' + ultimo.Gestor + ')' : '') + ': ' + r.detalles.concat(r.faltantes.map(function (f) { return 'falta ' + f; })).join(' · '));
  }
  var foto = _guardarImagen(d.foto, 'image/jpeg', v.Vehiculo + ' SALIDA ' + _ahora('yyyy-MM-dd HH.mm') + ' ' + u.Nombre + ' · Tablero', _config().CARPETA_TABLERO, u.Nombre);
  _agregar(APPG.H.BITACORA, { Id: 'VB' + _ahora('yyMMddHHmm') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase(), Vehiculo: String(v.Vehiculo),
    NumeroGestor: u.Numero, Gestor: u.Nombre, Estado: 'EN USO', Salida: _ahora(), KmSalida: d.km, GasSalida: d.gas, FotoSalida: foto, LatSalida: d.lat, LngSalida: d.lng,
    NivelSalida: nivel, RevSalida: JSON.stringify(r.rev), Faltantes: r.faltantes.join(', '), Detalles: r.detalles.join(' · '), Observaciones: r.rev.obs ? 'Al tomar: ' + r.rev.obs : '' });
  if (nivel === 'COMPLETA' && _si(v.CompletaProxima)) _limpiarCompletaProxima(v);
  _log(u.Nombre, 'TOMA_VEHICULO', v.Vehiculo + ' · ' + d.km + ' km · ' + d.gas + ' · revisión ' + nivel);
}
function _limpiarCompletaProxima(v) {
  var tv = _tabla(APPG.H.VEHICULOS), f = tv.filas.filter(function (x) { return _norm(x.Vehiculo) === _norm(v.Vehiculo); })[0];
  if (f) tv.sh.getRange(f._fila, tv.col('CompletaProxima')).setValue(false);
}

/** p = { foto, km, gas, lat, lng, fotos, falta, detalles, todoBien, algo, obs, donde, llaves } */
function apiEntregarVehiculo(p) {
  var s = _exigirSesion(p.token), u = _buscarUsuario(s.Usuario);
  var a = _bitacoraAbierta({ numero: u.Numero });
  if (!a) throw _falla('APP-01', 'No tienes ningún vehículo por entregar.');
  var v = _tabla(APPG.H.VEHICULOS).filas.filter(function (x) { return _norm(x.Vehiculo) === _norm(a.b.Vehiculo); })[0] || { Vehiculo: a.b.Vehiculo, PideTablero: true };
  var nivel = _nivelPara(u, v, 'REGRESO', null);
  if (nivel === 'NINGUNA' || nivel === 'CONFIRMA') nivel = 'BASICA';   // si la tomó con revisión, al menos el tablero al dejarla
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
  if (nivel === 'COMPLETA' && _si(v.CompletaProxima)) _limpiarCompletaProxima(v);
  if (_norm(u.VehiculoHoy) === _norm(a.b.Vehiculo)) {   // ya no trae vehículo: la app le pregunta en qué sigue
    u._t.sh.getRange(u._fila, u._t.col('VehiculoHoy')).setValue('');
    u._t.sh.getRange(u._fila, u._t.col('FechaVehiculo')).setValue('');
  }
  var min = Math.round((Date.now() - _fechaMs(a.b.Salida)) / 60000);
  _log(u.Nombre, 'ENTREGA_VEHICULO', a.b.Vehiculo + ' · ' + d.km + ' km (' + (kmSal ? d.km - kmSal : '?') + ' recorridos) · ' + d.gas + ' · revisión ' + nivel);
  return { vehiculo: String(a.b.Vehiculo), kmSalida: kmSal, kmRegreso: d.km, km: kmSal ? d.km - kmSal : '', gasSalida: String(a.b.GasSalida), gasRegreso: d.gas,
           salida: _fechaTxt(a.b.Salida, 'yyyy-MM-dd HH:mm'), regreso: _ahora('yyyy-MM-dd HH:mm'), minutos: min > 0 ? min : 0, urlFoto: foto,
           nivel: nivel, faltantes: r.faltantes, detalles: r.detalles };
}

/** Para el inicio: el vehículo que trae, y qué revisión le toca al entregarlo. */
function _bitacoraInicio(u) {
  try {
    var a = _bitacoraAbierta({ numero: u.Numero }); if (!a) return null;
    var v = _tabla(APPG.H.VEHICULOS).filas.filter(function (x) { return _norm(x.Vehiculo) === _norm(a.b.Vehiculo); })[0] || { Vehiculo: a.b.Vehiculo, PideTablero: true };
    var niv = _nivelPara(u, v, 'REGRESO', null); if (niv === 'NINGUNA' || niv === 'CONFIRMA') niv = 'BASICA';
    return { vehiculo: String(a.b.Vehiculo), salida: _fechaTxt(a.b.Salida, 'yyyy-MM-dd HH:mm'), km: Number(a.b.KmSalida) || '', gas: String(a.b.GasSalida), nivel: niv };
  } catch (e) { return null; }
}
/** Para la lista de vehículos del inicio: qué revisión le toca al tomarlo y, si es "confirmar", cómo lo dejaron. */
function _revisionAlTomar(u, v, t) {
  var ultimo = _ultimoUso(t, v.Vehiculo), nivel = _nivelPara(u, v, 'SALIDA', ultimo), out = { revision: nivel };
  if (nivel !== 'NINGUNA' && ultimo && String(ultimo.Estado) !== 'EN USO') {
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
    return { id: String(b.Id), vehiculo: String(b.Vehiculo), gestor: String(b.Gestor), estado: est,
      sinEntregar: est === 'SIN ENTREGAR' || (est === 'EN USO' && _fechaTxt(b.Salida) < hoy),
      salida: _fechaTxt(b.Salida, 'yyyy-MM-dd HH:mm'), regreso: _fechaTxt(b.Regreso, 'yyyy-MM-dd HH:mm'),
      kmSalida: kmSal || '', kmRegreso: Number(b.KmRegreso) || '', km: b.Km === '' ? '' : Number(b.Km), gasSalida: String(b.GasSalida || ''), gasRegreso: String(b.GasRegreso || ''),
      fotoSalida: String(b.FotoSalida || ''), fotoRegreso: String(b.FotoRegreso || ''), descuadre: descuadre, nota: String(b.Nota || ''),
      nivelSalida: String(b.NivelSalida || ''), nivelRegreso: String(b.NivelRegreso || ''), faltantes: String(b.Faltantes || ''), detalles: String(b.Detalles || ''),
      observaciones: String(b.Observaciones || ''), donde: String(b.DondeLaDejo || ''), llaves: String(b.Llaves || ''), fotos: fotos, alRecibir: alRecibir,
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
