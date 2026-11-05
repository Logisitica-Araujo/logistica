/***********************************************************************
 * APP GESTORES 2 — 06_GESTOR.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * Lo que pide el celular (ver CONTRATO.md):
 *   inicio · vehiculo · cerrar · recolectar · problema · documentos
 * Todo contesta en 1–2 s porque solo toca ESTE archivo (y, al escanear,
 * lee el Sistema de Traspasos). Lo pesado (Operaciones) lo hace el robot.
 ***********************************************************************/

var APPG_RESULTADOS = ['ENTREGADO', 'RETORNO', 'CANCELADO', 'PAQUETERIA', 'NO_ENTREGADO'];

function _hoyTxt() { return _ahora('yyyy-MM-dd'); }

/** MOTO, AUTO o NINGUNO. "Sin vehículo", "A pie", "Caminando", "Transporte público" siempre son NINGUNO:
 *  esos los pueden elegir varios gestores a la vez. */
function _tipoVehiculo(v) {
  if (/^(sin veh|a pie|camin|transporte|metro|taxi)/.test(_norm(v.Vehiculo))) return 'NINGUNO';
  return String(v.Tipo || 'AUTO').trim().toUpperCase() || 'AUTO';
}

/** ¿Qué es? IMSS (entrega en un área del IMSS), EFECTIVO, DOCUMENTO o '' (traspaso o pedido normal). */
function _clase(texto, cfg, esPedidoImss) {
  var t = _norm(texto);
  var tiene = function (lista) { return _lista(lista).some(function (w) { return w && t.indexOf(_norm(w)) >= 0; }); };
  if (esPedidoImss) return 'IMSS';
  if (tiene(cfg.PALABRAS_EFECTIVO || 'Efectivo | $')) return 'EFECTIVO';
  if (tiene(cfg.PALABRAS_DOCUMENTOS || 'Factura | Cortes | Documento')) return 'DOCUMENTO';
  return '';
}
function _esImss(f, cfg) {
  var t = _norm([f.Area, f.SubArea, f.Cliente].join(' '));
  return _lista(cfg.PALABRAS_IMSS || 'IMSS').some(function (w) { return w && t.indexOf(_norm(w)) >= 0; });
}
/** "$2,654.00 + $1,144.00" → 3798. 0 si no trae montos. */
function _montoEsperado(texto) {
  var m, total = 0, re = /\$\s?([\d,]+(?:\.\d{1,2})?)/g, s = String(texto || '');
  while ((m = re.exec(s))) total += Number(m[1].replace(/,/g, '')) || 0;
  return Math.round(total * 100) / 100;
}
function _lista(v) { return String(v || '').split('|').map(function (x) { return x.trim(); }).filter(String); }

/* ==================== inicio ==================== */

