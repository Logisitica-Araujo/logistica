/***********************************************************************
 * APP LOGÍSTICA FADERMEX / BOTICAN  —  01_INSTALADOR.gs  (VERSIÓN 1.2)
 * ---------------------------------------------------------------------
 * CAMBIOS DE LA 1.2 (servidor 3.0):
 *  • Conoce las columnas nuevas de APP_Sesiones (actividad y vehículo del
 *    día) y de APP_Entregas (EnOperaciones), para no marcarlas como dañadas.
 *  • Crea/repara cada hoja en el libro donde le toca vivir (ver
 *    10_LIBRO_APP.gs): APP_Entregas siempre en el libro de la oficina.
 *
 * CAMBIOS DE LA 1.1:
 *  • Lee "Cat" respetando que sus encabezados están en la fila 2.
 *  • Importa las sucursales desde "Cat" (columna "Sucursales" + 2).
 *  • El diagnóstico ahora dice en qué fila encontró los encabezados,
 *    muestra una fila de ejemplo y avisa de hojas "_conflict".
 *  • Nueva función probarColisiones() para detectar doGet/onOpen repetidos.
 ***********************************************************************/

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙ Logística')
    .addItem('1. Instalar / Reparar hojas', 'instalar')
    .addItem('2. Sincronizar catálogos (gestores, vehículos, sucursales)', 'sincronizarCatalogos')
    .addItem('3. Diagnóstico de columnas', 'diagnostico')
    .addItem('4. Explorar TODO el libro (mapa de hojas)', 'explorarLibro')
    .addItem('5. ¿Qué vería cada gestor? (prueba en seco)', 'probarPendientesPorGestor')
    .addItem('6. Probar las carpetas de Drive', 'probarCarpetasDrive')
    .addSeparator()
    .addItem('Probar colisiones de código', 'probarColisiones')
    .addItem('Liberar candado de vehículo (todos)', 'liberarCandadosTodos')
    .addItem('Cerrar todas las sesiones', 'cerrarTodasSesiones')
    .addToUi();
}

const ESQUEMA = {
  CONFIG: ['Clave', 'Valor', 'Descripción'],
  USUARIOS: ['Gestor', 'Codigo', 'Correo', 'Activo', 'UltimoAcceso', 'Notas'],
  // 'Tipo' va AL FINAL a propósito: si lo metiera en medio, los datos que ya
  // tienes se recorrerían y "Activo" quedaría bajo el encabezado equivocado.
  VEHICULOS: ['Vehiculo', 'Placa', 'Activo', 'Notas', 'Tipo'],
  SESIONES: ['Token', 'Gestor', 'Vehiculo', 'InicioISO', 'UltimoCambioVehISO', 'Activa', 'UserAgent',
             'UltimaActividadISO', 'VehiculoElegidoISO'],          // ← v1.2, al final
  USO_VEH: ['FechaHora', 'Gestor', 'VehiculoAnterior', 'VehiculoNuevo', 'Motivo', 'Token'],
  ENTREGAS: ['FechaHora', 'IDPedido', 'Gestor', 'Vehiculo', 'Resultado', 'Motivo',
             'Cliente', 'Direccion', 'Observaciones', 'Area', 'SubArea',
             'URLFoto', 'URLFirma', 'Latitud', 'Longitud', 'ComentarioGestor',
             'Recibio',                        // ← nuevo, al final para no recorrer nada
             'EnOperaciones'],                 // ← v1.2: lo llena el robot de 08_SYNC
  TRASPASOS: ['Folio', 'FechaRecoleccionISO', 'Gestor', 'Vehiculo', 'Origen', 'Destino',
              'Area', 'Contenido', 'Estado', 'URLFotoRecoleccion'],
  TRAS_HIST: ['FechaHora', 'Folio', 'Gestor', 'Vehiculo', 'Evento', 'Origen', 'Destino',
              'Area', 'Contenido', 'Resultado', 'Motivo', 'ComentarioGestor',
              'URLFoto', 'Latitud', 'Longitud'],
  CAT_TRAS: ['Folio', 'Origen', 'Destino', 'Area', 'Contenido'],
  SUCURSALES: ['Sucursal', 'Direccion', 'URLMaps', 'Activo'],
  MOTIVOS: ['Tipo', 'Motivo', 'PideComentario', 'Activo'],
  LOG: ['FechaHora', 'Gestor', 'Accion', 'Detalle'],
  // Biblioteca de la pantalla "Documentación". Tú editas esta hoja.
  // Tipo: 'texto' (se muestra en pantalla) o 'enlace' (abre un link/PDF de Drive)
  DOCUMENTOS: ['Categoria', 'Titulo', 'Tipo', 'Contenido', 'Activo', 'Orden']
};


/** ==================== INSTALADOR ==================== */
function instalar() {
  const ss = _libro();
  const creadas = [], reparadas = [];

  Object.keys(ESQUEMA).forEach(function (clave) {
    const nombre = CFG.H[clave];
    const libro = _libroDe(nombre);          // cada hoja en el libro que le toca
    let sh = libro.getSheetByName(nombre);
    if (!sh) { sh = libro.insertSheet(nombre); creadas.push(nombre); }
    const enc = ESQUEMA[clave];
    const actuales = sh.getLastColumn() > 0
      ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (actuales.join('|') !== enc.join('|')) {
      sh.getRange(1, 1, 1, enc.length).setValues([enc]);
      if (creadas.indexOf(nombre) < 0) reparadas.push(nombre);
    }
    sh.getRange(1, 1, 1, enc.length)
      .setFontWeight('bold').setBackground('#F4B183').setFontColor('#000');
    sh.setFrozenRows(1);
  });

  sembrarConfig();
  sembrarMotivos();
  sembrarDocumentos();
  const resSync = sincronizarCatalogos(true);

  // Aviso de hojas duplicadas por conflicto de edición
  const conflictos = ss.getSheets()
    .map(function (s) { return s.getName(); })
    .filter(function (n) { return n.indexOf('_conflict') >= 0; });

  const msg =
    'Instalación terminada.\n\n' +
    (creadas.length   ? 'Hojas creadas:\n  • ' + creadas.join('\n  • ') + '\n\n' : '') +
    (reparadas.length ? 'Hojas reparadas:\n  • ' + reparadas.join('\n  • ') + '\n\n' : '') +
    resSync + '\n\n' +
    (conflictos.length
      ? '⚠️ OJO: hay hojas duplicadas por un conflicto de edición.\n' +
        'Bórralas a mano (clic derecho en la pestaña > Eliminar):\n  • ' +
        conflictos.join('\n  • ') + '\n\n'
      : '') +
    'Siguiente paso: menú ⚙ Logística > 3. Diagnóstico de columnas.';

  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  _log('SISTEMA', 'INSTALAR', creadas.join(',') + ' | ' + reparadas.join(','));
  return msg;
}


