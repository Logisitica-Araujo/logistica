/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  00_CONFIG.gs   (VERSIÓN 3.0)
 * ---------------------------------------------------------------------
 * CAMBIOS DE LA 3.0 (velocidad):
 *  • El libro se abre UNA vez por consulta. Antes cada _hoja() volvía a
 *    abrir el libro gigante (openById), y una sola pantalla lo hacía
 *    decenas de veces.
 *  • Preparado para que las hojas APP_* vivan en un libro propio y ligero
 *    (ver 10_LIBRO_APP.gs). "Operaciones", "Datos" y APP_Entregas se quedan
 *    en el libro de siempre. Mientras no corras la migración, todo sigue igual.
 *
 * >>> AL PEGAR ESTE ARCHIVO: vuelve a escribir tu CLAVE_ADMIN abajo. <<<
 ***********************************************************************/

const CFG = {

  /* ---------- 1. IDENTIFICADORES ---------- */

  // Libro de la oficina: aquí viven "Operaciones" y "Datos".
  ID_HOJA: '1cPHTH2JwM92iD2wSxf4JauYLk9VBLv6T2fHhtxP-kmc',
  NOMBRE_APP: 'Logística FADERMEX',

  /* --------------------------------------------------------------------
   * CARPETAS DE DRIVE — una por resultado.
   * El archivo se guarda con el ID del pedido COMO NOMBRE Y NADA MÁS
   * (ej. "#15780"), para que tu buscador de rastreo lo encuentre.
   * Por eso cada resultado necesita su propia carpeta: si no, un pedido
   * que primero se retorna y luego se entrega tendría dos archivos
   * llamados igual en el mismo lugar.
   *
   * Si dejas un ID vacío, el script crea (una sola vez) una subcarpeta
   * con ese nombre dentro de la carpeta de ENTREGADO y la usa.
   * ------------------------------------------------------------------ */
  CARPETAS_DRIVE: {
    ENTREGADO: '1fGcPo7r1p2QHw-wV507l1ovzesKj9-fu',   // Pedidos entregados Logística
    RETORNO:   '1aRw_0Xv719WXD6cyxzLD7yEGZ2jHZFpu',   // ...Logistica RETORNO
    CANCELADO: '1tLoTzGye9z6QBaHNiiJRfUTskurv9cAb',   // ...Logistica CANCELADO
    FIRMAS:    '153U2PjEDCaNvkIxoIfuz2nYLGrEixM7q',   // Firmas del cliente
    TRASPASOS: ''       // vacío = la app crea la subcarpeta "TRASPASOS" sola.
                        // Cuando tengas la tuya, pega aquí su ID.
  },

  // ¿El nombre del archivo lleva extensión?
  //   false → "#15780"       (igual a lo que ya tienes en Drive)
  //   true  → "#15780.jpg"
  EXTENSION_EN_NOMBRE: false,

  // Si ya existe un archivo con ese ID en la carpeta destino, el anterior
  // se manda a la papelera (recuperable 30 días) para que SIEMPRE haya uno
  // solo por pedido y tu buscador nunca muestre la foto equivocada.
  REEMPLAZAR_SI_EXISTE: true,


  /* ---------- 2. PUERTA TRASERA (SOLO TÚ) ---------- */

  // >>> ESCRIBE AQUÍ TU CLAVE OTRA VEZ <<<
  CLAVE_ADMIN: 'PON-AQUI-TU-CLAVE',

  ADMINS: ['jaraujo@fadermex.com'],


  /* ---------- 3. HOJAS EXISTENTES ---------- */

  HOJA_OPERACIONES: 'Operaciones',

  // OJO: el catálogo de gestores, códigos, vehículos y sucursales NO está
  // en "Cat" — está en la hoja "Datos". (Confirmado con el explorador.)
  HOJA_CAT:         'Datos',

  // Fila donde están los encabezados. En tus dos hojas es la 2.
  FILA_ENC_OPERACIONES: 2,
  FILA_ENC_CAT:         2,

  // Filas de NOTAS que van debajo del encabezado y NO son datos.
  // 'auto' = el script las detecta solo. O pon el número exacto.
  FILAS_DESCRIPCION: {
    'Operaciones': 'auto',
    'Datos':       'auto'
  },

  /* --------------------------------------------------------------------
   * MAPEO DE COLUMNAS
   * Puedes poner:
   *   'col:A'                → la columna A, sin buscar nada (a prueba de balas)
   *   'Nombre del encabezado' → lo busca por nombre
   *   ['col:I', 'Gestores']   → usa la letra; si algún día cambia, busca el nombre
   * Si mueves una columna de lugar, aquí es donde se corrige.
   * ------------------------------------------------------------------ */

  COL_OPERACIONES: {
    id:        ['col:A',  'ID Pedido / Tarea'],
    area:      ['col:B',  'Área'],
    subarea:   ['col:C',  'Sub Área / Tipo'],
    nombre:    ['col:D',  'Nombre'],
    direccion: ['col:E',  'Dirección / Destino'],
    fecha:     ['col:F',  'Fecha de registro'],
    zona:      ['col:G',  'Zona'],
    metodo:    ['col:H',  'Método'],
    gestor:    ['col:I',  'Gestores'],
    vehiculo:  ['col:J',  'Vehículos'],
    estatus:   ['col:P',  'ESTATUS'],
    notas:     ['col:AH', 'Observaciones']
  },

  COL_CAT: {
    gestor:   ['col:A', 'Gestores'],
    codigo:   ['col:B', 'Codigos'],
    vehiculo: ['col:E', 'Vehiculos'],
    correo:   ['Correo']                   // en "Datos" no existe; queda vacío
  },

  // Bloque de sucursales dentro de "Datos": AX nombre, AY dirección, AZ URL.
  CAT_SUCURSALES_ENCABEZADO: 'col:AX',

  /* --------------------------------------------------------------------
   * QUÉ ESCRIBE LA APP EN "Operaciones"
   * La app NUNCA toca la columna ESTATUS: ese lo calcula TU fórmula.
   * Solo llena las columnas que le indiques aquí. Deja '' en cualquiera
   * que no quieras que toque, o pon activo:false para que no escriba nada.
   * ------------------------------------------------------------------ */
  ESCRIBIR_EN_OPERACIONES: {
    activo: true,

    // Según el botón que apretó el gestor:
    ENTREGADO: { fecha: 'col:V', check: 'col:W' },   // Fecha de Entrega  / Marcar como Entregado
    RETORNO:   { fecha: 'col:R', check: 'col:S' },   // Fecha RETORNADO   / Pedido Retornado
    CANCELADO: { fecha: 'col:T', check: 'col:U' },   // Fecha Cancelado   / Pedido Cancelado

    // Comunes a cualquier resultado:
    gestor:     'col:Y',    // Gestor Asignado
    gps:        'col:Z',    // Coordenadas GPS
    foto:       'col:AA',   // Foto de Evidencia
    firma:      'col:AB',   // Firma del Cliente
    motivo:     'col:AC',   // Motivo de Entrega Fallida
    comentario: 'col:AD',   // Solución
    vehiculo:   ''          // pon 'col:__' si quieres registrarlo también aquí
  },

  // Estatus que la app considera YA CERRADOS (nunca los muestra).
  ESTATUS_CERRADOS: ['ENTREGADO', 'CANCELADO', 'CANCELADO/RETORNO', 'RETORNO',
                     'RETORNADO', 'CERRADO'],

  // Si dejas la lista VACÍA, el gestor ve todo lo que no esté cerrado.
  // Si pones estatus aquí, SOLO verá esos (más los que estén en blanco).
  // Ejemplo: ['ENVIADO POR LOGISTICA INTERNA']
  ESTATUS_PERMITIDOS: [],


  /* ---------- 4. HOJAS QUE CREA LA APP ---------- */

  H: {
    CONFIG:      'APP_Config',
    USUARIOS:    'APP_Usuarios',
    VEHICULOS:   'APP_Vehiculos',
    SESIONES:    'APP_Sesiones',
    USO_VEH:     'APP_Vehiculos_Uso',
    ENTREGAS:    'APP_Entregas',
    TRASPASOS:   'APP_Traspasos',
    TRAS_HIST:   'APP_Traspasos_Hist',
    CAT_TRAS:    'APP_Catalogo_Traspasos',
    SUCURSALES:  'APP_Sucursales',
    MOTIVOS:     'APP_Motivos',
    LOG:         'APP_Log',
    DOCUMENTOS:  'APP_Documentos'
  },


  /* ---------- 5. REGLAS DE NEGOCIO ---------- */

  CANDADO_VEHICULO_MIN: 30,
  DURACION_SESION_HORAS: 14,     // desde la 3.0: "actividad reciente" (vehículos ocupados,
                                 // dispositivos). La sesión ya NO caduca por esto.
  SESION_INACTIVIDAD_HORAS: 72,  // la sesión se cierra sola tras 72 h SIN USAR la app
  SESION_MAX_DIAS: 30,           // y en todo caso, se pide login de nuevo cada 30 días
  REVISAR_NUEVOS_SEG: 45,
  FOTO_LADO_MAX: 1280,
  FOTO_CALIDAD: 0.72,
  NOTIFICAR_POR_CORREO: false,


  /* ---------- 6. CATÁLOGOS DE RESPALDO ---------- */
  // Solo se usan si "Cat" no los tiene. Después se editan desde el panel.

  SUCURSALES_INICIALES: [
    ['NUEVA ROMA PV', 'Av. Baja California 114 B, Roma Sur, Cuauhtémoc, 06760 Ciudad de México, CDMX', 'https://maps.app.goo.gl/FbRW1zySPTzeMGDC8'],
    ['VERTIZ PV',     'C. Dr. José María Vértiz 434, Buenos Aires, Cuauhtémoc, 06780 Ciudad de México, CDMX', 'https://maps.app.goo.gl/1hiZ14RAWjzzhkfz5'],
    ['COAPA PV',      'Calz. del Hueso 921 Local 29, Col. Granjas Coapa, Tlalpan, CDMX', 'https://maps.app.goo.gl/h4LvvdFCKBMWoUMi6'],
    ['DOCTORES PV',   'Eje 3 Sur, Dr. Ignacio Morones Prieto 155, Doctores, Cuauhtémoc, 06720 Ciudad de México, CDMX', 'https://maps.app.goo.gl/Ke68Mp5qqyFgbViS8'],
    ['ECATEPEC PV',   'Vía Morelos 172, interior C-5 Los Laureles, 55090 Ecatepec de Morelos, Méx.', 'https://maps.app.goo.gl/fHKbVsPdZV8HJAHA8']
  ],

  // Motivos del botón CANCELADO (el pedido ya no se entrega)
  MOTIVOS_CANCELADO: [
    'Entrega incorrecta',
    'Incidente con Materia prima',
    'Pedido extraviado o decomisado'
  ],

  // Motivos del botón RETORNO (se regresa y se vuelve a intentar)
  MOTIVOS_RETORNO: [
    'No se encontraba cliente',
    'Cambio de Dirección o Dirección incorrecta',
    'Primera visita',
    'Segunda visita'
  ],

  MOTIVOS_TRASPASO: [
    'Sucursal cerrada',
    'Traspaso extraviado',
    'Traspaso incorrecto',
    'Otro'
  ],

  MODULOS: [
    { id: 'pedidos',    titulo: 'Pedidos pendientes a entregar', icono: '🚚', color: '#1565C0', activo: true  },
    { id: 'traspasos',  titulo: 'Traspasos de sucursales',       icono: '🔄', color: '#00897B', activo: true  },
    { id: 'recolec',    titulo: 'Recolecciones',                 icono: '📦', color: '#EF6C00', activo: false },
    { id: 'catalogo',   titulo: 'Catálogo FADERMEX / BOTICAN',   icono: '📇', color: '#8E24AA', activo: false },
    { id: 'docs',       titulo: 'Documentación',                 icono: '📋', color: '#283593', activo: true  },
    { id: 'vehiculos',  titulo: 'Control de uso de vehículos',   icono: '🚗', color: '#F9A825', activo: true  },
    { id: 'historial',  titulo: 'Pedidos entregados',            icono: '✅', color: '#2E7D32', activo: true  }
  ]
};