function apiInicio(p) {
  var s = _exigirSesion(p.token);
  var u = _buscarUsuario(s.Usuario);
  var cfg = _config();
  var hoy = _hoyTxt();
  var perfil = _perfil(u);

  /* Vehículos y quién trae cuál hoy */
  var ocupados = {};
  u._t.filas.forEach(function (f) {
    if (String(f.Numero) !== String(u.Numero) && _si(f.Activo) && _fechaTxt(f.FechaVehiculo) === hoy && f.VehiculoHoy) ocupados[_norm(f.VehiculoHoy)] = f.Nombre;
  });
  var vehiculos = _tabla(APPG.H.VEHICULOS).filas.filter(function (v) { return _si(v.Activo); }).map(function (v) {
    var tipo = _tipoVehiculo(v);
    return { nombre: String(v.Vehiculo), tipo: tipo, placa: String(v.Placa || ''),
             ocupadoPor: tipo === 'NINGUNO' ? '' : (ocupados[_norm(v.Vehiculo)] || ''), enTaller: _si(v.EnTaller) };
  });

  /* Lo que cerró (para no volver a mostrarlo mientras Operaciones se entera) */
  var cierres = _tabla(APPG.H.CIERRES).filas;
  var ocultar = {}, hoyCuenta = { entregados: 0, noEntregados: 0, recolectados: 0 };
  var hace15 = Date.now() - 15 * 60000;
  cierres.forEach(function (c) {
    var k = _norm(c.ID);
    var est = String(c.Estado);
    var reciente = _fechaMs(c.EnviadoEn || c.FechaHora) > hace15;
    if (String(c.Resultado) === 'PAQUETERIA' || est === 'PENDIENTE' || (est === 'ENVIADO' && reciente) || est === 'LOCAL') ocultar[k] = true;
    if (String(c.NumeroGestor) === String(u.Numero) && _fechaTxt(c.FechaHora) === hoy && est !== 'ANULADO' && est !== 'CORREGIDO') {
      if (c.Resultado === 'ENTREGADO') hoyCuenta.entregados++;
      else if (c.Resultado !== 'PAQUETERIA') hoyCuenta.noEntregados++;
    }
  });

  var pedidos = _tabla(APPG.H.PEDIDOS).filas.filter(function (f) {
    return String(f.NumeroGestor) === String(u.Numero) && !ocultar[_norm(f.ID)];
  }).map(function (f) {
    return { id: String(f.ID), fila: Number(f.Fila), cliente: String(f.Cliente), direccion: String(f.Direccion),
             telefono: String(f.Telefono || ''), notas: String(f.Notas || ''), area: String(f.Area), subarea: String(f.SubArea),
             metodo: String(f.Metodo), eta: String(f.ETA || ''), estatus: String(f.Estatus || ''),
             clase: _clase([f.Notas, f.SubArea].join(' '), cfg, _esImss(f, cfg)), esperado: _montoEsperado(f.Notas) };
  });

  var sucursales = _tabla(APPG.H.SUCURSALES).filas.filter(function (x) { return _si(x.Activo); }).map(function (x) {
    return { nombre: String(x.Sucursal), id: String(x.ID).toUpperCase(), direccion: String(x.Direccion || ''), maps: String(x.URLMaps || '') };
  });
  var porId = {};
  sucursales.forEach(function (x) { porId[x.id] = x; });
  var lleva = [];
  _tabla(APPG.H.RECOLECCIONES).filas.forEach(function (r) {
    if (String(r.NumeroGestor) !== String(u.Numero)) return;
    if (_fechaTxt(r.FechaHora) === hoy) hoyCuenta.recolectados++;
    if (String(r.Estado) !== 'EN RUTA') return;
    var suc = null;
    if (r.DestinoPrefijo) { try { suc = porId[_tnSucursalDe(r.DestinoPrefijo)] || null; } catch (e) { } }
    lleva.push({ codigo: String(r.Codigo), tipo: String(r.Tipo), origen: String(r.Origen), destino: String(r.Destino),
                 contenido: String(r.Contenido), fecha: _fechaTxt(r.FechaHora, 'yyyy-MM-dd HH:mm'),
                 estado: _estadoAmigable(r.EstadoFuente, r.Enviado),
                 destinoSucursal: suc ? suc.nombre : '', destinoDireccion: suc ? suc.direccion : '', destinoMaps: suc ? suc.maps : '',
                 destinoId: suc ? suc.id : '', clase: _clase([r.Contenido, r.Destino].join(' '), cfg, false), esperado: _montoEsperado(r.Contenido) });
  });

  var motivos = { RETORNO: [], CANCELADO: [], TRASPASO: [] };
  _tabla(APPG.H.MOTIVOS).filas.forEach(function (m) {
    var t = String(m.Tipo).toUpperCase();
    if (motivos[t] && _si(m.Activo)) motivos[t].push({ motivo: String(m.Motivo), pideComentario: _si(m.PideComentario) });
  });

  var wa = {};
  Object.keys(cfg).forEach(function (k) { if (/^WA_MSG_/.test(k)) wa[k.replace('WA_MSG_', '')] = String(cfg[k]).replace(/\\n/g, '\n'); });

  return {
    gestor: { numero: u.Numero, nombre: u.Nombre }, perfil: perfil,
    porRecoger: perfil.area === 'FACTURACION' ? _porRecoger() : [],
    libresHoy: cierres.filter(function (c) {
      return String(c.Tipo) === 'LIBRE' && String(c.NumeroGestor) === String(u.Numero) && _fechaTxt(c.FechaHora) === hoy && String(c.Estado) !== 'ANULADO';
    }).map(function (c) {
      return { id: String(c.ID), que: String(c.Clase), detalle: String(c.Cliente), donde: String(c.Direccion), recibio: String(c.Recibio || ''),
               monto: c.Monto === '' ? '' : String(c.Monto), hora: _fechaTxt(c.FechaHora, 'yyyy-MM-dd HH:mm').slice(11), foto: !!c.URLFoto };
    }),
    vehiculo: _fechaTxt(u.FechaVehiculo) === hoy && u.VehiculoHoy ? String(u.VehiculoHoy) : '',
    vehiculos: vehiculos,
    checklist: { MOTO: _lista(cfg.CHECK_MOTO), AUTO: _lista(cfg.CHECK_AUTO) },
    pedidos: pedidos, lleva: lleva, sucursales: sucursales, motivos: motivos, whatsapp: wa, hoy: hoyCuenta,
    reglas: apiYo(p).reglas,
    robot: String(cfg.ULTIMA_VUELTA_ROBOT || ''),
    hora: _ahora('yyyy-MM-dd HH:mm:ss'), version: APPG.VERSION
  };
}

