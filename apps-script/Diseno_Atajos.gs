/*******************************************************************************
 *  HOJA "OPERACIONES" - DISEÑO + ATAJOS + FILAS COMPACTAS + AUDITORÍA
 *  Archivo: Logística FED 2026   |   Fecha: 2026-10-10   |   v2 (rendimiento)
 *
 *  CONTENIDO (todo es PRESENTACIÓN; no toca datos, fórmulas ni tu onOpen/onEdit):
 *    1) aplicarDisenoOperaciones()  -> colores, fuentes, bordes, formato condicional
 *    2) instalarMenuAtajos()        -> menú ⚡ Atajos (filtros con un clic)
 *    3) compactarFilas()            -> alto uniforme de filas (versión rápida)
 *    4) auditarColumnasOperaciones()-> lee y lista cómo se llena cada columna
 *
 *  🔧 CAMBIOS v2 (rendimiento):
 *    - Las reglas de formato condicional YA NO SE ACUMULAN. Antes, cada vez
 *      que corrías aplicarDisenoOperaciones() se agregaban otra vez las
 *      reglas de "NO APLICA", "Días de atraso" y la de filas alternas
 *      (y las anteriores se conservaban), así que la hoja tenía cada vez
 *      más reglas que evaluar en cada celda → más lenta al desplazarse y
 *      al editar. Ahora se reemplazan las propias y se conservan las demás.
 *    - Ya NO se borra la regla rosa de duplicados (columna Y): el filtro
 *      viejo quitaba cualquier regla que tocara la columna B, y la de
 *      duplicados abarca A:P.
 *    - Filas alternas con "Colores alternos" nativos de Sheets en vez de
 *      una regla =ISEVEN(ROW()) sobre ~35 columnas × miles de filas. Los
 *      colores nativos no se recalculan; la regla sí, en cada celda.
 *
 *  OJO: este archivo reúne los 3 scripts anteriores. Si ya tienes pegados por
 *  separado "Diseno", "Atajos" y "Compactar", NO pegues este además (daría error
 *  de "Identifier already declared"). Reemplázalos por este.
 *******************************************************************************/


/* ============================================================================
 *  1) DISEÑO PROFESIONAL
 * ========================================================================== */

// ---------- AJUSTES (si cambia tu estructura, se edita aquí) ----------
const DL = {
  HOJA: 'Operaciones',
  FILA_NUMEROS: 1,     // fila de números 1..30 (se conserva, solo más discreta)
  FILA_ENCAB: 2,       // fila de encabezados
  FILA_INICIO: 4,      // primera fila de datos
  ULT_COL: 35,         // hasta la columna AI
  COL_AREA: 2,         // B
  COL_ESTATUS: 16,     // P
  COL_DIAS_ATRASO: 24, // X
  // Colores
  TINTA: '#1B2430', MARFIL: '#F4F1EA', DORADO: '#B8975A',
  LINEA: '#ECE8E0', BANDA: '#FBFAF7', GRIS_TENUE: '#B3AD9F'
};

