// =========================================================================
// DISEÑO VISUAL — pestaña "Busqueda por Sucursal" (Bitácora PV 2026)
//
// Archivo independiente: pégalo como un ARCHIVO NUEVO (por ejemplo
// "DisenoSucursales.gs") en el mismo proyecto. Todo vive en SUCURSALES_UI
// y en funciones que empiezan con "suc", así que no choca con Diseno.gs ni
// con las notificaciones.
//
// Funciones para ejecutar a mano desde el editor:
//   aplicarDisenoSucursales()   → aplica el diseño (se puede correr varias veces)
//   revertirDisenoSucursales()  → regresa formato y textos al respaldo
//
// Qué hace aplicarDisenoSucursales():
//   1. Respaldo: la primera vez duplica la pestaña y la oculta.
//   2. Encuentra solo las cajas de cada sucursal (busca "N° De ticket").
//   3. Quita el bloque de paqueterías (logos y ligas fuera de las cajas).
//   4. Formato: fondo blanco, franja de color por sucursal, encabezado gris,
//      separadores finos, estatus en tono pastel (igual que Envios),
//      "SIN PEDIDOS POR ENVIAR" en verde y ETA vencida en rojo.
//   5. Agregados: resumen en la fila 1 y contador en el título de cada caja.
//
// Nunca escribe en las celdas de datos de las cajas, donde están las
// fórmulas que traen los pedidos.
// =========================================================================

const SUCURSALES_UI = {
  HOJA: 'Busqueda por Sucursal',
  HOJA_RESPALDO: 'Busqueda por Sucursal (respaldo diseño)',

  ENCABEZADO_TICKET: /^n\s*[°º]?\s*de\s*ticket/i, // así se reconoce cada caja
  FILAS_POR_CAJA: 11,                             // solo si no se puede calcular

  QUITAR_PAQUETERIAS: true,
  RESUMEN_FILA_1: true,
  CONTADOR_EN_TITULO: true,

  FUENTE: 'Inter',
  COLOR: {
    fondo: '#FFFFFF',
    texto: '#202124',
    texto2: '#5F6368',
    linea: '#F1F3F4',
    lineaEncabezado: '#E0E3E7',
    encabezado: '#F8F9FA',
    verde: '#137333',
    verdeSuave: '#E6F4EA',
    rojo: '#B3261E'
  },
  // Si el encabezado de una caja no tiene color, se usa uno de estos en orden.
  ACENTOS_RESPALDO: ['#B0466C', '#5E4BA6', '#2F6DB5', '#2E7D3E', '#A87B00'],

  // Misma paleta que Envios. Orden = prioridad.
  ESTATUS: [
    { contiene: 'CANCELADO',               fondo: '#FDECEC', color: '#B42318' },
    { contiene: 'RETORNADO',               fondo: '#FEF0DD', color: '#B54708' },
    { contiene: 'EXISTE UN PROBLEMA',      fondo: '#FCE4E2', color: '#A50E0E' },
    { contiene: 'paquetería y Notificado', fondo: '#DCE8FD', color: '#1442A8' },
    { contiene: 'En ruta por paquetería',  fondo: '#ECF2FE', color: '#1A56DB' },
    { contiene: 'gestoría + Notificado',   fondo: '#E9E1FD', color: '#5121A8' },
    { contiene: 'En ruta por gestoría',    fondo: '#F3EFFE', color: '#6D28D9' },
    { contiene: 'Gestor recolectó',        fondo: '#F5EEE4', color: '#7C5023' },
    { contiene: 'Sucursal entregó',        fondo: '#FBEDF4', color: '#A23B72' },
    { igual: 'Entregado',                  fondo: '#E6F4EA', color: '#137333' },
    { igual: 'Recibido en logística',      fondo: '#E3F4F6', color: '#0E6B80' },
    { igual: 'Elaborado',                  fondo: '#EEF0F2', color: '#3C4043' },
    { igual: 'En elaboración',             fondo: '#F6F7F8', color: '#80868B' }
  ]
};