/* ==================== vehiculo ==================== */

function apiVehiculo(p) {
  var s = _exigirSesion(p.token);
  var u = _buscarUsuario(s.Usuario);
  var nombre = String(p.vehiculo || '').trim();
  var v = _tabla(APPG.H.VEHICULOS).filas.filter(function (x) { return _si(x.Activo) && _norm(x.Vehiculo) === _norm(nombre); })[0];
  if (!v) throw _falla('CAP-06', 'Ese vehículo no está en la lista.');
  if (_si(v.EnTaller)) throw _falla('CAP-06', nombre + ' está en taller. Elige otro.');
  var hoy = _hoyTxt();
  if (_tipoVehiculo(v) !== 'NINGUNO') {
    var otro = u._t.filas.filter(function (f) {
      return String(f.Numero) !== String(u.Numero) && _si(f.Activo) && _fechaTxt(f.FechaVehiculo) === hoy && _norm(f.VehiculoHoy) === _norm(nombre);
    })[0];
    if (otro) throw _falla('CAP-06', otro.Nombre + ' ya trae ' + nombre + ' hoy. Elige otro o pídele que lo cambie.');
  }
  var antes = _fechaTxt(u.FechaVehiculo) === hoy ? String(u.VehiculoHoy || '') : '';
  var desde = _fechaTxt(u.FechaVehiculo, 'yyyy-MM-dd HH:mm').slice(11);
  u._t.sh.getRange(u._fila, u._t.col('VehiculoHoy')).setValue(String(v.Vehiculo));
  u._t.sh.getRange(u._fila, u._t.col('FechaVehiculo')).setValue(_ahora('yyyy-MM-dd HH:mm'));
  var falta = (p.checklist || []).filter(function (c) { return c && c.ok === false; }).map(function (c) { return c.texto; });
  var motivo = String(p.motivo || '').slice(0, 120);
  var nota = antes && antes !== String(v.Vehiculo) ? antes + ' de ' + desde + ' a ' + _ahora('HH:mm') + ' → ' + v.Vehiculo + (motivo ? ' · ' + motivo : '') : '';
  try { u._t.sh.getRange(u._fila, u._t.col('VehiculoNota')).setValue(nota ? nota : (falta.length ? 'Le faltó: ' + falta.join(', ') : '')); } catch (e) { }
  _log(u.Nombre, antes ? 'CAMBIA_VEHICULO' : 'VEHICULO', (antes ? antes + ' → ' : '') + v.Vehiculo + (motivo ? ' · motivo: ' + motivo : '') + (falta.length ? ' · le falta: ' + falta.join(', ') : ''));
  if (falta.length) _problema('CAP-06', u.Nombre, 'Salió en ' + v.Vehiculo + ' sin: ' + falta.join(', '));
  return { vehiculo: String(v.Vehiculo) };
}

/* ==================== cerrar ==================== */
/* p = { idLocal, tipo: PEDIDO|TRASPASO|RECOLECCION, id, fila, resultado, motivo, comentario, recibio,
         foto (base64 JPEG), firma (base64 PNG), lat, lng, horaCelular } */
function apiCerrar(p) {
  var u = _quienCierra(p);
  var cfg = _config();
  return _cerrarUno(u, cfg, p, null);
}

/** La administradora puede cerrar a nombre de otro (p.comoNumero). Cualquier otro cierra lo suyo. */
function _quienCierra(p) {
  var s = _exigirSesion(p.token);
  var u = _buscarUsuario(s.Usuario);
  if (p.comoNumero && String(p.comoNumero) !== String(u.Numero)) {
    if (!_esAdmin(u)) throw _falla('APP-02', 'Solo un administrador puede cerrar a nombre de otro.');
    var otro = u._t.filas.filter(function (f) { return String(f.Numero) === String(p.comoNumero); })[0];
    if (!otro) throw _falla('APP-01', 'No existe el gestor ' + p.comoNumero + '.');
    otro._t = u._t; otro._por = u.Nombre;
    return otro;
  }
  return u;
}

