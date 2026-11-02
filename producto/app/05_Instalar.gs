/***********************************************************************
 * CUSTODIA by AARX — 05_Instalar.gs
 * ---------------------------------------------------------------------
 * Menú "🔄 Traspasos" dentro de la hoja y la instalación inicial.
 * Instalar / reparar se puede correr las veces que quieras: solo agrega
 * lo que falta, nunca borra nada.
 ***********************************************************************/

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 Traspasos')
    .addItem('Instalar / reparar', 'instalar')
    .addItem('Revisar configuración', 'revisarConfiguracion')
    .addSeparator()
    .addItem('🧹 Limpiar para lanzamiento (empezar de cero)', 'limpiarParaLanzamiento')
    .addToUi();
}

function instalar() {
  const hechos = [];
  _secreto();
  hechos.push('Llave de seguridad de sesiones lista.');

  // 1) Estatus nuevo: "Entregado por gestor, falta confirmar"
  const te = _tb(TR.H.ESTATUS);
  const claves = te.filas().map(function (f) { return String(f['Clave']).trim().toUpperCase(); });
  if (claves.indexOf('ENTREGADO_GESTOR') < 0) {
    te.agregar({
      'Clave': 'ENTREGADO_GESTOR', 'Nombre en pantalla': 'Entregado por gestor, falta confirmar',
      'Significado': 'El gestor lo marcó entregado en su app (con o sin foto). Falta que el destino lo escanee.',
      'Quién lo provoca': 'Gestor desde su app', 'Color texto (hex)': '0E7C66', 'Color fondo (hex)': 'D9F2EA',
      'Orden': 5, 'Muestra': 'Entregado por gestor, falta confirmar', 'Estado en app de gestores': 'ENTREGADO (gestor)'
    });
    hechos.push('Se agregó el estatus ENTREGADO_GESTOR a CAT_Estatus.');
  }

  // 1a) Estatus nuevo: "Entregado parcial" (llegó una parte; el resto todavía no sale del origen)
  if (claves.indexOf('ENTREGADO_PARCIAL') < 0) {
    te.agregar({
      'Clave': 'ENTREGADO_PARCIAL', 'Nombre en pantalla': 'Entregado parcial',
      'Significado': 'El destino recibió una parte de los bultos; el resto todavía no sale (se quedó en el origen o en el punto de resguardo). No es incidencia.',
      'Quién lo provoca': 'El destino al recibir, cuando el gestor se llevó solo una parte', 'Color texto (hex)': '9A5B00', 'Color fondo (hex)': 'FFE9C7',
      'Orden': 6, 'Muestra': 'Entregado parcial', 'Estado en app de gestores': ''
    });
    hechos.push('Se agregó el estatus ENTREGADO_PARCIAL a CAT_Estatus.');
  }

  // 1b) Estatus nuevo: "En Recepción Oficinas"
  if (claves.indexOf('EN_RECEPCION') < 0) {
    te.agregar({
      'Clave': 'EN_RECEPCION', 'Nombre en pantalla': 'En punto de resguardo',
      'Significado': 'Lo dejaron en el punto de resguardo. Espera a que lo recoja su destino o un portador.',
      'Quién lo provoca': 'Computadora del punto de resguardo', 'Color texto (hex)': '8A4B12', 'Color fondo (hex)': 'F6E7D8',
      'Orden': 4, 'Muestra': 'En punto de resguardo', 'Estado en app de gestores': ''
    });
    hechos.push('Se agregó el estatus EN_RECEPCION (En punto de resguardo).');
  }

  // 1c) Columnas nuevas: PIN de entrada por área, usuario y NIP para quien no tiene credencial
  [[TR.H.TRASPASOS, 'Incidencia'], [TR.H.TRASPASOS, 'Bultos pendientes'], [TR.H.TRASPASOS, 'Pendientes en'], [TR.H.TRASPASOS, 'Editado'], [TR.H.SOLICITUDES, 'Lado'], [TR.H.SOLICITUDES, 'Responsable (área)'], [TR.H.SOLICITUDES, 'Cuenta'], [TR.H.SOLICITUDES, 'Tipo'], [TR.H.SOLICITUDES, 'Destino nuevo'],
   [TR.H.AREAS, 'PIN de entrada'], [TR.H.PERSONAS, 'Usuario'], [TR.H.PERSONAS, 'NIP'],
   [TR.H.GESTORES, 'Usuario'], [TR.H.GESTORES, 'NIP']].forEach(function (x) {
    if (_agregarColumna(x[0], x[1])) hechos.push('Columna "' + x[1] + '" agregada en ' + x[0] + '.');
  });

  // 2) Un contador de folios por cada área
  const tf = _tb(TR.H.FOLIOS);
  const ya = {};
  tf.filas().forEach(function (f) { ya[String(f['Prefijo']).trim().toUpperCase()] = true; });
  const nuevos = Object.keys(_areas()).filter(function (id) { return !ya[id]; })
    .map(function (id) { return { 'Prefijo': id, 'Último número': 0, 'Actualizado': _ahoraTxt() }; });
  tf.agregarVarias(nuevos);
  if (nuevos.length) hechos.push('Contadores de folio agregados: ' + nuevos.map(function (n) { return n['Prefijo']; }).join(', '));

  // 3) Ajustes que la app usa
  const ta = _tb(TR.H.AJUSTES);
  const params = ta.filas().map(function (f) { return _norm(f['Parámetro']); });
  const faltan = [
    ['revisar_avisos_cada_seg', 45, 'Cada cuántos segundos la página revisa si hay traspasos nuevos para el área.'],
    ['pin_administrador', '', 'PIN para entrar al Modo administrador. Vacío = sin PIN. Recomendado si tu cuenta está abierta en una computadora compartida.'],
    ['nombre_empresa', '', 'Nombre de la empresa que aparece en la página.'],
    ['ubicacion_resguardo', '', 'Prefijo de la ubicación que funciona como punto de resguardo (recepción / caseta). Vacío = no se usa.'],
    ['ubicacion_centro_envios', '', 'Prefijo de la ubicación por la que pasa todo envío foráneo antes de la paquetería. Vacío = no se usa.'],
    ['carpeta_manuales', '', 'Carpeta de Drive con los manuales en PDF (solo la ven los administradores, para actualizarlos).'],
    ['manual_sucursales', '', 'Link de Drive del PDF "Manual de Sucursales". Sale en el botón ❓ Ayuda.'],
    ['manual_oficinas_recepcion', '', 'Link de Drive del PDF "Manual de Oficinas y punto de resguardo". Sale en el botón ❓ Ayuda de las ubicaciones de oficina.'],
    ['manual_recepcion', '', 'Link de Drive del PDF "Manual del punto de resguardo". Es el ÚNICO manual que ve esa computadora.'],
    ['manual_administradores', '', 'Link de Drive del PDF "Manual de Administradores". Solo lo ven los administradores.'],
    ['manual_proceso', '', 'Link de Drive del documento del proceso implementado (certificación). Solo administradores. Vacío = no se muestra.'],
    ['horas_alerta_sin_salida', 36, 'Horas que puede estar un traslado sin salir del punto de resguardo antes de avisar al centro de envíos, al origen y a administración.']
  ].filter(function (p) { return params.indexOf(_norm(p[0])) < 0; })
   .map(function (p) { return { 'Parámetro': p[0], 'Valor': p[1], 'Qué hace': p[2] }; });
  ta.agregarVarias(faltan);

  // 3b) Tamaño general de etiqueta: el rollo de todas las sucursales es de 50 × 20 mm.
  //     Solo se cambia si todavía tiene los valores de ejemplo (62 × 100).
  const fAn = ta.filas().filter(function (f) { return _norm(f['Parámetro']) === 'etiqueta_ancho_mm'; })[0];
  const fAl = ta.filas().filter(function (f) { return _norm(f['Parámetro']) === 'etiqueta_alto_mm'; })[0];
  if (fAn && fAl && Number(fAn['Valor']) === 62 && Number(fAl['Valor']) === 100) {
    ta.actualizar(fAn._fila, { 'Valor': 50, 'Qué hace': 'Ancho de la etiqueta en mm (rollo de todas las sucursales: 5 cm).' });
    ta.actualizar(fAl._fila, { 'Valor': 20, 'Qué hace': 'Alto de la etiqueta en mm (rollo de todas las sucursales: 2 cm).' });
    hechos.push('Tamaño general de etiqueta: 50 × 20 mm.');
  }

  // 4) Hoja de impresoras: una fila por área, para poner el tamaño de etiqueta de cada una
  if (_crearHojaImpresoras()) hechos.push('Se creó la hoja CAT_Impresoras: llena el tamaño de etiqueta de cada área.');
  ['Margen superior (mm)', 'Margen izquierdo (mm)', 'Orientación', 'Formato'].forEach(function (h) {
    if (_agregarColumna(TR.H.IMPRESORAS, h)) hechos.push('Columna "' + h + '" agregada en CAT_Impresoras (opcional).');
  });
  const imp = _impresoras();
  hechos.push('Impresoras configuradas: ' + (Object.keys(imp).length
    ? Object.keys(imp).map(function (id) { return id + ' ' + imp[id].ancho + '×' + imp[id].alto; }).join(', ')
    : 'ninguna (todas usan el tamaño general de CFG_Ajustes)') + '.');

  // 5) Cajas consolidadas y revisión periódica (alertas por tiempo)
  if (_crearHojaCajas()) hechos.push('Se creó la hoja RES_Cajas (cajas consolidadas).');
  if (_crearActivador()) hechos.push('Activado: cada 10 min se revisan las alertas por tiempo.');
  if (typeof clienteInstalar === 'function') clienteInstalar(hechos);   // excepciones del cliente (ver ejemplos/)

  // 6) Logo (esto también pide el permiso de Drive la primera vez)
  try { if (_logo()) hechos.push('Logo leído correctamente.'); } catch (e) { hechos.push('No pude leer el logo: ' + e.message); }

  const msg = 'Listo.\n\n• ' + hechos.join('\n• ') + '\n\n' + _textoRevision();
  try { SpreadsheetApp.getUi().alert(TR.NOMBRE_APP, msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(msg); }
  return msg;
}

function revisarConfiguracion() {
  const msg = _textoRevision();
  try { SpreadsheetApp.getUi().alert('Revisión', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(msg); }
  return msg;
}

function _textoRevision() {
  const A = _areas();
  const sinCorreo = Object.keys(A).filter(function (id) { return A[id].activa && !A[id].correos.length; });
  const personas = _tb(TR.H.PERSONAS).filas().length;
  const gestores = _tb(TR.H.GESTORES).filas().length;
  const admins = _tb(TR.H.ADMINS).filas().filter(function (f) { return _activo(f['Activo']); }).length;
  const l = [];
  l.push(sinCorreo.length
    ? '⚠ Áreas SIN correo (nadie puede entrar como ellas): ' + sinCorreo.join(', ') + '. Llénalo en CAT_Areas → "Correo de la cuenta".'
    : '✓ Todas las áreas tienen correo.');
  l.push(personas ? '✓ ' + personas + ' persona(s) en CAT_Personas.' : '⚠ CAT_Personas está vacía: nadie podrá crear traspasos con credencial.');
  l.push(gestores ? '✓ ' + gestores + ' gestor(es) en CAT_Gestores.' : '⚠ CAT_Gestores está vacía: las sucursales no podrán registrar la salida con la credencial del gestor.');
  l.push('✓ ' + admins + ' administrador(es) activos.');
  const env = _enviosOficinas();
  l.push(env.lista.length ? '✓ ' + env.lista.length + ' sugerencia(s) en CAT_EnviosOf.' : '• CAT_EnviosOf vacía o sin crear: no se muestran sugerencias de qué mandar a Oficinas.');
  if (env.sinArea.length) l.push('⚠ En CAT_EnviosOf hay áreas que no existen en CAT_Areas (revisa que se escriban igual): ' + env.sinArea.join(', '));
  return l.join('\n');
}

function _crearHojaImpresoras() {
  const ss = _libro();
  if (ss.getSheetByName(TR.H.IMPRESORAS)) return false;
  const sh = ss.insertSheet(TR.H.IMPRESORAS);
  const enc = ['Área (prefijo)', 'Área', 'Impresora (marca y modelo)', 'Ancho etiqueta (mm)', 'Alto etiqueta (mm)', 'Notas',
               'Margen superior (mm)', 'Margen izquierdo (mm)', 'Orientación', 'Formato'];
  sh.getRange(1, 1).setValue('CAT_Impresoras  —  CATÁLOGO · La app LEE esta hoja · Solo administradores la editan.  ' +
    'Tamaño de etiqueta de cada área. En "Área (prefijo)" puede ir el área (NR), la sucursal (Nueva Roma = todas sus áreas) o TODAS. ' +
    'Si Ancho/Alto quedan vacíos, se usa el de CFG_Ajustes. Márgenes para mover la impresión; Orientación Horizontal/Vertical; Formato AUTO/MINI/CHICA/COMPLETA.');
  sh.getRange(2, 1, 1, enc.length).setValues([enc]);
  const A = _areas();
  const filas = Object.keys(A).map(function (id) { return [id, R.nom(A, id), 'PENDIENTE', '', '', '', '', '', '', '']; });
  if (filas.length) sh.getRange(3, 1, filas.length, enc.length).setValues(filas);
  try {
    sh.setTabColor('#1F63D6');
    sh.getRange(1, 1, 1, enc.length).merge().setBackground('#DCE8FF').setFontColor('#1F63D6').setFontWeight('bold').setWrap(true);
    sh.setRowHeight(1, 36);
    sh.getRange(2, 1, 1, enc.length).setBackground('#1F63D6').setFontColor('#FFFFFF').setFontWeight('bold');
    sh.setFrozenRows(2);
    [16, 30, 30, 20, 20, 40, 18, 18, 14, 14].forEach(function (w, i) { sh.setColumnWidth(i + 1, w * 7); });
  } catch (e) { }
  __TB = {};
  return true;
}

function _crearHojaCajas() {
  const ss = _libro();
  if (ss.getSheetByName(TR.H.CAJAS)) return false;
  const sh = ss.insertSheet(TR.H.CAJAS);
  const enc = ['Folio caja', 'Fecha', 'Hora', 'Destino', 'Traspasos', 'Bultos', 'Creó', 'Paquetería', 'Guía', 'ETA', 'Estatus', 'Última actualización'];
  sh.getRange(1, 1).setValue('RES_Cajas  —  RESULTADOS · La app ESCRIBE aquí sola · NO editar a mano.  ' +
    'Cajas consolidadas para envío por paquetería. Estatus: ARMADA (esperando guía) → ENVIADA → RECIBIDA.');
  sh.getRange(2, 1, 1, enc.length).setValues([enc]);
  try {
    sh.setTabColor('#1B7F38');
    sh.getRange(1, 1, 1, enc.length).merge().setBackground('#DFF3E5').setFontColor('#1B7F38').setFontWeight('bold').setWrap(true);
    sh.setRowHeight(1, 36);
    sh.getRange(2, 1, 1, enc.length).setBackground('#1B7F38').setFontColor('#FFFFFF').setFontWeight('bold');
    sh.setFrozenRows(2);
    [12, 12, 8, 14, 40, 8, 26, 14, 22, 16, 12, 18].forEach(function (w, i) { sh.setColumnWidth(i + 1, w * 7); });
  } catch (e) { }
  __TB = {};
  return true;
}

/** Activador de tiempo para revisionPeriodica (solo uno). */
function _crearActivador() {
  const ya = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'revisionPeriodica'; });
  if (ya) return false;
  ScriptApp.newTrigger('revisionPeriodica').timeBased().everyMinutes(10).create();
  return true;
}