function sembrarConfig() {
  const sh = _hoja(CFG.H.CONFIG, true);
  const existentes = {};
  sh.getDataRange().getValues().forEach(function (f, i) {
    if (i > 0) existentes[_norm(f[0])] = true;
  });

  const semillas = [
    ['CANDADO_VEHICULO_MIN',   CFG.CANDADO_VEHICULO_MIN,   'Minutos que deben pasar para volver a cambiar de vehículo'],
    ['DURACION_SESION_HORAS',  CFG.DURACION_SESION_HORAS,  'Horas antes de pedir login otra vez'],
    ['REVISAR_NUEVOS_SEG',     CFG.REVISAR_NUEVOS_SEG,     'Cada cuántos segundos la app busca pedidos nuevos'],
    ['CACHE_SEG',              15,    'Segundos que el servidor recuerda pedidos/catálogos (velocidad). 0 lo apaga'],
    ['NOTIFICAR_POR_CORREO',   CFG.NOTIFICAR_POR_CORREO,   'TRUE/FALSE — avisar por correo al gestor'],
    ['ESCRIBIR_EN_OPERACIONES', (CFG.ESCRIBIR_EN_OPERACIONES || {}).activo !== false,
      'TRUE/FALSE — llenar fechas, GPS, foto, firma y motivo en Operaciones. Nunca toca ESTATUS.'],
    ['EXIGIR_FOTO_ENTREGA',    true,  'TRUE/FALSE — obligar foto para cerrar una entrega'],
    ['EXIGIR_FIRMA_ENTREGA',   true,  'TRUE/FALSE — obligar firma para cerrar una entrega'],
    ['EXIGIR_FOTO_NOENTREGA',  true,  'TRUE/FALSE — obligar foto en cancelado/retorno'],
    ['EXIGIR_FOTO_TRASPASO',   true,  'TRUE/FALSE — obligar foto al entregar un traspaso'],
    ['PEDIR_GPS',              true,  'TRUE/FALSE — guardar coordenadas al cerrar'],
    ['SINCRONIZAR_SUCURSALES_DESDE_CAT', true, 'TRUE/FALSE — traer las sucursales de la hoja Cat'],
    ['APP_BLOQUEADA',          false, 'TRUE = nadie puede entrar (mantenimiento)'],

    /* ---- Quién recibió el pedido ---- */
    ['PEDIR_QUIEN_RECIBIO',    true,  'TRUE/FALSE — mostrar la caja "¿Quién recibió?" al entregar'],
    ['EXIGIR_QUIEN_RECIBIO',   false, 'TRUE/FALSE — hacerla obligatoria. Déjalo en FALSE: es opcional'],

    /* ---- Nombre de los archivos de firma ---- */
    ['SUFIJO_FIRMA',           ' FIRMA',
      'Se le pega al ID para nombrar la firma: "#15847 FIRMA". Evita que compita con la foto en la búsqueda de Drive'],

    /* ---- Opción "sin vehículo" ---- */
    ['VEHICULO_SIN',           'Sin vehículo',
      'Nombre EXACTO de la opción que significa "entro solo a consultar". No activa el candado de cambio'],
    ['BLOQUEAR_VEHICULO_OCUPADO', true,
      'TRUE/FALSE — impedir que dos gestores tomen el mismo vehículo a la vez. Se libera con "Cerrar todas las sesiones"'],

    /* ---- Checklist de seguridad antes de salir ---- */
    ['CHECKLIST_ACTIVO',       true,  'TRUE/FALSE — mostrar la pantalla de revisión al elegir vehículo'],
    ['CHECK_MOTO',
      'Licencia de conducir | Casco | Guantes | Impermeable (temporada de lluvia) | Tarjeta de circulación | Póliza de seguro | Kit de herramientas | Kit de siniestro',
      'Lista para MOTO. Separa cada punto con la barra |'],
    ['CHECK_AUTO',
      'Licencia de conducir | Póliza de seguro | Tarjeta de circulación | Gato hidráulico | Llanta de refacción | Cables pasa corriente | Kit de herramientas | Kit de siniestro',
      'Lista para AUTO / CAMIONETA. Separa cada punto con la barra |'],
    ['CHECK_NOTA',             'Si algo te falta, avísale a tu supervisor antes de salir.',
      'Frase que aparece debajo de la lista. Déjala vacía si no quieres ninguna'],
    ['MENSAJE_BLOQUEO',        'App en mantenimiento. Intenta más tarde.', 'Texto que ven los gestores si está bloqueada'],
    ['WHATSAPP_ACTIVO',        true,  'TRUE/FALSE — ofrecer compartir por WhatsApp al cerrar'],
    ['WA_INCLUIR_FOTO',        true,  'TRUE/FALSE — mandar también la foto de evidencia'],
    ['WA_MSG_ENTREGADO',
      '✅ PEDIDO ENTREGADO\\n{id} · {cliente}\\n{direccion}\\nGestor: {gestor} · {vehiculo}\\n{fecha} {hora}',
      'Mensaje de entrega. Usa {id} {cliente} {direccion} {gestor} {vehiculo} {fecha} {hora} {motivo} {comentario}'],
    ['WA_MSG_RETORNO',
      '↩️ PEDIDO EN RETORNO\\n{id} · {cliente}\\n{direccion}\\nMotivo: {motivo}\\n{comentario}\\nGestor: {gestor}\\n{fecha} {hora}',
      'Mensaje de retorno'],
    ['WA_MSG_CANCELADO',
      '❌ PEDIDO CANCELADO\\n{id} · {cliente}\\n{direccion}\\nMotivo: {motivo}\\n{comentario}\\nGestor: {gestor}\\n{fecha} {hora}',
      'Mensaje de cancelación'],
    ['WA_MSG_TRASPASO_OK',
      '✅ TRASPASO ENTREGADO\\nFolio {folio} → {destino}\\nGestor: {gestor} · {vehiculo}\\n{fecha} {hora}',
      'Mensaje de traspaso entregado. Usa {folio} {origen} {destino} {contenido}'],
    ['WA_MSG_TRASPASO_NO',
      '⚠️ TRASPASO NO ENTREGADO\\nFolio {folio} → {destino}\\nMotivo: {motivo}\\n{comentario}\\nGestor: {gestor}\\n{fecha} {hora}',
      'Mensaje de traspaso no entregado'],
    ['VERSION',                '2.7.0', 'No editar']
  ];

  semillas.forEach(function (fila) {
    if (!existentes[_norm(fila[0])]) sh.appendRow(fila);
  });
  _setCfgHoja('VERSION', '2.7.0');
  sh.autoResizeColumns(1, 3);
}