/* cerrarVarios = varias entregas en la misma parada con UNA foto (perfil Facturación).
   p = { items: [{idLocal, tipo, id, fila, clase}], resultado: 'ENTREGADO', foto, sucursal, comentario, recibio, lat, lng, horaCelular } */
function apiCerrarVarios(p) {
  var u = _quienCierra(p);
  var cfg = _config();
  var items = (p.items || []).slice(0, 40);
  if (!items.length) throw _falla('APP-01', 'No marcaste nada para entregar.');
  var urlFoto = '';
  if (p.foto) {
    var primero = String(items[0].id || 'entrega').replace(/[\\/:*?"<>|]/g, '-');
    var hayPedido = items.some(function (x) { return String(x.tipo).toUpperCase() === 'PEDIDO'; });
    urlFoto = _guardarImagen(p.foto, 'image/jpeg', primero + (items.length > 1 ? ' y ' + (items.length - 1) + ' más' : ''),
                             cfg[hayPedido ? 'CARPETA_ENTREGADO' : 'CARPETA_TRASPASOS'], u.Nombre);
  }
  var hechos = items.map(function (x) {
    var q = Object.assign({}, p, x, { foto: null, resultado: p.resultado || 'ENTREGADO' });
    try { return _cerrarUno(u, cfg, q, urlFoto); }
    catch (e) { return { idCierre: x.idLocal, error: e.message, codigo: e.codigo || 'APP-01' }; }
  });
  return { cierres: hechos, urlFoto: urlFoto };
}

function _cerrarUno(u, cfg, p, urlFotoYa) {
  var idLocal = String(p.idLocal || '').trim();
  if (!/^[A-Za-z0-9_-]{8,60}$/.test(idLocal)) throw _falla('APP-01', 'Falta el identificador del cierre (actualiza la app).');

  // Mismo cierre que llega dos veces (mala señal): se contesta igual y no se duplica.
  var cierres = _tabla(APPG.H.CIERRES);
  var ya = cierres.filas.filter(function (c) { return String(c.IdCierre) === idLocal; })[0];
  if (ya) return { idCierre: idLocal, repetido: true };

  var tipo = String(p.tipo || 'PEDIDO').toUpperCase();
  var res = String(p.resultado || '').toUpperCase();
  var id = String(p.id || '').trim();
  /* LIBRE = entrega sin asignar que registra el mismo gestor (perfil Facturación). Solo queda en la app. */
  if (tipo === 'LIBRE') {
    if (!String(p.que || '').trim()) throw _falla('CAP-01', 'Elige qué entregaste.');
    if (!String(p.donde || '').trim()) throw _falla('CAP-01', 'Escribe dónde lo entregaste.');
    res = 'ENTREGADO';
    p.clase = String(p.que).toUpperCase().slice(0, 30);
    p.sucursal = String(p.donde);
    if (p.pidio) p.comentario = (p.comentario ? p.comentario + ' · ' : '') + 'Lo pidió: ' + String(p.pidio).slice(0, 80);
  }
  /* Si en una entrega "sin asignar" escriben un número de pedido o TAREA, casi seguro el pedido no le apareció
     en su lista (nombre distinto en Operaciones, lo asignaron a otro…). Se avisa a Administración el mismo día. */
  if (tipo === 'LIBRE') {
    var txtLibre = [p.detalle, p.comentario, p.donde].join(' ');
    var mPed = /(TAREA\s*#\s*\d+|#\s?\d{4,6}|NRREM-\d+)/i.exec(txtLibre);
    if (mPed) _problema('DIS-03', u.Nombre, 'Registró como "entrega sin asignar" algo que parece el pedido ' + mPed[1].replace(/\s+/g, ' ') +
      '. Revisa en Operaciones a quién está asignado (columna I) y que su nombre sea igual al de APP_Usuarios. Entrega: ' + id + ' · ' + txtLibre.slice(0, 160));
  }
  if (['PEDIDO', 'TRASPASO', 'RECOLECCION', 'LIBRE'].indexOf(tipo) < 0) throw _falla('APP-01', 'Tipo de cierre desconocido.');
  if (APPG_RESULTADOS.indexOf(res) < 0) throw _falla('APP-01', 'Resultado desconocido.');
  if (!id) throw _falla('APP-01', 'Falta el número de pedido o folio.');

  /* Reglas (las mismas que valida el celular; aquí por si alguien se las salta) */
  // En traspasos nada es obligatorio. En pedidos: motivo en retorno/cancelado y las fotos que diga APP_Config.
  if (tipo === 'PEDIDO' && (res === 'RETORNO' || res === 'CANCELADO') && !String(p.motivo || '').trim()) throw _falla('CAP-05', 'Elige el motivo.');
  var clase = String(p.clase || '').toUpperCase();
  var tieneFoto = !!(p.foto || urlFotoYa);
  if (clase === 'IMSS' && res === 'ENTREGADO' && apiYoReglas_(cfg).exigirAcuseImss && !tieneFoto) throw _falla('CAP-04', 'Falta la foto del acuse sellado.');
  if (tipo === 'PEDIDO' && clase !== 'IMSS' && res === 'ENTREGADO' && _si(cfg.EXIGIR_FOTO_ENTREGA) && !tieneFoto) throw _falla('CAP-04', 'Falta la foto de la fachada.');
  if (tipo === 'PEDIDO' && (res === 'RETORNO' || res === 'CANCELADO') && _si(cfg.EXIGIR_FOTO_NOENTREGA) && !tieneFoto) throw _falla('CAP-04', 'Falta la foto de evidencia.');
  if (tipo === 'PEDIDO' && clase !== 'IMSS' && res === 'ENTREGADO' && _si(cfg.EXIGIR_QUIEN_RECIBIO) && !String(p.recibio || '').trim()) throw _falla('CAP-08', 'Anota quién recibió.');

  /* IMSS: el área queda en "dónde entregó" y en el comentario (Operaciones AD); la matrícula va con quién recibió.
     Efectivo: el monto (opcional) va en su columna y en el comentario; si no cuadra con lo que decía, se avisa. */
  var recibio = String(p.recibio || '').trim();
  if (p.matricula) recibio = (recibio ? recibio + ' · ' : '') + 'Mat. ' + String(p.matricula).trim();
  var comentario = String(p.comentario || '').trim();
  var donde = String(p.sucursal || p.areaImss || '').slice(0, 80);
  if (clase === 'IMSS' && p.areaImss) comentario = 'Área IMSS: ' + p.areaImss + (comentario ? ' · ' + comentario : '');
  var monto = p.monto === '' || p.monto == null ? '' : Number(String(p.monto).replace(/[$,\s]/g, ''));
  if (monto !== '' && !isFinite(monto)) throw _falla('CAP-09', 'El monto no es un número.');
  if (monto !== '') comentario = (comentario ? comentario + ' · ' : '') + 'Monto entregado: $' + monto.toFixed(2);
  var esperado = Number(p.esperado) || 0;
  if (monto !== '' && esperado && Math.abs(monto - esperado) > 0.009) {
    _problema('CAP-09', u.Nombre, id + ': entregó $' + monto.toFixed(2) + ' y el sobre decía $' + esperado.toFixed(2) + '. Nota: ' + (p.comentario || '—'));
  }
  if (u._por) comentario = (comentario ? comentario + ' · ' : '') + 'Cerrado por ' + u._por;

  /* Fotos a Drive (si una carpeta falla, va a la de respaldo y queda en APP_Problemas) */
  var nombreArchivo = id.replace(/[\\/:*?"<>|]/g, '-');
  var carpeta = tipo === 'PEDIDO' ? ({ ENTREGADO: 'CARPETA_ENTREGADO', RETORNO: 'CARPETA_RETORNO', CANCELADO: 'CARPETA_CANCELADO', PAQUETERIA: 'CARPETA_ENTREGADO' })[res]
                                  : tipo === 'LIBRE' && cfg.CARPETA_LIBRES ? 'CARPETA_LIBRES' : 'CARPETA_TRASPASOS';
  var urlFoto = urlFotoYa || (p.foto ? _guardarImagen(p.foto, 'image/jpeg', nombreArchivo + (res === 'PAQUETERIA' ? ' PAQUETERIA' : ''), cfg[carpeta], u.Nombre) : '');
  var urlFirma = p.firma ? _guardarImagen(p.firma, 'image/png', nombreArchivo + ' FIRMA', cfg.CARPETA_FIRMAS, u.Nombre) : '';

  var ped = tipo === 'PEDIDO' ? _tabla(APPG.H.PEDIDOS).filas.filter(function (f) { return _norm(f.ID) === _norm(id); })[0] : null;
  // PEDIDO y TRASPASO los lleva el robot a su sistema. RECOLECCION y PAQUETERIA solo se anotan aquí.
  var estado = (tipo === 'RECOLECCION' || tipo === 'LIBRE' || res === 'PAQUETERIA') ? 'LOCAL' : 'PENDIENTE';
  _agregar(APPG.H.CIERRES, {
    IdCierre: idLocal, FechaHora: _ahora(), HoraCelular: String(p.horaCelular || '').slice(0, 19), NumeroGestor: u.Numero, Gestor: u.Nombre,
    Vehiculo: _fechaTxt(u.FechaVehiculo) === _hoyTxt() ? String(u.VehiculoHoy || '') : '', Tipo: tipo, ID: id,
    Fila: ped ? Number(ped.Fila) : (Number(p.fila) || ''), Resultado: res, Motivo: String(p.motivo || ''), Comentario: comentario.slice(0, 1000),
    Recibio: recibio.slice(0, 120), Lat: p.lat || '', Lng: p.lng || '', URLFoto: urlFoto, URLFirma: urlFirma,
    Estado: estado, Intentos: 0, UltimoError: '', EnviadoEn: '', Cliente: ped ? String(ped.Cliente) : tipo === 'LIBRE' ? (String(p.que) + (p.detalle ? ' · ' + String(p.detalle) : '')).slice(0, 200) : '',
    Direccion: ped ? String(ped.Direccion) : tipo === 'LIBRE' ? String(p.donde).slice(0, 200) : '',
    DondeEntrego: donde, Monto: monto === '' ? '' : monto, Clase: clase, Corregido: ''
  });

  /* Lo que lleva (traspaso o recolección) sale de su lista al entregar */
  if (tipo !== 'PEDIDO' && (res === 'ENTREGADO' || res === 'PAQUETERIA')) {
    var tr = _tabla(APPG.H.RECOLECCIONES);
    tr.filas.forEach(function (r) {
      if (String(r.NumeroGestor) === String(u.Numero) && _tnClave(r.Codigo) === _tnClave(id) && String(r.Estado) === 'EN RUTA') {
        tr.sh.getRange(r._fila, tr.col('Estado')).setValue(res === 'PAQUETERIA' ? 'EN PAQUETERÍA' : 'ENTREGADO POR GESTOR');
        tr.sh.getRange(r._fila, tr.col('Actualizado')).setValue(_ahora());
      }
    });
  }
  _log(u.Nombre, 'CIERRE', tipo + ' ' + id + ' · ' + res + (p.motivo ? ' · ' + p.motivo : ''));
  return { idCierre: idLocal, urlFoto: urlFoto };
}
function apiYoReglas_(cfg) { return { exigirAcuseImss: cfg.EXIGIR_ACUSE_IMSS === '' || cfg.EXIGIR_ACUSE_IMSS == null ? true : _si(cfg.EXIGIR_ACUSE_IMSS) }; }

/* ==================== por recoger (perfil Facturación) ==================== */
/* Traspasos que esperan en una sucursal a que alguien pase por ellos (Estatus NUEVO o EN_LOGISTICA).
   Lo calcula el robot cada vuelta y lo deja en memoria; si no está, se lee una vez. */
function _porRecoger() {
  var c = CacheService.getScriptCache().get('porRecoger');
  if (c) { try { return JSON.parse(c); } catch (e) { } }
  try { return _calcularPorRecoger(); } catch (e) { return []; }
}
function _calcularPorRecoger() {
  var t = _tnTabla();
  var out = [];
  var cE = t.c('Estatus'), cF = t.c('Folio'), cD = t.c('Destino'), cO = t.c('Origen'), cDesc = t.c('Descripción');
  var cEl = t.enc.indexOf('Eliminación solicitada');
  for (var i = 0; i < t.datos.length && out.length < 300; i++) {
    var v = t.datos[i], est = String(v[cE]).trim().toUpperCase();
    if (est !== 'NUEVO' && est !== 'EN_LOGISTICA') continue;
    if (cEl >= 0 && String(v[cEl]).trim().toUpperCase() === 'SI') continue;
    var folio = String(v[cF]).trim(); if (!folio) continue;
    var pref = folio.replace(/-\d+$/, '');
    out.push({ folio: folio, sucursalId: est === 'EN_LOGISTICA' ? 'OFI' : _tnSucursalDe(pref), origen: String(v[cO]), destino: String(v[cD]),
               contenido: String(v[cDesc]).slice(0, 80), estatus: est });
  }
  try { CacheService.getScriptCache().put('porRecoger', JSON.stringify(out), 300); } catch (e) { }
  return out;
}

/* ==================== recolectar ==================== */
/* p.codigos = [ "C-PV-0019", "#16018", {codigo:"VREM-123", origen:"…", destino:"…", contenido:"…"} ] */
function apiRecolectar(p) {
  var s = _exigirSesion(p.token);
  var u = _buscarUsuario(s.Usuario);
  var vehiculo = _fechaTxt(u.FechaVehiculo) === _hoyTxt() ? String(u.VehiculoHoy || '') : '';
  var lista = (p.codigos || []).slice(0, 60);
  var t = _tabla(APPG.H.RECOLECCIONES);
  var abiertos = {};
  t.filas.forEach(function (r) { if (String(r.NumeroGestor) === String(u.Numero) && String(r.Estado) === 'EN RUTA') abiertos[_tnClave(r.Codigo)] = true; });
  var misPedidos = {};
  _tabla(APPG.H.PEDIDOS).filas.forEach(function (f) { if (String(f.NumeroGestor) === String(u.Numero)) misPedidos[_tnClave(f.ID)] = f; });

  var resultados = lista.map(function (x) {
    var o = typeof x === 'object' && x ? x : { codigo: x };
    var codigo = String(o.codigo || '').trim().toUpperCase();
    var k = _tnClave(codigo);
    if (k.length < 3) return { codigo: codigo, ok: false, mensaje: 'Código muy corto. Revísalo.' };
    if (abiertos[k]) return { codigo: codigo, ok: false, repetido: true, mensaje: 'Ya lo habías leído.' };

    var reg = { FechaHora: _ahora(), NumeroGestor: u.Numero, Gestor: u.Nombre, Vehiculo: vehiculo, Codigo: codigo,
                Estado: 'EN RUTA', EstadoFuente: '', Actualizado: _ahora(), Enviado: 'NO' };
    var tn = null;
    try { tn = _tnBuscar(codigo); } catch (e) { _log(u.Nombre, 'TN_LECTURA', e.message); }
    if (tn) {
      if (APPG_TN.TERMINADOS.indexOf(tn.estatus) >= 0) return { codigo: tn.folio, ok: false, mensaje: 'Ese traspaso ya está ' + tn.estatus + ' en el sistema.' };
      if (tn.eliminar) return { codigo: tn.folio, ok: false, mensaje: 'Ese traspaso tiene eliminación solicitada. Pregunta en la sucursal.' };
      reg.Codigo = tn.folio; reg.Tipo = 'TRASPASO'; reg.Origen = tn.origen; reg.Destino = tn.destino; reg.Contenido = tn.contenido; reg.EstadoFuente = tn.estatus;
      reg.DestinoPrefijo = tn.destinoPrefijo;
    } else if (codigo.charAt(0) === '#') {
      var mio = misPedidos[k];
      reg.Tipo = 'PEDIDO'; reg.Origen = o.origen || ''; reg.Destino = mio ? String(mio.Cliente) : (o.destino || '');
      reg.Contenido = mio ? String(mio.Direccion) : (o.contenido || '');
      if (mio) reg.Estado = 'EN RUTA (EN MIS PEDIDOS)';   // ya está en su lista de pedidos: se entrega desde ahí
    } else {
      if (!String(o.destino || '').trim()) return { codigo: codigo, ok: false, pideDestino: true, mensaje: 'No está en el Sistema de Traspasos. Escribe a dónde va.' };
      reg.Tipo = 'OTRO'; reg.Origen = String(o.origen || ''); reg.Destino = String(o.destino); reg.Contenido = String(o.contenido || '');
    }
    _agregar(APPG.H.RECOLECCIONES, reg);
    abiertos[k] = true;
    return { codigo: reg.Codigo, ok: true, tipo: reg.Tipo, origen: reg.Origen, destino: reg.Destino, contenido: reg.Contenido,
             enPedidos: reg.Estado !== 'EN RUTA', direccion: _direccionDe(reg.DestinoPrefijo),
             mensaje: reg.Tipo === 'TRASPASO' ? 'Recolectado · ya se ve en el rastreo en 1 minuto' : 'Recolectado' };
  });
  _log(u.Nombre, 'RECOLECTA', resultados.filter(function (r) { return r.ok; }).map(function (r) { return r.codigo; }).join(', '));
  return { resultados: resultados };
}

/* ==================== problema y documentos ==================== */

function apiProblema(p) {
  var s = _exigirSesion(p.token);
  var num = _problema(String(p.codigo || 'CEL'), s.Nombre, (p.id ? p.id + ' · ' : '') + String(p.detalle || '').slice(0, 800));
  return { numero: num };
}

function apiDocumentos(p) {
  _exigirSesion(p.token);
  return { documentos: _tabla(APPG.H.DOCUMENTOS).filas.filter(function (d) { return _si(d.Activo); })
    .sort(function (a, b) { return (Number(a.Orden) || 99) - (Number(b.Orden) || 99); })
    .map(function (d) { return { categoria: String(d.Categoria), titulo: String(d.Titulo), tipo: String(d.Tipo), contenido: String(d.Contenido) }; }) };
}

/* ==================== utilidades ==================== */

/** Texto para el gestor según el estatus del Sistema de Traspasos. */
function _estadoAmigable(fuente, enviado) {
  var f = String(fuente || '').toUpperCase();
  if (String(enviado) === 'NO') return 'Registrando en el sistema…';
  if (/RECOLECTADO/.test(f)) return 'En camino · ya sale en el rastreo';
  if (/EN_RECEPCION/.test(f)) return 'En recepción';
  if (/NO EXISTE EN OPERACIONES/.test(f)) return 'No está abierto en Operaciones';
  if (/ANOTADO/.test(f)) return 'Recolectado · anotado en Operaciones';
  if (/NO RECOLECTABLE|NO EXISTE/.test(f)) return 'No está en el Sistema de Traspasos';
  if (/ALERTA/.test(f)) return 'Lleva días sin entregarse';
  return f ? f.replace(/_/g, ' ').toLowerCase() : '';
}
function _direccionDe(prefijo) {
  if (!prefijo) return '';
  var id = _tnSucursalDe(prefijo);
  var s = _tabla(APPG.H.SUCURSALES).filas.filter(function (x) { return String(x.ID).toUpperCase() === id; })[0];
  return s ? String(s.Direccion || '') : '';
}

function _exigeFirma(contenido, cfg) {
  var c = _norm(contenido);
  if (!c) return false;
  return _lista(cfg.PALABRAS_EXIGEN_FIRMA).some(function (w) { return w && c.indexOf(_norm(w)) >= 0; });
}

/** Anota un problema numerado P-0001… y devuelve su número. */
function _problema(codigo, quien, detalle) {
  var t = _tabla(APPG.H.PROBLEMAS);
  var max = 0;
  t.filas.forEach(function (f) { var m = /P-(\d+)/.exec(String(f.Numero)); if (m) max = Math.max(max, Number(m[1])); });
  var num = 'P-' + ('000' + (max + 1)).slice(-4);
  _agregar(APPG.H.PROBLEMAS, { Numero: num, FechaHora: _ahora(), Codigo: codigo, Quien: quien || '', Detalle: detalle, Resuelto: false });
  return num;
}

/** Guarda una imagen base64 en Drive. Si la carpeta falla, usa la de respaldo. Devuelve la URL. */
function _guardarImagen(base64, mime, nombre, carpetaId, quien) {
  var datos = String(base64).replace(/^data:[^,]+,/, '');
  if (datos.length > 4 * 1024 * 1024) throw _falla('CAP-04', 'La foto pesa demasiado. Tómala otra vez.');
  var blob = Utilities.newBlob(Utilities.base64Decode(datos), mime, nombre);
  if (carpetaId) {
    try { return DriveApp.getFolderById(_idDrive(carpetaId)).createFile(blob).getUrl(); }
    catch (e) { _problema('DRV-01', quien, 'No pude guardar "' + nombre + '" en la carpeta ' + carpetaId + ': ' + e.message + '. Quedó en la carpeta de respaldo.'); }
  }
  return _carpetaRespaldo().createFile(blob).getUrl();
}

function _carpetaRespaldo() {
  var cfg = _config();
  if (cfg.CARPETA_RESPALDO) { try { return DriveApp.getFolderById(_idDrive(cfg.CARPETA_RESPALDO)); } catch (e) { } }
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CARPETA_RESPALDO_AUTO');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var c = DriveApp.createFolder('App Gestores · Respaldo fotos');
  props.setProperty('CARPETA_RESPALDO_AUTO', c.getId());
  return c;
}

/** Fecha (Date o texto) → 'yyyy-MM-dd' (o el patrón dado). '' si no hay. */
function _fechaTxt(v, patron) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, APPG.ZONA, patron || 'yyyy-MM-dd');
  var s = String(v);
  return patron ? s.slice(0, patron.length) : s.slice(0, 10);
}
function _fechaMs(v) {
  if (!v) return 0;
  if (Object.prototype.toString.call(v) === '[object Date]') return v.getTime();
  var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v));
  if (!m) return 0;
  // Hora de CDMX (UTC-6, sin horario de verano desde 2022)
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 6, +m[5], +(m[6] || 0));
}
