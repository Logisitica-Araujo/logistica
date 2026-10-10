// ============================================================
//  OPERACIONES v6.0 — Script principal
//
//  ⚡ NUEVO EN v6.0 — la versión "rápida de verdad". Cambios:
//
//  1) EL onEdit CORRÍA DOS VECES POR CADA EDICIÓN. La función se llama
//     "onEdit" (Google la corre sola como activador simple) Y ADEMÁS
//     OPS_instalarTriggerEdicionOperaciones creaba un activador instalable
//     que también apuntaba a "onEdit". Resultado: cada clic hacía todo el
//     trabajo dos veces, en paralelo, peleándose entre sí. Ahora:
//       - onEdit ignora la segunda ejecución (la del activador instalable).
//       - OPS_quitarTriggerDuplicadoOnEdit() borra ese activador sobrante.
//
//  2) FÓRMULAS DE C, D, E, Z — 100× MÁS LIGERAS. En v5 CADA celda (≈2000
//     filas × 4 columnas) limpiaba la columna completa de IDs de Cat
//     (5000 filas, quitando "#" y espacios) antes de buscar. Eso son
//     decenas de millones de operaciones cada vez que Cat cambia. Ahora
//     existe una hoja oculta "OpsIdx" con UNA sola fórmula que limpia los
//     IDs de Cat (y las listas de COLIMA/IMSS de Datos) una sola vez, y
//     cada fila solo hace una búsqueda directa contra esa lista ya limpia.
//
//  3) DUPLICADOS (columna Y) — de 2000 COUNTIFS a UNA fórmula. Antes cada
//     fila contaba contra las 2000 filas (≈4 millones de comparaciones)
//     cada vez que tocabas una ID o un Área. Ahora Y4 tiene una sola
//     fórmula que agrupa todas las claves de una pasada.
//
//  4) MENOS VIAJES AL SERVIDOR EN CADA EDICIÓN. Cada lectura (getValue)
//     obliga a esperar a Google; las escrituras se agrupan solas. Ahora:
//       - Al elegir Gestor/Vehículo/Plataforma/Guía: 1 lectura (antes ~10).
//       - Al cambiar Método de envío: 1 lectura + 2 escrituras agrupadas
//         (antes 1 + 4 + 2-3 por separado).
//       - Al cambiar Área o casilla: se usa el valor que trae el propio
//         evento (e.value) — 0 lecturas.
//       - Desplegable de SubÁrea de COLIMA/IMSS: en caché (antes releía
//         Datos completo en cada cambio de área).
//     Y si pegas varias filas de golpe, se procesan TODAS (antes solo la
//     primera).
//
//  5) CORRECCIÓN UBER: v5 bloqueaba I:L (Gestor..Plataforma) para UBER y
//     escribía "NO APLICA" en Plataforma justo después de ponerle su
//     desplegable — así que Plataforma nunca se podía llenar y el ETA /
//     de UBER jamás se marcaba. Ahora UBER bloquea I:K y deja
//     Plataforma (L) libre con su desplegable.
//
//  6) "En ruta por otro método": ahora marca el ETA en cuanto eliges ese
//     método — antes solo pasaba si después
//     editabas Gestor/Vehículo/Plataforma/Guía, que para ese método no
//     aplican.
//
//  ⚠️ DESPUÉS DE PEGAR ESTA VERSIÓN: ejecuta UNA SOLA VEZ la función
//  OPS_INSTALAR_TODO (es la primera del archivo). Hace todo sola.
//  El archivo de diseño / ⚡ Atajos NO se toca: tu presentación queda igual.
//
//  Hojas: Operaciones | Cat | Datos | OpsIdx (oculta, la crea el script)
//  Los datos en Operaciones empiezan en la fila 4 (filas 1-3 = encabezados)
//  Los datos en Datos empiezan en la fila 3 (filas 1-2 = encabezados)
//  Los datos en Cat empiezan en la fila 2 (fila 1 = encabezados)
//
//  Lo que hace cada parte:
//    - C (SubÁrea), D (Nombre), E (Dirección), Z (Nota Cat): fórmulas por
//      fila que buscan en OpsIdx. C se reemplaza por un desplegable
//      manual cuando el Área es COLIMA o IMSS.
//    - Y (Duplicado): una sola fórmula en Y4 que se extiende hacia abajo.
//    - Apps Script (onEdit) solo hace lo que una fórmula no puede:
//      autonumerar TAREA, marcar fechas (F, O, R, T, V), desplegables
//      dependientes y bloqueo según método.
//
//  7) WhatsApp ELIMINADO (no se usaba). Ya no se genera el link en AE ni
//     existe OPS_generarLinksWhatsAppTodaLaHoja. Los links que ya estén en
//     la columna AE se quedan como están; puedes borrarlos a mano si quieres.
// ============================================================

// ============================================================
//  ▶▶▶ INSTALADOR DE UN SOLO CLIC ◀◀◀
//  Es la PRIMERA función del archivo a propósito: en el editor de Apps
//  Script aparece seleccionada sola en la lista de arriba. Solo dale
//  "Ejecutar". No toca el diseño (colores, fuentes, menú ⚡ Atajos).
// ============================================================
function OPS_INSTALAR_TODO() {
  const eliminados = OPS_quitarTriggerDuplicadoOnEdit(true);
  if (!OPS_instalarFormulasAutocompletado(true)) return;
  OPS_configurarFormatoCondicionalDuplicados(true);
  opsLimpiarCacheListas_();
  SpreadsheetApp.getUi().alert(
    "✅ TODO INSTALADO\n\n" +
    "• Activadores duplicados eliminados: " + eliminados + "\n" +
    "• Fórmulas rápidas instaladas en C, D, E, Y, Z\n" +
    "• Aviso rosa de duplicados activado\n" +
    "• Tu diseño quedó igual\n\n" +
    "Ya puedes cerrar esta pestaña y usar la hoja normalmente."
  );
}

