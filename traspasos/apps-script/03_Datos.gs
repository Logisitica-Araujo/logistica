/***********************************************************************
 * TRASPASOS FADERMEX — 03_Datos.gs
 * ---------------------------------------------------------------------
 * Lectura de catálogos y de traspasos, sesión (12 h), folios y bitácoras.
 ***********************************************************************/

/* ======================= CATÁLOGOS ======================= */

function _tipoSuc(v) {
  const n = _norm(v);
  if (n.indexOf('oficina') >= 0) return 'OFICINAS';
  if (n.indexOf('foran') >= 0) return 'FORANEA';
  if (n.indexOf('independ') >= 0) return 'INDEPENDIENTE';
  return 'SUCURSAL';
}

var __AREAS = null;
/** Mapa de áreas: id → {id, corto, suc, sucNombre, tipo, correos[], activa} */
function _areas() {
  if (__AREAS) return __AREAS;
  const suc = {};
  _tb(TR.H.SUCURSALES).filas().forEach(function (f) {
    const id = String(f['ID']).trim().toUpperCase();
    if (id) suc[id] = { nombre: String(f['Nombre']).trim(), tipo: _tipoSuc(f['Tipo']), activa: _activo(f['Activa']) };
  });
  const A = {};
  _tb(TR.H.AREAS).filas().forEach(function (f) {
    const id = String(f['Prefijo de folio']).trim().toUpperCase();
    if (!id) return;
    const sid = String(f['Sucursal (ID)']).trim().toUpperCase();
    const s = suc[sid] || { nombre: '', tipo: 'SUCURSAL', activa: true };
    A[id] = {
      id: id,
      corto: String(f['Nombre del área']).trim(),
      suc: sid,
      sucNombre: s.nombre,
      tipo: s.tipo,
      correos: String(f['Correo de la cuenta'] || '').toLowerCase().split(/[\s,;]+/)
                 .filter(function (c) { return c.indexOf('@') > 0; }),
      activa: _activo(f['Activa']) && s.activa,
      pin: String(f['PIN de entrada'] == null ? '' : f['PIN de entrada']).trim()
    };
  });
  __AREAS = A;
  return A;
}

function _nom(id) { return R.nom(_areas(), id); }

var __ESTATUS = null;
function _estatus() {
  if (__ESTATUS) return __ESTATUS;
  const lista = _tb(TR.H.ESTATUS).filas().map(function (f) {
    const hex = function (v, d) { const s = String(v || '').replace('#', '').trim(); return /^[0-9a-fA-F]{6}$/.test(s) ? '#' + s : d; };
    return {
      clave: String(f['Clave']).trim().toUpperCase(),
      nombre: String(f['Nombre en pantalla']).trim(),
      significado: String(f['Significado'] || ''),
      color: hex(f['Color texto (hex)'], '#4E5B67'),
      fondo: hex(f['Color fondo (hex)'], '#E8ECF0'),
      orden: Number(f['Orden']) || 99
    };
  }).filter(function (e) { return e.clave; });
  lista.sort(function (a, b) { return a.orden - b.orden; });
  __ESTATUS = lista;
  return lista;
}
function _mapaEstatus() {
  const m = {};
  _estatus().forEach(function (e) { m[e.clave] = e.nombre; });
  return m;
}

function _esAdmin(email) {
  const e = String(email || '').toLowerCase();
  if (!e) return false;
  return _tb(TR.H.ADMINS).filas().some(function (f) {
    return String(f['Correo']).trim().toLowerCase() === e && _activo(f['Activo']);
  });
}

