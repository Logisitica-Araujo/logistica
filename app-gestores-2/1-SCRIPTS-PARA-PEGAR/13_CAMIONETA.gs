/***********************************************************************
 * APP GESTORES 2 — 13_CAMIONETA.gs   (archivo NUEVO en la versión 0.5.2)
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * BITÁCORA DE VEHÍCULO: foto del tablero, kilometraje y gasolina al TOMAR y al ENTREGAR.
 *   · Solo para los vehículos con la casilla "PideTablero" en APP_Vehiculos
 *     (al instalar: solo los AUTO = la camioneta). La administradora lo prende/apaga
 *     en Administración → Vehículos.
 *   · Pestaña APP_Bitacora_Vehiculo: un renglón por uso (Estado EN USO → ENTREGADA).
 *     Si alguien toma el vehículo sin que el anterior lo haya entregado, el anterior queda
 *     "SIN ENTREGAR" y se avisa en APP_Problemas (VEH-01).
 ***********************************************************************/

var APPG_GAS = ['Reserva', '¼', '½', '¾', 'Lleno'];

function _pideTablero(v) { return !!v && _si(v.PideTablero); }

/** El uso abierto (EN USO) de un gestor, o de un vehículo. */
function _bitacoraAbierta(filtro) {
  var t; try { t = _tabla(APPG.H.BITACORA); } catch (e) { return null; }   // sin INSTALAR todavía: no hay bitácora
  var f = t.filas.filter(function (b) {
    return String(b.Estado) === 'EN USO' && (filtro.numero ? String(b.NumeroGestor) === String(filtro.numero) : _norm(b.Vehiculo) === _norm(filtro.vehiculo));
  });
  return f.length ? { t: t, b: f[f.length - 1] } : null;
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

/** Lo llama apiVehiculo cuando el vehículo elegido pide tablero. */
function _bitacoraSalida(u, v, tablero) {
  var mia = _bitacoraAbierta({ numero: u.Numero });
  if (mia && _norm(mia.b.Vehiculo) === _norm(v.Vehiculo)) return;   // ya la trae (volvió a elegirla): nada que pedir
  if (mia) throw _falla('VEH-02', 'Primero entrega ' + mia.b.Vehiculo + ' (botón "Entregar" en tu inicio).');
  var d = _leerTablero(tablero, 'al tomarla');
  var otro = _bitacoraAbierta({ vehiculo: v.Vehiculo });
  if (otro) {
    otro.t.sh.getRange(otro.b._fila, otro.t.col('Estado')).setValue('SIN ENTREGAR');
    otro.t.sh.getRange(otro.b._fila, otro.t.col('Nota')).setValue('La tomó ' + u.Nombre + ' ' + _ahora('dd/MM HH:mm') + ' sin que ' + otro.b.Gestor + ' la entregara');
    _problema('VEH-01', u.Nombre, v.Vehiculo + ': ' + otro.b.Gestor + ' no la entregó en la app (salió ' + _fechaTxt(otro.b.Salida, 'yyyy-MM-dd HH:mm') + ').');
  }
  var foto = _guardarImagen(d.foto, 'image/jpeg', v.Vehiculo + ' SALIDA ' + _ahora('yyyy-MM-dd HH.mm') + ' ' + u.Nombre, _config().CARPETA_TABLERO, u.Nombre);
  _agregar(APPG.H.BITACORA, { Id: 'VB' + _ahora('yyMMddHHmm') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase(), Vehiculo: String(v.Vehiculo),
    NumeroGestor: u.Numero, Gestor: u.Nombre, Estado: 'EN USO', Salida: _ahora(), KmSalida: d.km, GasSalida: d.gas, FotoSalida: foto, LatSalida: d.lat, LngSalida: d.lng });
  _log(u.Nombre, 'TOMA_VEHICULO', v.Vehiculo + ' · ' + d.km + ' km · ' + d.gas);
}

/** p = { foto, km, gas, lat, lng } */
function apiEntregarVehiculo(p) {
  var s = _exigirSesion(p.token), u = _buscarUsuario(s.Usuario);
  var a = _bitacoraAbierta({ numero: u.Numero });
  if (!a) throw _falla('APP-01', 'No tienes ningún vehículo por entregar.');
  var d = _leerTablero(p, 'al entregarla');
  var kmSal = Number(a.b.KmSalida) || 0;
  if (kmSal && d.km < kmSal) throw _falla('CAP-01', 'El kilometraje (' + d.km + ') es menor al de salida (' + kmSal + '). Revisa el tablero.');
  var foto = _guardarImagen(d.foto, 'image/jpeg', a.b.Vehiculo + ' REGRESO ' + _ahora('yyyy-MM-dd HH.mm') + ' ' + u.Nombre, _config().CARPETA_TABLERO, u.Nombre);
  var set = function (h, v) { a.t.sh.getRange(a.b._fila, a.t.col(h)).setValue(v); };
  set('Regreso', _ahora()); set('KmRegreso', d.km); set('GasRegreso', d.gas); set('FotoRegreso', foto);
  set('LatRegreso', d.lat); set('LngRegreso', d.lng); set('Km', kmSal ? d.km - kmSal : ''); set('Estado', 'ENTREGADA');
  // Ya no trae vehículo: la app le pregunta en qué sigue.
  if (_norm(u.VehiculoHoy) === _norm(a.b.Vehiculo)) {
    u._t.sh.getRange(u._fila, u._t.col('VehiculoHoy')).setValue('');
    u._t.sh.getRange(u._fila, u._t.col('FechaVehiculo')).setValue('');
  }
  var min = Math.round((Date.now() - _fechaMs(a.b.Salida)) / 60000);
  _log(u.Nombre, 'ENTREGA_VEHICULO', a.b.Vehiculo + ' · ' + d.km + ' km (' + (kmSal ? d.km - kmSal : '?') + ' recorridos) · ' + d.gas);
  return { vehiculo: String(a.b.Vehiculo), kmSalida: kmSal, kmRegreso: d.km, km: kmSal ? d.km - kmSal : '', gasSalida: String(a.b.GasSalida), gasRegreso: d.gas,
           salida: _fechaTxt(a.b.Salida, 'yyyy-MM-dd HH:mm'), regreso: _ahora('yyyy-MM-dd HH:mm'), minutos: min > 0 ? min : 0, urlFoto: foto };
}

/** Para el inicio: el vehículo que trae con bitácora abierta. */
function _bitacoraInicio(u) {
  try {
    var a = _bitacoraAbierta({ numero: u.Numero });
    return a ? { vehiculo: String(a.b.Vehiculo), salida: _fechaTxt(a.b.Salida, 'yyyy-MM-dd HH:mm'), km: Number(a.b.KmSalida) || '', gas: String(a.b.GasSalida) } : null;
  } catch (e) { return null; }
}

/* ---------- Administración ---------- */
function _admBitacora() {
  var t = _tabla(APPG.H.BITACORA), hoy = _hoyTxt();
  var ultimoRegreso = {};   // por vehículo, en orden de tiempo: para ver si el km de salida cuadra
  var lista = t.filas.map(function (b) {
    var k = _norm(b.Vehiculo), prev = ultimoRegreso[k];
    var kmSal = Number(b.KmSalida) || 0;
    var descuadre = prev && kmSal && Math.abs(kmSal - prev) > 1 ? kmSal - prev : 0;
    var ultimo = Number(b.KmRegreso) || kmSal;   // lo último que se supo del tablero (si no la entregó, el de salida)
    if (ultimo) ultimoRegreso[k] = ultimo;
    var est = String(b.Estado);
    return { id: String(b.Id), vehiculo: String(b.Vehiculo), gestor: String(b.Gestor), estado: est,
      sinEntregar: est === 'SIN ENTREGAR' || (est === 'EN USO' && _fechaTxt(b.Salida) < hoy),
      salida: _fechaTxt(b.Salida, 'yyyy-MM-dd HH:mm'), regreso: _fechaTxt(b.Regreso, 'yyyy-MM-dd HH:mm'),
      kmSalida: kmSal || '', kmRegreso: Number(b.KmRegreso) || '', km: b.Km === '' ? '' : Number(b.Km), gasSalida: String(b.GasSalida || ''), gasRegreso: String(b.GasRegreso || ''),
      fotoSalida: String(b.FotoSalida || ''), fotoRegreso: String(b.FotoRegreso || ''), descuadre: descuadre, nota: String(b.Nota || '') };
  });
  return { bitacora: lista.reverse().slice(0, 60) };
}