/* ======================= UTILIDADES BÁSICAS ======================= */

/* VELOCIDAD v3.0 — los libros se abren UNA vez por consulta.
 * Antes _libro() hacía openById en cada llamada, y _hoja() lo llama en
 * cada lectura: una pantalla abría el libro gigante decenas de veces.
 * Las variables viven solo durante esa consulta: nunca sirven datos viejos. */
var __LIBRO_APP = null;
var __LIBRO_OPS = null;

/** ID del libro donde viven las hojas APP_*.
 *  Si corriste la migración (09_LIBRO_APP.gs), es el libro propio de la app.
 *  Si no, es el mismo libro de siempre. */
function _idLibroApp() {
  try {
    const id = PropertiesService.getScriptProperties().getProperty('ID_HOJA_APP');
    if (id) return id;
  } catch (e) { }
  return CFG.ID_HOJA;
}

/** Libro de la app (APP_Config, APP_Sesiones, APP_Entregas…). */
function _libro() {
  if (__LIBRO_APP) return __LIBRO_APP;
  const id = _idLibroApp();
  __LIBRO_APP = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return __LIBRO_APP;
}

/** Libro de la oficina ("Operaciones", "Datos"). */
function _libroOps() {
  if (__LIBRO_OPS) return __LIBRO_OPS;
  if (_idLibroApp() === CFG.ID_HOJA) { __LIBRO_OPS = _libro(); return __LIBRO_OPS; }
  __LIBRO_OPS = CFG.ID_HOJA ? SpreadsheetApp.openById(CFG.ID_HOJA)
                            : SpreadsheetApp.getActiveSpreadsheet();
  return __LIBRO_OPS;
}