/**
 * Motivos por tipo: CANCELADO, RETORNO y TRASPASO.
 * Si ya existían motivos de tipo "PEDIDO" (versión anterior), los reparte.
 */
function sembrarMotivos() {
  const sh = _hoja(CFG.H.MOTIVOS, true);

  // Migración: la versión 1.x guardaba todo como tipo "PEDIDO"
  if (sh.getLastRow() > 1) {
    const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    const hayPedido = datos.some(function (f) { return _norm(f[0]) === 'pedido'; });
    if (!hayPedido) return;                           // ya está en el formato nuevo
    const retorno = CFG.MOTIVOS_RETORNO.map(_norm);
    datos.forEach(function (f, i) {
      if (_norm(f[0]) !== 'pedido') return;
      sh.getRange(i + 2, 1).setValue(retorno.indexOf(_norm(f[1])) >= 0 ? 'RETORNO' : 'CANCELADO');
    });
    _log('SISTEMA', 'MIGRAR_MOTIVOS', 'PEDIDO → CANCELADO/RETORNO');
    return;
  }

  const filas = [];
  CFG.MOTIVOS_CANCELADO.forEach(function (m) { filas.push(['CANCELADO', m, false, true]); });
  CFG.MOTIVOS_RETORNO.forEach(function (m) { filas.push(['RETORNO', m, false, true]); });
  CFG.MOTIVOS_TRASPASO.forEach(function (m) {
    filas.push(['TRASPASO', m, _norm(m) === 'otro', true]);
  });
  sh.getRange(2, 1, filas.length, 4).setValues(filas);
  sh.setColumnWidth(2, 320);
}


/**
 * Siembra la biblioteca de "Documentación" la PRIMERA vez.
 * Si la hoja ya tiene documentos, NO la toca (respeta lo que tú edites).
 * Trae listo el protocolo de cortesía; las pólizas las agregas tú como filas.
 */
function sembrarDocumentos() {
  const sh = _hoja(CFG.H.DOCUMENTOS, true);
  if (sh.getLastRow() > 1) return;                       // ya hay documentos: no pisar

  const PROTOCOLO =
    'Antes de salir\n' +
    '• Preséntate limpio y con tu credencial visible.\n' +
    '• Lleva cambio y el paquete protegido.\n' +
    '• Revisa la dirección y el teléfono del cliente antes de arrancar.\n\n' +
    'Al llegar\n' +
    '• Saluda y preséntate: "Buen día, vengo de parte de FADERMEX / BOTICAN con su pedido."\n' +
    '• Confirma el nombre de quien recibe antes de entregar.\n' +
    '• Trata de usted, con amabilidad, aunque el cliente venga de prisa o molesto.\n\n' +
    'Al entregar\n' +
    '• Entrega el paquete en mano, no lo dejes tirado.\n' +
    '• Toma la foto de la fachada y, si se puede, pide la firma.\n' +
    '• Anota quién recibió.\n' +
    '• Agradece: "Gracias por su preferencia, que tenga buen día."\n\n' +
    'Si el cliente no está\n' +
    '• No dejes el paquete con desconocidos sin confirmar.\n' +
    '• Usa el botón RETORNO con el motivo correcto y toma evidencia.\n\n' +
    'Siempre\n' +
    '• Cuida tu presentación: representas a la empresa.\n' +
    '• Maneja con precaución y respeta tu equipo de seguridad.\n' +
    '• Ante cualquier duda o incidente, avisa a tu supervisor.';

  const EJEMPLO_POLIZA =
    'Esta es una fila de EJEMPLO (está desactivada).\n' +
    'Para cada vehículo agrega una fila con tipo "texto" y pon aquí los datos ' +
    'que sirven en la calle: aseguradora, número de póliza, teléfono de ' +
    'siniestros, vehículo y vigencia. Si tienes el PDF en Drive y se abre sin ' +
    'iniciar sesión, agrega otra fila tipo "enlace" con la liga.';

  const filas = [
    ['Cómo entregar', 'Protocolo de presentación y trato al cliente', 'texto', PROTOCOLO, true, 1],
    ['Pólizas y seguros', 'EJEMPLO — cómo llenar una póliza', 'texto', EJEMPLO_POLIZA, false, 10]
  ];
  sh.getRange(2, 1, filas.length, 6).setValues(filas);
  sh.setColumnWidth(2, 300);
  sh.setColumnWidth(4, 480);
  _log('SISTEMA', 'SEMBRAR_DOCUMENTOS', filas.length + ' documentos iniciales');
}