// -----------------------------------------------------------
// Configuración central — cambia aquí si mueven columnas en Cat.
// En v6 este bloque SÍ se usa: genera la fórmula de la hoja OpsIdx. Si
// mueves una columna en Cat, actualiza este bloque y vuelve a correr
// OPS_instalarFormulasAutocompletado().
// -----------------------------------------------------------
const OPS_CONFIG = {
  "IMSS MORELIA": {
    idCol:      148, // ER
    subAreaCol: 143, // EM -> Operaciones!C
    nombreCol:  144, // EN -> Operaciones!D
    dirCol:     151, // EU -> Operaciones!E
    obsCol:     null, // ⚠️ no confirmado todavía
  },
  FADERMEX: {
    idCol:      178, // FV
    subAreaCol: 183, // GA -> Operaciones!C
    nombreCol:  181, // FY -> Operaciones!D
    dirCol:     182, // FZ -> Operaciones!E
    obsCol:     null, // ⚠️ no confirmado todavía
  },
  BOTICAN: {
    idCol:      212, // HD
    subAreaCol: 216, // HH -> Operaciones!C
    nombreCol:  214, // HF -> Operaciones!D
    dirCol:     215, // HG -> Operaciones!E
    obsCol:     234, // HZ — confirmado -> Operaciones!Z
  },
};

const OPS_AREAS_ID_LOOKUP = Object.keys(OPS_CONFIG); // ["IMSS MORELIA", "FADERMEX", "BOTICAN"]
const OPS_AREAS_LISTA_MANUAL = ["COLIMA", "IMSS"];
const OPS_AREAS_VALIDAS = [...OPS_AREAS_ID_LOOKUP, ...OPS_AREAS_LISTA_MANUAL];

// Columnas fijas en hoja Operaciones (base 1)
const OPS_COL_ID        = 1;  // A
const OPS_COL_AREA      = 2;  // B
const OPS_COL_SUBAREA   = 3;  // C  ← fórmula (o desplegable manual en COLIMA/IMSS)
const OPS_COL_NOMBRE    = 4;  // D  ← fórmula
const OPS_COL_DIRECCION = 5;  // E  ← fórmula
const OPS_COL_FECHA     = 6;  // F
const OPS_COL_ZONA      = 7;  // G
const OPS_COL_METODO_ENVIO = 8;  // H
const OPS_COL_GESTOR       = 9;  // I
const OPS_COL_VEHICULO     = 10; // J
const OPS_COL_PAQUETERIA   = 11; // K
const OPS_COL_PLATAFORMA   = 12; // L
const OPS_COL_GUIA         = 13; // M
const OPS_COL_COSTO        = 14; // N
const OPS_COL_ETA          = 15; // O — se marca por script
const OPS_COL_ESTATUS      = 16; // P — fórmula

const OPS_COL_DUPLICADO  = 25; // Y — UNA fórmula en Y4 para toda la columna
const OPS_COL_NOTA_CAT   = 26; // Z — nota pendiente de Cat (hoy solo BOTICAN)

const OPS_METODO_LOGISTICA_INTERNA  = "Logística Interna";
const OPS_METODO_UBER               = "UBER";
const OPS_METODO_PAQUETERIA_EXTERNA = "Paquetería Externa";
const OPS_METODO_OTRO               = "En ruta por otro método";
const OPS_OPCIONES_METODO_ENVIO_RESPALDO = [ // respaldo si Datos!P está vacío
  OPS_METODO_LOGISTICA_INTERNA, OPS_METODO_UBER, OPS_METODO_PAQUETERIA_EXTERNA, OPS_METODO_OTRO,
];

// [primera, última] columna que queda en "NO APLICA" con cada método.
const OPS_RANGOS_BLOQUEADOS_POR_METODO = {
  [OPS_METODO_LOGISTICA_INTERNA]:  [OPS_COL_PAQUETERIA, OPS_COL_COSTO],   // K:N
  [OPS_METODO_PAQUETERIA_EXTERNA]: [OPS_COL_GESTOR, OPS_COL_VEHICULO],    // I:J
  [OPS_METODO_UBER]:               [OPS_COL_GESTOR, OPS_COL_PAQUETERIA],  // I:K (v6: antes I:L, bloqueaba Plataforma)
};

// --- Datos es la fuente de TODAS las listas desplegables ---
const OPS_DATOS_FILA_INICIO       = 3;  // fila 1 = números, fila 2 = encabezados, datos desde fila 3
const OPS_DATOS_COL_GESTORES      = 1;  // A
const OPS_DATOS_COL_VEHICULOS     = 5;  // E
const OPS_DATOS_COL_AREA_LISTA    = 9;  // I
const OPS_DATOS_COL_SUBAREA_LISTA = 10; // J
const OPS_DATOS_COL_NOMBRE_LISTA  = 11; // K
const OPS_DATOS_COL_DIRECCION_LISTA = 12; // L
const OPS_DATOS_COL_METODOS       = 16; // P
const OPS_DATOS_COL_ZONA          = 24; // X
const OPS_DATOS_COL_PLATAFORMAS   = 32; // AF
const OPS_DATOS_COL_PAQUETERIAS   = 36; // AJ

// Qué desplegable lleva cada columna (I..L) según el método.
const OPS_LISTAS_POR_METODO = {
  [OPS_METODO_LOGISTICA_INTERNA]:  { [OPS_COL_GESTOR]: OPS_DATOS_COL_GESTORES, [OPS_COL_VEHICULO]: OPS_DATOS_COL_VEHICULOS },
  [OPS_METODO_PAQUETERIA_EXTERNA]: { [OPS_COL_PAQUETERIA]: OPS_DATOS_COL_PAQUETERIAS },
  [OPS_METODO_UBER]:               { [OPS_COL_PLATAFORMA]: OPS_DATOS_COL_PLATAFORMAS },
};

const OPS_TEXTO_NO_APLICA = "NO APLICA";

const OPS_COL_RETORNADO_FECHA = 18; // R
const OPS_COL_RETORNADO_CHECK = 19; // S
const OPS_COL_CANCELADO_FECHA = 20; // T
const OPS_COL_CANCELADO_CHECK = 21; // U
const OPS_COL_ENTREGA_FECHA   = 22; // V
const OPS_COL_ENTREGA_CHECK   = 23; // W

