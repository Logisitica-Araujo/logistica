// =========================================================================
// DISEÑO VISUAL — Bitácora de pedidos Sucursales PV 2026 (hoja "Envios")
//
// Pégalo como un ARCHIVO NUEVO (por ejemplo "Diseno.gs") dentro del mismo
// proyecto de Apps Script donde ya están las notificaciones. Todo vive en
// el objeto DISENO y en funciones que empiezan con "diseno", así que no
// choca con HOJA_ENVIOS, COL_*, ORDEN_ETAPAS ni ninguna otra constante o
// función que ya exista. No toca triggers ni correos.
//
// Funciones para ejecutar a mano desde el editor:
//   aplicarDisenoBitacora()   → aplica el diseño (se puede correr varias veces)
//   revertirDisenoBitacora()  → regresa el formato al respaldo original
//
// Qué hace aplicarDisenoBitacora():
//   1. Respaldo: la primera vez duplica "Envios" como "Envios (respaldo diseño)"
//      y la oculta. Si ya existe, no la vuelve a crear.
//   2. Limpia: cuadrícula, bandas de color, fondos, bordes y las reglas de
//      formato condicional viejas de A:AA.
//   3. Aplica: tipografía, encabezado, separadores grises, estatus en tono
//      pastel, casillas verdes y la zona editable (I y Z) en ámbar claro.
//   4. Protege: toda la hoja menos I3:I y Z3:Z.
//
// No cambia valores, fórmulas, filas, columnas ni anchos. La única
// escritura de texto es el "✎ " al inicio de los títulos de I y Z
// (se puede apagar con MARCAR_EDITABLES_CON_LAPIZ).
// =========================================================================

const DISENO = {
  HOJA: 'Envios',
  HOJA_RESPALDO: 'Envios (respaldo diseño)',

  FILA_TITULO: 1,      // logo y título
  FILA_ENCABEZADO: 2,  // títulos de columna
  FILA_DATOS: 3,       // primera fila de pedidos
  ULTIMA_COLUMNA: 27,  // AA

  COLUMNA_ESTATUS: 'C',
  COLUMNAS_CASILLA: ['I', 'K'],
  COLUMNAS_EDITABLES: ['I', 'Z'],
  MARCAR_EDITABLES_CON_LAPIZ: true,

  // Protección del resto de la hoja (todo menos I y Z):
  //   'bloqueo' → solo el dueño y EDITORES_COMPLETOS pueden editar fuera de I y Z.
  //   'aviso'   → cualquiera puede editar, pero Sheets pide confirmación.
  // Con 'bloqueo' y la lista vacía, el script usa 'aviso' para no dejar
  // fuera al equipo de logística.
  MODO_PROTECCION: 'bloqueo',
  EDITORES_COMPLETOS: [
    // 'logistica@fadermex.com',
  ],
  ETIQUETA_PROTECCION: 'DISENO_BITACORA · solo I y Z editables por sucursal',

  FUENTE: 'Inter',

  COLOR: {
    fondo: '#FFFFFF',
    texto: '#202124',
    texto2: '#5F6368',
    linea: '#ECEEF1',
    encabezado: '#F8F9FA',
    editable: '#FFF8E1',
    editableEncabezado: '#FFF1C2',
    editableTexto: '#7A5300',
    casillaVacia: '#9AA0A6',
    casillaMarcada: '#188038'
  },

  // Línea de color de 2 px bajo el encabezado, una por grupo de columnas.
  GRUPOS: [
    { nombre: 'Pedido',             desde: 'A', hasta: 'F',  color: '#1593C8' },
    { nombre: 'Sucursal',           desde: 'G', hasta: 'I',  color: '#C8960C' },
    { nombre: 'Logística',          desde: 'J', hasta: 'L',  color: '#0E6B80' },
    { nombre: 'Envío',              desde: 'M', hasta: 'S',  color: '#1A56DB' },
    { nombre: 'Incidencias',        desde: 'T', hasta: 'W',  color: '#B42318' },
    { nombre: 'Cierre en sucursal', desde: 'X', hasta: 'AA', color: '#C8960C' }
  ],

  COLUMNAS_CENTRADAS: ['B', 'C', 'G', 'H', 'I', 'J', 'K', 'L', 'O', 'P', 'Q', 'R', 'S', 'U', 'V', 'X', 'Z'],
  COLUMNAS_SECUNDARIAS: ['B', 'F', 'M', 'R'],     // texto gris medio
  COLUMNAS_TEXTO_LARGO: ['D', 'E', 'T', 'W'],     // ajuste de texto
  COLUMNAS_TEXTO_CHICO: ['E', 'W'],               // dirección y observaciones en 9 pt

  // Orden = prioridad: la primera regla que coincide gana. Las variantes
  // "Notificado" van antes que la genérica para que no se las coma.
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


function aplicarDisenoBitacora() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(DISENO.HOJA);
  if (!hoja) throw new Error('No encontré la hoja "' + DISENO.HOJA + '".');

  disenoRespaldar_(ss, hoja);

  const nDatos = hoja.getMaxRows() - DISENO.FILA_DATOS + 1;
  if (nDatos < 1) throw new Error('La hoja no tiene filas de datos.');

  disenoLimpiar_(hoja);
  disenoTitulo_(hoja);
  disenoEncabezado_(hoja);
  disenoDatos_(hoja, nDatos);
  disenoZonaEditable_(hoja, nDatos);
  disenoReglas_(hoja, nDatos);
  const modo = disenoProteger_(hoja);

  SpreadsheetApp.flush();
  const msg = 'Diseño aplicado. Protección: ' + modo + '.';
  Logger.log('✅ ' + msg);
  ss.toast(msg, 'Bitácora PV 2026', 6);
}


