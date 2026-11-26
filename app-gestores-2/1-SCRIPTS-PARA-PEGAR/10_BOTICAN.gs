/***********************************************************************
 * APP GESTORES 2 — 10_BOTICAN.gs   (archivo NUEVO en la versión 0.5.0)
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * Reglas de Logística del 7-nov-2026 para la recolección de pedidos BOTICAN.
 *
 * Lee (y solo escribe la columna H, si está vacía y sin fórmula) el archivo
 * "LOGISTICA BOTICAN 2026" (APP_Config → ID_BOTICAN):
 *   · Envios  (datos desde la fila 3): A Estatus · B N° de pedido · E Dirección
 *             · G Pedido listo (Producción) · H Ingreso a logística · J Fecha salida · Q Sucursales
 *   · Feriados (desde la fila 2): A fecha · B motivo
 *   · Rutas    (desde la fila 2): A hora "HH:MM" · B recorrido en orden ("Vértiz · Doctores · Roma · Oficinas")
 *              Opcionales (solo para mostrar), se buscan por su TÍTULO en la fila 1: "Hasta" (HH:MM, ventana) ·
 *              "Ruta" (nombre) · "Realiza" · "Qué lleva".
 *              Las rutas son un AVISO VISUAL: no deciden plazos ni quién puede recoger.
 * Los horarios y feriados NO están en el código: siempre se leen de esas pestañas.
 *
 * PLAZO (igual que el portal):
 *   compromiso = G + 2 días hábiles completos, a la misma hora (3 si G es antes del 9-nov-2026).
 *   No cuentan sábados, domingos ni Feriados. Si G cae en día inhábil, se cuenta desde el
 *   siguiente día hábil a las 9:00. Pedidos que se recogen en sucursal Coapa (visita lun, mié, vie)
 *   o Ecatepec (mar, jue): se cuenta desde el día de visita a las 9:00 (el mismo día solo si G es
 *   antes de las 13:00 y es día de visita).
 * SEMÁFORO: verde en tiempo · amarillo vence hoy o el siguiente día hábil · rojo ya venció ·
 *           gris en elaboración (sin G).
 *
 * El robot lo lee cada minuto y lo deja en memoria (CacheService); el celular lo pide en "inicio".
 * Nada de esto usa el nombre del gestor: todo es por horario y sucursal.
 ***********************************************************************/

var APPG_BOT = {
  FILA_ENVIOS: 3,                 // primera fila con datos en Envios
  ULTIMAS: 600,                   // solo se revisan los últimos N pedidos de Envios (los viejos ya salieron)
  CAMBIO_REGLA: '2026-11-09',     // antes de esta fecha de G: 3 días hábiles; desde aquí: 2
  VISITAS: { COAPA: [1, 3, 5], ECATEPEC: [2, 4] },   // 0 = domingo … 6 = sábado
  CORTE_VISITA_MIN: 13 * 60,      // G antes de las 13:00 el día de visita cuenta ese mismo día
  INICIO_DIA_MIN: 9 * 60,         // 9:00
  MESES: { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 },
  DIAS_TXT: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  MESES_TXT: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
};

/* ==================== Fechas (sin zona: todo en hora de CDMX como "minutos del día") ==================== */
/* Una fecha se maneja como {y, m, d, min} (min = minutos desde las 00:00). Así no hay líos de zona horaria. */

function _btF(y, m, d, min) { return { y: y, m: m, d: d, min: min || 0 }; }
function _btClaveDia(f) { return f.y + '-' + ('0' + f.m).slice(-2) + '-' + ('0' + f.d).slice(-2); }
function _btDow(f) { return new Date(Date.UTC(f.y, f.m - 1, f.d)).getUTCDay(); }
function _btMas1(f) { var x = new Date(Date.UTC(f.y, f.m - 1, f.d + 1)); return _btF(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), f.min); }
function _btComparar(a, b) { var ka = _btClaveDia(a), kb = _btClaveDia(b); return ka < kb ? -1 : ka > kb ? 1 : a.min - b.min; }
function _btTexto(f) {
  var hh = ('0' + Math.floor(f.min / 60)).slice(-2) + ':' + ('0' + f.min % 60).slice(-2);
  return APPG_BOT.DIAS_TXT[_btDow(f)] + ' ' + f.d + ' ' + APPG_BOT.MESES_TXT[f.m - 1] + ', ' + hh;
}
function _btAhora() {
  var s = _ahora('yyyy-MM-dd HH:mm');
  return _btF(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10), +s.slice(11, 13) * 60 + +s.slice(14, 16));
}