function aplicarDisenoSucursales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(SUCURSALES_UI.HOJA);
  if (!hoja) throw new Error('No encontré la pestaña "' + SUCURSALES_UI.HOJA + '".');

  sucRespaldar_(ss, hoja);

  const cajas = sucCajas_(hoja);
  if (cajas.length === 0) throw new Error('No encontré ninguna caja con el encabezado "N° De ticket".');
  Logger.log('📦 Cajas encontradas: ' + cajas.map(function (c) { return c.nombre + ' (' + c.a1 + ')'; }).join(', '));

  // El color de cada sucursal se toma de su encabezado actual antes de limpiar.
  cajas.forEach(function (c, i) { c.acento = sucAcento_(hoja, c, i); });

  const ultimaCol = Math.max.apply(null, cajas.map(function (c) { return c.col + c.ancho - 1; }));
  const ultimaFila = Math.max.apply(null, cajas.map(function (c) { return c.filaDatos + c.alto - 1; }));

  if (SUCURSALES_UI.QUITAR_PAQUETERIAS) sucQuitarPaqueterias_(hoja, cajas, ultimaFila, ultimaCol);
  sucLimpiar_(hoja, ultimaCol);

  let reglas = [];
  cajas.forEach(function (c) { reglas = reglas.concat(sucFormatearCaja_(hoja, c)); });
  hoja.setConditionalFormatRules(reglas);

  if (SUCURSALES_UI.RESUMEN_FILA_1) sucResumen_(hoja, cajas, ultimaCol);
  if (SUCURSALES_UI.CONTADOR_EN_TITULO) sucContadores_(hoja, cajas);

  SpreadsheetApp.flush();
  Logger.log('✅ Diseño aplicado a "' + SUCURSALES_UI.HOJA + '".');
  ss.toast('Diseño aplicado a ' + cajas.length + ' sucursales.', 'Búsqueda por Sucursal', 6);
}


function revertirDisenoSucursales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(SUCURSALES_UI.HOJA);
  const respaldo = ss.getSheetByName(SUCURSALES_UI.HOJA_RESPALDO);
  if (!hoja) throw new Error('No encontré la pestaña "' + SUCURSALES_UI.HOJA + '".');
  if (!respaldo) throw new Error('No existe "' + SUCURSALES_UI.HOJA_RESPALDO + '"; no hay de dónde restaurar.');

  const filas = Math.min(hoja.getMaxRows(), respaldo.getMaxRows());
  const cols = Math.min(hoja.getMaxColumns(), respaldo.getMaxColumns());
  const cajas = sucCajas_(respaldo);

  // 1. Formato completo desde el respaldo.
  hoja.getBandings().forEach(function (b) { b.remove(); });
  hoja.setConditionalFormatRules([]);
  respaldo.getRange(1, 1, filas, cols)
    .copyTo(hoja.getRange(1, 1, filas, cols), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  respaldo.getBandings().forEach(function (b) { b.copyTo(hoja.getRange(b.getRange().getA1Notation())); });
  hoja.setHiddenGridlines(respaldo.hasHiddenGridlines());

  // 2. Contenido solo fuera de los datos de las cajas (títulos, fila 1, ligas),
  //    celda por celda, para no pisar las fórmulas que traen los pedidos.
  const fNueva = hoja.getRange(1, 1, filas, cols).getFormulas();
  const vNueva = hoja.getRange(1, 1, filas, cols).getDisplayValues();
  const fResp = respaldo.getRange(1, 1, filas, cols).getFormulas();
  const vResp = respaldo.getRange(1, 1, filas, cols).getDisplayValues();
  let restauradas = 0;
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < cols; c++) {
      if (sucEnDatos_(cajas, r + 1, c + 1)) continue;
      if (fNueva[r][c] === fResp[r][c] && vNueva[r][c] === vResp[r][c]) continue;
      respaldo.getRange(r + 1, c + 1).copyTo(hoja.getRange(r + 1, c + 1));
      restauradas++;
    }
  }

  SpreadsheetApp.flush();
  Logger.log('↩️ Formato restaurado y ' + restauradas + ' celdas de texto devueltas. ' +
             'Los logos de paqueterías no se pueden copiar por script: si los quieres de vuelta, ' +
             'cópialos a mano desde "' + SUCURSALES_UI.HOJA_RESPALDO + '".');
  ss.toast('Formato original restaurado.', 'Búsqueda por Sucursal', 6);
}


