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
      activa: _activo(f['Activa']) && s.activa
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
      etiquetaAncho: Number(_ajuste('etiqueta_ancho_mm', 62)) || 62,
      etiquetaAlto: Number(_ajuste('etiqueta_alto_mm', 100)) || 100,
      logo: String(_ajuste('logo_empresa', '')),
      urlHoja: _libro().getUrl()
    }
  };
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
  const horas = Number(_ajuste(admin ? 'sesion_horas_admin' : 'sesion_horas_sucursal', 12)) || 12;
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
  const admin = d[2] === '1' && _esAdmin(d[0]);
  return { email: d[0], area: d[1], admin: admin, exp: Number(d[3]) };
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

function _personaPorCodigo(codigo) {
  const c = _normCod(codigo);
  if (!c) return null;
  const f = _tb(TR.H.PERSONAS).filas().filter(function (p) {
    return _normCod(p['Código de credencial']) === c && _activo(p['Activo']);
  })[0];
  return f ? { nombre: String(f['Nombre completo']), codigo: String(f['Código de credencial']), num: String(f['No. empleado'] || '') } : null;
}

function _gestorPorCodigo(codigo) {
  const c = _normCod(codigo);
  if (!c) return null;
  const f = _tb(TR.H.GESTORES).filas().filter(function (g) {
    return _normCod(g['Código de credencial']) === c && _activo(g['Activo']);
  })[0];
  return f ? { nombre: String(f['Nombre completo']), codigo: String(f['Código de credencial']) } : null;
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