function aplicarDisenoOperaciones() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(DL.HOJA);
  if (!hoja) throw new Error('No encuentro la pestaña "' + DL.HOJA + '"');
  const maxFilas = hoja.getMaxRows();
  const nFilas = maxFilas - DL.FILA_INICIO + 1;

  // 1) Hoja limpia: sin cuadrícula y pestaña en color tinta
  hoja.setHiddenGridlines(true);
  hoja.setTabColor(DL.TINTA);

  // 2) CUERPO (filas de datos): fondo por defecto (lo pintan los colores
  //    alternos nativos), fuente, líneas finas entre filas
  const cuerpo = hoja.getRange(DL.FILA_INICIO, 1, nFilas, DL.ULT_COL);
  cuerpo.setBackground(null)
        .setFontFamily('Roboto').setFontSize(9).setFontColor(DL.TINTA)
        .setVerticalAlignment('middle')
        .setBorder(null, null, true, null, null, true, DL.LINEA, SpreadsheetApp.BorderStyle.SOLID);

  // Alineaciones por columna (A=1 ... P=16)
  [1,2,3,6,7,8,9,10,11,12,13,15,16].forEach(c =>
    hoja.getRange(DL.FILA_INICIO, c, nFilas, 1).setHorizontalAlignment('center'));
  hoja.getRange(DL.FILA_INICIO, 14, nFilas, 1).setHorizontalAlignment('right'); // Costo
  // ID del pedido destacado
  hoja.getRange(DL.FILA_INICIO, 1, nFilas, 1).setFontFamily('Montserrat').setFontWeight('bold').setFontSize(8);
  // Estatus en negritas y más pequeño
  hoja.getRange(DL.FILA_INICIO, DL.COL_ESTATUS, nFilas, 1).setFontWeight('bold').setFontSize(8);

  // 3) FILA 1 (números): discreta
  hoja.getRange(DL.FILA_NUMEROS, 1, 1, DL.ULT_COL)
      .setBackground('#F7F5F0').setFontColor('#A8A397').setFontSize(7)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 4) ENCABEZADOS (fila 2): un tono tinta por bloque + filete dorado
  const bloques = [
    { desde: 1,  hasta: 8,  color: '#1B2430' }, // A-H  Captura
    { desde: 9,  hasta: 16, color: '#233749' }, // I-P  Gestión
    { desde: 17, hasta: 30, color: '#2D3B36' }, // Q-AD Cierre e incidencias
    { desde: 31, hasta: 35, color: '#3A3345' }  // AE-AI Notificaciones
  ];
  bloques.forEach(b => {
    hoja.getRange(DL.FILA_ENCAB, b.desde, 1, b.hasta - b.desde + 1)
        .setBackground(b.color).setFontColor(DL.MARFIL)
        .setFontFamily('Montserrat').setFontSize(8).setFontWeight('bold')
        .setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setWrap(true)
        .setBorder(null, null, true, null, null, null, DL.DORADO, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  // 5) FILAS ALTERNAS nativas (no se recalculan, a diferencia de una regla)
  aplicarFilasAlternas_(hoja, cuerpo);

  // 6) FORMATO CONDICIONAL
  aplicarReglasCondicionales_(hoja, maxFilas);

  SpreadsheetApp.getActive().toast('Diseño aplicado a "' + DL.HOJA + '"', 'Listo', 5);
}

function aplicarFilasAlternas_(hoja, cuerpo) {
  hoja.getBandings().forEach(b => b.remove());
  const filaParPrimero = DL.FILA_INICIO % 2 === 0; // igual que =ISEVEN(ROW())
  cuerpo.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
        .setFirstRowColor(filaParPrimero ? DL.BANDA : '#FFFFFF')
        .setSecondRowColor(filaParPrimero ? '#FFFFFF' : DL.BANDA);
}

// ¿Esta regla la creó este script (en esta versión o en la anterior)?
// Se reconocen por su rango: B sola, P sola, X sola, I:N, o A:AI completa
// (la vieja regla de filas alternas). La de duplicados (A:P) NO cae aquí.
function esReglaDelDiseno_(regla) {
  return regla.getRanges().some(r => {
    const c1 = r.getColumn(), c2 = r.getLastColumn();
    if (c1 === c2 && [DL.COL_AREA, DL.COL_ESTATUS, DL.COL_DIAS_ATRASO].includes(c1)) return true;
    if (c1 === 9 && c2 === 14) return true;           // I:N  ("NO APLICA")
    if (c1 === 1 && c2 === DL.ULT_COL) return true;   // A:AI (filas alternas viejas)
    return false;
  });
}

function aplicarReglasCondicionales_(hoja, maxFilas) {
  const nFilas = maxFilas - DL.FILA_INICIO + 1;
  const rEstatus = hoja.getRange(DL.FILA_INICIO, DL.COL_ESTATUS, nFilas, 1);
  const rArea    = hoja.getRange(DL.FILA_INICIO, DL.COL_AREA, nFilas, 1);
  const rNoAplica= hoja.getRange(DL.FILA_INICIO, 9, nFilas, 6);          // I a N
  const rAtraso  = hoja.getRange(DL.FILA_INICIO, DL.COL_DIAS_ATRASO, nFilas, 1);

  // Se reemplazan SOLO las reglas propias del diseño; las demás (por ejemplo,
  // la de duplicados) se conservan.
  const reglasActuales = hoja.getConditionalFormatRules();
  const conservadas = reglasActuales.filter(regla => !esReglaDelDiseno_(regla));
  const nuevas = [];

  // Helper: regla de texto exacto
  const igual = (rango, texto, fondo, letra) => nuevas.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(texto)
      .setBackground(fondo).setFontColor(letra).setRanges([rango]).build());

  // --- ESTATUS (columna P): 5 familias de color suave ---
  const VERDE = ['#E3EDE5', '#2F5D3F'], ARENA = ['#F3EBDD', '#7A5A1E'], PIZARRA = ['#E3E9F1', '#34506E'],
        ROSA = ['#F4E3E1', '#8A3A33'], GRIS = ['#E9E7E3', '#5A5750'];
  ['ENTREGADO', 'RECOLECTADO Y ENTREGADO'].forEach(t => igual(rEstatus, t, VERDE[0], VERDE[1]));
  nuevas.push(SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('ENVIADO POR')
      .setBackground(ARENA[0]).setFontColor(ARENA[1]).setRanges([rEstatus]).build());
  ['PENDIENTE PARA RECOLECTAR', 'RECOLECTADO POR GESTOR'].forEach(t => igual(rEstatus, t, PIZARRA[0], PIZARRA[1]));
  ['HAY UNA NOTA PENDIENTE', 'RECOLECCIÓN NO ENTREGADA'].forEach(t => igual(rEstatus, t, ROSA[0], ROSA[1]));
  ['PEDIDO CANCELADO', 'PEDIDO RETORNADO'].forEach(t => igual(rEstatus, t, GRIS[0], GRIS[1]));

  // --- ÁREA (columna B): solo color de letra, sin relleno ---
  const areaColor = (texto, letra, contiene) => {
    const b = SpreadsheetApp.newConditionalFormatRule();
    (contiene ? b.whenTextContains(texto) : b.whenTextEqualTo(texto));
    nuevas.push(b.setFontColor(letra).setBold(true).setRanges([rArea]).build());
  };
  areaColor('BOTICAN', '#3F6B4F');
  areaColor('FADERMEX', '#2F5280');
  areaColor('COLIMA', '#9A5B3C');
  areaColor('IMSS', '#6B4A73', true); // cubre "IMSS" e "IMSS MORELIA"

  // --- "NO APLICA" en gris tenue (columnas I a N) ---
  nuevas.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('aplica')
      .setFontColor(DL.GRIS_TENUE).setRanges([rNoAplica]).build());

  // --- Días de atraso > 0: el único rojo apagado "de alerta" ---
  nuevas.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0)
      .setBackground(ROSA[0]).setFontColor(ROSA[1]).setBold(true).setRanges([rAtraso]).build());

  // Las conservadas van primero (así la de duplicados sigue teniendo prioridad),
  // después las del diseño.
  hoja.setConditionalFormatRules(conservadas.concat(nuevas));
  Logger.log('Reglas nuevas: ' + nuevas.length + ' | conservadas: ' + conservadas.length +
             ' | reemplazadas: ' + (reglasActuales.length - conservadas.length));
}