/** Lee fechas como vienen en la hoja: Date, "vie, 06 nov26, 14:06", "lun, 09 nov 26, 09:54",
 *  "06/11/2026 16:52:00", "lun 02/11/2026", "2026-11-06 14:06". Devuelve {y,m,d,min} o null. */
function _btLeerFecha(v) {
  if (v === '' || v == null) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    var s = Utilities.formatDate(v, APPG.ZONA, 'yyyy-MM-dd HH:mm');
    return _btF(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10), +s.slice(11, 13) * 60 + +s.slice(14, 16));
  }
  var t = String(v).toLowerCase().trim(), m, hm = /(\d{1,2}):(\d{2})/.exec(t), min = hm ? +hm[1] * 60 + +hm[2] : 0;
  if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) return _btF(+m[1], +m[2], +m[3], min);
  if ((m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t))) return _btF(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1], hm && hm.index > m.index ? min : 0);
  if ((m = /(\d{1,2})\s*(?:de\s+)?([a-zé]{3})[a-zé]*\.?\s*(?:de\s+)?(\d{2,4})?/.exec(t)) && APPG_BOT.MESES[m[2].replace('é', 'e')]) {
    var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +_ahora('yyyy');
    return _btF(y, APPG_BOT.MESES[m[2].replace('é', 'e')], +m[1], min);
  }
  return null;
}

/* ==================== Días hábiles y plazo ==================== */

function _btHabil(f, feriados) { var w = _btDow(f); return w !== 0 && w !== 6 && !feriados[_btClaveDia(f)]; }
function _btSiguienteHabil(f, feriados) { var x = _btMas1(f); while (!_btHabil(x, feriados)) x = _btMas1(x); return x; }

/** ¿Se recoge en sucursal Coapa o Ecatepec? Por la Dirección (E) o la columna Sucursales (Q). '' = Vértiz (Producción). */
function _btSucursalRecoge(direccion, sucursales) {
  var t = _norm(direccion + ' ' + sucursales);
  if (/sucursal\s+coapa|^coapa\b/.test(t)) return 'COAPA';
  if (/sucursal\s+ecatepec|^ecatepec\b/.test(t)) return 'ECATEPEC';
  return '';
}

/** Fecha compromiso de un pedido. g = {y,m,d,min}; suc = '' | 'COAPA' | 'ECATEPEC'. */
function _btCompromiso(g, suc, feriados) {
  var dias = _btClaveDia(g) < APPG_BOT.CAMBIO_REGLA ? 3 : 2, ini, por;
  var visitas = APPG_BOT.VISITAS[suc];
  if (visitas) {
    // El plazo empieza el día de la visita a las 9:00 (hoy solo si es día de visita, hábil y G antes de las 13:00).
    var x = _btF(g.y, g.m, g.d, APPG_BOT.INICIO_DIA_MIN);
    var hoyVale = visitas.indexOf(_btDow(x)) >= 0 && _btHabil(x, feriados) && g.min < APPG_BOT.CORTE_VISITA_MIN;
    if (!hoyVale) { x = _btMas1(x); while (visitas.indexOf(_btDow(x)) < 0 || !_btHabil(x, feriados)) x = _btMas1(x); }
    ini = x; por = 'visita a ' + (suc === 'COAPA' ? 'Coapa' : 'Ecatepec') + ' (' + _btTexto(x) + ')';
  } else if (_btHabil(g, feriados)) {
    ini = g; por = 'listo ' + _btTexto(g);
  } else {
    ini = _btSiguienteHabil(g, feriados); ini.min = APPG_BOT.INICIO_DIA_MIN;
    por = 'listo ' + _btTexto(g) + ' (inhábil) → cuenta desde ' + _btTexto(ini);
  }
  var c = _btF(ini.y, ini.m, ini.d, ini.min);
  for (var i = 0; i < dias; i++) c = _btSiguienteHabil(c, feriados);
  return { fecha: c, dias: dias, explicacion: por + ' · ' + dias + ' días hábiles' };
}