// ---------- pasos ----------

function sucRespaldar_(ss, hoja) {
  if (ss.getSheetByName(SUCURSALES_UI.HOJA_RESPALDO)) {
    Logger.log('ℹ️ El respaldo ya existe; no se vuelve a crear.');
    return;
  }
  const copia = hoja.copyTo(ss);
  copia.setName(SUCURSALES_UI.HOJA_RESPALDO);
  copia.hideSheet();
  Logger.log('🗂️ Respaldo creado: "' + SUCURSALES_UI.HOJA_RESPALDO + '" (oculta).');
}


// Busca cada celda "N° De ticket" y arma la caja: título arriba, encabezado,
// y N filas de datos. N sale de la distancia entre cajas apiladas.
function sucCajas_(hoja) {
  const vals = hoja.getDataRange().getDisplayValues();
  const enc = [];
  vals.forEach(function (fila, r) {
    fila.forEach(function (v, c) {
      if (SUCURSALES_UI.ENCABEZADO_TICKET.test(String(v).trim())) enc.push({ filaEnc: r + 1, col: c + 1 });
    });
  });

  enc.forEach(function (e) {
    const fila = vals[e.filaEnc - 1];
    let w = 0;
    while (e.col - 1 + w < fila.length && String(fila[e.col - 1 + w]).trim() !== '') w++;
    e.ancho = w;
    e.titulos = fila.slice(e.col - 1, e.col - 1 + w).map(function (s) {
      return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
    });
    const abajo = enc.filter(function (o) { return o.col === e.col && o.filaEnc > e.filaEnc; })
                     .sort(function (a, b) { return a.filaEnc - b.filaEnc; })[0];
    e.alto = abajo ? abajo.filaEnc - e.filaEnc - 3 : 0; // datos + fila vacía + título de la siguiente
  });

  const conocidos = enc.map(function (e) { return e.alto; }).filter(function (a) { return a > 0; });
  const altoDefecto = conocidos.length ? Math.max.apply(null, conocidos) : SUCURSALES_UI.FILAS_POR_CAJA;

  return enc.map(function (e) {
    const alto = Math.min(e.alto > 0 ? e.alto : altoDefecto, hoja.getMaxRows() - e.filaEnc);
    const filaTitulo = e.filaEnc - 1;
    const nombre = filaTitulo >= 1 ? String(vals[filaTitulo - 1][e.col - 1]).trim() : '';
    const colDe = function (prueba) {
      const i = e.titulos.findIndex(prueba);
      return i === -1 ? null : e.col + i;
    };
    return {
      nombre: nombre || ('Caja ' + hoja.getRange(e.filaEnc, e.col).getA1Notation()),
      a1: hoja.getRange(filaTitulo >= 1 ? filaTitulo : e.filaEnc, e.col).getA1Notation(),
      filaTitulo: filaTitulo, filaEnc: e.filaEnc, filaDatos: e.filaEnc + 1,
      col: e.col, ancho: e.ancho, alto: alto,
      colId: e.col,
      colEstatus: colDe(function (t) { return t.indexOf('estatus') !== -1; }),
      colCliente: colDe(function (t) { return t.indexOf('cliente') !== -1; }),
      colSalida:  colDe(function (t) { return t.indexOf('salida') !== -1; }),
      colTipo:    colDe(function (t) { return t.indexOf('tipo') !== -1; }),
      colEta:     colDe(function (t) { return t === 'eta'; }),
      colEntrega: colDe(function (t) { return t.indexOf('entrega') !== -1; })
    };
  });
}