/** Hojas que se quedan SIEMPRE en el libro de la oficina.
 *  APP_Entregas se queda ahí porque la columna V de "Operaciones" tiene una
 *  fórmula (SUMIFS) que lee la fecha de entrega directo de APP_Entregas, y
 *  una fórmula no puede leer otro libro sin IMPORTRANGE. */
function _quedaEnLibroOficina(nombreHoja) {
  return nombreHoja === CFG.HOJA_OPERACIONES ||
         nombreHoja === CFG.HOJA_CAT ||
         nombreHoja === CFG.H.ENTREGAS;
}

/** ¿En qué libro está esta hoja? Operaciones, Datos y APP_Entregas → oficina; el resto → app. */
function _libroDe(nombreHoja) {
  return _quedaEnLibroOficina(nombreHoja) ? _libroOps() : _libro();
}

function _hoja(nombre, crearSiFalta) {
  const ss = _libroDe(nombre);
  let sh = ss.getSheetByName(nombre);
  if (!sh && crearSiFalta) sh = ss.insertSheet(nombre);
  if (!sh) throw new Error('No existe la hoja "' + nombre + '". Corre el menú ⚙ Logística > Instalar / Reparar.');
  return sh;
}

function _norm(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/["'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function _normCodigo(v) {
  return String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

/** Convierte 'Área' o ['Área','Area'] siempre en arreglo. */
function _lista(v) { return Array.isArray(v) ? v : [v]; }

/**
 * ¿El texto contiene la frase como PALABRA COMPLETA?
 * Así "Sub Áreas" ya no se confunde con "Área", y "ID Pedido/Tarea"
 * ya no se confunde con "Área" (porque "tarea" contiene "area").
 */
function _contienePalabra(texto, frase) {
  if (!texto || !frase) return false;
  const f = frase.replace(/[.*+?^${}()|[\]\\\/\-]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + f + '([^a-z0-9]|$)').test(texto);
}

/** Convierte 'A' → 0, 'B' → 1, 'AX' → 49. */
function _letraAIdx(letra) {
  let n = 0;
  const s = String(letra).toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 64;
    if (c < 1 || c > 26) return -1;
    n = n * 26 + c;
  }
  return n - 1;
}

/**
 * Índice (0-based) de una columna. Acepta un nombre o una lista de nombres.
 * Primero busca coincidencia EXACTA de todos los candidatos; si ninguno
 * aparece, entonces busca coincidencia parcial.
 */
function _idxCol(encabezados, nombreOLista) {
  const bruto = _lista(nombreOLista);

  // 0) 'col:AX' → esa columna exacta, sin buscar nada
  for (let i = 0; i < bruto.length; i++) {
    const m = String(bruto[i] == null ? '' : bruto[i]).match(/^\s*col\s*:\s*([A-Za-z]{1,3})\s*$/);
    if (m) {
      const idx = _letraAIdx(m[1]);
      if (idx >= 0) return idx;
    }
  }

  const candidatos = bruto
    .filter(function (v) { return !/^\s*col\s*:/i.test(String(v)); })
    .map(_norm).filter(Boolean);

  // 1) coincidencia EXACTA (el caso normal)
  for (let c = 0; c < candidatos.length; c++) {
    for (let i = 0; i < encabezados.length; i++) {
      if (_norm(encabezados[i]) === candidatos[c]) return i;
    }
  }
  // 2) el encabezado CONTIENE el nombre buscado como palabra completa
  //    (nunca al revés: eso provocaba falsos positivos)
  for (let c = 0; c < candidatos.length; c++) {
    const obj = candidatos[c];
    if (obj.length < 4) continue;
    for (let i = 0; i < encabezados.length; i++) {
      if (_contienePalabra(_norm(encabezados[i]), obj)) return i;
    }
  }
  return -1;
}

function _mapaColumnas(encabezados, definicion) {
  const m = {};
  Object.keys(definicion).forEach(function (k) {
    m[k] = _idxCol(encabezados, definicion[k]);
  });
  return m;
}

/** Qué tan bien una fila sirve de encabezado: exacto vale 10, parcial 1. */
function _puntajeEncabezado(fila, definicion) {
  let p = 0;
  Object.keys(definicion).forEach(function (k) {
    const candidatos = _lista(definicion[k])
      .filter(function (v) { return !/^\s*col\s*:/i.test(String(v)); })
      .map(_norm).filter(Boolean);
    let exacto = false, parcial = false;
    for (let i = 0; i < fila.length; i++) {
      const h = _norm(fila[i]);
      if (!h) continue;
      for (let c = 0; c < candidatos.length; c++) {
        if (h === candidatos[c]) { exacto = true; break; }
        if (candidatos[c].length >= 4 && _contienePalabra(h, candidatos[c])) parcial = true;
      }
      if (exacto) break;
    }
    p += exacto ? 10 : (parcial ? 1 : 0);
  });
  return p;
}

/**
 * Abre una hoja y descubre dónde están los encabezados.
 * Devuelve { sh, filaEnc, enc, mapa, datos }  —  datos = filas de abajo.
 *
 * ---------------------------------------------------------------------
 * VELOCIDAD (cambio de la v2.2):
 *   Solo se leen las columnas hasta la última que el mapa usa.
 *   Los encabezados sí se leen completos (una sola fila, es baratísimo),
 *   así que la detección de columnas por nombre sigue funcionando igual.
 *
 *   colMinima  →  obliga a leer al menos hasta esa columna (1 = A).
 *   Se usa cuando el código lee columnas "vecinas" que no están en el
 *   mapa, como las sucursales en "Datos" (AX toma también AY y AZ).
 * ---------------------------------------------------------------------
 */
function _abrirTabla(nombreHoja, definicion, filaForzada, colMinima) {
  const sh = _libroDe(nombreHoja).getSheetByName(nombreHoja);
  if (!sh) throw new Error('No encontré la hoja "' + nombreHoja + '".');

  const ultCol = Math.max(1, sh.getLastColumn());
  const ultFila = sh.getLastRow();
  if (ultFila < 1) return { sh: sh, filaEnc: 1, enc: [], mapa: {}, datos: [], colsLeidas: 0 };

  let filaEnc = 1;
  if (filaForzada && String(filaForzada).toLowerCase() !== 'auto') {
    filaEnc = Number(filaForzada);
  } else {
    // 8 filas como mucho: no pesa aunque la hoja tenga 50 mil
    const aExplorar = Math.min(8, ultFila);
    const bloque = sh.getRange(1, 1, aExplorar, ultCol).getValues();
    let mejor = -1;
    for (let i = 0; i < aExplorar; i++) {
      const p = _puntajeEncabezado(bloque[i], definicion);
      if (p > mejor) { mejor = p; filaEnc = i + 1; }
    }
  }

  const enc = sh.getRange(filaEnc, 1, 1, ultCol).getValues()[0];
  const mapa = _mapaColumnas(enc, definicion);

  /* ---- Hasta dónde hay que leer de verdad ---- */
  let maxIdx = -1;
  Object.keys(mapa).forEach(function (k) { if (mapa[k] > maxIdx) maxIdx = mapa[k]; });
  let colsLeer = (maxIdx >= 0) ? (maxIdx + 1) : ultCol;
  if (colMinima) colsLeer = Math.max(colsLeer, Number(colMinima) || 0);
  colsLeer = Math.max(1, Math.min(ultCol, colsLeer));

  const nDatos = ultFila - filaEnc;
  let datos = nDatos > 0 ? sh.getRange(filaEnc + 1, 1, nDatos, colsLeer).getValues() : [];

  // Muchas hojas traen debajo del encabezado una o dos filas de NOTAS
  // explicativas ("El Script jala el cliente…"). No son pedidos: se saltan.
  const saltar = _filasDescriptivas(nombreHoja, mapa, datos);
  if (saltar > 0) datos = datos.slice(saltar);

  return { sh: sh, filaEnc: filaEnc, filaPrimerDato: filaEnc + 1 + saltar,
           saltadas: saltar, enc: enc, mapa: mapa, datos: datos,
           colsLeidas: colsLeer, colsTotales: ultCol };
}

/** Cuántas filas de descripción hay debajo del encabezado. */
function _filasDescriptivas(nombreHoja, mapa, datos) {
  const forzado = (CFG.FILAS_DESCRIPCION || {})[nombreHoja];
  if (forzado != null && String(forzado).toLowerCase() !== 'auto') return Number(forzado) || 0;

  const cols = Object.keys(mapa).map(function (k) { return mapa[k]; })
                     .filter(function (i) { return i >= 0; });
  if (!cols.length) return 0;

  let n = 0;
  for (let i = 0; i < Math.min(8, datos.length); i++) {
    let textoLargo = 0, conValor = 0;
    for (let j = 0; j < cols.length; j++) {
      const v = String(datos[i][cols[j]] == null ? '' : datos[i][cols[j]]).trim();
      if (!v) continue;
      conValor++;
      if (v.length > 45) textoLargo++;          // una descripción, no un dato
    }
    // fila de notas: todo lo que tiene valor son textos largos
    if (conValor > 0 && textoLargo >= Math.ceil(conValor / 2)) { n++; continue; }
    break;
  }
  return n;
}

function _ahora() {
  return Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm:ss');
}
function _hoyISO() {
  return Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd');
}

function _uid(prefijo) {
  return (prefijo || '') + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}

function _log(gestor, accion, detalle) {
  try {
    _hoja(CFG.H.LOG, true).appendRow([_ahora(), gestor || '-', accion || '-', String(detalle || '').substring(0, 900)]);
  } catch (e) { }
}

/* VELOCIDAD v2.8 — Memoria por ejecución de APP_Config.
 * Se lee UNA vez por ejecución y se guarda en memoria; las demás
 * llamadas salen de ahí. (La variable vive solo durante esa ejecución;
 * cada petición empieza limpia, así que nunca sirve datos viejos.) */
var __CFG_MEM = null;

function _cfgTodo() {
  if (__CFG_MEM) return __CFG_MEM;
  var m = {};
  try {
    var datos = _hoja(CFG.H.CONFIG).getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      var k = _norm(datos[i][0]);
      if (k) m[k] = datos[i][1];
    }
  } catch (e) { }
  __CFG_MEM = m;
  return m;
}

function _cfgHoja(clave, porDefecto) {
  var m = _cfgTodo();
  var k = _norm(clave);
  if (!Object.prototype.hasOwnProperty.call(m, k)) return porDefecto;
  var v = m[k];
  if (v === '' || v == null) return porDefecto;
  if (String(v).toUpperCase() === 'TRUE')  return true;
  if (String(v).toUpperCase() === 'FALSE') return false;
  return v;
}

function _setCfgHoja(clave, valor) {
  const sh = _hoja(CFG.H.CONFIG, true);
  const datos = sh.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (_norm(datos[i][0]) === _norm(clave)) {
      sh.getRange(i + 1, 2).setValue(valor);
      __CFG_MEM = null;                 // cambió la config: tira la memoria
      return;
    }
  }
  sh.appendRow([clave, valor, '']);
  __CFG_MEM = null;                     // cambió la config: tira la memoria
}

function _letraCol(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function _fechaTexto(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'America/Mexico_City', 'dd/MM/yyyy');
  }
  return String(v);
}