/**
 * Adivina si un vehículo es MOTO, AUTO o NINGUNO.
 * Si tú ya escribiste algo en la columna Tipo, eso manda y no se toca.
 * Lo que adivina es solo para no dejarte la columna vacía: revísala.
 */
function _tipoVehiculo(tipoActual, nombre, sinVeh) {
  const t = _norm(tipoActual);
  if (t === 'moto' || t === 'auto' || t === 'ninguno') return t.toUpperCase();

  const n = _norm(nombre);
  if (sinVeh && n === _norm(sinVeh)) return 'NINGUNO';
  if (/\b(moto|motocicleta|scooter|italika|vento|suzuki|yamaha|honda|bajaj|carabela)\b/.test(n)) return 'MOTO';
  if (/\b(camioneta|auto|coche|carro|van|pick ?up|nissan|chevrolet|ford|tsuru|urvan|estaquitas)\b/.test(n)) return 'AUTO';
  return 'AUTO';                                  // por defecto, la lista más completa
}


/** ============ SINCRONIZAR TODO DESDE "Cat" ============ */
function sincronizarCatalogos(silencioso) {
  let t;
  try {
    // Las sucursales viven en columnas "vecinas" (AX toma también AY y AZ) que
    // no están en COL_CAT. Le decimos a _abrirTabla hasta dónde debe leer para
    // que el recorte de columnas no se las coma.
    let minCol = 1000;                       // si no sabemos, lee todo (como antes)
    const cs = String(CFG.CAT_SUCURSALES_ENCABEZADO || '');
    const m = cs.match(/^\s*col\s*:\s*([A-Za-z]+)\s*$/);
    if (m) minCol = _letraAIdx(m[1]) + 3;    // sucursal + dirección + maps

    t = _abrirTabla(CFG.HOJA_CAT, CFG.COL_CAT, CFG.FILA_ENC_CAT, minCol);
  } catch (e) {
    const m = 'No pude abrir la hoja "' + CFG.HOJA_CAT + '": ' + e.message;
    if (!silencioso) SpreadsheetApp.getUi().alert(m);
    return m;
  }

  if (t.mapa.gestor < 0 || t.mapa.codigo < 0) {
    const m = 'En "' + CFG.HOJA_CAT + '" (fila de encabezados detectada: ' + t.filaEnc + ')\n' +
              'no encontré las columnas de Gestores y/o Codigos.\n\n' +
              'Encabezados de esa fila:\n' +
              t.enc.map(function (h, i) { return h ? (_letraCol(i + 1) + ': ' + h) : null; })
                   .filter(Boolean).join('\n');
    if (!silencioso) SpreadsheetApp.getUi().alert(m);
    return m;
  }

  /* --- Usuarios --- */
  const shU = _hoja(CFG.H.USUARIOS, true);
  const prev = {};
  if (shU.getLastRow() > 1) {
    shU.getRange(2, 1, shU.getLastRow() - 1, 6).getValues().forEach(function (f) {
      if (f[0]) prev[_norm(f[0])] = f;
    });
  }

  const usuarios = [], vistos = {};
  t.datos.forEach(function (f) {
    const nombre = String(f[t.mapa.gestor] || '').trim();
    const codigo = _normCodigo(f[t.mapa.codigo]);
    if (!nombre || !codigo) return;
    if (vistos[_norm(nombre)]) return;
    vistos[_norm(nombre)] = true;
    const p = prev[_norm(nombre)] || [];
    usuarios.push([
      nombre, codigo,
      (t.mapa.correo >= 0 ? String(f[t.mapa.correo] || '') : (p[2] || '')),
      (p[3] === false ? false : true),
      p[4] || '', p[5] || ''
    ]);
  });
  if (shU.getLastRow() > 1) shU.getRange(2, 1, shU.getLastRow() - 1, 6).clearContent();
  if (usuarios.length) shU.getRange(2, 1, usuarios.length, 6).setValues(usuarios);

  /* --- Vehículos (conserva los agregados a mano) --- */
  const shV = _hoja(CFG.H.VEHICULOS, true);
  const vehiculos = [], vistosV = {};
  const sinVeh = String(_cfgHoja('VEHICULO_SIN', 'Sin vehículo'));

  // Lo que ya tenías se respeta tal cual, incluido el Tipo que hayas escrito
  if (shV.getLastRow() > 1) {
    shV.getRange(2, 1, shV.getLastRow() - 1, 5).getValues().forEach(function (f) {
      if (!f[0] || vistosV[_norm(f[0])]) return;
      vistosV[_norm(f[0])] = true;
      vehiculos.push([f[0], f[1] || '', f[2] === false ? false : true, f[3] || '',
                      _tipoVehiculo(f[4], f[0], sinVeh)]);
    });
  }

  // Los que aparezcan en el catálogo y aún no estén, se agregan
  if (t.mapa.vehiculo >= 0) {
    t.datos.forEach(function (f) {
      const v = String(f[t.mapa.vehiculo] || '').trim();
      if (!v || vistosV[_norm(v)]) return;
      vistosV[_norm(v)] = true;
      vehiculos.push([v, '', true, 'Importado de ' + CFG.HOJA_CAT, _tipoVehiculo('', v, sinVeh)]);
    });
  }

  // La opción "sin vehículo" siempre debe existir, aunque nadie la haya escrito
  if (sinVeh && !vistosV[_norm(sinVeh)]) {
    vehiculos.push([sinVeh, '', true, 'Para entrar solo a consultar', 'NINGUNO']);
  }

  if (shV.getLastRow() > 1) shV.getRange(2, 1, shV.getLastRow() - 1, 5).clearContent();
  if (vehiculos.length) shV.getRange(2, 1, vehiculos.length, 5).setValues(vehiculos);

  /* --- Sucursales --- */
  const nSuc = sincronizarSucursales(t);

  const msg = 'Catálogos sincronizados desde "' + CFG.HOJA_CAT + '" (encabezados en la fila ' + t.filaEnc + '):\n' +
              '  • Gestores: ' + usuarios.length + '\n' +
              '  • Vehículos: ' + vehiculos.length + '\n' +
              '  • Sucursales: ' + nSuc;
  if (!silencioso) SpreadsheetApp.getUi().alert(msg);
  _log('SISTEMA', 'SINCRONIZAR', 'g=' + usuarios.length + ' v=' + vehiculos.length + ' s=' + nSuc);
  return msg;
}