/* ============================================================================
 *  2) MENÚ ⚡ ATAJOS
 *  Aplica filtros con un clic. Solo oculta/muestra filas (como un filtro normal).
 *  NO toca tu onOpen: usa un disparador propio.
 * ========================================================================== */

const ATJ = {
  HOJA: 'Operaciones',
  FILA_FILTRO: 3,        // fila 3 (oculta) actúa como "encabezado" del filtro; datos desde la 4
  FILA_INICIO: 4,
  ULT_COL: 35,           // hasta AI
  COL_ID: 1,             // A
  COL_AREA: 2,           // B
  COL_PAQUETERIA: 11,    // K (Proveedor = paquetería)
  COL_ESTATUS: 16,       // P
  COL_ATRASO: 24         // X (Días de atraso)
};

// ---------- INSTALACIÓN (se corre UNA sola vez) ----------
function instalarMenuAtajos() {
  // Evita duplicar el disparador si ya existe
  const existe = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'crearMenuAtajos');
  if (!existe) {
    ScriptApp.newTrigger('crearMenuAtajos').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
  }
  Logger.log('Listo. Recarga la hoja (F5) y verás el menú ⚡ Atajos.');
}

// ---------- MENÚ ----------
function crearMenuAtajos() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Atajos')
    .addSubMenu(ui.createMenu('Por área')
      .addItem('BOTICAN', 'atajoBotican')
      .addItem('FADERMEX', 'atajoFadermex')
      .addItem('IMSS MORELIA', 'atajoImssMorelia')
      .addItem('COLIMA', 'atajoColima')
      .addItem('IMSS', 'atajoImss'))
    .addSubMenu(ui.createMenu('En ruta')
      .addItem('Todo lo que está en ruta', 'atajoEnRuta')
      .addItem('En ruta por paquetería externa', 'atajoRutaPaqueteria')
      .addItem('En ruta por logística interna', 'atajoRutaLogistica'))
    .addItem('Paqueterías…', 'atajoPaqueterias')
    .addSeparator()
    .addItem('Pedidos retrasados', 'atajoRetrasados')
    .addItem('Pedidos con problema', 'atajoProblema')
    .addSeparator()
    .addItem('Ir a pedido…', 'atajoIrAPedido')
    .addItem('Quitar filtros', 'atajoQuitarFiltros')
    .addToUi();
}

