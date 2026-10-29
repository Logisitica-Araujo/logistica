/***********************************************************************
 * APP GESTORES 2 — 00_CONFIG.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 *           (Extensiones → Apps Script de ESE archivo; no va en Logística FED 2026)
 * ---------------------------------------------------------------------
 * Configuración fija y utilidades que usan todos los demás archivos.
 * Aquí NO van contraseñas ni claves: esas viven en Propiedades del script
 * (Configuración del proyecto → Propiedades del script), y las crea
 * INSTALAR() solo.
 ***********************************************************************/

var APPG = {
  VERSION: '0.1.0',
  ZONA: 'America/Mexico_City',

  /* Nombres de las pestañas del archivo de la app. */
  H: {
    CONFIG:        'APP_Config',
    USUARIOS:      'APP_Usuarios',
    VEHICULOS:     'APP_Vehiculos',
    MOTIVOS:       'APP_Motivos',
    DOCUMENTOS:    'APP_Documentos',
    PEDIDOS:       'APP_Pedidos',
    CIERRES:       'APP_Cierres',
    RECOLECCIONES: 'APP_Recolecciones',
    SESIONES:      'APP_Sesiones',
    LOG:           'APP_Log',
    PROBLEMAS:     'APP_Problemas'
  },

  /* Encabezados de cada pestaña, en orden. El código busca las columnas
     por su NOMBRE, así que el orden puede cambiar sin romper nada,
     pero los nombres no. */
  ENC: {
    APP_Config:        ['Clave', 'Valor', 'Descripción'],
    APP_Usuarios:      ['Numero', 'Nombre', 'NombreEnOperaciones', 'Usuario', 'ClaveCifrada', 'Rol', 'Activo',
                        'DebeCambiar', 'VersionSesion', 'Alta', 'UltimoAcceso', 'Notas'],
    APP_Vehiculos:     ['Vehiculo', 'Tipo', 'Placa', 'Activo'],
    APP_Motivos:       ['Tipo', 'Motivo', 'PideComentario', 'Activo'],
    APP_Documentos:    ['Categoria', 'Titulo', 'Tipo', 'Contenido', 'Activo', 'Orden'],
    APP_Pedidos:       ['ID', 'Fila', 'NumeroGestor', 'Gestor', 'Cliente', 'Direccion', 'Notas', 'Area', 'SubArea',
                        'Metodo', 'Estatus', 'ETA', 'Actualizado'],
    APP_Cierres:       ['IdCierre', 'FechaHora', 'HoraCelular', 'NumeroGestor', 'Gestor', 'Vehiculo', 'Tipo', 'ID', 'Fila',
                        'Resultado', 'Motivo', 'Comentario', 'Recibio', 'Lat', 'Lng', 'URLFoto', 'URLFirma',
                        'Estado', 'Intentos', 'UltimoError', 'EnviadoEn'],
    APP_Recolecciones: ['FechaHora', 'NumeroGestor', 'Gestor', 'Vehiculo', 'Codigo', 'Tipo', 'Origen', 'Destino',
                        'Contenido', 'Estado', 'EstadoFuente', 'Actualizado'],
    APP_Sesiones:      ['FechaHora', 'Usuario', 'NumeroGestor', 'Dispositivo', 'Resultado'],
    APP_Log:           ['FechaHora', 'Quien', 'Accion', 'Detalle'],
    APP_Problemas:     ['Numero', 'FechaHora', 'Codigo', 'Quien', 'Detalle', 'Resuelto']
  },

  /* Pestañas que la administradora SÍ edita a mano. Las demás se protegen. */
  EDITABLES: ['APP_Config', 'APP_Usuarios', 'APP_Vehiculos', 'APP_Motivos', 'APP_Documentos', 'APP_Problemas'],

  /* Valores iniciales de APP_Config (INSTALAR solo agrega los que falten). */
  CONFIG_INICIAL: [
    ['EXIGIR_FOTO_ENTREGA', true, 'TRUE/FALSE — foto obligatoria al entregar'],
    ['EXIGIR_FIRMA_ENTREGA', false, 'TRUE/FALSE — firma obligatoria al entregar'],
    ['EXIGIR_QUIEN_RECIBIO', false, 'TRUE/FALSE — nombre de quien recibe obligatorio'],
    ['EXIGIR_FOTO_NOENTREGA', true, 'TRUE/FALSE — foto obligatoria en retorno o cancelado'],
    ['PALABRAS_EXIGEN_FIRMA', 'Efectivo | Factura | Cortes', 'Si el contenido trae una de estas palabras, se exigen firma y quién recibió'],
    ['ROBOT_HORARIO', '6-22', 'Horas en que corre el robot'],
    ['ROBOT_CADA_MIN', 1, 'Cada cuántos minutos corre el robot'],
    ['DIAS_PARA_ALERTA', 3, 'Días sin movimiento antes de mandarlo a APP_Problemas'],
    ['CHECK_MOTO', 'Licencia de conducir | Casco | Guantes | Impermeable (temporada de lluvia) | Tarjeta de circulación | Póliza de seguro | Kit de herramientas | Kit de siniestro', 'Revisión antes de salir en moto'],
    ['CHECK_AUTO', 'Licencia de conducir | Póliza de seguro | Tarjeta de circulación | Gato hidráulico | Llanta de refacción | Cables pasa corriente | Kit de herramientas | Kit de siniestro', 'Revisión antes de salir en auto'],
    ['WA_MSG_ENTREGADO', 'PEDIDO ENTREGADO\\n{id} · {cliente}\\nRecibió: {recibio}\\nGestor: {gestor}\\n{fecha} {hora}', 'Mensaje de WhatsApp al entregar'],
    ['APP_BLOQUEADA', false, 'TRUE = nadie puede entrar (mantenimiento)'],
    ['MENSAJE_BLOQUEO', 'App en mantenimiento. Intenta más tarde.', 'Texto que ven los gestores si está bloqueada'],
    ['ULTIMA_VUELTA_ROBOT', '', 'La escribe el robot. No editar.']
  ],

  /* Motivos iniciales: los mismos textos que hoy tiene la app vieja (APP_Motivos). */
  MOTIVOS_INICIALES: [
    ['RETORNO', 'No se encontraba cliente', false, true],
    ['RETORNO', 'Cambio de Dirección o Dirección incorrecta', false, true],
    ['RETORNO', 'Primera visita', false, true],
    ['RETORNO', 'Segunda visita', false, true],
    ['CANCELADO', 'Entrega incorrecta', false, true],
    ['CANCELADO', 'Incidente con Materia prima', false, true],
    ['CANCELADO', 'Pedido extraviado o decomisado', false, true],
    ['TRASPASO', 'Sucursal cerrada', false, true],
    ['TRASPASO', 'Traspaso extraviado', false, true],
    ['TRASPASO', 'Traspaso incorrecto', false, true],
    ['TRASPASO', 'Otro', true, true]
  ],

  /* Seguridad del inicio de sesión. */
  INTENTOS_MAX: 5,          // intentos fallidos antes de bloquear
  BLOQUEO_MIN: 15,          // minutos de bloqueo
  CLAVE_MIN: 6,             // largo mínimo de contraseña
  VUELTAS_CIFRADO: 300,     // vueltas del cifrado de contraseñas (más = más difícil de adivinar)
  CACHE_USUARIO_SEG: 300    // una baja (Activo = NO) tarda como máximo esto en sacar al gestor
};