function sucAcento_(hoja, caja, i) {
  const bg = hoja.getRange(caja.filaEnc, caja.col).getBackground();
  if (!bg || /^#?f{6}$/i.test(bg.replace('#', '')) || bg === 'white') {
    return SUCURSALES_UI.ACENTOS_RESPALDO[i % SUCURSALES_UI.ACENTOS_RESPALDO.length];
  }
  return sucOscurecer_(bg, 0.3);
}


// Quita lo que está fuera de las cajas dentro de su área: logos (imágenes
// flotantes o IMAGE()) y ligas. Nunca borra otras fórmulas.
function sucQuitarPaqueterias_(hoja, cajas, ultimaFila, ultimaCol) {
  let imagenes = 0;
  hoja.getImages().forEach(function (img) {
    const a = img.getAnchorCell();
    if (a.getRow() >= 2 && a.getRow() <= ultimaFila + 5 &&a.getColumn() <= ultimaCol && !sucEnCaja_(cajas, a.getRow(), a.getColumn())) {
      img.remove();
      imagenes++;
    }
  });

  const filas = Math.min(ultimaFila + 5, hoja.getMaxRows()) - 1;
  if (filas < 1) return;
  const rango = hoja.getRange(2, 1, filas, ultimaCol);
  const valores = rango.getDisplayValues();
  const formulas = rango.getFormulas();
  const borradas = [];
  for (let r = 0; r < valores.length; r++) {
    for (let c = 0; c < valores[r].length; c++) {
      const fila = r + 2, col = c + 1;
      if (sucEnCaja_(cajas, fila, col)) continue;
      const f = formulas[r][c];
      if (valores[r][c] === '' && f === '') continue;
      if (f !== '' && !/HYPERLINK|IMAGE/i.test(f)) continue;
      hoja.getRange(fila, col).clearContent();
      borradas.push(hoja.getRange(fila, col).getA1Notation() + '="' + valores[r][c] + '"');
    }
  }
  Logger.log('🧹 Paqueterías: ' + imagenes + ' logos y ' + borradas.length + ' celdas quitadas' +
             (borradas.length ? ' → ' + borradas.join(', ') : '') + '.');
}


function sucLimpiar_(hoja, ultimaCol) {
  hoja.setHiddenGridlines(true);
  hoja.getBandings().forEach(function (b) { b.remove(); });
  const n = hoja.getConditionalFormatRules().length;
  hoja.setConditionalFormatRules([]);
  Logger.log('🧹 Reglas de formato retiradas: ' + n + '.');

  hoja.getRange(1, 1, hoja.getMaxRows(), ultimaCol)
    .setBorder(false, false, false, false, false, false)
    .setBackground(SUCURSALES_UI.COLOR.fondo)
    .setFontFamily(SUCURSALES_UI.FUENTE);
}


