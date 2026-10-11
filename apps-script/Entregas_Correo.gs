// ============================================================
//  ENTREGAS AUTOMÁTICAS DESDE EL CORREO — v1
//
//  Cada 15 minutos revisa tu Gmail. Cuando Skydropx o Mienvio avisan que
//  una guía "fue entregada", busca esa guía en Operaciones (columna M) y:
//    • marca la casilla de Entregado (W)
//    • pone en V la fecha y hora en que llegó ese correo
//    • deja una nota en V: "Registrado desde correo de Skydropx/Mienvio"
//
//  No toca pedidos que ya están entregados ni cancelados, así que puede
//  correr las veces que sea sin duplicar nada.
//
//  Funciones que corres a mano (lista de arriba → Ejecutar):
//    - ENTREGAS_PROBAR            → revisa los últimos 7 días SIN escribir
//                                   nada y te dice qué haría.
//    - ENTREGAS_PONER_AL_CORRIENTE → aplica los últimos 60 días (una vez).
//    - ENTREGAS_ACTIVAR           → lo deja corriendo solo cada 15 min.
//    - ENTREGAS_DESACTIVAR        → lo apaga.
// ============================================================

const ENT = {
  HOJA: "Operaciones",
  FILA_INICIO: 4,
  COL_GUIA: 13,      // M
  COL_RET_CHK: 19,   // S
  COL_CAN_CHK: 21,   // U
  COL_ENT_FECHA: 22, // V
  COL_ENT_CHK: 23,   // W
  FORMATO_FECHA: 'ddd dd mmm yyyy", "hh:mm',
  MINUTOS: 15,
  // Correos que significan "ya se entregó". Si mañana usas otra plataforma,
  // agrega aquí su remitente, asunto y cómo viene escrita la guía.
  FUENTES: [
    { nombre: "Skydropx", busqueda: 'from:noreply@skydropx.com subject:"fue entregado"',
      guia: /n[uú]mero de gu[ií]a\s*:?\s*([A-Z0-9-]{6,})/i },
    { nombre: "Mienvio", busqueda: 'from:hola@mienvio.mx subject:"ha sido entregado"',
      guia: /Gu[ií]a\s*N\s*[°º.o]?\s*:?\s*([A-Z0-9-]{6,})/i },
  ],
};

function ENTREGAS_PROBAR() { entRevisar_(7, true); }
function ENTREGAS_PONER_AL_CORRIENTE() { entRevisar_(60, false); }
function entregasRevisarCorreo() { entRevisar_(3, false); } // lo corre el activador

function ENTREGAS_ACTIVAR() {
  ENTREGAS_DESACTIVAR();
  ScriptApp.newTrigger("entregasRevisarCorreo").timeBased().everyMinutes(ENT.MINUTOS).create();
  Logger.log("✅ Listo: cada " + ENT.MINUTOS + " minutos se revisará tu correo y se marcarán las entregas.");
}
function ENTREGAS_DESACTIVAR() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "entregasRevisarCorreo")
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function entRevisar_(dias, soloProbar) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // ya hay una revisión corriendo
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENT.HOJA);
    const ult = hoja.getLastRow();
    if (ult < ENT.FILA_INICIO) return;

    // 1) Una sola lectura de M..W para saber qué guía está en qué fila.
    const n = ult - ENT.FILA_INICIO + 1;
    const v = hoja.getRange(ENT.FILA_INICIO, ENT.COL_GUIA, n, ENT.COL_ENT_CHK - ENT.COL_GUIA + 1).getValues();
    const col = c => c - ENT.COL_GUIA;
    const filasPorGuia = {};
    v.forEach((r, i) => {
      const g = entLimpiar_(r[col(ENT.COL_GUIA)]);
      if (g.length < 6) return;
      (filasPorGuia[g] = filasPorGuia[g] || []).push(i);
    });

    // 2) Correos de entrega de los últimos días.
    const hechos = [], yaEstaban = [], sinPedido = [];
    const vistas = {};
    ENT.FUENTES.forEach(f => {
      const hilos = GmailApp.search(f.busqueda + " newer_than:" + dias + "d", 0, 300);
      if (!hilos.length) return;
      GmailApp.getMessagesForThreads(hilos).forEach(msgs => msgs.forEach(m => {
        const asunto = m.getSubject();
        if (!/entregado/i.test(asunto) || /se entrega hoy|en camino/i.test(asunto)) return;
        const match = m.getPlainBody().match(f.guia);
        if (!match) return;
        const guia = entLimpiar_(match[1]);
        if (vistas[guia]) return; // la misma guía en dos correos: vale el primero
        vistas[guia] = true;
        const fecha = m.getDate();
        const filas = filasPorGuia[guia];
        if (!filas) { sinPedido.push(guia + " (" + f.nombre + ")"); return; }
        filas.forEach(i => {
          const r = v[i];
          const yaEntregado = r[col(ENT.COL_ENT_CHK)] === true || r[col(ENT.COL_ENT_FECHA)] instanceof Date;
          const cancelado = r[col(ENT.COL_CAN_CHK)] === true;
          const fila = ENT.FILA_INICIO + i;
          if (yaEntregado || cancelado) { yaEstaban.push(guia + " → fila " + fila); return; }
          hechos.push({ fila: fila, guia: guia, fecha: fecha, fuente: f.nombre });
        });
      }));
    });

    // 3) Escribir solo lo nuevo.
    const tz = Session.getScriptTimeZone();
    hechos.forEach(h => {
      if (soloProbar) return;
      hoja.getRange(h.fila, ENT.COL_ENT_FECHA).setNumberFormat(ENT.FORMATO_FECHA).setValue(h.fecha)
        .setNote("Registrado desde correo de " + h.fuente + " · " + Utilities.formatDate(h.fecha, tz, "dd/MM/yyyy HH:mm"));
      hoja.getRange(h.fila, ENT.COL_ENT_CHK).setValue(true);
    });

    Logger.log((soloProbar ? "🔎 PRUEBA (no se escribió nada). " : "✅ ") + "Entregas " + (soloProbar ? "que se marcarían" : "marcadas") + ": " + hechos.length);
    hechos.forEach(h => Logger.log("   • Fila " + h.fila + " · guía " + h.guia + " · " + h.fuente + " · " + Utilities.formatDate(h.fecha, tz, "EEE dd/MM HH:mm")));
    Logger.log("Ya estaban entregadas o canceladas: " + yaEstaban.length);
    if (sinPedido.length) Logger.log("⚠️ Guías entregadas que NO encontré en la columna M (" + sinPedido.length + "): " + sinPedido.join(", "));
  } finally {
    lock.releaseLock();
  }
}

// Quita espacios, saltos de línea y guiones: "3015892120610605 266620" = "3015892120610605266620"
function entLimpiar_(x) {
  return String(x == null ? "" : x).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