// ---------- ATAJOS (cada uno llama al motor de filtros) ----------
function atajoBotican()        { filtrarTexto_(ATJ.COL_AREA, 'BOTICAN'); }
function atajoFadermex()       { filtrarTexto_(ATJ.COL_AREA, 'FADERMEX'); }
function atajoImssMorelia()    { filtrarTexto_(ATJ.COL_AREA, 'IMSS MORELIA'); }
function atajoColima()         { filtrarTexto_(ATJ.COL_AREA, 'COLIMA'); }
function atajoImss()           { filtrarTexto_(ATJ.COL_AREA, 'IMSS'); }  // área exactamente "IMSS"
function atajoRutaPaqueteria() { filtrarTexto_(ATJ.COL_ESTATUS, 'ENVIADO POR PAQUETERÍA EXTERNA'); }
function atajoRutaLogistica()  { filtrarTexto_(ATJ.COL_ESTATUS, 'ENVIADO POR LOGÍSTICA INTERNA'); }

// Todo lo "en ruta": cualquier estatus que empiece con "ENVIADO POR"
function atajoEnRuta() {
  aplicarCriterio_(ATJ.COL_ESTATUS,
    SpreadsheetApp.newFilterCriteria().whenTextStartsWith('ENVIADO POR').build(), 'En ruta');
}

// Retrasados: Días de atraso mayor a 0 (requiere la fórmula de la columna X)
function atajoRetrasados() {
  aplicarCriterio_(ATJ.COL_ATRASO,
    SpreadsheetApp.newFilterCriteria().whenNumberGreaterThan(0).build(), 'Pedidos retrasados');
}

// Con problema: estatus de nota pendiente o recolección no entregada
function atajoProblema() {
  aplicarCriterio_(ATJ.COL_ESTATUS,
    SpreadsheetApp.newFilterCriteria()
      .setVisibleValues(['HAY UNA NOTA PENDIENTE', 'RECOLECCIÓN NO ENTREGADA']).build(),
    'Pedidos con problema');
}