function sucFormatearCaja_(hoja, c) {
  const C = SUCURSALES_UI.COLOR;
  const B = SpreadsheetApp.BorderStyle;
  const reglas = [];
  const col = function (n) { return hoja.getRange(c.filaDatos, n, c.alto, 1); };
  const letra = function (n) { return sucLetra_(n); };

  // Título: texto del color de la sucursal y franja de 3 px arriba.
  if (c.filaTitulo >= 1) {
    hoja.getRange(c.filaTitulo, c.col, 1, c.ancho)
      .setFontSize(11).setFontWeight('bold').setFontColor(c.acento)
      .setHorizontalAlignment('left').setVerticalAlignment('middle')
      .setBorder(true, null, null, null, null, null, c.acento, B.SOLID_THICK);
    hoja.setRowHeight(c.filaTitulo, 30);
  }

  // Encabezado.
  hoja.getRange(c.filaEnc, c.col, 1, c.ancho)
    .setBackground(C.encabezado).setFontSize(8).setFontWeight('bold').setFontColor(C.texto2)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(null, null, true, null, null, null, C.lineaEncabezado, B.SOLID);

  // Datos: solo formato, nunca contenido.
  hoja.getRange(c.filaDatos, c.col, c.alto, c.ancho)
    .setFontSize(9).setFontWeight('normal').setFontColor(C.texto)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(null, null, true, null, null, true, C.linea, B.SOLID);
  col(c.colId).setFontWeight('bold').setHorizontalAlignment('left');
  if (c.colCliente) col(c.colCliente).setHorizontalAlignment('left').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  if (c.colSalida) col(c.colSalida).setFontColor(C.texto2);
  if (c.colTipo) col(c.colTipo).setFontColor(C.texto2);

  // Estatus en tono pastel.
  if (c.colEstatus) {
    const r = col(c.colEstatus);
    r.setFontWeight('bold').setFontSize(8).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    SUCURSALES_UI.ESTATUS.forEach(function (e) {
      let b = SpreadsheetApp.newConditionalFormatRule();
      b = e.igual ? b.whenTextEqualTo(e.igual) : b.whenTextContains(e.contiene);
      reglas.push(b.setBackground(e.fondo).setFontColor(e.color).setBold(true).setRanges([r]).build());
    });
  }

  // "SIN PEDIDOS POR ENVIAR" → franja verde en toda la fila.
  const id = '$' + letra(c.colId) + c.filaDatos;
  reglas.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=ISNUMBER(SEARCH("SIN PEDIDOS",' + id + '))')
    .setBackground(C.verdeSuave).setFontColor(C.verde).setBold(true)
    .setRanges([hoja.getRange(c.filaDatos, c.col, c.alto, c.ancho)]).build());

  // ETA vencida sin fecha de entrega → roja. Si la ETA es texto, no se pinta.
  if (c.colEta && c.colEntrega) {
    const eta = letra(c.colEta) + c.filaDatos;
    const ent = letra(c.colEntrega) + c.filaDatos;
    reglas.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISNUMBER(' + eta + '),' + eta + '<TODAY(),LEN(' + ent + ')=0)')
      .setFontColor(C.rojo).setBold(true)
      .setRanges([col(c.colEta)]).build());
  }

  return reglas;
}


// Fila 1: totales sumando lo que muestran las cajas.
function sucResumen_(hoja, cajas, ultimaCol) {
  const fila = hoja.getRange(1, 1, 1, ultimaCol);
  const formulas = fila.getFormulas()[0];
  const valores = fila.getDisplayValues()[0];
  const ocupada = valores.some(function (v, i) {
    return (v !== '' || formulas[i] !== '') && formulas[i].indexOf('pendientes') === -1 &&
           formulas[i].indexOf('en ruta') === -1 && formulas[i].indexOf('en logística') === -1 &&
           formulas[i].indexOf('en preparación') === -1 && formulas[i].indexOf('con problema') === -1;
  });
  if (ocupada) {
    Logger.log('⚠️ La fila 1 tiene contenido propio; no se agrega el resumen.');
    return;
  }

  const suma = function (crit, campo) {
    return cajas.filter(function (c) { return c[campo]; }).map(function (c) {
      const r = sucLetra_(c[campo]) + c.filaDatos + ':' + sucLetra_(c[campo]) + (c.filaDatos + c.alto - 1);
      return 'COUNTIF(' + r + ',"' + crit + '")';
    }).join('+') || '0';
  };
  const pendientes = '(' + suma('?*', 'colId') + ')-(' + suma('SIN PEDIDOS*', 'colId') + ')';
  const kpis = [
    '=' + pendientes + '&"  pendientes"',
    '=(' + suma('*En ruta*', 'colEstatus') + ')&"  en ruta"',
    '=(' + suma('Recibido en logística', 'colEstatus') + ')&"  en logística"',
    '=(' + suma('En elaboración', 'colEstatus') + '+' + suma('Elaborado', 'colEstatus') + ')&"  en preparación"',
    '=(' + suma('*PROBLEMA*', 'colEstatus') + ')&"  con problema"'
  ];

  fila.clearContent();
  const paso = Math.max(2, Math.floor(ultimaCol / kpis.length));
  kpis.forEach(function (f, i) {
    const col = 1 + i * paso;
    if (col <= ultimaCol) hoja.getRange(1, col).setFormula(f);
  });
  fila.setFontSize(11).setFontWeight('bold').setFontColor(SUCURSALES_UI.COLOR.texto)
      .setHorizontalAlignment('left').setVerticalAlignment('middle')
      .setBorder(null, null, true, null, null, null, SUCURSALES_UI.COLOR.lineaEncabezado, SpreadsheetApp.BorderStyle.SOLID);
  hoja.setRowHeight(1, 36);

  // "con problema" en rojo solo si hay alguno.
  const ultimo = hoja.getRange(1, 1 + (kpis.length - 1) * paso);
  hoja.setConditionalFormatRules(hoja.getConditionalFormatRules().concat([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=VALUE(LEFT(' + ultimo.getA1Notation() + ',FIND(" ",' + ultimo.getA1Notation() + ')-1))>0')
      .setFontColor(SUCURSALES_UI.COLOR.rojo).setRanges([ultimo]).build()
  ]));
  Logger.log('📊 Resumen agregado en la fila 1.');
}


