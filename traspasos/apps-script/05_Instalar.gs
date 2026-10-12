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
    ['revisar_avisos_cada_seg', 45, 'Cada cuántos segundos la página revisa si hay traspasos nuevos para el área.']
  ].filter(function (p) { return params.indexOf(_norm(p[0])) < 0; })
   .map(function (p) { return { 'Parámetro': p[0], 'Valor': p[1], 'Qué hace': p[2] }; });
  ta.agregarVarias(faltan);

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
  return l.join('\n');
}