function revertirDisenoBitacora() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(DISENO.HOJA);
  const respaldo = ss.getSheetByName(DISENO.HOJA_RESPALDO);
  if (!hoja) throw new Error('No encontré la hoja "' + DISENO.HOJA + '".');
  if (!respaldo) throw new Error('No existe "' + DISENO.HOJA_RESPALDO + '"; no hay de dónde restaurar.');

  const nc = DISENO.ULTIMA_COLUMNA;
  const filas = Math.min(hoja.getMaxRows(), respaldo.getMaxRows());

  hoja.getBandings().forEach(function (b) { b.remove(); });
  hoja.setConditionalFormatRules(disenoReglasFueraDeRango_(hoja));
  respaldo.getRange(1, 1, filas, nc)
    .copyTo(hoja.getRange(1, 1, filas, nc), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  respaldo.getBandings().forEach(function (b) {
    b.copyTo(hoja.getRange(b.getRange().getA1Notation()));
  });
  hoja.setHiddenGridlines(respaldo.hasHiddenGridlines());

  DISENO.COLUMNAS_EDITABLES.forEach(function (letra) {
    const enc = hoja.getRange(DISENO.FILA_ENCABEZADO, disenoCol_(letra));
    const t = enc.getValue();
    if (typeof t === 'string' && t.indexOf('✎ ') === 0) enc.setValue(t.substring(2));
    enc.clearNote();
  });

  hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    if (p.getDescription() === DISENO.ETIQUETA_PROTECCION) p.remove();
  });

  SpreadsheetApp.flush();
  Logger.log('↩️ Formato restaurado desde "' + DISENO.HOJA_RESPALDO + '" y protección retirada.');
  ss.toast('Formato original restaurado.', 'Bitácora PV 2026', 6);
}


// ---------- pasos ----------

function disenoRespaldar_(ss, hoja) {
  if (ss.getSheetByName(DISENO.HOJA_RESPALDO)) {
    Logger.log('ℹ️ El respaldo ya existe; no se vuelve a crear.');
    return;
  }
  const copia = hoja.copyTo(ss);
  copia.setName(DISENO.HOJA_RESPALDO);
  copia.hideSheet();
  Logger.log('🗂️ Respaldo creado: "' + DISENO.HOJA_RESPALDO + '" (oculta).');
}