const OPS_FORMATO_FECHA_UNIFORME = 'ddd dd mmm yyyy", "hh:mm';
const OPS_COLUMNAS_FECHA_UNIFORME = [OPS_COL_FECHA, OPS_COL_ETA, OPS_COL_RETORNADO_FECHA, OPS_COL_CANCELADO_FECHA, OPS_COL_ENTREGA_FECHA];
const OPS_FILA_INICIO_DATOS = 4; // Operaciones: datos desde la fila 4
const OPS_ULTIMA_FILA_FORMULAS = 2003; // mínimo hasta dónde se instalan las fórmulas por fila

// 🔧 v6 — hoja oculta con los IDs de Cat ya limpios (una sola fórmula).
const OPS_HOJA_INDICE = "OpsIdx";

// ============================================================
//  CACHÉ de listas de Datos (Gestores, Vehículos, Paqueterías,
//  Plataformas y SubÁreas de COLIMA/IMSS). Se limpia sola al editar Datos.
// ============================================================
const OPS_CACHE_TTL_SEGUNDOS = 21600; // 6 horas

function opsListaCacheada_(clave, cargar) {
  let cache = null;
  try {
    cache = CacheService.getScriptCache();
    const cacheado = cache.get(clave);
    if (cacheado !== null) return JSON.parse(cacheado);
  } catch (err) {
    // Sin caché disponible: se lee directo, no truena nada.
  }
  const lista = cargar();
  try {
    if (cache) cache.put(clave, JSON.stringify(lista), OPS_CACHE_TTL_SEGUNDOS);
  } catch (err) {
    // Lista demasiado grande para la caché: se vuelve a leer la próxima vez.
  }
  return lista;
}

function opsClavesCache_() {
  return [OPS_DATOS_COL_GESTORES, OPS_DATOS_COL_VEHICULOS, OPS_DATOS_COL_PAQUETERIAS, OPS_DATOS_COL_PLATAFORMAS]
    .map(col => 'opsListaDatos_col' + col)
    .concat(OPS_AREAS_LISTA_MANUAL.map(area => 'opsSubAreas_' + area));
}

function opsLimpiarCacheListas_() {
  try { CacheService.getScriptCache().removeAll(opsClavesCache_()); } catch (err) {}
}

function opsObtenerListaDatosColumnaCacheada_(col) {
  return opsListaCacheada_('opsListaDatos_col' + col, () => opsObtenerListaDatosColumna_(col));
}

function opsOpcionesSubAreaManual_(area) {
  return opsListaCacheada_('opsSubAreas_' + area, () => {
    const datosSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Datos");
    if (!datosSheet) return [];
    const lastRow = datosSheet.getLastRow();
    if (lastRow < OPS_DATOS_FILA_INICIO) return [];
    const datos = datosSheet.getRange(OPS_DATOS_FILA_INICIO, OPS_DATOS_COL_AREA_LISTA, lastRow - OPS_DATOS_FILA_INICIO + 1, 2).getValues(); // I:J
    const opciones = datos
      .filter(par => String(par[0]).trim().toUpperCase() === area)
      .map(par => String(par[1]).trim())
      .filter(v => v !== "");
    return [...new Set(opciones)];
  });
}

// Botón manual — úsalo si acabas de agregar algo en Datos y quieres que se
// refleje ya (normalmente no hace falta: editar Datos limpia la caché solo).
function OPS_refrescarCacheListasDatos() {
  opsLimpiarCacheListas_();
  SpreadsheetApp.getUi().alert('✅ Caché limpiado — el próximo cambio releerá Datos una vez y lo vuelve a guardar.');
}

// ============================================================
//  🔧 HOJA ÍNDICE (OpsIdx) — v6
//  Columnas: A clave | B subárea | C nombre | D dirección | E nota
//  Clave de áreas por ID:        "BOTICAN|15511"   (ID sin "#" ni espacios)
//  Clave de áreas de lista:      "M|COLIMA|<SUBÁREA>"
//  Todo se calcula con UNA fórmula en A2; se recalcula sola cuando cambian
//  Cat o Datos.
// ============================================================
function opsRangoCat_(col) {
  const letra = OPS_colToLetter(col);
  return 'Cat!$' + letra + '$2:$' + letra;
}

function opsFormulaIndice_() {
  const bloques = OPS_AREAS_ID_LOOKUP.map(area => {
    const cfg = OPS_CONFIG[area];
    const ids = opsRangoCat_(cfg.idCol);
    // LEFT(x,0) = columna de vacíos del mismo tamaño (para áreas sin nota).
    const nota = cfg.obsCol ? opsRangoCat_(cfg.obsCol) : 'LEFT(' + ids + ',0)';
    return 'IFERROR(FILTER({"' + area + '|"&SUBSTITUTE(TRIM(TO_TEXT(' + ids + ')),"#",""),' +
      opsRangoCat_(cfg.subAreaCol) + ',' + opsRangoCat_(cfg.nombreCol) + ',' + opsRangoCat_(cfg.dirCol) + ',' + nota + '},' +
      ids + '<>""),"")';
  });

  const fi = OPS_DATOS_FILA_INICIO;
  const dI = 'Datos!$I$' + fi + ':$I', dJ = 'Datos!$J$' + fi + ':$J', dK = 'Datos!$K$' + fi + ':$K', dL = 'Datos!$L$' + fi + ':$L';
  bloques.push('IFERROR(FILTER({"M|"&UPPER(TRIM(' + dI + '))&"|"&UPPER(TRIM(' + dJ + ')),' + dJ + ',' + dK + ',' + dL + ',LEFT(' + dI + ',0)},' +
    dI + '<>"",' + dJ + '<>""),"")');

  return '=ARRAYFORMULA(IFNA(VSTACK(' + bloques.join(',') + '),""))';
}

function OPS_crearIndice() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(OPS_HOJA_INDICE);
  if (!hoja) hoja = ss.insertSheet(OPS_HOJA_INDICE);
  hoja.clear();
  hoja.getRange(1, 1, 1, 5).setValues([["clave", "subarea", "nombre", "direccion", "nota"]]);
  hoja.getRange(2, 1).setFormula(opsFormulaIndice_());
  hoja.hideSheet();
  return hoja;
}