function _catalogos() {
  const A = _areas();
  const areas = Object.keys(A).map(function (id) {
    const a = A[id];
    return { id: id, corto: a.corto, suc: a.suc, sucNombre: a.sucNombre, tipo: a.tipo, activa: a.activa, nombre: R.nom(A, id) };
  });
  const paq = _tb(TR.H.PAQ).filas()
    .filter(function (f) { return f['Paquetería'] && _activo(f['Activa']); })
    .map(function (f) { return String(f['Paquetería']); });
  const motivos = { REIMPRESION: [], ELIMINACION: [], INCIDENCIA: [] };
  _tb(TR.H.MOTIVOS).filas().forEach(function (f) {
    const t = String(f['Tipo']).trim().toUpperCase();
    if (motivos[t] && f['Motivo'] && _activo(f['Activo'])) motivos[t].push(String(f['Motivo']));
  });
  return {
    areas: areas,
    estatus: _estatus(),
    paqueterias: paq,
    motivos: motivos,
    ajustes: {
      revisarSeg: Number(_ajuste('revisar_avisos_cada_seg', 45)) || 45,
      etiquetaAncho: Number(_ajuste('etiqueta_ancho_mm', 50)) || 50,
      etiquetaAlto: Number(_ajuste('etiqueta_alto_mm', 20)) || 20,
      horasSinSalida: Number(_ajuste('horas_alerta_sin_salida', 36)) || 36,
      logo: _logo(),
      urlHoja: _libro().getUrl()
    },
    impresoras: _impresoras(),
    enviosOf: _enviosOficinas().lista
  };
}

/**
 * Guía "¿Qué se manda a cada área de Oficinas?" (hoja CAT_EnviosOf).
 * Columnas: Documentos | Área   (encabezados en la fila 2; el Área es el NOMBRE como en CAT_Areas, ej. "Coordinación PV").
 * Regresa { lista: [{doc, area}], sinArea: ['Nombre que no existe', ...] }.
 */
function _enviosOficinas() {
  const out = { lista: [], sinArea: [] };
  const libro = _libro();
  const sh = libro.getSheetByName('CAT_EnviosOf') ||
    libro.getSheets().filter(function (h) { return _norm(h.getName()).replace(/[^a-z]/g, '') === 'catenviosof'; })[0];
  if (!sh || sh.getLastRow() <= TR.FILA_ENC) return out;
  const lc = Math.max(2, sh.getLastColumn());
  const enc = sh.getRange(TR.FILA_ENC, 1, 1, lc).getValues()[0].map(_norm);
  let cDoc = enc.findIndex(function (h) { return h.indexOf('document') >= 0 || h.indexOf('que se manda') >= 0; });
  let cArea = enc.findIndex(function (h) { return h.indexOf('area') === 0; });
  if (cDoc < 0) cDoc = 0;
  if (cArea < 0) cArea = 1;
  // nombre (o prefijo) del área → prefijo, solo áreas de Oficinas
  const A = _areas(), porNombre = {};
  Object.keys(A).forEach(function (id) {
    if (A[id].tipo !== 'OFICINAS' || id === 'REC') return;
    porNombre[_norm(A[id].corto)] = id;
    porNombre[_norm(id)] = id;
  });
  sh.getRange(TR.FILA_ENC + 1, 1, sh.getLastRow() - TR.FILA_ENC, lc).getValues().forEach(function (f) {
    const doc = String(f[cDoc] == null ? '' : f[cDoc]).trim();
    const nombre = String(f[cArea] == null ? '' : f[cArea]).trim();
    if (!doc || !nombre) return;
    const id = porNombre[_norm(nombre)] || porNombre[_norm(nombre.replace(/^oficinas\s*[·\-]\s*/i, ''))];
    if (id) out.lista.push({ doc: doc, area: id });
    else if (out.sinArea.indexOf(nombre) < 0) out.sinArea.push(nombre);
  });
  return out;
}

/**
 * Logo de CFG_Ajustes → logo_empresa.
 * Un link de Google Drive ("…/file/d/ID/view") NO es una imagen: el navegador
 * la muestra rota. Aquí se lee el archivo de Drive y se manda ya como imagen.
 * Sirve con cualquier link de Drive, aunque no esté compartido al público.
 */
function _logo() {
  const v = String(_ajuste('logo_empresa', '') || '').trim();
  if (!v) return '';
  const esDrive = /drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(v);
  const m = v.match(/(?:\/d\/|[?&]id=)([-\w]{20,})/);
  if (!esDrive || !m) return v;
  const id = m[1];
  const cache = CacheService.getScriptCache();
  const k = 'logo_' + id;
  const ya = cache.get(k);
  if (ya) return ya;
  try {
    const b = DriveApp.getFileById(id).getBlob();
    const uri = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
    if (uri.length < 95000) cache.put(k, uri, 21600);      // 6 h en memoria
    return uri;
  } catch (e) {
    return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400';
  }
}