/**
 * Trae las sucursales de "Cat": busca el encabezado "Sucursales" y toma
 * esa columna (nombre) más las dos siguientes (dirección y URL de Maps).
 */
function sincronizarSucursales(t) {
  const sh = _hoja(CFG.H.SUCURSALES, true);

  if (_cfgHoja('SINCRONIZAR_SUCURSALES_DESDE_CAT', true) === false) {
    return Math.max(0, sh.getLastRow() - 1);
  }

  let col = -1;
  if (t && t.enc) col = _idxCol(t.enc, CFG.CAT_SUCURSALES_ENCABEZADO);

  const filas = [];
  if (col >= 0) {
    const vistas = {};
    t.datos.forEach(function (f) {
      const nombre = String(f[col] || '').trim();
      if (!nombre || vistas[_norm(nombre)]) return;
      vistas[_norm(nombre)] = true;
      filas.push([nombre, String(f[col + 1] || '').trim(), String(f[col + 2] || '').trim(), true]);
    });
  }

  // Si "Cat" no dio nada, usa la lista de respaldo del código
  if (!filas.length) {
    if (sh.getLastRow() > 1) return sh.getLastRow() - 1;   // ya había datos, no tocar
    CFG.SUCURSALES_INICIALES.forEach(function (s) { filas.push([s[0], s[1], s[2], true]); });
  }

  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, 4).setValues(filas);
  sh.setColumnWidth(2, 380);
  sh.setColumnWidth(3, 300);
  return filas.length;
}