// ============================================================
//  🔧 GENERADORES DE FÓRMULA (v6) — cada fila hace UNA búsqueda directa
//  en OpsIdx, sin limpiar columnas enteras.
// ============================================================
function opsRangoIndice_(letra) {
  return OPS_HOJA_INDICE + '!$' + letra + ':$' + letra;
}

function opsClaveId_(fila) {
  return 'a&"|"&SUBSTITUTE(TRIM($A' + fila + '),"#","")';
}

function opsEsAreaManualExpr_() {
  return 'OR(' + OPS_AREAS_LISTA_MANUAL.map(a => 'a="' + a + '"').join(',') + ')';
}

function opsFormulaSubArea_(fila) {
  return '=LET(a,UPPER(TRIM($B' + fila + ')),IF(OR(a="",$A' + fila + '=""),"",' +
    'IFERROR(XLOOKUP(' + opsClaveId_(fila) + ',' + opsRangoIndice_('A') + ',' + opsRangoIndice_('B') + '),"")))';
}

function opsFormulaBusquedaCompleta_(fila, letraResultado) {
  return '=LET(a,UPPER(TRIM($B' + fila + ')),IF(a="","",' +
    'IFERROR(XLOOKUP(IF(' + opsEsAreaManualExpr_() + ',"M|"&a&"|"&UPPER(TRIM($C' + fila + ')),' + opsClaveId_(fila) + '),' +
    opsRangoIndice_('A') + ',' + opsRangoIndice_(letraResultado) + '),"")))';
}

function opsFormulaNombre_(fila)    { return opsFormulaBusquedaCompleta_(fila, 'C'); }
function opsFormulaDireccion_(fila) { return opsFormulaBusquedaCompleta_(fila, 'D'); }

function opsFormulaNotaCat_(fila) {
  return '=LET(a,UPPER(TRIM($B' + fila + ')),IF(OR(a="",$A' + fila + '=""),"",' +
    'IFERROR(XLOOKUP(' + opsClaveId_(fila) + ',' + opsRangoIndice_('A') + ',' + opsRangoIndice_('E') + '),"")))';
}

// Una sola fórmula para toda la columna Y. Agrupa ID+Área con QUERY
// (una pasada) en vez de que cada fila cuente contra todas las demás.
function opsFormulaDuplicadoColumna_() {
  const f = OPS_FILA_INICIO_DATOS;
  return '=ARRAYFORMULA(LET(' +
    'ids,TRIM($A$' + f + ':$A&""),' +
    'k,IF((ids="")+REGEXMATCH(UPPER(ids),"^TAREA"),"",UPPER(ids)&"|"&UPPER(TRIM($B$' + f + ':$B&""))),' +
    'conteo,QUERY({k},"select Col1, count(Col1) where Col1 <> \'\' group by Col1 label count(Col1) \'\'",0),' +
    'IF(k="","",IF(IFERROR(VLOOKUP(k,conteo,2,FALSE),0)>1,"⚠ Duplicado",""))))';
}

// Escribe las fórmulas por fila (C si aplica, D:E y Z). Solo escrituras,
// cero lecturas.
function opsEscribirFormulasFila_(sheet, fila, areaMayus) {
  const nombre = opsFormulaNombre_(fila), direccion = opsFormulaDireccion_(fila);
  if (OPS_AREAS_LISTA_MANUAL.includes(areaMayus)) {
    sheet.getRange(fila, OPS_COL_NOMBRE, 1, 2).setFormulas([[nombre, direccion]]);
  } else {
    sheet.getRange(fila, OPS_COL_SUBAREA).clearDataValidations(); // por si quedó un desplegable de COLIMA/IMSS
    sheet.getRange(fila, OPS_COL_SUBAREA, 1, 3).setFormulas([[opsFormulaSubArea_(fila), nombre, direccion]]);
  }
  sheet.getRange(fila, OPS_COL_NOTA_CAT).setFormula(opsFormulaNotaCat_(fila));
}

// ============================================================
//  🔧 INSTALACIÓN (correr UNA vez, o cuando cambies columnas en Cat).
//  v6: respeta las SubÁreas escritas a mano en filas COLIMA/IMSS (v5 las
//  borraba al reinstalar).
// ============================================================
function OPS_instalarFormulasAutocompletado(silencioso) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Operaciones");
  if (!sheet) { SpreadsheetApp.getUi().alert("❌ Hoja Operaciones no encontrada."); return; }

  OPS_crearIndice();

  const ultimaFila = Math.max(OPS_ULTIMA_FILA_FORMULAS, sheet.getLastRow() + 200);
  if (sheet.getMaxRows() < ultimaFila) sheet.insertRowsAfter(sheet.getMaxRows(), ultimaFila - sheet.getMaxRows());
  const numFilas = ultimaFila - OPS_FILA_INICIO_DATOS + 1;

  const areas = sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_AREA, numFilas, 1).getValues(); // B
  const esManual = areas.map(a => OPS_AREAS_LISTA_MANUAL.includes(String(a[0]).trim().toUpperCase()));
  const nombreDir = [], nota = [];
  for (let i = 0; i < numFilas; i++) {
    const f = OPS_FILA_INICIO_DATOS + i;
    nombreDir.push([opsFormulaNombre_(f), opsFormulaDireccion_(f)]);
    nota.push([opsFormulaNotaCat_(f)]);
  }

  // D, E y Z son siempre fórmula: se les quita cualquier desplegable viejo
  // (si no, Google rechaza la fórmula por "infringir la validación").
  sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_NOMBRE, numFilas, 2).clearDataValidations().setFormulas(nombreDir);
  sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_NOTA_CAT, numFilas, 1).clearDataValidations().setFormulas(nota);

  // C: en COLIMA/IMSS la SubÁrea es manual y NO se toca (ni valor ni
  // desplegable). En las demás filas se quita el desplegable que hubiera
  // quedado y se pone la fórmula. Se escribe por tramos seguidos.
  for (let i = 0; i < numFilas; ) {
    if (esManual[i]) { i++; continue; }
    let j = i;
    while (j < numFilas && !esManual[j]) j++;
    const formulas = [];
    for (let k = i; k < j; k++) formulas.push([opsFormulaSubArea_(OPS_FILA_INICIO_DATOS + k)]);
    sheet.getRange(OPS_FILA_INICIO_DATOS + i, OPS_COL_SUBAREA, j - i, 1).clearDataValidations().setFormulas(formulas);
    i = j;
  }

  // Y: se vacía toda la columna y se pone UNA fórmula en Y4 que se extiende sola.
  sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_DUPLICADO, sheet.getMaxRows() - OPS_FILA_INICIO_DATOS + 1, 1).clearContent();
  sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_DUPLICADO).setFormula(opsFormulaDuplicadoColumna_());

  sheet.getRange(3, OPS_COL_DUPLICADO).setValue("Duplicado");
  sheet.getRange(3, OPS_COL_NOTA_CAT).setValue("Nota Cat");

  if (silencioso === true) return true;
  SpreadsheetApp.getUi().alert(
    "✅ Listo.\n\n" +
    "• Hoja oculta \"" + OPS_HOJA_INDICE + "\" creada (IDs de Cat ya limpios).\n" +
    "• Fórmulas ligeras en C, D, E y Z desde la fila " + OPS_FILA_INICIO_DATOS + " hasta la " + ultimaFila + ".\n" +
    "• Columna Y: una sola fórmula en Y" + OPS_FILA_INICIO_DATOS + ".\n\n" +
    "Siguiente paso: corre OPS_configurarFormatoCondicionalDuplicados()."
  );
}