/**
 * Configuración de impresora por área o por sucursal (hoja CAT_Impresoras).
 * En "Área (prefijo)" puede ir el prefijo del área (NR), el ID o nombre de la
 * sucursal (NR / Nueva Roma: aplica a todas sus áreas) o TODAS.
 * Columnas (por nombre; las opcionales pueden faltar):
 *   Ancho etiqueta (mm) · Alto etiqueta (mm) · Margen superior (mm) · Margen izquierdo (mm)
 *   Orientación (Horizontal / Vertical) · Formato (AUTO, MINI, CHICA, COMPLETA) · Impresora (marca y modelo)
 * Regresa { 'NR': {ancho, alto, arriba, izq, girar, formato, modelo}, ... } ya resuelto por área.
 * Si un área no tiene fila, usa el tamaño general de CFG_Ajustes.
 */
function _impresoras() {
  const out = {};
  const libro = _libro();
  const sh = libro.getSheetByName(TR.H.IMPRESORAS) ||
    libro.getSheets().filter(function (h) { return _norm(h.getName()).indexOf('impresora') >= 0; })[0];
  if (!sh || sh.getLastRow() <= TR.FILA_ENC) return out;
  const lc = sh.getLastColumn();
  const enc = sh.getRange(TR.FILA_ENC, 1, 1, lc).getValues()[0].map(_norm);
  const col = function (prueba) { for (let i = 0; i < enc.length; i++) if (prueba(enc[i])) return i; return -1; };
  const cId = col(function (h) { return h.indexOf('prefijo') >= 0 || h === 'area' || h.indexOf('sucursal') === 0; });
  const cAn = col(function (h) { return h.indexOf('ancho') >= 0; });
  const cAl = col(function (h) { return h.indexOf('alto') >= 0; });
  const cArr = col(function (h) { return h.indexOf('margen sup') >= 0 || h.indexOf('arriba') >= 0; });
  const cIzq = col(function (h) { return h.indexOf('margen izq') >= 0 || h.indexOf('izquierd') >= 0; });
  const cOri = col(function (h) { return h.indexOf('orienta') >= 0; });
  const cFmt = col(function (h) { return h.indexOf('formato') >= 0; });
  const cMod = col(function (h) { return h.indexOf('impresora') >= 0 || h.indexOf('modelo') >= 0; });
  if (cId < 0 || cAn < 0 || cAl < 0) return out;
  const num = function (f, c) { return c >= 0 ? Number(String(f[c]).replace(',', '.')) || 0 : 0; };
  const filas = sh.getRange(TR.FILA_ENC + 1, 1, sh.getLastRow() - TR.FILA_ENC, lc).getValues();
  const conf = {};
  filas.forEach(function (f) {
    const k = _norm(f[cId]);
    const an = num(f, cAn), al = num(f, cAl);
    if (!k || !(an > 0) || !(al > 0)) return;
    conf[k] = {
      ancho: an, alto: al, arriba: num(f, cArr), izq: num(f, cIzq),
      girar: cOri >= 0 && _norm(f[cOri]).indexOf('vert') === 0,
      formato: cFmt >= 0 ? String(f[cFmt] || '').trim().toUpperCase() : '',
      modelo: cMod >= 0 ? String(f[cMod] || '') : ''
    };
  });
  const A = _areas();
  Object.keys(A).forEach(function (id) {
    const a = A[id];
    const c = conf[_norm(id)] || conf[_norm(a.corto)] || conf[_norm(R.nom(A, id))] ||
              conf[_norm(a.suc)] || conf[_norm(a.sucNombre)] || conf['todas'] || conf['todos'];
    if (c) out[id] = c;
  });
  return out;
}


/* ======================= SESIÓN =======================
 * Quién eres lo dice tu cuenta de Google (@fadermex.com).
 * El "token" guarda en qué área estás trabajando en esa computadora y
 * cuándo vence (12 h, se cambia en CFG_Ajustes). Va firmado: no se
 * puede falsificar ni cambiar de área a mano.
 * ====================================================== */

function _email() {
  return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
}

function _secreto() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('TR_SECRETO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('TR_SECRETO', s); }
  return s;
}
function _firmar(txt) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(txt, _secreto()));
}

