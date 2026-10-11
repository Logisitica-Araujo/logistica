// ============================================================
//  REPORTE LOGÍSTICA — Web App (proyecto SEPARADO)
//
//  Qué hace:
//    1) Publica una página web (el tablero) que lee en vivo las hojas
//       Operaciones, Cat y Datos del archivo "Logística FED 2026".
//       No escribe NADA en ese archivo y no lo hace más lento.
//    2) Cada 10 minutos lee la hoja por su cuenta y la guarda en memoria
//       (caché), así el tablero abre al instante para quien lo consulte.
//    3) El día 1 de cada mes envía el resumen del mes anterior por correo.
//
//  Funciones que corres a mano (lista de arriba → Ejecutar):
//    - TABLERO_PROBAR            → revisa que lee bien tu archivo.
//    - TABLERO_PROBAR_CORREO     → te manda el correo del mes SOLO a ti.
//    - TABLERO_ACTIVAR_AUTOMATICOS → deja programados: la lectura cada
//      10 min (tablero instantáneo) y el correo del día 1 a Miriam.
//    - TABLERO_DESACTIVAR_CORREO_MENSUAL → apaga solo el correo.
// ============================================================

const TAB = {
  ID_ARCHIVO: "1cPHTH2JwM92iD2wSxf4JauYLk9VBLv6T2fHhtxP-kmc", // Logística FED 2026
  HOJA_OPS: "Operaciones",
  HOJA_CAT: "Cat",
  HOJA_DATOS: "Datos",
  OPS_FILA_INICIO: 4,     // datos de Operaciones desde la fila 4
  DATOS_FILA_INICIO: 3,   // datos de Datos desde la fila 3
  ZONA_HORARIA: "America/Mexico_City",

  // Compromisos (horas hábiles: no cuentan sábados, domingos ni festivos de Datos!V)
  SLA_INTERNA_H: 48, // listo para recolectar → entregado
  SLA_IMSS_H: 36,    // solicitud de guía → guía generada
  SLA_PAQ_H: 48,     // listo → sale con guía
  META: 0.95,        // 95 % dentro del tiempo
  META_INC: 5,       // menos de 5 incidencias por cada 100 pedidos

  CORREO_JEFA: "mcamacho@fadermex.com",
  NOMBRE_JEFA: "Miriam Camacho Martinez",
  CACHE_SEG: 1500,      // 25 min; el activador la renueva cada 10 min
};

// Columnas de Operaciones (1 = A). Las que dicen "busca" se localizan por su
// título en las filas 1-3; si no lo encuentra usa la letra indicada.
const TAB_OPS = {
  ID: 1, AREA: 2, SUBAREA: 3, NOMBRE: 4, FECHA: 6, ZONA: 7, METODO: 8, GESTOR: 9, VEHICULO: 10,
  PAQUETERIA: 11, PLATAFORMA: 12, GUIA: 13, COSTO: 14, ETA: 15, ESTATUS: 16,
  RET_FECHA: 18, RET_CHK: 19, CAN_FECHA: 20, CAN_CHK: 21, ENT_FECHA: 22, ENT_CHK: 23,
  ATRASO: 24, DUPLICADO: 25, MOTIVO: 29 /* AC, busca "Motivo" */, SALIDA_AUTO: 31 /* AE */,
};

// Bitácoras en Cat (1 = A). Mismas columnas que usa el script de Operaciones.
const TAB_CAT = {
  FADERMEX: { id: 178 /* FV */, listo: 185 /* GC */, salida: 189 /* GG */ },
  BOTICAN:  { id: 212 /* HD */, listo: 217 /* HI */, salida: 220 /* HL */ },
};

const M_INTERNA = "Logística Interna", M_PAQ = "Paquetería Externa", M_UBER = "UBER", M_REC = "Recolección";

// ============================================================
//  PÁGINA WEB
// ============================================================
function doGet() {
  const t = HtmlService.createTemplateFromFile("Tablero");
  // "Cómo funciona este reporte" solo lo ve el dueño (quien lo publicó).
  const quien = String(Session.getActiveUser().getEmail() || "").toLowerCase();
  t.esDueno = quien !== "" && quien === String(Session.getEffectiveUser().getEmail() || "").toLowerCase();
  return t.evaluate()
    .setTitle("Reporte Logística")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // permite pegarlo en Google Sites después
}