// Paqueterías: te muestra las que existen y filtras por la que escribas
function atajoPaqueterias() {
  const ui = SpreadsheetApp.getUi();
  const hoja = obtenerHoja_();
  const n = Math.max(hoja.getLastRow() - ATJ.FILA_INICIO + 1, 1);
  const valores = hoja.getRange(ATJ.FILA_INICIO, ATJ.COL_PAQUETERIA, n, 1).getDisplayValues().flat();
  // Lista de paqueterías distintas (sin vacíos ni "NO APLICA")
  const unicas = [...new Set(valores.map(v => String(v).trim()).filter(v => v && v.toUpperCase() !== 'NO APLICA'))].sort();
  const resp = ui.prompt('Paqueterías',
    'Escribe cuál quieres ver (o parte del nombre).\nDisponibles: ' + unicas.slice(0, 25).join(', '),
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const texto = resp.getResponseText().trim().toLowerCase();
  const coinciden = unicas.filter(u => u.toLowerCase().indexOf(texto) !== -1);
  if (!texto || coinciden.length === 0) { ui.alert('No encontré ninguna paquetería con "' + texto + '".'); return; }
  aplicarCriterio_(ATJ.COL_PAQUETERIA,
    SpreadsheetApp.newFilterCriteria().setVisibleValues(coinciden).build(), 'Paquetería: ' + coinciden.join(', '));
}

// Ir a pedido: busca un ID y te lleva a su fila
function atajoIrAPedido() {
  const ui = SpreadsheetApp.getUi();
  const hoja = obtenerHoja_();
  const resp = ui.prompt('Ir a pedido', 'Escribe el ID o parte del ID (ej. 15912):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK || !resp.getResponseText().trim()) return;
  const n = Math.max(hoja.getLastRow() - ATJ.FILA_INICIO + 1, 1);
  const celda = hoja.getRange(ATJ.FILA_INICIO, ATJ.COL_ID, n, 1)
    .createTextFinder(resp.getResponseText().trim()).matchCase(false).findNext();
  if (!celda) { ui.alert('No encontré ese pedido.'); return; }
  if (hoja.isRowHiddenByFilter(celda.getRow())) {
    ui.alert('Lo encontré en la fila ' + celda.getRow() + ', pero está oculto por un filtro. Usa "Quitar filtros".');
    return;
  }
  hoja.setActiveRange(celda);
}

// Quitar filtros: deja todo visible
function atajoQuitarFiltros() {
  const hoja = obtenerHoja_();
  const props = PropertiesService.getDocumentProperties();
  const filtro = hoja.getFilter();
  if (!filtro) { toast_('No hay filtros activos'); return; }
  if (props.getProperty('ATJ_FILTRO_CREADO') === 'si') {
    filtro.remove();                                  // lo creamos nosotros: se quita completo
    props.deleteProperty('ATJ_FILTRO_CREADO');
  } else {
    const r = filtro.getRange();                      // ya existía: solo limpiamos sus criterios
    for (let c = r.getColumn(); c <= r.getLastColumn(); c++) filtro.removeColumnFilterCriteria(c);
  }
  toast_('Filtros quitados');
}

// ---------- MOTOR ----------
function obtenerHoja_() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(ATJ.HOJA);
  if (!hoja) throw new Error('No encuentro la pestaña "' + ATJ.HOJA + '"');
  hoja.activate();
  return hoja;
}

function filtrarTexto_(columna, texto) {
  aplicarCriterio_(columna, SpreadsheetApp.newFilterCriteria().whenTextEqualTo(texto).build(), texto);
}

// Aplica el criterio solo a esa columna. Los filtros de otras columnas se conservan,
// así puedes combinar (ej. BOTICAN + En ruta). "Quitar filtros" los limpia todos.
function aplicarCriterio_(columna, criterio, nombre) {
  const hoja = obtenerHoja_();
  let filtro = hoja.getFilter();
  if (!filtro) {
    const filas = hoja.getMaxRows() - ATJ.FILA_FILTRO + 1;
    filtro = hoja.getRange(ATJ.FILA_FILTRO, 1, filas, ATJ.ULT_COL).createFilter();
    PropertiesService.getDocumentProperties().setProperty('ATJ_FILTRO_CREADO', 'si');
  }
  filtro.setColumnFilterCriteria(columna, criterio);
  toast_(nombre);
}

function toast_(msg) { SpreadsheetApp.getActive().toast(msg, '⚡ Atajos', 4); }


/* ============================================================================
 *  3) FILAS COMPACTAS (versión rápida: 3 operaciones en total)
 *  Quita cualquier filtro activo antes de correrla.
 * ========================================================================== */

const CMP = { HOJA: 'Operaciones', FILA_INICIO: 4, ALTURA: 36, COL_ID: 1, COL_DIRECCION: 5 };

function compactarFilas() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(CMP.HOJA);
  const n = hoja.getMaxRows() - CMP.FILA_INICIO + 1;

  // 1) Última fila con pedido (una sola lectura de la columna A)
  const ids = hoja.getRange(CMP.FILA_INICIO, CMP.COL_ID, n, 1).getValues();
  let ultima = CMP.FILA_INICIO - 1;
  for (let i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] !== '') { ultima = CMP.FILA_INICIO + i; break; }
  }
  if (ultima < CMP.FILA_INICIO) return;
  const total = ultima - CMP.FILA_INICIO + 1;

  // 2) Dirección ajustada al ancho y centrada verticalmente (una operación)
  hoja.getRange(CMP.FILA_INICIO, CMP.COL_DIRECCION, total, 1)
      .setWrap(true).setVerticalAlignment('middle');

  // 3) Alto uniforme para todas las filas de pedidos (una operación)
  hoja.setRowHeightsForced(CMP.FILA_INICIO, total, CMP.ALTURA);

  SpreadsheetApp.getActive().toast('Filas compactas hasta la fila ' + ultima, 'Listo', 5);
}