function _crearToken(email, area, admin) {
  // 0 (o vacío) en CFG_Ajustes = la sesión no se cierra sola.
  let horas = Number(_ajuste(admin ? 'sesion_horas_admin' : 'sesion_horas_sucursal', 0)) || 0;
  if (!(horas > 0)) horas = 24 * 365 * 10;
  const exp = Date.now() + horas * 3600000;
  const p = [email, area, admin ? 1 : 0, exp].join('|');
  return { token: Utilities.base64EncodeWebSafe(p) + '.' + _firmar(p), exp: exp };
}

/** Valida el token. Lanza SESION_EXPIRADA si no sirve. */
function _ctx(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 2) throw new Error('SESION_EXPIRADA');
  let p;
  try { p = Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString(); }
  catch (e) { throw new Error('SESION_EXPIRADA'); }
  if (_firmar(p) !== partes[1]) throw new Error('SESION_EXPIRADA');
  const d = p.split('|');
  if (Date.now() > Number(d[3])) throw new Error('SESION_EXPIRADA');
  const yo = _email();
  if (yo && yo !== d[0]) throw new Error('SESION_EXPIRADA');
  // Los poderes de administrador solo existen en el modo Administración.
  // Si un administrador entra como su área, trabaja como cualquier usuario.
  const admin = d[1] === TR.AREA_ADMIN && d[2] === '1' && _esAdmin(d[0]);
  return { email: d[0], area: d[1], admin: admin, exp: Number(d[3]), puedeAdmin: _esAdmin(d[0]) };
}

function _exigirAdmin(c) {
  if (!c.admin) throw new Error('Solo un administrador puede hacer esto.');
}


/* ======================= TRASPASOS ======================= */

function _tObj(f) {
  return {
    folio: String(f['Folio']).trim(),
    fecha: _txt(f['Fecha creación']),
    hora: _txt(f['Hora']),
    origen: String(f['Origen (prefijo)']).trim().toUpperCase(),
    destino: String(f['Destino (prefijo)']).trim().toUpperCase(),
    desc: String(f['Descripción'] || ''),
    bultos: Number(f['Bultos']) || 1,
    por: String(f['Creado por'] || ''),
    cred: String(f['Credencial'] || ''),
    sinCred: _si(f['Sin credencial']),
    estatus: String(f['Estatus'] || '').trim().toUpperCase(),
    ubic: String(f['Ubicación actual'] || '').trim().toUpperCase(),
    ruta: String(f['Ruta'] || '').trim().toUpperCase(),
    gestor: String(f['Gestor'] || ''),
    fechaRec: _txt(f['Fecha recolección']),
    paqueteria: String(f['Paquetería'] || ''),
    guia: String(f['Guía'] || ''),
    fechaEnt: _txt(f['Fecha entrega']),
    recibio: String(f['Recibido por'] || ''),
    bultosRec: String(f['Bultos recibidos'] || ''),
    reimp: Number(f['Reimpresiones']) || 0,
    solicitud: _si(f['Eliminación solicitada']),
    act: _txt(f['Última actualización']),
    _fila: f._fila
  };
}

function _traspasos() {
  return _tb(TR.H.TRASPASOS).filas().map(_tObj).filter(function (t) { return t.folio; });
}

function _buscarT(folio) {
  const f = R.folioDe(folio);
  const lista = _traspasos();
  for (let i = lista.length - 1; i >= 0; i--) {
    if (R.limpio(lista[i].folio) === f) return lista[i];
  }
  return null;
}

/** Cambia columnas de un traspaso (por nombre de encabezado) y marca la hora. */
function _actualizarT(t, cambios) {
  cambios['Última actualización'] = _ahoraTxt();
  _tb(TR.H.TRASPASOS).actualizar(t._fila, cambios);
}