// Pinta la fila cuando Y (Duplicado) no está vacía. Correr una vez.
function OPS_configurarFormatoCondicionalDuplicados(silencioso) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Operaciones");
  if (!sheet) { SpreadsheetApp.getUi().alert("❌ Hoja Operaciones no encontrada."); return; }

  const formula = '=$Y' + OPS_FILA_INICIO_DATOS + '<>""';
  const rango = sheet.getRange(
    OPS_FILA_INICIO_DATOS, OPS_COL_ID,
    sheet.getMaxRows() - OPS_FILA_INICIO_DATOS + 1,
    OPS_COL_ESTATUS - OPS_COL_ID + 1
  );

  // Quita cualquier versión anterior de esta misma regla (aunque su rango haya cambiado).
  const reglasActuales = sheet.getConditionalFormatRules().filter(function (r) {
    const cond = r.getBooleanCondition();
    return !(cond && cond.getCriteriaValues()[0] === formula);
  });

  const reglaDuplicado = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground("#fce8e6")
    .setRanges([rango])
    .build();

  // Va primero para que tenga prioridad sobre las demás reglas.
  sheet.setConditionalFormatRules([reglaDuplicado].concat(reglasActuales));
  if (silencioso === true) return;
  SpreadsheetApp.getUi().alert("✅ Formato condicional de duplicados instalado (filas A:P se pintan de rosa si Y tiene un aviso).");
}

// ============================================================
//  TRIGGER PRINCIPAL
// ============================================================
function onEdit(e) {
  if (!e || !e.range) return;

  // 🔧 v6 — si existe un activador instalable que también apunta a onEdit,
  // Google corre esta función DOS veces por edición. La copia del
  // activador simple (LIMITED) hace el trabajo; la del instalable (FULL)
  // se sale de inmediato. Para quitarla del todo:
  // OPS_quitarTriggerDuplicadoOnEdit().
  if (String(e.authMode) === 'FULL') return;

  const sheet = e.range.getSheet();
  const nombreHoja = sheet.getName();

  // Si tocan Datos, la caché de listas queda vieja: se limpia sola.
  if (nombreHoja === "Datos") { opsLimpiarCacheListas_(); return; }
  if (nombreHoja !== "Operaciones") return;

  const col = e.range.getColumn();
  const colFin = e.range.getLastColumn();
  const ultimaFila = e.range.getLastRow();
  if (ultimaFila < OPS_FILA_INICIO_DATOS) return;
  const filaIni = Math.max(e.range.getRow(), OPS_FILA_INICIO_DATOS);
  const nFilas = ultimaFila - filaIni + 1;
  const unaCelda = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;

  if (OPS_COLUMNAS_FECHA_UNIFORME.includes(col)) {
    sheet.getRange(filaIni, col, nFilas, 1).setNumberFormat(OPS_FORMATO_FECHA_UNIFORME);
  }

  if (col === OPS_COL_RETORNADO_CHECK) { opsManejarCheckboxes_(e, sheet, filaIni, nFilas, unaCelda, OPS_COL_RETORNADO_CHECK, OPS_COL_RETORNADO_FECHA); return; }
  if (col === OPS_COL_CANCELADO_CHECK) { opsManejarCheckboxes_(e, sheet, filaIni, nFilas, unaCelda, OPS_COL_CANCELADO_CHECK, OPS_COL_CANCELADO_FECHA); return; }
  if (col === OPS_COL_ENTREGA_CHECK)   { opsManejarCheckboxes_(e, sheet, filaIni, nFilas, unaCelda, OPS_COL_ENTREGA_CHECK, OPS_COL_ENTREGA_FECHA); return; }
  if (col === OPS_COL_METODO_ENVIO)    { opsManejarMetodoEnvio_(sheet, filaIni, nFilas); return; }
  if (col >= OPS_COL_GESTOR && col <= OPS_COL_COSTO) {
    opsManejarCamposEnvio_(sheet, filaIni, nFilas, col, Math.min(colFin, OPS_COL_COSTO));
    return;
  }
  if (col === OPS_COL_AREA) { opsManejarArea_(e, sheet, filaIni, nFilas, unaCelda); return; }
  if (col === OPS_COL_ID)   { opsManejarId_(sheet, filaIni, nFilas); return; }
}

// Valor de una edición de UNA celda sin ir al servidor: e.value lo trae;
// si la celda se borró, e.value no viene pero e.oldValue sí.
function opsValorEditado_(e) {
  if (e.value !== undefined) return e.value;
  if ('oldValue' in e) return "";
  return e.range.getCell(1, 1).getValue();
}