/** ==================== DIAGNÓSTICO ==================== */
function diagnostico() {
  const ss = _libro();
  const L = [];
  L.push('ARCHIVO: ' + ss.getName());
  L.push('VERSIÓN DE LA APP: ' + _cfgHoja('VERSION', '?'));
  L.push('');

  [[CFG.HOJA_OPERACIONES, CFG.COL_OPERACIONES, CFG.FILA_ENC_OPERACIONES],
   [CFG.HOJA_CAT,         CFG.COL_CAT,         CFG.FILA_ENC_CAT]].forEach(function (par) {

    L.push('══ HOJA: ' + par[0]);
    let t;
    try { t = _abrirTabla(par[0], par[1], par[2]); }
    catch (e) { L.push('   ❌ ' + e.message); L.push(''); return; }

    L.push('   Encabezados en la FILA ' + t.filaEnc +
           '   ·   notas saltadas: ' + t.saltadas +
           '   ·   primer dato: fila ' + t.filaPrimerDato +
           '   ·   datos: ' + t.datos.length);
    L.push('');
    L.push('   MAPEO:');
    let fallos = 0;
    Object.keys(t.mapa).forEach(function (k) {
      if (t.mapa[k] >= 0) {
        const ejemplo = t.datos.length ? String(t.datos[0][t.mapa[k]] || '').substring(0, 40) : '';
        L.push('     ✔ ' + _pad(k, 10) + ' → col ' + _pad(_letraCol(t.mapa[k] + 1), 3) +
               ' "' + t.enc[t.mapa[k]] + '"' + (ejemplo ? '   ej: ' + ejemplo : ''));
      } else {
        fallos++;
        L.push('     ❌ ' + _pad(k, 10) + ' → NO ENCONTRADA. Buscaba: ' +
               _lista(par[1][k]).join(' / '));
      }
    });
    // Filas reales, ya sin las notas — para confirmar que sí son datos
    L.push('');
    L.push('   PRIMERAS FILAS REALES:');
    for (let r = 0; r < Math.min(2, t.datos.length); r++) {
      const partes = [];
      Object.keys(t.mapa).forEach(function (k) {
        if (t.mapa[k] < 0) return;
        const v = String(t.datos[r][t.mapa[k]] == null ? '' : t.datos[r][t.mapa[k]]).trim();
        if (v) partes.push(k + '=' + v.substring(0, 26));
      });
      L.push('     fila ' + (t.filaPrimerDato + r) + ') ' + (partes.join(' | ') || '(vacía)'));
    }

    if (fallos) {
      L.push('');
      L.push('   Encabezados reales de la fila ' + t.filaEnc + ':');
      t.enc.forEach(function (h, i) {
        if (String(h).trim()) L.push('     ' + _letraCol(i + 1) + ': ' + String(h).substring(0, 50));
      });
    }

    if (par[0] === CFG.HOJA_CAT) {
      const c = _idxCol(t.enc, CFG.CAT_SUCURSALES_ENCABEZADO);
      L.push('');
      L.push('   SUCURSALES: ' + (c >= 0
        ? 'col ' + _letraCol(c + 1) + ' (+ ' + _letraCol(c + 2) + ' dirección, ' +
          _letraCol(c + 3) + ' URL)'
        : '❌ no encontré el encabezado "' + CFG.CAT_SUCURSALES_ENCABEZADO + '"'));
    }
    L.push('');
  });

  L.push('══ HOJAS DE LA APP');
  Object.keys(CFG.H).forEach(function (k) {
    const sh = _libroDe(CFG.H[k]).getSheetByName(CFG.H[k]);
    L.push('   ' + _pad(CFG.H[k], 26) + (sh ? (Math.max(0, sh.getLastRow() - 1) + ' filas') : '❌ falta'));
  });

  const conflictos = ss.getSheets().map(function (s) { return s.getName(); })
    .filter(function (n) { return n.indexOf('_conflict') >= 0; });
  if (conflictos.length) {
    L.push('');
    L.push('══ ⚠️ HOJAS DUPLICADAS — BÓRRALAS A MANO');
    conflictos.forEach(function (n) { L.push('   • ' + n); });
  }

  L.push('');
  L.push('══ ARCHIVOS DEL PROYECTO (¿los pegaste todos?)');
  let htmlScripts = '';
  try { htmlScripts = HtmlService.createHtmlOutputFromFile('Scripts').getContent(); } catch (e) { }
  [
    ['00_CONFIG',    typeof CFG !== 'undefined' && !!CFG.CARPETAS_DRIVE,
      'falta la v2.1 — no tiene CARPETAS_DRIVE'],
    ['01_INSTALADOR', typeof probarPendientesPorGestor === 'function',
      'falta la v2.1'],
    ['02_BACKEND',   typeof _carpetaDestino === 'function' && typeof _escribirEnOperaciones === 'function',
      'falta la v2.1 — las fotos NO se van a guardar'],
    ['03_ADMIN',     typeof _limpiarEnOperaciones === 'function',
      'falta la v2.0 — "Reabrir pedido" va a fallar'],
    ['Scripts.html', htmlScripts.indexOf('estiloResultado') >= 0,
      'falta la v2.0 — seguirías con 2 botones en vez de 3']
  ].forEach(function (x) {
    L.push('   ' + (x[1] ? '✔ ' : '❌ ') + _pad(x[0], 15) + (x[1] ? 'al día' : x[2]));
  });

  L.push('');
  L.push('══ CARPETAS DE DRIVE');
  L.push('   (el archivo se guarda con el ID del pedido como nombre' +
         (CFG.EXTENSION_EN_NOMBRE === true ? ' + extensión)' : ', sin extensión)'));
  ['ENTREGADO', 'CANCELADO', 'RETORNO', 'FIRMAS', 'TRASPASOS'].forEach(function (tipo) {
    try {
      const f = _carpetaDestino(tipo);
      const propia = (CFG.CARPETAS_DRIVE || {})[tipo] ? '' : '  (subcarpeta creada por la app)';
      L.push('   ✔ ' + _pad(tipo, 11) + f.getName() + propia);
    } catch (e) {
      L.push('   ❌ ' + _pad(tipo, 11) + e.message);
    }
  });

  const texto = L.join('\n');
  Logger.log(texto);
  try {
    const html = HtmlService.createHtmlOutput(
      '<pre style="font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap">' +
      texto.replace(/[&<>]/g, function (s) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s]; }) +
      '</pre>').setWidth(700).setHeight(580);
    SpreadsheetApp.getUi().showModalDialog(html, 'Diagnóstico');
  } catch (e) { }
  return texto;
}

function _pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}


/** ============ PRUEBA EN SECO: ¿QUÉ VE CADA GESTOR? ============ */
/**
 * Simula el login de cada gestor y muestra exactamente qué pedidos le
 * aparecerían en la app, SIN publicar nada y sin tocar ningún dato.
 * También desglosa por estatus, para decidir si hay que filtrar más.
 */
function probarPendientesPorGestor() {
  const L = [];
  L.push('PRUEBA EN SECO — lo que vería cada gestor al entrar a la app');
  L.push('');

  const shU = _hoja(CFG.H.USUARIOS);
  if (shU.getLastRow() < 2) {
    return _mostrar('Prueba en seco', 'No hay gestores en APP_Usuarios.');
  }
  const usuarios = shU.getRange(2, 1, shU.getLastRow() - 1, 4).getValues()
    .filter(function (f) { return f[0]; });

  const t = _abrirTabla(CFG.HOJA_OPERACIONES, CFG.COL_OPERACIONES, CFG.FILA_ENC_OPERACIONES);
  const c = t.mapa;

  // --- Reparto de TODA la hoja por gestor asignado ---
  const porGestor = {}, sinGestor = {};
  const fuera = CFG.ESTATUS_CERRADOS.map(_norm);
  let cerrados = 0;

  t.datos.forEach(function (f) {
    const id = String(f[c.id] || '').trim();
    if (!id) return;
    const est = c.estatus >= 0 ? String(f[c.estatus] || '').trim() : '';
    if (est && fuera.indexOf(_norm(est)) >= 0) { cerrados++; return; }
    const g = String(f[c.gestor] || '').trim();
    const clave = g || '(vacío)';
    const destino = _norm(g) && usuarios.some(function (u) { return _norm(u[0]) === _norm(g); })
      ? porGestor : sinGestor;
    destino[clave] = destino[clave] || { total: 0, estatus: {} };
    destino[clave].total++;
    destino[clave].estatus[est || '(sin estatus)'] =
      (destino[clave].estatus[est || '(sin estatus)'] || 0) + 1;
  });

  L.push('Total de filas en "' + CFG.HOJA_OPERACIONES + '": ' + t.datos.length);
  L.push('Ya cerradas (ENTREGADO / CANCELADO / etc.): ' + cerrados);
  L.push('');
  L.push('════ LO QUE VERÍA CADA GESTOR ════');

  usuarios.forEach(function (u) {
    const nombre = String(u[0]);
    const lista = _leerPendientes(nombre);
    L.push('');
    L.push('▶ ' + nombre + '  →  ' + lista.length + ' pendiente(s)');
    if (porGestor[nombre]) {
      const e = porGestor[nombre].estatus;
      L.push('   Por estatus: ' + Object.keys(e).map(function (k) {
        return k + ' (' + e[k] + ')';
      }).join(', '));
    }
    lista.slice(0, 5).forEach(function (p, i) {
      L.push('   ' + (i + 1) + ') ' + _pad(p.id, 16) + ' ' +
             String(p.cliente || '(sin nombre)').substring(0, 30));
      L.push('      ' + String(p.direccion || '(sin dirección)').substring(0, 70));
    });
    if (lista.length > 5) L.push('   … y ' + (lista.length - 5) + ' más');
  });

  const otros = Object.keys(sinGestor);
  if (otros.length) {
    L.push('');
    L.push('════ ABIERTOS QUE NO VE NADIE ════');
    L.push('(el texto de "Gestores" no coincide con ningún gestor dado de alta)');
    otros.sort(function (a, b) { return sinGestor[b].total - sinGestor[a].total; })
         .slice(0, 15).forEach(function (k) {
      L.push('   ' + _pad(k, 26) + sinGestor[k].total + ' pedido(s)');
    });
  }

  L.push('');
  L.push('Si algún gestor ve pedidos que NO debería (por ejemplo "EN ELABORACIÓN"),');
  L.push('avísame y le pongo un filtro de estatus permitidos.');

  return _mostrar('Prueba en seco', L.join('\n'));
}