/** Siguiente folio de un área, con candado para que nunca se repita. Llamar DENTRO de _conCandado. */
function _siguienteFolio(prefijo) {
  const tf = _tb(TR.H.FOLIOS);
  let fila = null, ultimo = 0;
  tf.filas().forEach(function (f) {
    if (String(f['Prefijo']).trim().toUpperCase() === prefijo) { fila = f._fila; ultimo = Number(f['Último número']) || 0; }
  });
  // Por si alguien movió el contador a mano: nunca por debajo del folio más alto que ya existe.
  const re = new RegExp('^' + prefijo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$');
  _traspasos().forEach(function (t) {
    const m = R.limpio(t.folio).match(re);
    if (m) ultimo = Math.max(ultimo, Number(m[1]));
  });
  const n = ultimo + 1;
  if (fila) tf.actualizar(fila, { 'Último número': n, 'Actualizado': _ahoraTxt() });
  else tf.agregar({ 'Prefijo': prefijo, 'Último número': n, 'Actualizado': _ahoraTxt() });
  const dig = Number(_ajuste('folio_digitos', 4)) || 4;
  return prefijo + '-' + String(n).padStart(dig, '0');
}


/* ======================= BITÁCORAS ======================= */

function _movObj(t, accion, antes, despues, x) {
  x = x || {};
  return {
    'ID': _id('M'), 'Fecha': _hoy(), 'Hora': _hora(), 'Folio': t.folio, 'Acción': accion,
    'Estatus anterior': antes || '', 'Estatus nuevo': despues || '',
    'Dónde ocurrió (área)': x.donde ? _nom(x.donde) : '', 'Persona': x.persona || '',
    'Credencial': x.cred || '', 'Medio': x.medio || '', 'Equipo': x.equipo || '', 'Detalle': x.detalle || ''
  };
}
function _mov(t, accion, antes, despues, x) { _tb(TR.H.MOV).agregar(_movObj(t, accion, antes, despues, x)); }

function _avisoObj(para, folio, msg) {
  return { 'Fecha': _hoy(), 'Hora': _hora(), 'Para (área)': para, 'Folio': folio, 'Mensaje': msg, 'Visto': 'NO' };
}
function _aviso(para, folio, msg) { if (para) _tb(TR.H.AVISOS).agregar(_avisoObj(para, folio, msg)); }

function _adminLog(email, accion, objeto, antes, despues, motivo) {
  _tb(TR.H.ADMINLOG).agregar({
    'Fecha': _hoy(), 'Hora': _hora(), 'Administrador': email, 'Acción': accion,
    'Objeto': objeto, 'Antes': antes || '', 'Después': despues || '', 'Motivo': motivo || ''
  });
}

function _etiquetasObj(t, bultos, impresion, persona, motivo) {
  return bultos.map(function (b) {
    return { 'Fecha': _hoy(), 'Hora': _hora(), 'Folio': t.folio, 'Bulto': b + ' de ' + t.bultos,
             'Impresión': impresion, 'Persona': persona || '', 'Motivo': motivo || '' };
  });
}


/* ======================= PERSONAS Y GESTORES ======================= */

/**
 * ¿Quién es? Por credencial escaneada  →  d = 'EMP-0153'  ó  {codigo:'EMP-0153'}
 *            o tecleando usuario y NIP →  d = {usuario:'sofia', nip:'123TAB'}
 * "usuario" puede ser la columna Usuario o el No. de empleado.
 * tipo = 'PERSONA' | 'GESTOR' | '' (cualquiera). Regresa null si no coincide.
 * 5 NIP equivocados con el mismo usuario lo bloquean 15 minutos.
 */
function _identificar(d, tipo) {
  if (d == null) return null;
  if (typeof d !== 'object') d = { codigo: d };
  const cod = _normCod(d.codigo);
  const usr = String(d.usuario || '').trim();
  const nip = String(d.nip || '').trim().toUpperCase();
  if (!cod && !usr) return null;

  let bloqueo = null;
  if (!cod) {
    bloqueo = CacheService.getScriptCache();
    const n = Number(bloqueo.get('nip_' + _norm(usr)) || 0);
    if (n >= 5) throw new Error('Demasiados NIP equivocados con ese usuario. Espera 15 minutos.');
  }

  const buscar = function (hoja, t) {
    if (!_libro().getSheetByName(hoja)) return null;
    const f = _tb(hoja).filas().filter(function (p) {
      if (!_activo(p['Activo'])) return false;
      if (cod) return _normCod(p['Código de credencial']) === cod;
      const u = _norm(usr);
      const esEl = (_norm(p['Usuario']) === u && u) || (t === 'PERSONA' && _normCod(p['No. empleado']) === _normCod(usr) && _normCod(usr));
      return esEl && nip && String(p['NIP'] == null ? '' : p['NIP']).trim().toUpperCase() === nip;
    })[0];
    if (!f) return null;
    // Un empleado de CAT_Personas cuyo puesto/área diga "gestor" también cuenta como gestor.
    const esGestor = t === 'GESTOR' || /gestor/i.test(String(f['Puesto'] || '') + ' ' + String(f['Área (prefijo)'] || ''));
    return {
      tipo: esGestor ? 'GESTOR' : 'PERSONA',
      nombre: String(f['Nombre completo']),
      codigo: cod ? String(f['Código de credencial']) : '',
      usuario: String(f['Usuario'] || usr),
      num: String(f['No. empleado'] || ''),
      area: String(f['Área (prefijo)'] || '').trim().toUpperCase(),
      // cómo se identificó (para la bitácora)
      via: cod ? String(f['Código de credencial']) : 'usuario ' + String(f['Usuario'] || usr)
    };
  };
  // Se busca en las DOS hojas: cualquier persona registrada se puede identificar.
  // Si está en CAT_Gestores (aunque también esté en CAT_Personas) cuenta como GESTOR.
  // "tipo" solo decide en qué hoja se busca primero.
  const r = tipo === 'PERSONA'
    ? (buscar(TR.H.PERSONAS, 'PERSONA') || buscar(TR.H.GESTORES, 'GESTOR'))
    : (buscar(TR.H.GESTORES, 'GESTOR') || buscar(TR.H.PERSONAS, 'PERSONA'));
  if (bloqueo) {
    const k = 'nip_' + _norm(usr);
    if (r) bloqueo.remove(k); else bloqueo.put(k, String(Number(bloqueo.get(k) || 0) + 1), 900);
  }
  return r;
}

function _personaPorCodigo(d) { return _identificar(d, 'PERSONA'); }
function _gestorPorCodigo(d) { return _identificar(d, 'GESTOR'); }

/** Lo que se le manda a la página: SOLO el nombre, nunca el código de la credencial. */
function _publico(q) {
  if (!q) return null;
  const a = _areas()[q.area];
  return { tipo: q.tipo, nombre: q.nombre, area: q.area, areaNombre: a ? R.nom(_areas(), q.area) : '', conCredencial: !!q.codigo };
}

/** Texto de error cuando no se reconoce a alguien. */
function _noReconocido(d, que) {
  if (d && typeof d === 'object' && !d.codigo) return 'Usuario o NIP incorrectos' + (que ? ' (' + que + ')' : '') + '.';
  return 'Esa credencial no está registrada' + (que ? ' (' + que + ')' : '') + ' o está desactivada. Revisa CAT_Personas / CAT_Gestores.';
}

/** Valida un PIN (de área o de administrador). 5 errores = 15 min de bloqueo. */
function _validarPin(clave, esperado, pin) {
  if (!esperado) return true;
  const cache = CacheService.getScriptCache();
  const k = 'pin_' + clave;
  const n = Number(cache.get(k) || 0);
  if (n >= 5) throw new Error('Demasiados PIN equivocados. Espera 15 minutos.');
  if (!String(pin || '').trim()) throw new Error('PIN_REQUERIDO');
  if (String(pin).trim().toUpperCase() === String(esperado).trim().toUpperCase()) { cache.remove(k); return true; }
  cache.put(k, String(n + 1), 900);
  throw new Error('PIN incorrecto.');
}

/** Registra (una sola vez) a quien todavía no tiene credencial. */
function _registrarSinCredencial(nombre, num, area) {
  const tp = _tb(TR.H.PERSONAS);
  const ya = tp.filas().filter(function (p) { return _normCod(p['No. empleado']) === _normCod(num); })[0];
  if (ya) return { nombre: String(ya['Nombre completo'] || nombre), num: String(num) };
  tp.agregar({
    'No. empleado': num, 'Nombre completo': nombre, 'Código de credencial': '', 'Área (prefijo)': area,
    'Tiene credencial': 'NO', 'Activo': 'SI', 'Alta': _hoy(), 'Notas': 'Registrado desde la app al crear un traspaso'
  });
  return { nombre: nombre, num: String(num) };
}