// Título → "NUEVA ROMA PV  ·  4 pendientes". Se salta la caja si alguna
// fórmula de la pestaña usa la celda del título (para no romper su filtro).
function sucContadores_(hoja, cajas) {
  const todas = hoja.getDataRange().getFormulas();
  cajas.forEach(function (c) {
    if (c.filaTitulo < 1) return;
    const celda = hoja.getRange(c.filaTitulo, c.col);
    const actual = celda.getFormula();
    if (actual.indexOf('SIN PEDIDOS') !== -1) return; // ya tiene contador

    const ref = new RegExp('(^|[^A-Z0-9$!])\\$?' + sucLetra_(c.col) + '\\$?' + c.filaTitulo + '(?![0-9])', 'i');
    const usada = todas.some(function (fila) { return fila.some(function (f) { return f && ref.test(f); }); });
    if (actual !== '') {
      Logger.log('ℹ️ ' + c.nombre + ': el título ya es una fórmula; no se agrega contador.');
      return;
    }
    if (usada) {
      Logger.log('ℹ️ ' + c.nombre + ': el título se usa en una fórmula; no se agrega contador.');
      return;
    }

    const ids = sucLetra_(c.colId) + c.filaDatos + ':' + sucLetra_(c.colId) + (c.filaDatos + c.alto - 1);
    const nombre = c.nombre.replace(/"/g, '""');
    celda.setFormula('=LET(n,COUNTIF(' + ids + ',"?*")-COUNTIF(' + ids + ',"SIN PEDIDOS*"),"' + nombre +
                     '  ·  "&IF(n=0,"al día",n&IF(n=1," pendiente"," pendientes")))');
  });
}


// ---------- auxiliares ----------

function sucEnCaja_(cajas, fila, col) {
  return cajas.some(function (c) {
    const arriba = c.filaTitulo >= 1 ? c.filaTitulo : c.filaEnc;
    return fila >= arriba && fila <= c.filaDatos + c.alto - 1 && col >= c.col && col <= c.col + c.ancho - 1;
  });
}

function sucEnDatos_(cajas, fila, col) {
  return cajas.some(function (c) {
    return fila >= c.filaDatos && fila <= c.filaDatos + c.alto - 1 && col >= c.col && col <= c.col + c.ancho - 1;
  });
}

function sucLetra_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function sucOscurecer_(hex, cuanto) {
  const h = hex.replace('#', '');
  const ch = function (i) {
    return Math.round(parseInt(h.substr(i, 2), 16) * (1 - cuanto)).toString(16).padStart(2, '0');
  };
  return '#' + ch(0) + ch(2) + ch(4);
}