/** verde | amarillo | rojo, según la hora actual. */
function _btSemaforo(comp, ahora, feriados) {
  if (_btComparar(ahora, comp) > 0) return 'rojo';
  var hoy = _btClaveDia(ahora), sig = _btClaveDia(_btSiguienteHabil(ahora, feriados)), dc = _btClaveDia(comp);
  return dc === hoy || dc <= sig ? 'amarillo' : 'verde';
}

/* ==================== Lectura del archivo BOTICAN ==================== */

function _btLibro() {
  var id = _idDrive(_config().ID_BOTICAN);
  if (!id) throw _falla('BOT-01', 'Falta ID_BOTICAN en APP_Config.');
  return SpreadsheetApp.openById(id);
}

/** Lee Envios, Feriados y Rutas. Devuelve datos "crudos" (sin depender de la hora) para guardarlos en memoria. */
function _btLeer() {
  var L = _btLibro();
  var feriados = {};
  var shF = L.getSheetByName('Feriados');
  if (shF && shF.getLastRow() >= 2) shF.getRange(2, 1, shF.getLastRow() - 1, 2).getValues().forEach(function (r) {
    var f = _btLeerFecha(r[0]); if (f) feriados[_btClaveDia(f)] = String(r[1] || 'Feriado');
  });
  var rutas = [];
  var shR = L.getSheetByName('Rutas');
  // A = hora y B = recorrido (fijos). Las columnas opcionales se buscan por su título en la fila 1:
  // "Hasta", "Ruta", "Realiza", "Qué lleva" (en cualquier columna; si no están, no pasa nada).
  var encR = shR ? shR.getRange(1, 1, 1, Math.max(2, shR.getLastColumn())).getDisplayValues()[0].map(function (h) { return _norm(h); }) : [];
  var colR = function (re) { for (var i = 2; i < encR.length; i++) if (re.test(encR[i])) return i; return -1; };
  var cHasta = colR(/^hasta/), cNom = colR(/^ruta$/), cRea = colR(/^realiza/), cLleva = colR(/^que lleva|^notas?$/);
  if (shR && shR.getLastRow() >= 2) shR.getRange(2, 1, shR.getLastRow() - 1, Math.max(2, shR.getLastColumn())).getDisplayValues().forEach(function (fila) {
    var v = function (c) { return c >= 0 ? String(fila[c] || '') : ''; };
    var r = [fila[0], fila[1], v(cHasta), v(cNom), v(cRea), v(cLleva)];
    var horas = String(r[0]).match(/\d{1,2}:\d{2}/g);
    if (!horas) return;
    var hm = function (t) { var x = t.split(':'); return { txt: ('0' + x[0]).slice(-2) + ':' + x[1], min: +x[0] * 60 + +x[1] }; };
    var ini = hm(horas[0]), fin = r[2] && /\d{1,2}:\d{2}/.test(r[2]) ? hm(String(r[2]).match(/\d{1,2}:\d{2}/)[0]) : horas[1] ? hm(horas[1]) : null;
    var rec = String(r[1] || '').trim();
    rutas.push({ hora: ini.txt, min: ini.min, hasta: fin ? fin.txt : '', hastaMin: fin ? fin.min : 0, sucursales: rec,
                 paradas: rec.split(/\s*(?:→|->|·|,)\s*/).filter(String), oficinas: /oficinas/i.test(rec),
                 nombre: String(r[3] || '').trim(), realiza: String(r[4] || '').trim(), lleva: String(r[5] || '').trim() });
  });
  rutas.sort(function (a, b) { return a.min - b.min; });

  var sh = L.getSheetByName('Envios');
  // Envios tiene miles de renglones vacíos con la casilla de la columna I (FALSE): getLastRow() los cuenta.
  // Se busca el último renglón que de verdad tiene N° de pedido (columna B).
  var ult = sh.getLastRow();
  if (ult >= APPG_BOT.FILA_ENVIOS) {
    var colB = sh.getRange(APPG_BOT.FILA_ENVIOS, 2, ult - APPG_BOT.FILA_ENVIOS + 1, 1).getValues();
    var k = colB.length - 1;
    while (k >= 0 && !String(colB[k][0]).trim()) k--;
    ult = APPG_BOT.FILA_ENVIOS + k;
  }
  var desde = Math.max(APPG_BOT.FILA_ENVIOS, ult - APPG_BOT.ULTIMAS + 1);
  var n = ult - desde + 1;
  var vals = n > 0 ? sh.getRange(desde, 1, n, 17).getValues() : [];
  var ids = [], pendientes = [], dirs = {};
  vals.forEach(function (r, i) {
    var id = String(r[1] || '').trim(); if (!id) return;
    ids.push(id);
    dirs[_tnClave(id)] = [String(r[3] || '').slice(0, 80), String(r[4] || '').slice(0, 250)];   // contacto y dirección (para "Entrega a domicilio" SOS)
    var est = String(r[0] || ''), g = _btLeerFecha(r[6]), h = String(r[7] || '').trim(), j = String(r[9] || '').trim();
    if (h.charAt(0) === '=') h = '';                                       // (una fórmula que no da nada cuenta como vacía)
    if (h || j) return;                                                     // ya ingresó a logística o ya salió
    if (/entregad|en ruta|recibido|cancel|retorn|devuel|disponible|en sucursal/i.test(_norm(est))) return;
    if (/\d/.test(String(r[16] || ''))) return;                           // Q "Sucursales" con fecha: ya llegó a la sucursal (el cliente pasa por él)
    pendientes.push({ id: id, fila: desde + i, g: g, estatus: est, suc: _btSucursalRecoge(r[4], r[16]), area: String(r[5] || '') });
  });
  return { feriados: feriados, rutas: rutas, ids: ids, pendientes: pendientes, dirs: dirs, leido: _ahora() };
}