/** Muestra un texto largo en una ventana. */
function _mostrar(titulo, texto) {
  Logger.log(texto);
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(
        '<pre style="font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap">' +
        texto.replace(/[&<>]/g, function (s) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s]; }) +
        '</pre>').setWidth(720).setHeight(580), titulo);
  } catch (e) { }
  return texto;
}


/** ============ PRUEBA DE ESCRITURA EN LAS CARPETAS ============ */
/**
 * Abrir una carpeta y escribir en ella son permisos DISTINTOS.
 * El diagnóstico solo comprueba que se pueda abrir; esta función
 * crea un archivo de prueba en cada una y lo borra enseguida.
 * Es la única forma de saber que las fotos y firmas sí se van a guardar.
 */
function probarCarpetasDrive() {
  const L = [];
  L.push('PRUEBA DE ESCRITURA EN LAS CARPETAS DE DRIVE');
  L.push('');
  L.push('Se crea un archivo de prueba en cada una y se borra al momento.');
  L.push('');

  let fallos = 0;
  ['ENTREGADO', 'RETORNO', 'CANCELADO', 'FIRMAS', 'TRASPASOS'].forEach(function (tipo) {
    const id = (CFG.CARPETAS_DRIVE || {})[tipo] || '(la crea la app)';
    let carpeta = null;

    try {
      carpeta = _carpetaDestino(tipo);
    } catch (e) {
      fallos++;
      L.push('❌ ' + _pad(tipo, 11) + 'NO SE PUEDE ABRIR');
      L.push('   ' + e.message);
      L.push('   ID configurado: ' + id);
      L.push('');
      return;
    }

    try {
      const f = carpeta.createFile(
        Utilities.newBlob('prueba', 'text/plain', '_prueba_app_logistica_' + Date.now()));
      f.setTrashed(true);
      L.push('✔ ' + _pad(tipo, 11) + carpeta.getName());
    } catch (e) {
      fallos++;
      L.push('❌ ' + _pad(tipo, 11) + carpeta.getName() + '  —  SOLO LECTURA');
      L.push('   ' + e.message);
      L.push('   Abre esa carpeta en Drive → Compartir → tu cuenta debe decir EDITOR.');
      L.push('   ID configurado: ' + id);
      L.push('');
    }
  });

  L.push('');
  if (fallos) {
    L.push('══ QUÉ SIGNIFICA');
    L.push('Una carpeta que solo se puede LEER deja abrir la carpeta pero no');
    L.push('crear archivos. Por eso el diagnóstico la daba por buena y aun así');
    L.push('las evidencias fallaban.');
    L.push('');
    L.push('Cómo se arregla, cualquiera de las dos:');
    L.push('  a) En Drive, clic derecho en la carpeta → Compartir → tu correo');
    L.push('     como EDITOR (si es de alguien más, que te lo dé esa persona).');
    L.push('  b) Crea una carpeta tuya y pega su ID en CARPETAS_DRIVE (00_CONFIG).');
    L.push('');
    L.push('Mientras tanto la app NO pierde nada: si una carpeta no acepta,');
    L.push('guarda la evidencia en la de ENTREGADO con el tipo entre paréntesis.');
  } else {
    L.push('✅ Las cinco aceptan escritura. Las evidencias se van a guardar bien.');
  }

  return _mostrar('Carpetas de Drive', L.join('\n'));
}


/** ============ EXPLORADOR DE TODO EL LIBRO ============ */
/**
 * Recorre TODAS las hojas del archivo y vuelca en la hoja "APP_Diagnostico"
 * un mapa completo: hoja, fila de encabezados, letra de columna, encabezado
 * y dos ejemplos reales. Sirve para encontrar dónde vive cada dato.
 */