// ---- A: ID (autonumeración TAREA + fórmulas de la fila) ----
function opsManejarId_(sheet, filaIni, nFilas) {
  const bloque = sheet.getRange(filaIni, OPS_COL_ID, nFilas, 2).getValues(); // A:B — única lectura
  let siguienteTarea = null;
  bloque.forEach((fila, i) => {
    const r = filaIni + i;
    if (String(fila[0]).trim().toUpperCase() === "TAREA") {
      if (siguienteTarea === null) siguienteTarea = OPS_obtenerSiguienteNumeroTarea(sheet);
      sheet.getRange(r, OPS_COL_ID).setValue("TAREA # " + String(siguienteTarea++).padStart(4, '0'));
    }
    // Asegura que la fila tenga sus fórmulas (filas nuevas o si escribiste
    // el ID antes que el Área).
    opsEscribirFormulasFila_(sheet, r, String(fila[1]).trim().toUpperCase());
  });
}

// ---- B: Área (fecha de captura, SubÁrea manual o fórmula) ----
function opsManejarArea_(e, sheet, filaIni, nFilas, unaCelda) {
  const areas = unaCelda ? [[opsValorEditado_(e)]] : sheet.getRange(filaIni, OPS_COL_AREA, nFilas, 1).getValues();
  const ahora = new Date();
  sheet.getRange(filaIni, OPS_COL_FECHA, nFilas, 1)
    .setNumberFormat(OPS_FORMATO_FECHA_UNIFORME)
    .setValues(areas.map(() => [ahora]));

  areas.forEach((fila, i) => {
    const r = filaIni + i;
    const area = String(fila[0]).trim().toUpperCase();
    const celdaSub = sheet.getRange(r, OPS_COL_SUBAREA);
    if (OPS_AREAS_LISTA_MANUAL.includes(area)) {
      celdaSub.clearContent();
      OPS_aplicarListaDesplegable(celdaSub, opsOpcionesSubAreaManual_(area));
    } else {
      celdaSub.clearDataValidations();
    }
    opsEscribirFormulasFila_(sheet, r, area);
  });
}

// ---- S / U / W: casillas que marcan fecha ----
function opsManejarCheckboxes_(e, sheet, filaIni, nFilas, unaCelda, colCheck, colFecha) {
  const esVerdadero = v => v === true || String(v).toUpperCase() === "TRUE";
  const rangoFecha = sheet.getRange(filaIni, colFecha, nFilas, 1);
  const ahora = new Date();

  if (unaCelda) {
    if (esVerdadero(opsValorEditado_(e))) rangoFecha.setNumberFormat(OPS_FORMATO_FECHA_UNIFORME).setValue(ahora);
    else rangoFecha.clearContent();
    return;
  }

  // Varias casillas a la vez: las que ya tenían fecha la conservan.
  const checks = sheet.getRange(filaIni, colCheck, nFilas, 1).getValues();
  const fechas = rangoFecha.getValues();
  rangoFecha.setNumberFormat(OPS_FORMATO_FECHA_UNIFORME).setValues(checks.map((c, i) =>
    [esVerdadero(c[0]) ? (fechas[i][0] !== "" ? fechas[i][0] : ahora) : ""]
  ));
}

// ---- H: Método de envío ----
// 1 lectura (H:N) + 1 escritura de valores (I:N) + 1 de validaciones (I:L).
function opsManejarMetodoEnvio_(sheet, filaIni, nFilas) {
  const bloque = sheet.getRange(filaIni, OPS_COL_METODO_ENVIO, nFilas, OPS_COL_COSTO - OPS_COL_METODO_ENVIO + 1).getValues(); // H:N
  const validacionPorLista = {};
  const validacion = colDatos => {
    if (!(colDatos in validacionPorLista)) {
      const lista = opsObtenerListaDatosColumnaCacheada_(colDatos);
      validacionPorLista[colDatos] = lista.length
        ? SpreadsheetApp.newDataValidation().requireValueInList(lista, true).setAllowInvalid(false).build()
        : null;
    }
    return validacionPorLista[colDatos];
  };

  const nuevosValores = [], nuevasValidaciones = [], filasEnRuta = [];
  bloque.forEach((fila, i) => {
    const metodo = String(fila[0]).trim();
    const valores = fila.slice(1).map(v => (String(v).trim() === OPS_TEXTO_NO_APLICA ? "" : v)); // I:N

    const bloqueado = OPS_RANGOS_BLOQUEADOS_POR_METODO[metodo];
    if (bloqueado) {
      for (let c = bloqueado[0]; c <= bloqueado[1]; c++) valores[c - OPS_COL_GESTOR] = OPS_TEXTO_NO_APLICA;
    }

    const listas = OPS_LISTAS_POR_METODO[metodo] || {};
    const validaciones = [];
    for (let c = OPS_COL_GESTOR; c <= OPS_COL_PLATAFORMA; c++) validaciones.push(listas[c] ? validacion(listas[c]) : null);

    nuevosValores.push(valores);
    nuevasValidaciones.push(validaciones);
    if (metodo === OPS_METODO_OTRO) filasEnRuta.push(filaIni + i);
  });

  sheet.getRange(filaIni, OPS_COL_GESTOR, nFilas, OPS_COL_COSTO - OPS_COL_GESTOR + 1).setValues(nuevosValores);
  sheet.getRange(filaIni, OPS_COL_GESTOR, nFilas, OPS_COL_PLATAFORMA - OPS_COL_GESTOR + 1).setDataValidations(nuevasValidaciones);

  // "En ruta por otro método" no tiene campos que llenar: sale en cuanto se elige.
  filasEnRuta.forEach(r => opsIntentarActivarSalida_(sheet, r));
}

// ---- I..N: bloqueo suave + disparo de salida (ETA) ----
// Una sola lectura de la fila (A:O) en vez de ~10 por separado.
function opsManejarCamposEnvio_(sheet, filaIni, nFilas, colIni, colFin) {
  const bloque = sheet.getRange(filaIni, 1, nFilas, OPS_COL_ETA).getValues(); // A:O
  const colsSalida = [OPS_COL_GESTOR, OPS_COL_VEHICULO, OPS_COL_PLATAFORMA, OPS_COL_GUIA];
  let huboBloqueo = false;

  bloque.forEach((v, i) => {
    const r = filaIni + i;
    const bloqueado = OPS_RANGOS_BLOQUEADOS_POR_METODO[String(v[OPS_COL_METODO_ENVIO - 1]).trim()];
    let tocaBloqueada = false;
    if (bloqueado) {
      for (let c = Math.max(colIni, bloqueado[0]); c <= Math.min(colFin, bloqueado[1]); c++) {
        tocaBloqueada = true;
        if (String(v[c - 1]).trim() !== OPS_TEXTO_NO_APLICA) sheet.getRange(r, c).setValue(OPS_TEXTO_NO_APLICA);
      }
    }
    if (tocaBloqueada) { huboBloqueo = true; return; }

    if (colsSalida.some(c => c >= colIni && c <= colFin)) opsActivarSalidaConValores_(sheet, r, v);
  });

  if (huboBloqueo) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Esta celda no aplica para el método de envío seleccionado en esta fila.", "🔒 Campo no editable", 5);
  }
}