/** Lo que el robot dejó en memoria (o lo lee si no hay). */
function _btDatos(forzar) {
  var c = forzar ? null : _cacheGrandeLeer('botican');
  if (c) return c;
  var d = _btLeer();
  _cacheGrandeGuardar('botican', d, 600);
  return d;
}

/* Memoria en pedazos (CacheService guarda 100 KB por clave). */
function _cacheGrandeLeer(clave) {
  var c = CacheService.getScriptCache();
  try {
    var n = Number(c.get(clave + '_n') || 0); if (!n) return null;
    var ks = []; for (var i = 0; i < n; i++) ks.push(clave + '_' + i);
    var p = c.getAll(ks);
    if (!ks.every(function (k) { return p[k] != null; })) return null;
    return JSON.parse(ks.map(function (k) { return p[k]; }).join(''));
  } catch (e) { return null; }
}
function _cacheGrandeGuardar(clave, datos, seg) {
  try {
    var txt = JSON.stringify(datos), o = {}, i = 0;
    for (var k = 0; k < txt.length; k += 90000) o[clave + '_' + (i++)] = txt.substr(k, 90000);
    var c = CacheService.getScriptCache(); c.putAll(o, seg); c.put(clave + '_n', String(i), seg);
  } catch (e) { }
}

/* ==================== Lo que ve el celular ==================== */

