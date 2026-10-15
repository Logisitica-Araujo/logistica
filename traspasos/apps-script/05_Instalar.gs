/***********************************************************************
 * TRASPASOS FADERMEX — 05_Instalar.gs
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

  // 1b) Estatus nuevo: "En Recepción Oficinas"
  if (claves.indexOf('EN_RECEPCION') < 0) {
    te.agregar({
      'Clave': 'EN_RECEPCION', 'Nombre en pantalla': 'En Recepción Oficinas',
      'Significado': 'Un gestor lo dejó en el stand de Recepción Oficinas. Espera a que lo recoja su área o un gestor.',
      'Quién lo provoca': 'Gestor en la computadora de Recepción Oficinas', 'Color texto (hex)': '8A4B12', 'Color fondo (hex)': 'F6E7D8',
      'Orden': 4, 'Muestra': 'En Recepción Oficinas', 'Estado en app de gestores': ''
    });
    hechos.push('Se agregó el estatus EN_RECEPCION (En Recepción Oficinas).');
  }

  // 1c) Columnas nuevas: PIN de entrada por área, usuario y NIP para quien no tiene credencial
  [[TR.H.AREAS, 'PIN de entrada'], [TR.H.PERSONAS, 'Usuario'], [TR.H.PERSONAS, 'NIP'],
   [TR.H.GESTORES, 'Usuario'], [TR.H.GESTORES, 'NIP']].forEach(function (x) {
    if (_agregarColumna(x[0], x[1])) hechos.push('Columna "' + x[1] + '" agregada en ' + x[0] + '.');
  });

  // 1d) Área Recepción Oficinas (computadora del patio)
  const ta0 = _tb(TR.H.AREAS);
  if (!ta0.filas().some(function (f) { return String(f['Prefijo de folio']).trim().toUpperCase() === 'REC'; })) {
    ta0.agregar({ 'Prefijo de folio': 'REC', 'Nombre del área': 'Recepción Oficinas', 'Sucursal (ID)': 'OFI',
                  'Correo de la cuenta': 'jaraujo@fadermex.com', 'Activa': 'SI',
                  'Notas': 'Computadora del patio: los gestores dejan y recogen traspasos.' });
    __AREAS = null;
    hechos.push('Se agregó el área REC (Recepción Oficinas) con tu correo.');
  }

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
    ['ops_ignorar_hasta_fila', 0, 'La revisión de Operaciones ignora las filas hasta este número (lo llena solo "Limpiar para lanzamiento").'],
    ['ops_columna_folio', 'A', 'Hoja Operaciones: columna (letra) donde va el folio del traspaso o de la caja.'],
    ['ops_columna_paqueteria', 'K', 'Hoja Operaciones: columna (letra) de la paquetería (DHL, Estafeta…).'],
    ['ops_columna_guia', 'M', 'Hoja Operaciones: columna (letra) del número de guía. Con guía, el traspaso pasa solo a "Enviado por paquetería".']
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

  // 5) Cajas para Morelia y revisión automática de guías en "Operaciones"
  if (_crearHojaCajas()) hechos.push('Se creó la hoja RES_Cajas (cajas para Morelia).');
  if (_crearActivador()) hechos.push('Activado: cada ' + TR.OPS.CADA_MIN + ' min se revisan las guías en "Operaciones".');
  try { if (_crearActivadorEdicion()) hechos.push('Activado: al escribir en "Operaciones" (columnas folio / paquetería / guía) el traspaso se actualiza al momento.'); }
  catch (e) { hechos.push('⚠ No pude crear el activador "al editar Operaciones": ' + e.message); }
  try {
    const r = sincronizarOperaciones(true);
    hechos.push('Revisión de Operaciones: ' + r.n + ' traspaso(s) pasaron a "Enviado por paquetería".' +
      (r.omitidos.length ? ' Sin cambiar: ' + r.omitidos.slice(0, 15).map(function (o) { return o.folio + ' (' + o.motivo + ')'; }).join('; ') : ''));
  } catch (e) { hechos.push('⚠ Revisión de Operaciones: ' + e.message); }
  try { _guiasOperaciones(); hechos.push('Conexión con la hoja "Operaciones": OK.'); }
  catch (e) { hechos.push('⚠ No pude leer "Operaciones": ' + e.message); }

  // 6) Logo (esto también pide el permiso de Drive la primera vez)
  try { if (_logo()) hechos.push('Logo leído correctamente.'); } catch (e) { hechos.push('No pude leer el logo: ' + e.message); }

  const msg = 'Listo.\n\n• ' + hechos.join('\n• ') + '\n\n' + _textoRevision();
  try { SpreadsheetApp.getUi().alert('Traspasos', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(msg); }
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
    'Cajas que arma Logística para Morelia. Estatus: ARMADA (esperando guía en Operaciones) → ENVIADA → RECIBIDA.');
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

/** Activador de tiempo para sincronizarOperaciones (solo uno). */
function _crearActivador() {
  const ya = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sincronizarOperaciones'; });
  if (ya) return false;
  ScriptApp.newTrigger('sincronizarOperaciones').timeBased().everyMinutes(TR.OPS.CADA_MIN).create();
  return true;
}