// Marca el ETA cuando el pedido ya salió. Recibe la fila ya leída (A:O)
// para no volver a leer celda por celda.
function opsActivarSalidaConValores_(sheet, fila, v) {
  const txt = col => String(v[col - 1] == null ? "" : v[col - 1]).trim();
  const esReal = s => s !== "" && s !== OPS_TEXTO_NO_APLICA;
  const metodo = txt(OPS_COL_METODO_ENVIO);

  let listo = false;
  if (metodo === OPS_METODO_PAQUETERIA_EXTERNA)     listo = esReal(txt(OPS_COL_GUIA));
  else if (metodo === OPS_METODO_LOGISTICA_INTERNA) listo = esReal(txt(OPS_COL_GESTOR)) && esReal(txt(OPS_COL_VEHICULO));
  else if (metodo === OPS_METODO_UBER)              listo = esReal(txt(OPS_COL_PLATAFORMA));
  else if (metodo === OPS_METODO_OTRO)              listo = true;
  if (!listo) return;

  if (txt(OPS_COL_ETA) === "") {
    sheet.getRange(fila, OPS_COL_ETA).setNumberFormat(OPS_FORMATO_FECHA_UNIFORME).setValue(new Date());
  }
}

function opsIntentarActivarSalida_(sheet, fila) {
  opsActivarSalidaConValores_(sheet, fila, sheet.getRange(fila, 1, 1, OPS_COL_ETA).getValues()[0]);
}

// ============================================================
//  NUMERACIÓN DE TAREAS
// ============================================================
function OPS_obtenerSiguienteNumeroTarea(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < OPS_FILA_INICIO_DATOS) return 1;
  const ids = sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_ID, lastRow - OPS_FILA_INICIO_DATOS + 1, 1).getValues();
  let maxNum = 0;
  const regex = /^TAREA\s*#\s*(\d+)$/i;
  for (let i = 0; i < ids.length; i++) {
    const match = String(ids[i][0]).trim().match(regex);
    if (match) { const num = parseInt(match[1], 10); if (num > maxNum) maxNum = num; }
  }
  return maxNum + 1;
}

// ============================================================
//  MÉTODO DE ENVÍO / LISTAS — utilidades
// ============================================================

// Compatibilidad con v5 (por si algún botón o macro la llama).
function OPS_manejarMetodoEnvio(sheet, fila) {
  opsManejarMetodoEnvio_(sheet, fila, 1);
}

function opsObtenerListaDatosColumna_(col) {
  const datosSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Datos");
  if (!datosSheet) return [];
  const lastRow = datosSheet.getLastRow();
  if (lastRow < OPS_DATOS_FILA_INICIO) return [];
  const valores = datosSheet.getRange(OPS_DATOS_FILA_INICIO, col, lastRow - OPS_DATOS_FILA_INICIO + 1, 1).getValues().flat();
  return [...new Set(valores.map(v => String(v).trim()).filter(v => v !== ""))];
}

function OPS_limpiarNoAplica(sheet, fila, colInicio, colFin) {
  const rango = sheet.getRange(fila, colInicio, 1, colFin - colInicio + 1);
  const valores = rango.getValues()[0];
  rango.setValues([valores.map(v => (String(v).trim() === OPS_TEXTO_NO_APLICA ? "" : v))]);
}

function OPS_aplicarListaDesplegable(rango, lista) {
  if (!lista.length) { rango.clearDataValidations(); return; }
  rango.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(lista, true).setAllowInvalid(false).build());
}

function OPS_configurarValidacionMetodoEnvioFila(sheet, fila) {
  const lista = opsObtenerListaDatosColumna_(OPS_DATOS_COL_METODOS);
  sheet.getRange(fila, OPS_COL_METODO_ENVIO).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(lista.length ? lista : OPS_OPCIONES_METODO_ENVIO_RESPALDO, true).setAllowInvalid(false).build()
  );
}

function OPS_configurarValidacionAreaTodaLaHoja() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Operaciones");
  const lastRow = Math.max(sheet.getLastRow(), 1000);
  const opciones = opsObtenerListaDatosColumna_(OPS_DATOS_COL_AREA_LISTA);
  sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_AREA, lastRow - OPS_FILA_INICIO_DATOS + 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opciones, true).setAllowInvalid(false).build());
  SpreadsheetApp.getUi().alert("✅ Desplegable de Área aplicado, usando Datos!I.");
}

function OPS_configurarValidacionZonaTodaLaHoja() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Operaciones");
  const lastRow = Math.max(sheet.getLastRow(), 1000);
  const opciones = opsObtenerListaDatosColumna_(OPS_DATOS_COL_ZONA);
  sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_ZONA, lastRow - OPS_FILA_INICIO_DATOS + 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opciones, true).setAllowInvalid(false).build());
  SpreadsheetApp.getUi().alert("✅ Desplegable de Zona aplicado, usando Datos!X.");
}

function OPS_configurarValidacionMetodoEnvioTodaLaHoja() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Operaciones");
  const lastRow = Math.max(sheet.getLastRow(), 1000);
  const lista = opsObtenerListaDatosColumna_(OPS_DATOS_COL_METODOS);
  sheet.getRange(OPS_FILA_INICIO_DATOS, OPS_COL_METODO_ENVIO, lastRow - OPS_FILA_INICIO_DATOS + 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(lista.length ? lista : OPS_OPCIONES_METODO_ENVIO_RESPALDO, true).setAllowInvalid(false).build());
  SpreadsheetApp.getUi().alert("✅ Desplegable de Método de envío aplicado, usando Datos!P.");
}