// DESHACER: regresa las filas a altura automática (según su contenido)
function restaurarAlturaAutomatica() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(CMP.HOJA);
  hoja.autoResizeRows(CMP.FILA_INICIO, hoja.getMaxRows() - CMP.FILA_INICIO + 1);
}


/* ============================================================================
 *  4) AUDITORÍA DE COLUMNAS (solo lee, no cambia nada)
 *  Cambia FILA por un pedido reciente si quieres revisar otro.
 * ========================================================================== */

function auditarColumnasOperaciones() {
  const FILA = 1040;   // fila de ejemplo (un pedido reciente)
  const hoja = SpreadsheetApp.getActive().getSheetByName('Operaciones');
  const n = 35;        // columnas A a AI (las demás están vacías)

  const enc = hoja.getRange(2, 1, 1, n).getDisplayValues()[0];      // encabezados (fila 2)
  const f4  = hoja.getRange(4, 1, 1, n).getFormulas()[0];           // fórmulas fila 4 (ahí viven los ARRAYFORMULA)
  const fx  = hoja.getRange(FILA, 1, 1, n).getFormulas()[0];        // fórmulas de la fila reciente
  const vx  = hoja.getRange(FILA, 1, 1, n).getDisplayValues()[0];   // valores de la fila reciente
  const val = hoja.getRange(FILA, 1, 1, n).getDataValidations()[0]; // listas / casillas

  // Convierte número de columna a letra (1 = A, 27 = AA)
  const letra = c => { let s = ''; while (c > 0) { const r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); } return s; };

  const lineas = [];
  for (let i = 0; i < n; i++) {
    const f = f4[i] || fx[i];
    const tipo = f ? (/ARRAYFORMULA/i.test(f) ? 'ARRAYFORMULA' : 'FÓRMULA') + ': ' + f.substring(0, 90)
                   : (vx[i] !== '' ? 'valor: ' + String(vx[i]).substring(0, 25) : 'vacía');
    const v = val[i] ? ' | validación: ' + val[i].getCriteriaType() : '';
    lineas.push(letra(i + 1) + ' | ' + enc[i] + ' | ' + tipo + v);
  }
  Logger.log('Fila auditada: ' + FILA + '\n' + lineas.join('\n'));
}