// La página llama a esta función. Regresa texto JSON (más rápido de pasar).
function tableroDatos(forzar) {
  const cache = CacheService.getScriptCache();
  if (!forzar) {
    const guardado = tabCacheLeer_(cache);
    if (guardado) return guardado;
  }
  const json = JSON.stringify(tabLeerTodo_());
  tabCacheGuardar_(cache, json);
  return json;
}

// La caché solo acepta 100 KB por pieza: se parte en trozos.
function tabCacheGuardar_(cache, json) {
  const trozo = 90000, partes = {};
  const n = Math.ceil(json.length / trozo);
  if (n > 90) return; // demasiado grande: se lee directo cada vez
  for (let i = 0; i < n; i++) partes["tab_" + i] = json.substr(i * trozo, trozo);
  partes.tab_n = String(n);
  cache.putAll(partes, TAB.CACHE_SEG);
}
function tabCacheLeer_(cache) {
  const n = +cache.get("tab_n");
  if (!n) return null;
  const claves = [];
  for (let i = 0; i < n; i++) claves.push("tab_" + i);
  const partes = cache.getAll(claves);
  let json = "";
  for (let i = 0; i < n; i++) { if (partes["tab_" + i] == null) return null; json += partes["tab_" + i]; }
  return json;
}

// ============================================================
//  LECTURA
// ============================================================
function tabLeerTodo_() {
  const ss = SpreadsheetApp.openById(TAB.ID_ARCHIVO);
  const ops = ss.getSheetByName(TAB.HOJA_OPS);
  if (!ops) throw new Error('No encontré la hoja "' + TAB.HOJA_OPS + '".');
  const datos = ss.getSheetByName(TAB.HOJA_DATOS);
  const cat = ss.getSheetByName(TAB.HOJA_CAT);

  const festivos = tabFestivos_(datos);
  const listas = tabListas_(datos);
  const catIdx = tabIndiceCat_(cat);
  const ahora = new Date();

  // --- Operaciones: una sola lectura de A hasta la última columna usada ---
  const ultFila = ops.getLastRow();
  const ultCol = Math.max(ops.getLastColumn(), TAB_OPS.SALIDA_AUTO);
  const titulos = ops.getRange(1, 1, 3, ultCol).getDisplayValues();
  const colMotivo = tabBuscarTitulo_(titulos, /motivo/i) || TAB_OPS.MOTIVO;
  const filas = [];
  if (ultFila >= TAB.OPS_FILA_INICIO) {
    const v = ops.getRange(TAB.OPS_FILA_INICIO, 1, ultFila - TAB.OPS_FILA_INICIO + 1, ultCol).getValues();
    for (let i = 0; i < v.length; i++) {
      const f = tabFila_(v[i], colMotivo, catIdx, festivos, ahora);
      if (f) filas.push(f);
    }
  }
  return {
    generado: Utilities.formatDate(ahora, TAB.ZONA_HORARIA, "yyyy-MM-dd'T'HH:mm:ss"),
    hoy: tabDia_(ahora),
    filas: filas,
    listas: listas,
    diasHabiles: tabDiasHabilesPorMes_(festivos, ahora),
    reglas: { int: TAB.SLA_INTERNA_H, imss: TAB.SLA_IMSS_H, paq: TAB.SLA_PAQ_H, meta: TAB.META, metaInc: TAB.META_INC },
  };
}