// ============================================================
//  FECHAS
// ============================================================
function OPS_manejarCheckboxFecha(sheet, fila, colCheck, colFecha) {
  const valor = sheet.getRange(fila, colCheck).getValue();
  const celda = sheet.getRange(fila, colFecha);
  if (valor === true) celda.setNumberFormat(OPS_FORMATO_FECHA_UNIFORME).setValue(new Date());
  else celda.clearContent();
}

// ============================================================
//  AUXILIARES
// ============================================================
function opsNormalizarId_(valor) { return String(valor).trim().replace(/^#/, ""); }

function OPS_colToLetter(col) {
  let letter = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

function OPS_verificarMapeoColumnas() {
  const log = [];
  for (const [area, cfg] of Object.entries(OPS_CONFIG)) {
    log.push(`=== ${area} ===`);
    log.push(`  ID → ${OPS_colToLetter(cfg.idCol)} | SubÁrea → ${OPS_colToLetter(cfg.subAreaCol)} | Nombre → ${OPS_colToLetter(cfg.nombreCol)} | Dir → ${OPS_colToLetter(cfg.dirCol)} | Obs → ${cfg.obsCol ? OPS_colToLetter(cfg.obsCol) : "N/A"}`);
  }
  log.push(`\nGestores ← Datos!${OPS_colToLetter(OPS_DATOS_COL_GESTORES)} | Vehículos ← Datos!${OPS_colToLetter(OPS_DATOS_COL_VEHICULOS)} | Paqueterías ← Datos!${OPS_colToLetter(OPS_DATOS_COL_PAQUETERIAS)} | Plataformas ← Datos!${OPS_colToLetter(OPS_DATOS_COL_PLATAFORMAS)}`);
  log.push(`Área (col B) ← Datos!${OPS_colToLetter(OPS_DATOS_COL_AREA_LISTA)} | Zona (col G) ← Datos!${OPS_colToLetter(OPS_DATOS_COL_ZONA)} | Método (col H) ← Datos!${OPS_colToLetter(OPS_DATOS_COL_METODOS)}`);
  log.push(`\n⚠️ Recuerda: si cambias algo aquí, corre también OPS_instalarFormulasAutocompletado() para regenerar OpsIdx y las fórmulas.`);
  Logger.log(log.join("\n"));
  SpreadsheetApp.getUi().alert("Mapeo de columnas\n\n" + log.join("\n"));
}

// 🔧 v6 — EJECUTAR UNA VEZ. Borra los activadores instalables que apuntan a
// "onEdit": Google ya la corre sola como activador simple, así que el
// instalable solo la duplicaba.
function OPS_quitarTriggerDuplicadoOnEdit(silencioso) {
  let eliminados = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onEdit') { ScriptApp.deleteTrigger(t); eliminados++; }
  });
  const msg = `✅ Listo. Se eliminaron ${eliminados} activador(es) instalable(s) duplicado(s) de onEdit.\n` +
    `onEdit sigue funcionando (Google la corre sola como activador simple), ahora una sola vez por edición.`;
  Logger.log(msg);
  if (silencioso === true) return eliminados;
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) {}
}

// Se conserva el nombre de v5, pero ya NO crea un activador nuevo (eso era
// lo que hacía correr onEdit dos veces).
function OPS_instalarTriggerEdicionOperaciones() {
  OPS_quitarTriggerDuplicadoOnEdit();
}

// 🔧 Diagnóstico — ahora también revisa activadores, reglas de formato
// condicional y funciones volátiles (NOW/TODAY/RAND/INDIRECT/OFFSET), que
// se recalculan en CADA edición.
function OPS_diagnosticoTamanoHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];
  ["Operaciones", "Cat", "Datos", OPS_HOJA_INDICE].forEach(nombre => {
    const sheet = ss.getSheetByName(nombre);
    if (!sheet) { log.push(`${nombre}: no encontrada`); return; }
    log.push(`${nombre}: ${sheet.getMaxRows()} filas x ${sheet.getMaxColumns()} columnas | getLastRow()=${sheet.getLastRow()} getLastColumn()=${sheet.getLastColumn()} | reglas de formato condicional: ${sheet.getConditionalFormatRules().length}`);
  });

  const triggersOnEdit = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'onEdit').length;
  log.push(`\nActivadores instalables apuntando a onEdit: ${triggersOnEdit}${triggersOnEdit ? "  ⚠️ corre OPS_quitarTriggerDuplicadoOnEdit()" : "  ✅"}`);

  const ops = ss.getSheetByName("Operaciones");
  if (ops && ops.getLastRow() >= OPS_FILA_INICIO_DATOS) {
    const filaMuestra = Math.max(OPS_FILA_INICIO_DATOS, ops.getLastRow());
    const filas = [OPS_FILA_INICIO_DATOS, filaMuestra];
    const volatiles = /\b(NOW|TODAY|RAND|RANDBETWEEN|INDIRECT|OFFSET|IMPORTRANGE)\s*\(/i;
    const hallazgos = [];
    filas.forEach(f => {
      ops.getRange(f, 1, 1, ops.getLastColumn()).getFormulas()[0].forEach((fx, i) => {
        if (fx && volatiles.test(fx)) hallazgos.push(`${OPS_colToLetter(i + 1)}${f}: ${fx.substring(0, 80)}`);
      });
    });
    log.push(hallazgos.length
      ? `\nFórmulas volátiles en Operaciones (se recalculan en cada edición):\n  ${hallazgos.join("\n  ")}`
      : `\nSin fórmulas volátiles en las filas ${filas.join(" y ")} de Operaciones ✅`);
  }

  const mensaje = log.join("\n") + "\n\nSi getLastRow()/getLastColumn() es mucho más grande que donde termina tu contenido real, borra las filas/columnas vacías sobrantes.";
  Logger.log(mensaje);
  try {
    SpreadsheetApp.getUi().alert("Diagnóstico\n\n" + mensaje);
  } catch (err) {
    Logger.log("(No se pudo mostrar el aviso emergente — pero el resultado de arriba es válido.)");
  }
}