function explorarLibro() {
  const ss = _libro();
  const PISTAS = ['codigo', 'credencial', 'gestor', 'vehiculo', 'sucursal',
                  'folio', 'origen', 'destino', 'direccion', 'url', 'traspaso'];

  const salida = [['HOJA', 'FILA ENC', 'COL', 'ENCABEZADO', 'EJEMPLO 1', 'EJEMPLO 2', 'PISTA']];

  ss.getSheets().forEach(function (sh) {
    const nombre = sh.getName();
    if (nombre.indexOf('APP_') === 0) return;             // saltar las nuestras
    const ultFila = sh.getLastRow(), ultCol = sh.getLastColumn();
    if (ultFila < 1 || ultCol < 1) return;

    const explorar = Math.min(8, ultFila);
    const cab = sh.getRange(1, 1, explorar, Math.min(ultCol, 400)).getValues();

    // La fila de encabezados es la que tiene más textos CORTOS distintos
    let filaEnc = 1, mejor = -1;
    for (let i = 0; i < explorar; i++) {
      let p = 0;
      for (let j = 0; j < cab[i].length; j++) {
        const v = String(cab[i][j] == null ? '' : cab[i][j]).trim();
        if (v && v.length <= 45 && v.indexOf('=') !== 0) p++;
      }
      if (p > mejor) { mejor = p; filaEnc = i + 1; }
    }

    const enc = sh.getRange(filaEnc, 1, 1, Math.min(ultCol, 400)).getValues()[0];
    const nMuestra = Math.min(8, ultFila - filaEnc);
    const muestra = nMuestra > 0
      ? sh.getRange(filaEnc + 1, 1, nMuestra, Math.min(ultCol, 400)).getValues() : [];

    let escritas = 0;
    for (let j = 0; j < enc.length && escritas < 400; j++) {
      const h = String(enc[j] == null ? '' : enc[j]).trim();
      if (!h) continue;
      const ejemplos = [];
      for (let i = 0; i < muestra.length && ejemplos.length < 2; i++) {
        const v = String(muestra[i][j] == null ? '' : muestra[i][j]).trim();
        if (v) ejemplos.push(v.substring(0, 60));
      }
      const hn = _norm(h);
      const pista = PISTAS.filter(function (p) { return hn.indexOf(p) >= 0; }).join(', ');
      salida.push([nombre, filaEnc, _letraCol(j + 1), h.substring(0, 80),
                   ejemplos[0] || '', ejemplos[1] || '', pista]);
      escritas++;
    }
    salida.push(['', '', '', '', '', '', '']);
  });

  let d = ss.getSheetByName('APP_Diagnostico');
  if (!d) d = ss.insertSheet('APP_Diagnostico');
  d.clear();
  d.getRange(1, 1, salida.length, 7).setValues(salida);
  d.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#F4B183');
  d.setFrozenRows(1);
  d.setColumnWidth(1, 130); d.setColumnWidth(4, 260);
  d.setColumnWidth(5, 240); d.setColumnWidth(6, 240);
  d.autoResizeColumns(2, 2);

  const msg = 'Listo. Abre la pestaña "APP_Diagnostico".\n\n' +
              'Tiene el mapa completo del libro: ' + (salida.length - 1) + ' líneas.\n' +
              'Filtra la columna PISTA para encontrar rápido dónde están\n' +
              'los códigos de credencial y el bloque de sucursales.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }
  _log('SISTEMA', 'EXPLORAR', salida.length + ' líneas');
  return msg;
}


/** ============ DETECTOR DE COLISIONES DE CÓDIGO ============ */
/**
 * Este proyecto de Apps Script ya tenía otros scripts (Rastreo, Shopify…).
 * Si alguno define doGet() u onOpen(), solo UNO sobrevive y el otro deja
 * de funcionar. Esta función dice cuál está ganando.
 */
function probarColisiones() {
  const L = [];
  L.push('PRUEBA DE COLISIONES EN EL PROYECTO DE APPS SCRIPT');
  L.push('');

  function revisar(nombre, marca, queEs) {
    let f;
    try { f = eval(nombre); } catch (e) { f = null; }
    if (typeof f !== 'function') { L.push('• ' + nombre + '(): no existe.'); return; }
    const src = f.toString();
    L.push('• ' + nombre + '(): ' + (src.indexOf(marca) >= 0
      ? '✔ el activo es el de la APP DE LOGÍSTICA'
      : '❌ COLISIÓN — está ganando OTRO ' + queEs + '.\n' +
        '        Primeras líneas del que ganó:\n        ' +
        src.split('\n').slice(0, 4).join('\n        ')));
  }

  revisar('doGet',  'NOMBRE_APP', 'doGet (probablemente el de Rastreo)');
  revisar('onOpen', 'Logística',  'onOpen (probablemente el de macros)');
  revisar('include', 'createHtmlOutputFromFile', 'include');

  L.push('');
  L.push('Si sale ❌ en doGet, la app web NO va a abrir correctamente');
  L.push('y hay que mover este código a su propio proyecto de Apps Script.');

  const texto = L.join('\n');
  Logger.log(texto);
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput('<pre style="font:12px/1.5 monospace;white-space:pre-wrap">' +
        texto.replace(/[&<>]/g, function (s) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s]; }) +
        '</pre>').setWidth(680).setHeight(420), 'Colisiones');
  } catch (e) { }
  return texto;
}


/** ==================== MANTENIMIENTO ==================== */
function liberarCandadosTodos() {
  const sh = _hoja(CFG.H.SESIONES, true);
  if (sh.getLastRow() > 1) sh.getRange(2, 5, sh.getLastRow() - 1, 1).setValue('');
  _log('ADMIN', 'LIBERAR_CANDADOS', 'todos');
  try { SpreadsheetApp.getUi().alert('Candados de vehículo liberados.'); } catch (e) { }
}

function cerrarTodasSesiones() {
  const sh = _hoja(CFG.H.SESIONES, true);
  if (sh.getLastRow() > 1) sh.getRange(2, 6, sh.getLastRow() - 1, 1).setValue(false);
  _log('ADMIN', 'CERRAR_SESIONES', 'todas');
  try { SpreadsheetApp.getUi().alert('Todas las sesiones fueron cerradas.'); } catch (e) { }
}