/**
 * 🧹 EMPEZAR DE CERO (para el lanzamiento oficial).
 *  1. Hace una COPIA completa del archivo en tu Drive (respaldo).
 *  2. Vacía los traspasos de prueba y todo su historial (RES_ e IMP_Recolecciones).
 *  3. Regresa los folios a 0001 en todas las áreas y cajas.
 *  4. Marca hasta qué fila de "Operaciones" hay datos viejos, para no confundirlos con los nuevos folios.
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
    const hojas = [TR.H.TRASPASOS, TR.H.MOV, TR.H.ESCANEOS, TR.H.ETIQUETAS, TR.H.SOLICITUDES, TR.H.AVISOS, TR.H.CAJAS, 'IMP_Recolecciones'];
    const borradas = [];
    hojas.forEach(function (h) {
      const sh = ss.getSheetByName(h);
      if (!sh) return;
      const n = sh.getLastRow() - TR.FILA_ENC;
      if (n > 0) { sh.getRange(TR.FILA_ENC + 1, 1, n, Math.max(1, sh.getLastColumn())).clearContent(); borradas.push(h + ' (' + n + ')'); }
    });
    const tf = _tb(TR.H.FOLIOS);
    tf.filas().forEach(function (f) { tf.actualizar(f._fila, { 'Último número': 0, 'Actualizado': _ahoraTxt() }); });
    let ops = '';
    try {
      const sh = SpreadsheetApp.openById(_idOperaciones()).getSheetByName(TR.OPS.HOJA);
      const ult = sh ? sh.getLastRow() : 0;
      const ta = _tb(TR.H.AJUSTES);
      const f = ta.filas().filter(function (x) { return _norm(x['Parámetro']) === 'ops_ignorar_hasta_fila'; })[0];
      if (f) ta.actualizar(f._fila, { 'Valor': ult }); else ta.agregar({ 'Parámetro': 'ops_ignorar_hasta_fila', 'Valor': ult, 'Qué hace': 'La revisión de Operaciones ignora las filas hasta este número.' });
      __AJ = null;
      ops = 'En "Operaciones" se ignorarán las filas 1 a ' + ult + ' (son de antes del lanzamiento).';
    } catch (e) { ops = '⚠ No pude leer Operaciones: ' + e.message; }
    __TB = {};
    _adminLog(quien, 'LIMPIAR PARA LANZAMIENTO', 'Todo', borradas.join(', '), 'Folios en 0', 'Respaldo: ' + copia.getUrl());
    return 'Respaldo guardado en tu Drive: "' + nombreRespaldo + '"\n' + copia.getUrl() + '\n\n' +
      'Vaciado: ' + (borradas.join(', ') || 'ya estaba vacío') + '.\nFolios de todas las áreas regresan a 0001.\n' + ops +
      '\n\nCatálogos, personas, impresoras y ajustes NO se tocaron.';
  });
}


/** Activador "Al editar" en el archivo de Operaciones (solo uno). */
function _crearActivadorEdicion() {
  const ya = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'alEditarOperaciones'; });
  if (ya) return false;
  ScriptApp.newTrigger('alEditarOperaciones').forSpreadsheet(_idOperaciones()).onEdit().create();
  return true;
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