/* ==================== Utilidades ==================== */

/** El archivo de la app. INSTALAR guarda su ID para que también funcione
 *  cuando la consulta llega desde el celular (no hay "archivo activo"). */
var __APPG_LIBRO = null;
function _libro() {
  if (__APPG_LIBRO) return __APPG_LIBRO;
  var id = PropertiesService.getScriptProperties().getProperty('ID_ARCHIVO');
  __APPG_LIBRO = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return __APPG_LIBRO;
}

function _hoja(nombre) {
  var sh = _libro().getSheetByName(nombre);
  if (!sh) throw _falla('APP-06', 'Falta la pestaña ' + nombre + '. Corre ⚙ App Gestores → Instalar / reparar.');
  return sh;
}

/** Lee una pestaña completa como lista de objetos {encabezado: valor, _fila: n}. */
function _tabla(nombre) {
  var sh = _hoja(nombre);
  var datos = sh.getDataRange().getValues();
  var enc = (datos[0] || []).map(function (h) { return String(h).trim(); });
  var filas = [];
  for (var i = 1; i < datos.length; i++) {
    var o = { _fila: i + 1 };
    var vacio = true;
    for (var j = 0; j < enc.length; j++) {
      if (!enc[j]) continue;
      o[enc[j]] = datos[i][j];
      if (datos[i][j] !== '' && datos[i][j] != null) vacio = false;
    }
    if (!vacio) filas.push(o);
  }
  return { sh: sh, enc: enc, filas: filas,
           col: function (h) { var k = enc.indexOf(h); if (k < 0) throw _falla('APP-06', 'Falta la columna "' + h + '" en ' + nombre + '.'); return k + 1; } };
}

/** Agrega un renglón usando los nombres de las columnas. */
function _agregar(nombre, obj) {
  var sh = _hoja(nombre);
  var enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  sh.appendRow(enc.map(function (h) { return obj[h] != null ? obj[h] : ''; }));
}

function _ahora(patron) { return Utilities.formatDate(new Date(), APPG.ZONA, patron || 'yyyy-MM-dd HH:mm:ss'); }
function _norm(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
function _si(v) { return v === true || /^(true|si|sí|1|verdadero)$/i.test(String(v).trim()); }

/** Error con código de la guía ERRORES_Y_SOLUCIONES.md. */
function _falla(codigo, mensaje) { var e = new Error(mensaje); e.codigo = codigo; return e; }

function _log(quien, accion, detalle) {
  try { _agregar(APPG.H.LOG, { FechaHora: _ahora(), Quien: quien || '', Accion: accion, Detalle: String(detalle || '').slice(0, 500) }); }
  catch (e) { /* la bitácora nunca debe tumbar la app */ }
}

/** Configuración de APP_Config como objeto {CLAVE: valor}. Se recuerda 60 s. */
function _config() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('cfg');
  if (c) return JSON.parse(c);
  var cfg = {};
  _tabla(APPG.H.CONFIG).filas.forEach(function (f) { if (f.Clave) cfg[String(f.Clave).trim()] = f.Valor; });
  try { cache.put('cfg', JSON.stringify(cfg), 60); } catch (e) {}
  return cfg;
}