/** { ruta, rutasHoy, porRecolectar, elaboracion } con el semáforo calculado a la hora actual. */
function _btParaInicio(recolectados) {
  var d = _btDatos(false), ahora = _btAhora(), fer = d.feriados;
  var dow = _btDow(ahora), habilHoy = _btHabil(ahora, fer);
  var hoyVisita = [];
  if (APPG_BOT.VISITAS.COAPA.indexOf(dow) >= 0) hoyVisita.push('COAPA');
  if (APPG_BOT.VISITAS.ECATEPEC.indexOf(dow) >= 0) hoyVisita.push('ECATEPEC');

  // Ruta del momento: la que está pasando (hasta 15 min después de su hora o de su ventana) o la siguiente.
  var finDe = function (r) { return (r.hastaMin || r.min) + 15; };
  var ruta = null;
  if (habilHoy) d.rutas.forEach(function (r) { if (!ruta && finDe(r) >= ahora.min) ruta = r; });
  var extra = !habilHoy ? '' : hoyVisita.map(function (s) {
    return s === 'COAPA' ? 'Coapa' + (ahora.min >= APPG_BOT.CORTE_VISITA_MIN ? ' (antes de las 13:00 · ya pasó hoy)' : ' (antes de las 13:00)') : 'Ecatepec';
  }).join(' y ');
  var porRecolectar = [], elaboracion = [];
  d.pendientes.forEach(function (p) {
    if (recolectados[_tnClave(p.id)]) return;                         // ya lo recogió alguien (la H llega después)
    if (!p.g) { if (/elabora/i.test(_norm(p.estatus)) || !p.estatus) elaboracion.push({ id: p.id, suc: p.suc }); return; }
    var c = _btCompromiso(p.g, p.suc, fer);
    porRecolectar.push({ id: p.id, area: p.area, suc: p.suc, sucTxt: p.suc === 'COAPA' ? 'Coapa · lun/mié/vie' : p.suc === 'ECATEPEC' ? 'Ecatepec · mar/jue' : 'Vértiz',
      listo: _btTexto(p.g), vence: _btTexto(c.fecha), venceKey: _btClaveDia(c.fecha) + ' ' + ('000' + c.fecha.min).slice(-4),
      semaforo: _btSemaforo(c.fecha, ahora, fer), explicacion: c.explicacion,
      enRuta: !p.suc || hoyVisita.indexOf(p.suc) >= 0 });
  });
  porRecolectar.sort(function (a, b) { return a.venceKey < b.venceKey ? -1 : a.venceKey > b.venceKey ? 1 : 0; });
  var proxFeriado = Object.keys(fer).sort().filter(function (k) { return k >= _btClaveDia(ahora); })[0];
  return {
    ruta: ruta ? { hora: ruta.hora, hasta: ruta.hasta || '', nombre: ruta.nombre || '', sucursales: ruta.sucursales, paradas: ruta.paradas || [], oficinas: !!ruta.oficinas,
                   realiza: ruta.realiza || '', lleva: ruta.lleva || '', extra: extra, enMin: ruta.min - ahora.min, enCurso: ahora.min >= ruta.min,
                   nota: dow === 5 && ruta.min >= 16 * 60 ? 'Viernes: lo que se recoja en esta ruta sale el lunes' : '' } : null,
    habilHoy: habilHoy, feriadoHoy: fer[_btClaveDia(ahora)] || '',
    rutasHoy: d.rutas.map(function (r) {
      return { hora: r.hora, hasta: r.hasta || '', nombre: r.nombre || '', sucursales: r.sucursales, paradas: r.paradas || [], oficinas: !!r.oficinas, realiza: r.realiza || '', lleva: r.lleva || '',
               paso: habilHoy && finDe(r) < ahora.min, actual: !!ruta && ruta.hora === r.hora, notaViernes: dow === 5 && r.min >= 16 * 60 };
    }),
    visitas: { coapa: hoyVisita.indexOf('COAPA') >= 0, ecatepec: hoyVisita.indexOf('ECATEPEC') >= 0, dow: dow },
    porRecolectar: porRecolectar, elaboracion: elaboracion.slice(-15),
    proxFeriado: proxFeriado ? _btTexto(_btF(+proxFeriado.slice(0, 4), +proxFeriado.slice(5, 7), +proxFeriado.slice(8, 10), 0)).slice(0, -7) + ' · ' + fer[proxFeriado] : '',
    leido: d.leido
  };
}

/** ¿Existe el pedido en Envios (BOTICAN)? Usa la lista en memoria. */
function _btExiste(codigo) {
  try { var k = _tnClave(codigo); return _btDatos(false).ids.some(function (x) { return _tnClave(x) === k; }); }
  catch (e) { return null; }       // no se pudo leer: no se bloquea a nadie
}
/** Un número parecido (un dígito distinto o dos cambiados de lugar) entre Envios y los pedidos de la app. */
function _btParecido(codigo) {
  var k = _tnClave(codigo), mejor = '';
  var cand = [];
  try { cand = _btDatos(false).ids.slice(-400); } catch (e) { }
  _tabla(APPG.H.PEDIDOS).filas.forEach(function (f) { cand.push(String(f.ID)); });
  cand.some(function (id) {
    var c = _tnClave(id);
    if (c.length !== k.length || c === k) return false;
    var dif = []; for (var i = 0; i < c.length; i++) if (c[i] !== k[i]) dif.push(i);
    if (dif.length === 1 || (dif.length === 2 && dif[1] === dif[0] + 1 && c[dif[0]] === k[dif[1]] && c[dif[1]] === k[dif[0]])) { mejor = id; return true; }
    return false;
  });
  return mejor;
}