function disenoLimpiar_(hoja) {
  const filas = hoja.getMaxRows();
  hoja.setHiddenGridlines(true);
  hoja.getBandings().forEach(function (b) { b.remove(); });

  const antes = hoja.getConditionalFormatRules().length;
  const conservadas = disenoReglasFueraDeRango_(hoja);
  hoja.setConditionalFormatRules(conservadas);
  Logger.log('🧹 Reglas de formato retiradas: ' + (antes - conservadas.length) +
             ' | conservadas (fuera de A:AA): ' + conservadas.length);

  const todo = hoja.getRange(1, 1, filas, DISENO.ULTIMA_COLUMNA);
  todo.setBorder(false, false, false, false, false, false);
  todo.setBackground(DISENO.COLOR.fondo);
}


function disenoTitulo_(hoja) {
  const C = DISENO.COLOR;
  const f = DISENO.FILA_TITULO;
  const fila = hoja.getRange(f, 1, 1, DISENO.ULTIMA_COLUMNA);
  fila.setFontFamily(DISENO.FUENTE).setFontColor(C.texto).setVerticalAlignment('middle');

  // El logo es una imagen flotante y no se toca. Solo se ajusta el texto.
  fila.getDisplayValues()[0].forEach(function (v, i) {
    if (!v) return;
    const celda = hoja.getRange(f, i + 1);
    if (/bit[aá]cora/i.test(v)) {
      celda.setFontWeight('bold').setFontSize(18).setFontColor(C.texto);
    } else if (/^PRO-/i.test(v)) {
      celda.setFontWeight('normal').setFontSize(8).setFontColor(C.texto2);
    }
  });
}


function disenoEncabezado_(hoja) {
  const C = DISENO.COLOR;
  const f = DISENO.FILA_ENCABEZADO;
  hoja.getRange(f, 1, 1, DISENO.ULTIMA_COLUMNA)
    .setBackground(C.encabezado)
    .setFontFamily(DISENO.FUENTE).setFontSize(9).setFontWeight('bold').setFontColor(C.texto2)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  DISENO.GRUPOS.forEach(function (g) {
    const a = disenoCol_(g.desde);
    const b = disenoCol_(g.hasta);
    hoja.getRange(f, a, 1, b - a + 1)
      .setBorder(null, null, true, null, null, null, g.color, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  hoja.setRowHeight(f, 44);
  hoja.setFrozenRows(f);
}


function disenoDatos_(hoja, n) {
  const C = DISENO.COLOR;
  const f0 = DISENO.FILA_DATOS;
  const col = function (letra) { return hoja.getRange(f0, disenoCol_(letra), n, 1); };

  hoja.getRange(f0, 1, n, DISENO.ULTIMA_COLUMNA)
    .setFontFamily(DISENO.FUENTE).setFontSize(10).setFontWeight('normal').setFontColor(C.texto)
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBorder(null, null, true, null, null, true, C.linea, SpreadsheetApp.BorderStyle.SOLID);

  DISENO.COLUMNAS_CENTRADAS.forEach(function (l) { col(l).setHorizontalAlignment('center'); });
  DISENO.COLUMNAS_SECUNDARIAS.forEach(function (l) { col(l).setFontColor(C.texto2); });
  DISENO.COLUMNAS_TEXTO_LARGO.forEach(function (l) { col(l).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP); });
  DISENO.COLUMNAS_TEXTO_CHICO.forEach(function (l) { col(l).setFontSize(9).setFontColor(C.texto2); });

  col('A').setFontWeight('bold');                                   // identificador
  col(DISENO.COLUMNA_ESTATUS).setFontWeight('bold').setFontSize(9); // estatus
}


function disenoZonaEditable_(hoja, n) {
  const C = DISENO.COLOR;
  DISENO.COLUMNAS_EDITABLES.forEach(function (letra) {
    const c = disenoCol_(letra);
    hoja.getRange(DISENO.FILA_DATOS, c, n, 1).setBackground(C.editable);

    const enc = hoja.getRange(DISENO.FILA_ENCABEZADO, c);
    enc.setBackground(C.editableEncabezado).setFontColor(C.editableTexto)
       .setNote('Columna editable por sucursal.');
    if (DISENO.MARCAR_EDITABLES_CON_LAPIZ) {
      const t = enc.getValue();
      if (typeof t === 'string' && t !== '' && t.indexOf('✎') !== 0) enc.setValue('✎ ' + t);
    }
  });
}


function disenoReglas_(hoja, n) {
  const f0 = DISENO.FILA_DATOS;
  const reglas = [];

  const rEstatus = hoja.getRange(f0, disenoCol_(DISENO.COLUMNA_ESTATUS), n, 1);
  DISENO.ESTATUS.forEach(function (e) {
    let r = SpreadsheetApp.newConditionalFormatRule();
    r = e.igual ? r.whenTextEqualTo(e.igual) : r.whenTextContains(e.contiene);
    reglas.push(r.setBackground(e.fondo).setFontColor(e.color).setBold(true)
                 .setRanges([rEstatus]).build());
  });

  // En Sheets la casilla toma el color del texto: gris si está vacía, verde si está marcada.
  DISENO.COLUMNAS_CASILLA.forEach(function (letra) {
    const r = hoja.getRange(f0, disenoCol_(letra), n, 1);
    r.setFontColor(DISENO.COLOR.casillaVacia);
    reglas.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + letra + f0 + '=TRUE')
      .setFontColor(DISENO.COLOR.casillaMarcada)
      .setRanges([r]).build());
  });

  hoja.setConditionalFormatRules(reglas.concat(hoja.getConditionalFormatRules()));
}