function tabFila_(r, colMotivo, catIdx, festivos, ahora) {
  const c = n => r[n - 1];
  const t = n => { const x = c(n); return x == null ? "" : String(x).trim(); };
  const real = s => s !== "" && s.toUpperCase() !== "NO APLICA";
  const id = t(TAB_OPS.ID), area = t(TAB_OPS.AREA);
  if (!id && !area) return null;
  const f = tabFecha_(c(TAB_OPS.FECHA));
  if (!f) return null; // sin fecha de registro no se puede ubicar en un mes

  const metodo = t(TAB_OPS.METODO);
  const entFecha = tabFecha_(c(TAB_OPS.ENT_FECHA));
  // Cerrado = entregado, cancelado o retornado. Se toma la casilla, la fecha
  // o el ESTATUS (P): cualquiera de los tres basta.
  const est = t(TAB_OPS.ESTATUS);
  const ent = c(TAB_OPS.ENT_CHK) === true || !!entFecha || (/ENTREGAD/i.test(est) && !/NO ENTREGAD/i.test(est));
  const can = c(TAB_OPS.CAN_CHK) === true || !!tabFecha_(c(TAB_OPS.CAN_FECHA)) || /CANCELAD/i.test(est);
  const ret = c(TAB_OPS.RET_CHK) === true || !!tabFecha_(c(TAB_OPS.RET_FECHA)) || /RETORNAD/i.test(est);
  const motivo = t(colMotivo);
  const costo = Number(c(TAB_OPS.COSTO));
  const salidaAuto = tabFecha_(c(TAB_OPS.SALIDA_AUTO));
  const eta = tabFecha_(c(TAB_OPS.ETA));
  const cat = catIdx[area.toUpperCase() + "|" + tabLimpiarId_(id)] || {};

  // ---- Compromiso (SLA) ----
  let tipo = "", ini = null, fin = null, lim = null;
  if (metodo === M_INTERNA) {
    tipo = "INT"; lim = TAB.SLA_INTERNA_H;
    ini = cat.listo || f;
    fin = entFecha;
  } else if (metodo === M_PAQ && area.toUpperCase() === "IMSS MORELIA") {
    tipo = "IMSS"; lim = TAB.SLA_IMSS_H;
    ini = f;
    fin = salidaAuto || tabSiTieneHora_(eta);
  } else if (metodo === M_PAQ) {
    tipo = "PAQ"; lim = TAB.SLA_PAQ_H;
    ini = cat.listo || f;
    fin = salidaAuto || (cat.salida ? tabFinDeDiaSiSinHora_(cat.salida) : null) || tabSiTieneHora_(eta);
  }
  let hs = null, ok = null, pe = 0;
  if (tipo && !can && ini) {
    if (fin && fin >= ini) { hs = tabHorasHabiles_(ini, fin, festivos); ok = hs <= lim ? 1 : 0; }
    // Paquetería con guía ya capturada (M) = ya salió aunque no sepamos la hora
    // (pedidos de antes de v6.1): no se cuenta como pendiente.
    else if (!fin && !ent && !ret && !(tipo !== "INT" && real(t(TAB_OPS.GUIA)))) { pe = 1; hs = tabHorasHabiles_(ini, ahora, festivos); ok = hs > lim ? 0 : null; }
    else if (!fin && ent && entFecha >= ini) { // salió y se entregó sin hora de salida: se juzga con la entrega
      hs = tabHorasHabiles_(ini, entFecha, festivos); ok = hs <= lim ? 1 : null;
    }
  }

  // ---- Tránsito de la paquetería (días naturales, salida → entrega) ----
  const salida = salidaAuto || cat.salida || null;
  let tr = null;
  if ((tipo === "PAQ" || tipo === "IMSS") && salida && entFecha && entFecha >= salida) tr = (entFecha - salida) / 864e5;

  // ---- ETA prometida (la escribes tú: fecha sin hora) ----
  let etaOk = null;
  if (eta && ent && entFecha && eta.getHours() === 0 && eta.getMinutes() === 0) {
    etaOk = entFecha <= new Date(eta.getFullYear(), eta.getMonth(), eta.getDate(), 23, 59, 59) ? 1 : 0;
  }

  const inc = motivo !== "" || ret ? 1 : 0;
  const dup = t(TAB_OPS.DUPLICADO) !== "" && !/^(no|0|false|-)$/i.test(t(TAB_OPS.DUPLICADO)) ? 1 : 0;
  const base = ini || f;
  return {
    id: id, a: area, sub: t(TAB_OPS.SUBAREA), nom: t(TAB_OPS.NOMBRE), z: t(TAB_OPS.ZONA) || "Sin zona",
    m: metodo || "Sin método", ges: real(t(TAB_OPS.GESTOR)) ? t(TAB_OPS.GESTOR) : "", veh: real(t(TAB_OPS.VEHICULO)) ? t(TAB_OPS.VEHICULO) : "",
    paq: real(t(TAB_OPS.PAQUETERIA)) ? t(TAB_OPS.PAQUETERIA) : "", pla: real(t(TAB_OPS.PLATAFORMA)) ? t(TAB_OPS.PLATAFORMA) : "",
    cos: isFinite(costo) && costo > 0 ? Math.round(costo * 100) / 100 : 0,
    est: est, guia: real(t(TAB_OPS.GUIA)) ? 1 : 0,
    y: f.getFullYear(), mo: f.getMonth(), dw: (f.getDay() + 6) % 7, hr: f.getHours(),
    ent: ent ? 1 : 0, can: can ? 1 : 0, ret: ret ? 1 : 0, mot: motivo || (ret ? "Retorno" : ""), inc: inc, dup: dup,
    at: Number(c(TAB_OPS.ATRASO)) > 0 ? 1 : 0,
    t: tipo, lim: lim, hs: hs == null ? null : Math.round(hs * 10) / 10, ok: ok, pe: pe,
    lsD: (base.getDay() + 6) % 7, lsH: base.getHours(), lsTxt: tabTextoFecha_(base),
    tr: tr == null ? null : Math.round(tr * 10) / 10, eta: etaOk,
    he: ent && entFecha && entFecha >= f ? Math.round(tabHorasHabiles_(f, entFecha, festivos) * 10) / 10 : null,
    dV: entFecha ? tabDia_(entFecha) : (salida ? tabDia_(salida) : ""),
    edad: Math.floor((ahora - f) / 864e5),
  };
}