/** Columna H de Envios: se escribe la hora de recolección SOLO si está vacía y sin fórmula. */
/* ---------- Evidencia de la app en Envios (columnas al final, por su TÍTULO en el renglón 2) ----------
   AD App · Recolectó (fecha y hora)       AE App · Recolectó (gestor)
   AF App · Entregó en sucursal (fecha y hora)   AG App · Sucursal (recibió)
   AH App · Gestor que entregó en sucursal       AI App · Foto entrega en sucursal
   El Estatus (columna A) muestra "🏪 GESTOR ENTREGÓ A SUCURSAL" cuando AF tiene fecha. Nunca se pisa algo ya escrito. */
var APPG_BOT_COL = { REC_FECHA: 'App · Recolectó (fecha y hora)', REC_GESTOR: 'App · Recolectó (gestor)',
  SUC_FECHA: 'App · Entregó en sucursal (fecha y hora)', SUC_DONDE: 'App · Sucursal (recibió)', SUC_GESTOR: 'App · Gestor que entregó en sucursal', SUC_FOTO: 'App · Foto entrega en sucursal' };
function _btColumnas(sh) {
  var enc = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).replace(/\s+/g, ' ').trim(); }), out = {};
  Object.keys(APPG_BOT_COL).forEach(function (k) { var i = enc.indexOf(APPG_BOT_COL[k]); out[k] = i >= 0 ? i + 1 : 0; });
  return out;
}
/** Renglón de un pedido en Envios (busca en los últimos ULTIMAS por la columna B). 0 si no está. */
function _btFila(sh, codigo) {
  var k = _tnClave(codigo), ult = sh.getLastRow(); if (ult < APPG_BOT.FILA_ENVIOS) return 0;
  var desde = Math.max(APPG_BOT.FILA_ENVIOS, ult - 4000), b = sh.getRange(desde, 2, ult - desde + 1, 1).getValues();
  for (var i = b.length - 1; i >= 0; i--) if (_tnClave(b[i][0]) === k) return desde + i;
  return 0;
}
function _btFechaTxt(fechaHora) {
  var f = _btLeerFecha(fechaHora); if (!f) return _ahora('dd/MM/yyyy HH:mm:ss');
  return ('0' + f.d).slice(-2) + '/' + ('0' + f.m).slice(-2) + '/' + f.y + ' ' + ('0' + Math.floor(f.min / 60)).slice(-2) + ':' + ('0' + f.min % 60).slice(-2) + ':00';
}
function _btPoner(sh, fila, col, valor) {   // solo si está vacía y sin fórmula
  if (!col) return false;
  var c = sh.getRange(fila, col);
  if (c.getFormula() || String(c.getValue()).trim()) return false;
  c.setValue(valor); return true;
}

/** Al registrar la recolección de un pedido BOTICAN: H (si está vacía) + AD/AE (evidencia de la app). */
function _btEscribirH(codigo, fechaHora, gestor) {
  if (!_si(_config().BOT_ESCRIBIR_H)) return 'apagado';
  var sh = _btLibro().getSheetByName('Envios');
  var fila = _btFila(sh, codigo);
  if (!fila) return 'no está en Envios';
  var col = _btColumnas(sh), txt = _btFechaTxt(fechaHora);
  _btPoner(sh, fila, col.REC_FECHA, txt);
  if (gestor) _btPoner(sh, fila, col.REC_GESTOR, String(gestor));
  return _btPoner(sh, fila, 8, txt) ? 'escrita' : 'ya tenía H';
}

/** Robot: lo que el gestor dejó en una sucursal ("Lo dejé en sucursal") de pedidos BOTICAN que van a sucursal → AF–AI. */
function _robotBotSucursal() {
  var t = _tabla(APPG.H.CIERRES), hace = Date.now() - 3 * 86400000;
  var pend = t.filas.filter(function (c) {
    return String(c.Tipo) === 'RECOLECCION' && String(c.Resultado) === 'ENTREGADO' && String(c.Estado) === 'LOCAL' && String(c.DondeEntrego || '').trim() &&
           !String(c.EnviadoEn || '').trim() && _fechaMs(c.FechaHora) > hace;
  });
  var sh = _btLibro().getSheetByName('Envios'), col = _btColumnas(sh), n = 0;
  if (!col.SUC_FECHA) return 'faltan las columnas App · … en Envios';
  pend.forEach(function (c) {
    var marca = 'NO APLICA', fila = _btFila(sh, c.ID);
    if (fila && /^\s*sucursal/i.test(String(sh.getRange(fila, 5).getValue()))) {
      _btPoner(sh, fila, col.SUC_FECHA, _btFechaTxt(_horaReal(c).replace('T', ' ')));
      _btPoner(sh, fila, col.SUC_DONDE, String(c.DondeEntrego) + (String(c.Recibio || '').trim() ? ' · recibió ' + String(c.Recibio).trim() : ''));
      _btPoner(sh, fila, col.SUC_GESTOR, String(c.Gestor));
      if (String(c.URLFoto || '')) _btPoner(sh, fila, col.SUC_FOTO, String(c.URLFoto));
      marca = _ahora();
      _log('robot', 'BOT_SUCURSAL', c.ID + ' · ' + c.DondeEntrego + ' · ' + c.Gestor);
      n++;
    }
    t.sh.getRange(c._fila, t.col('EnviadoEn')).setValue(marca);
  });
  return n + _botSucursalRuta(t, sh, col, hace);
}
/** Pedido BOTICAN que va a sucursal y se lo asignaste en su ruta: al marcarlo "Entregado" también queda
    "Gestor entregó a sucursal" (AF–AI). Se anota cada cierre una sola vez (propiedad BOT_SUC_PED). */