function disenoProteger_(hoja) {
  let modo = DISENO.MODO_PROTECCION;
  if (modo === 'bloqueo' && DISENO.EDITORES_COMPLETOS.length === 0) {
    Logger.log('⚠️ MODO_PROTECCION es "bloqueo" pero EDITORES_COMPLETOS está vacío. ' +
               'Se usa "aviso" para no bloquear a logística.');
    modo = 'aviso';
  }

  const p = hoja.protect();
  const anterior = p.getDescription();
  if (anterior && anterior !== DISENO.ETIQUETA_PROTECCION) {
    Logger.log('ℹ️ La hoja ya tenía protección ("' + anterior + '"); se reemplaza su configuración.');
  }
  p.setDescription(DISENO.ETIQUETA_PROTECCION);

  const ultima = hoja.getMaxRows();
  p.setUnprotectedRanges(DISENO.COLUMNAS_EDITABLES.map(function (l) {
    return hoja.getRange(l + DISENO.FILA_DATOS + ':' + l + ultima);
  }));

  if (modo === 'aviso') {
    p.setWarningOnly(true);
  } else {
    p.setWarningOnly(false);
    const yo = Session.getEffectiveUser();
    p.addEditor(yo);
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
    p.addEditors(DISENO.EDITORES_COMPLETOS.concat([yo.getEmail()]));
  }
  Logger.log('🔒 Protección "' + modo + '": editables por todos solo ' +
             DISENO.COLUMNAS_EDITABLES.join(' y ') + ' desde la fila ' + DISENO.FILA_DATOS + '.');
  return modo;
}


// ---------- auxiliares ----------

// Reglas de formato condicional que viven completamente fuera de A:AA; esas no se tocan.
function disenoReglasFueraDeRango_(hoja) {
  return hoja.getConditionalFormatRules().filter(function (regla) {
    return regla.getRanges().every(function (r) { return r.getColumn() > DISENO.ULTIMA_COLUMNA; });
  });
}

// 'A' → 1, 'Z' → 26, 'AA' → 27
function disenoCol_(letra) {
  let n = 0;
  for (let i = 0; i < letra.length; i++) n = n * 26 + (letra.charCodeAt(i) - 64);
  return n;
}