// Cat: índice "AREA|ID" → { listo, salida } con una lectura por bitácora.
function tabIndiceCat_(cat) {
  const idx = {};
  if (!cat) return idx;
  const ult = cat.getLastRow();
  if (ult < 2) return idx;
  Object.keys(TAB_CAT).forEach(area => {
    const cfg = TAB_CAT[area];
    const desde = Math.min(cfg.id, cfg.listo, cfg.salida), hasta = Math.max(cfg.id, cfg.listo, cfg.salida);
    if (hasta > cat.getMaxColumns()) return;
    const v = cat.getRange(1, desde, ult, hasta - desde + 1).getValues();
    v.forEach(r => {
      const id = tabLimpiarId_(r[cfg.id - desde]);
      if (!id) return;
      idx[area + "|" + id] = { listo: tabFecha_(r[cfg.listo - desde]), salida: tabFecha_(r[cfg.salida - desde]) };
    });
  });
  return idx;
}

function tabListas_(datos) {
  const vacio = { problemas: [], sucursales: [], vehiculos: [], gestores: [] };
  if (!datos) return vacio;
  const ult = datos.getLastRow();
  if (ult < TAB.DATOS_FILA_INICIO) return vacio;
  const col = n => datos.getRange(TAB.DATOS_FILA_INICIO, n, ult - TAB.DATOS_FILA_INICIO + 1, 1).getDisplayValues()
    .map(r => r[0].trim()).filter(String);
  return { gestores: col(1), vehiculos: col(5), problemas: col(28) /* AB */, sucursales: col(50) /* AX */ };
}

// Festivos de Datos!V (fechas). Sábado y domingo siempre son inhábiles.
function tabFestivos_(datos) {
  const set = {};
  if (!datos) return set;
  const ult = datos.getLastRow();
  if (ult < TAB.DATOS_FILA_INICIO) return set;
  datos.getRange(TAB.DATOS_FILA_INICIO, 22, ult - TAB.DATOS_FILA_INICIO + 1, 1).getValues()
    .forEach(r => { const d = tabFecha_(r[0]); if (d) set[tabDia_(d)] = true; });
  return set;
}

function tabEsHabil_(d, festivos) {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !festivos[tabDia_(d)];
}