function _botSucursalRuta(t, sh, col, hace) {
  var dirs = ((_hay('_btDatos') ? _btDatos() : null) || {}).dirs || {};
  var props = PropertiesService.getScriptProperties(), hechos = [];
  try { hechos = JSON.parse(props.getProperty('BOT_SUC_PED') || '[]'); } catch (e) { hechos = []; }
  var peds = t.filas.filter(function (c) {
    var d = dirs[_tnClave(c.ID)];
    return String(c.Tipo) === 'PEDIDO' && String(c.Resultado) === 'ENTREGADO' && !/ANULADO|CORREGIDO/.test(String(c.Estado)) &&
           _fechaMs(c.FechaHora) > hace && hechos.indexOf(String(c.IdCierre)) < 0 && d && /^\s*sucursal/i.test(d[1]);
  });
  var n = 0;
  peds.forEach(function (c) {
    var fila = _btFila(sh, c.ID);
    if (fila && /^\s*sucursal/i.test(String(sh.getRange(fila, 5).getValue()))) {
      var suc = String(c.DondeEntrego || '').trim() || String(sh.getRange(fila, 5).getValue()).replace(/^\s*sucursal\s*/i, '').split(/[,\n]/)[0].trim();
      _btPoner(sh, fila, col.SUC_FECHA, _btFechaTxt(_horaReal(c).replace('T', ' ')));
      _btPoner(sh, fila, col.SUC_DONDE, suc + (String(c.Recibio || '').trim() ? ' · recibió ' + String(c.Recibio).trim() : ''));
      _btPoner(sh, fila, col.SUC_GESTOR, String(c.Gestor));
      if (String(c.URLFoto || '')) _btPoner(sh, fila, col.SUC_FOTO, String(c.URLFoto));
      _log('robot', 'BOT_SUCURSAL_RUTA', c.ID + ' · ' + suc + ' · ' + c.Gestor);
      n++;
    }
    hechos.push(String(c.IdCierre));
  });
  if (peds.length) props.setProperty('BOT_SUC_PED', JSON.stringify(hechos.slice(-400)));
  return n;
}

/** Paso del robot: refresca la memoria de BOTICAN. */
function _robotBotican() {
  var d = _btLeer();
  _cacheGrandeGuardar('botican', d, 600);
  return d.pendientes.length;
}

/* ==================== Prueba desde el editor ==================== */
function PROBAR_BOTICAN() {
  var d = _btLeer();
  var r = _btParaInicio({});
  Logger.log('Feriados: ' + Object.keys(d.feriados).join(', '));
  Logger.log('Rutas: ' + d.rutas.map(function (x) { return (x.nombre ? x.nombre + ' ' : '') + x.hora + (x.hasta ? '–' + x.hasta : '') + ' ' + x.sucursales + (x.realiza ? ' (' + x.realiza + ')' : ''); }).join(' | '));
  Logger.log('Ruta del momento: ' + JSON.stringify(r.ruta));
  r.porRecolectar.forEach(function (p) { Logger.log(p.semaforo.toUpperCase() + ' ' + p.id + ' · Vence: ' + p.vence + ' · ' + p.explicacion); });
  Logger.log('En elaboración: ' + r.elaboracion.map(function (x) { return x.id; }).join(', '));
  return r;
}