/**
 * 🧹 EMPEZAR DE CERO (para el lanzamiento oficial).
 *  1. Hace una COPIA completa del archivo en tu Drive (respaldo).
 *  2. Vacía los traspasos de prueba y todo su historial (RES_ e IMP_Recolecciones).
 *  3. Regresa los folios a 0001 en todas las áreas y cajas.
 * NO toca catálogos (áreas, personas, gestores, administradores, impresoras) ni ajustes.
 */
function limpiarParaLanzamiento() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('🧹 Limpiar para lanzamiento',
    'Esto BORRA todos los traspasos, cajas, avisos, escaneos y su historial, y regresa los folios a 0001.\n' +
    'Antes se guarda una copia completa del archivo en tu Drive.\n\nPara continuar escribe: BORRAR', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || String(r.getResponseText()).trim().toUpperCase() !== 'BORRAR') {
    ui.alert('Cancelado. No se borró nada.');
    return 'cancelado';
  }
  const msg = _limpiar(Session.getActiveUser().getEmail());
  ui.alert('Listo', msg, ui.ButtonSet.OK);
  return msg;
}

function _limpiar(quien) {
  if (!_esAdmin(quien)) throw new Error('Solo un administrador puede limpiar.');
  return _conCandado(function () {
    const ss = _libro();
    const nombreRespaldo = 'RESPALDO Traspasos antes de lanzamiento ' + _ahoraTxt();
    const copia = DriveApp.getFileById(ss.getId()).makeCopy(nombreRespaldo);
    const hojas = [TR.H.TRASPASOS, TR.H.MOV, TR.H.ESCANEOS, TR.H.ETIQUETAS, TR.H.SOLICITUDES, TR.H.AVISOS, TR.H.CAJAS];
    const borradas = [];
    hojas.forEach(function (h) {
      const sh = ss.getSheetByName(h);
      if (!sh) return;
      const n = sh.getLastRow() - TR.FILA_ENC;
      if (n > 0) { sh.getRange(TR.FILA_ENC + 1, 1, n, Math.max(1, sh.getLastColumn())).clearContent(); borradas.push(h + ' (' + n + ')'); }
    });
    const tf = _tb(TR.H.FOLIOS);
    tf.filas().forEach(function (f) { tf.actualizar(f._fila, { 'Último número': 0, 'Actualizado': _ahoraTxt() }); });
    const ops = '';
    __TB = {};
    _adminLog(quien, 'LIMPIAR PARA LANZAMIENTO', 'Todo', borradas.join(', '), 'Folios en 0', 'Respaldo: ' + copia.getUrl());
    return 'Respaldo guardado en tu Drive: "' + nombreRespaldo + '"\n' + copia.getUrl() + '\n\n' +
      'Vaciado: ' + (borradas.join(', ') || 'ya estaba vacío') + '.\nFolios de todas las áreas regresan a 0001.\n' + ops +
      '\n\nCatálogos, personas, impresoras y ajustes NO se tocaron.';
  });
}


/** Agrega una columna al final de la fila de encabezados si no existe. */
function _agregarColumna(hoja, nombre) {
  const sh = _libro().getSheetByName(hoja);
  if (!sh) return false;
  const lc = Math.max(1, sh.getLastColumn());
  const enc = sh.getRange(TR.FILA_ENC, 1, 1, lc).getValues()[0].map(function (h) { return _norm(h); });
  if (enc.indexOf(_norm(nombre)) >= 0) return false;
  const cel = sh.getRange(TR.FILA_ENC, lc + 1);
  cel.setValue(nombre);
  try {
    const prev = sh.getRange(TR.FILA_ENC, lc);
    cel.setBackground(prev.getBackground()).setFontColor(prev.getFontColor()).setFontWeight('bold');
  } catch (e) { }
  __TB = {};
  return true;
}