// Horas entre a y b contando solo días hábiles (24 h por día hábil).
function tabHorasHabiles_(a, b, festivos) {
  if (!a || !b || b <= a) return 0;
  let total = 0, d = new Date(a.getFullYear(), a.getMonth(), a.getDate()), vueltas = 0;
  while (d < b && vueltas++ < 400) {
    const sig = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    if (tabEsHabil_(d, festivos)) {
      const desde = a > d ? a : d, hasta = b < sig ? b : sig;
      if (hasta > desde) total += (hasta - desde) / 36e5;
    }
    d = sig;
  }
  return total;
}

function tabDiasHabilesPorMes_(festivos, ahora) {
  const out = {};
  for (let y = ahora.getFullYear() - 1; y <= ahora.getFullYear(); y++) {
    for (let m = 0; m < 12; m++) {
      let n = 0;
      for (let d = new Date(y, m, 1); d.getMonth() === m && d <= ahora; d = new Date(y, m, d.getDate() + 1)) if (tabEsHabil_(d, festivos)) n++;
      out[y + "-" + m] = n;
    }
  }
  return out;
}

// ---- utilidades ----
function tabFecha_(x) {
  if (x instanceof Date && !isNaN(x)) return x;
  // Fecha que llega como número (p. ej. V con fórmula sin formato de fecha)
  if (typeof x === "number" && x > 40000 && x < 80000) {
    const ms = Math.round((x - 25569) * 864e5), d = new Date(ms);
    return new Date(ms + d.getTimezoneOffset() * 60000);
  }
  return null; // texto que no es fecha real de Sheets se ignora
}
function tabSiTieneHora_(d) { return d && (d.getHours() || d.getMinutes()) ? d : null; }
function tabFinDeDiaSiSinHora_(d) {
  return d.getHours() || d.getMinutes() ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
}
function tabLimpiarId_(x) { return String(x == null ? "" : x).replace(/#/g, "").trim().toUpperCase(); }
function tabDia_(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function tabTextoFecha_(d) {
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return dias[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
}
function tabBuscarTitulo_(titulos, re) {
  for (let f = 0; f < titulos.length; f++) for (let c = 0; c < titulos[f].length; c++) if (re.test(titulos[f][c])) return c + 1;
  return 0;
}

// ============================================================
//  PRUEBA (Ejecutar → mira el "Registro de ejecución" abajo)
// ============================================================
function TABLERO_PROBAR() {
  const t0 = Date.now();
  const d = tabLeerTodo_();
  const conCat = d.filas.filter(f => f.t === "INT" || f.t === "PAQ").length;
  Logger.log("✅ Leí " + d.filas.length + " pedidos de Operaciones en " + ((Date.now() - t0) / 1000).toFixed(1) + " s.");
  Logger.log("   Con compromiso medible: " + d.filas.filter(f => f.ok != null).length + " · Interna/Paquetería: " + conCat);
  Logger.log("   Tipos de problema en Datos: " + d.listas.problemas.length + " · Sucursales: " + d.listas.sucursales.length);
  CacheService.getScriptCache().remove("tab_n");
}

// ============================================================
//  CORREO MENSUAL (día 1, 8 a. m.) — resumen del mes anterior
// ============================================================
function TABLERO_ACTIVAR_AUTOMATICOS() {
  ScriptApp.getProjectTriggers()
    .filter(t => ["tabEnviarCorreoMensual", "tabRefrescarCache"].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("tabRefrescarCache").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("tabEnviarCorreoMensual").timeBased().onMonthDay(1).atHour(8).inTimezone(TAB.ZONA_HORARIA).create();
  tabRefrescarCache();
  Logger.log("✅ Listo: el tablero se precarga cada 10 minutos (abre al instante).");
  Logger.log("✅ Listo: el día 1 de cada mes a las 8 a. m. se enviará el resumen a " + TAB.CORREO_JEFA);
}
function TABLERO_ACTIVAR_CORREO_MENSUAL() { TABLERO_ACTIVAR_AUTOMATICOS(); } // nombre anterior

// Lo corre el activador cada 10 min: lee la hoja y la deja lista en caché.
function tabRefrescarCache() { tableroDatos(true); }
function TABLERO_DESACTIVAR_CORREO_MENSUAL() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "tabEnviarCorreoMensual").forEach(t => ScriptApp.deleteTrigger(t));
}
function TABLERO_PROBAR_CORREO() { tabEnviarCorreo_(Session.getEffectiveUser().getEmail(), true); }
function tabEnviarCorreoMensual() { tabEnviarCorreo_(TAB.CORREO_JEFA, false); }

function tabEnviarCorreo_(para, prueba) {
  const d = tabLeerTodo_();
  const hoy = new Date();
  const ref = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const y = ref.getFullYear(), m = ref.getMonth();
  const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const mesTxt = MES[m] + " " + y;
  const fs = d.filas.filter(f => f.y === y && f.mo === m);
  const ant = d.filas.filter(f => (m === 0 ? f.y === y - 1 && f.mo === 11 : f.y === y && f.mo === m - 1));
  const url = ScriptApp.getService().getUrl() || "";

  const n = fs.length, gasto = fs.reduce((s, f) => s + f.cos, 0), inc = fs.filter(f => f.inc).length;
  const cumple = tipo => { const x = fs.filter(f => (!tipo || f.t === tipo) && f.ok != null); return x.length ? x.filter(f => f.ok).length / x.length : null; };
  const trs = fs.filter(f => f.tr != null), tr = trs.length ? trs.reduce((s, f) => s + f.tr, 0) / trs.length : null;
  const fuera = fs.filter(f => f.ok === 0).sort((a, b) => (b.hs - b.lim) - (a.hs - a.lim));
  const pc = v => v == null ? "—" : (v * 100).toFixed(1) + "%";
  const mx = v => "$" + Math.round(v).toLocaleString("es-MX");
  const delta = (a, b) => !b ? "" : ' <span style="color:#7C8592;font-size:12px">(' + (a >= b ? "▲ " : "▼ ") + Math.abs((a - b) / b * 100).toFixed(0) + "% vs mes anterior)</span>";
  const color = v => v == null ? "#7C8592" : v >= TAB.META ? "#0a8f0a" : v >= TAB.META - 0.05 ? "#9a6500" : "#c23535";

  const contar = (arr, key) => { const o = {}; arr.forEach(f => { const k = key(f); if (k) o[k] = (o[k] || 0) + 1; }); return Object.keys(o).map(k => [k, o[k]]).sort((a, b) => b[1] - a[1]); };
  const barras = (rows, col, fmt) => { const max = rows.length ? rows[0][1] : 1; return rows.slice(0, 6).map(r =>
    '<tr><td style="padding:4px 8px 4px 0;font-size:13px">' + r[0] + '</td><td style="width:60%"><div style="background:' + col + ';height:10px;border-radius:0 3px 3px 0;width:' + Math.max(2, r[1] / max * 100) + '%"></div></td><td style="padding-left:8px;font-size:13px;text-align:right">' + (fmt ? fmt(r[1]) : r[1]) + "</td></tr>").join(""); };
  const kpi = (lbl, val, sub, col) => '<td style="padding:12px;border:1px solid #E3E6EB;border-radius:8px;vertical-align:top;width:33%"><div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#7C8592;font-weight:700">' + lbl + '</div><div style="font-size:24px;font-weight:700;color:' + (col || "#1B2430") + '">' + val + '</div><div style="font-size:12px;color:#4A5462">' + sub + "</div></td>";

  const html = '<div style="font-family:Arial,sans-serif;color:#1B2430;max-width:680px">' +
    (prueba ? '<p style="background:#F3ECDD;padding:8px 12px;border-radius:6px;font-size:12px">PRUEBA — así le llegará a ' + TAB.NOMBRE_JEFA + " el día 1.</p>" : "") +
    '<div style="background:#1B2430;color:#F4F1EA;padding:18px 20px;border-bottom:3px solid #B8975A"><div style="font-size:10px;letter-spacing:.18em;color:#B8975A;font-weight:700">FADERMEX · TODAS LAS ÁREAS</div><div style="font-size:20px;font-weight:700">Reporte Logística · ' + mesTxt + "</div></div>" +
    '<p style="font-size:14px">Hola ' + TAB.NOMBRE_JEFA.split(" ")[0] + ", este es el Reporte Logística de " + mesTxt + ".</p>" +
    '<table style="width:100%;border-spacing:6px"><tr>' +
    kpi("Pedidos", n.toLocaleString("es-MX"), delta(n, ant.length)) +
    kpi("Gasto en envíos", mx(gasto), delta(gasto, ant.reduce((s, f) => s + f.cos, 0))) +
    kpi("Incidencias", inc, (n ? (inc / n * 100).toFixed(1) : "0") + " por cada 100 pedidos", inc / Math.max(1, n) * 100 > TAB.META_INC ? "#c23535" : null) +
    "</tr><tr>" +
    kpi("Logística interna ≤ " + TAB.SLA_INTERNA_H + " h", pc(cumple("INT")), "listo → entregado", color(cumple("INT"))) +
    kpi("Guías IMSS Morelia ≤ " + TAB.SLA_IMSS_H + " h", pc(cumple("IMSS")), "solicitud → guía", color(cumple("IMSS"))) +
    kpi("Paquetería gestión ≤ " + TAB.SLA_PAQ_H + " h", pc(cumple("PAQ")), "listo → sale con guía" + (tr != null ? " · tránsito " + tr.toFixed(1) + " días" : ""), color(cumple("PAQ"))) +
    "</tr></table>" +
    '<h3 style="font-size:14px;margin:18px 0 6px;color:#c23535">Problemas más frecuentes</h3><table style="width:100%;border-collapse:collapse">' + (barras(contar(fs.filter(f => f.inc), f => f.mot), "#C23B33") || '<tr><td style="font-size:13px">Sin incidencias 🎉</td></tr>') + "</table>" +
    '<h3 style="font-size:14px;margin:18px 0 6px">Destinos con más problemas</h3><table style="width:100%;border-collapse:collapse">' + (barras(contar(fs.filter(f => f.inc), f => f.z), "#E66A62") || '<tr><td style="font-size:13px">—</td></tr>') + "</table>" +
    '<h3 style="font-size:14px;margin:18px 0 6px">Gasto por paquetería</h3><table style="width:100%;border-collapse:collapse">' + (barras(tabSumar_(fs, f => f.paq || (f.m === M_UBER ? "UBER" : ""), f => f.cos), "#2a78d6", mx) || '<tr><td style="font-size:13px">—</td></tr>') + "</table>" +
    '<h3 style="font-size:14px;margin:18px 0 6px">Fuera de compromiso (' + fuera.length + ")</h3>" +
    (fuera.length ? '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#7C8592;text-align:left"><th>ID</th><th>Área</th><th>Tipo</th><th>Tardó</th><th>Motivo</th></tr>' +
      fuera.slice(0, 10).map(f => '<tr style="border-top:1px solid #E3E6EB"><td style="padding:4px 0">' + f.id + "</td><td>" + f.a + "</td><td>" + tabNombreTipo_(f.t) + '</td><td style="color:#c23535">' + Math.round(f.hs) + " h / " + f.lim + " h</td><td>" + (f.mot || "—") + "</td></tr>").join("") + "</table>" : '<p style="font-size:13px">Todo dentro de tiempo ✅</p>') +
    (url ? '<p style="margin-top:22px"><a href="' + url + '" style="background:#1B2430;color:#F4F1EA;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:700">Abrir el Reporte Logística completo</a></p>' : "") +
    '<p style="font-size:11px;color:#7C8592;margin-top:20px">Horas hábiles: no cuentan sábados, domingos ni días festivos. Correo automático de Reporte Logística.</p></div>';

  MailApp.sendEmail({ to: para, subject: (prueba ? "[PRUEBA] " : "") + "Reporte Logística · " + mesTxt, htmlBody: html, name: "Reporte Logística" });
  Logger.log("✅ Correo enviado a " + para);
}

function tabSumar_(arr, key, val) {
  const o = {};
  arr.forEach(f => { const k = key(f); if (k) o[k] = (o[k] || 0) + val(f); });
  return Object.keys(o).map(k => [k, o[k]]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
}
function tabNombreTipo_(t) { return t === "INT" ? "Logística interna" : t === "IMSS" ? "Guía IMSS" : t === "PAQ" ? "Paquetería" : ""; }
