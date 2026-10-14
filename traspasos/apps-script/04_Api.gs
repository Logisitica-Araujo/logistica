/***********************************************************************
 * TRASPASOS FADERMEX — 04_Api.gs
 * ---------------------------------------------------------------------
 * Lo que la página le pide al servidor. Cada función regresa
 * {ok:true, datos} o {ok:false, error}.
 ***********************************************************************/

/** Abre la página (la URL /exec de la implementación). */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(TR.NOMBRE_APP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** El código de las reglas, para que la página valide igual que el servidor. */
function fuenteReglas() {
  return TR_REGLAS.toString();
}


/* ======================= ENTRADA ======================= */

/** Quién eres y en qué áreas puedes trabajar. */
function apiInicio() {
  return _api(function () {
    const yo = _email();
    if (!yo) throw new Error('No pude identificar tu cuenta de Google. Entra con tu correo @fadermex.com.');
    const A = _areas();
    const admin = _esAdmin(yo);
    // Se muestran TODAS las áreas, pero solo se pueden elegir las que tienen tu correo en CAT_Areas.
    const areas = Object.keys(A)
      .filter(function (id) { return A[id].activa; })
      .map(function (id) {
        return { id: id, nombre: R.nom(A, id), suc: A[id].sucNombre || 'Oficinas', tipo: A[id].tipo,
                 mia: A[id].correos.indexOf(yo) >= 0, pin: !!A[id].pin };
      });
    if (!areas.some(function (a) { return a.mia; }) && !admin) {
      throw new Error('Tu correo ' + yo + ' no tiene un área asignada. Pide a un administrador que lo agregue en la hoja CAT_Areas.');
    }
    return { email: yo, admin: admin, adminPin: !!String(_ajuste('pin_administrador', '') || '').trim(), areas: areas, logo: _logo() };
  });
}

/** Elegir el área de esta computadora (o "Administración"). */
function apiEntrar(area, dispositivo, pin) {
  return _api(function () {
    const yo = _email();
    if (!yo) throw new Error('No pude identificar tu cuenta de Google.');
    const admin = _esAdmin(yo);
    const A = _areas();
    area = String(area || '').toUpperCase();
    if (area === TR.AREA_ADMIN) {
      if (!admin) throw new Error('Solo los administradores pueden entrar a Administración.');
      _validarPin(yo + '_ADMIN', String(_ajuste('pin_administrador', '') || ''), pin);
    } else {
      if (!A[area] || !A[area].activa) throw new Error('Esa área no existe o está desactivada.');
      if (A[area].correos.indexOf(yo) < 0) throw new Error('Tu correo no tiene permiso para esa área.');
      _validarPin(yo + '_' + area, A[area].pin, pin);
    }
    const modoAdmin = admin && area === TR.AREA_ADMIN;
    const tk = _crearToken(yo, area, modoAdmin);
    _tb(TR.H.SESIONES).agregar({
      'Fecha': _hoy(), 'Hora': _hora(), 'Cuenta': yo, 'Equipo': area,
      'Evento': 'ENTRADA', 'Dispositivo': String(dispositivo || '').substring(0, 150)
    });
    return {
      token: tk.token,
      ctx: { email: yo, area: area, admin: modoAdmin, puedeAdmin: admin, exp: tk.exp,
             areaNombre: area === TR.AREA_ADMIN ? 'Administración' : R.nom(A, area) },
      cat: _catalogos()
    };
  });
}

/** Al volver a abrir la página con una sesión guardada. */
function apiReanudar(token) {
  return _api(function () {
    const c = _ctx(token);
    const A = _areas();
    c.areaNombre = c.area === TR.AREA_ADMIN ? 'Administración' : R.nom(A, c.area);
    return { ctx: c, cat: _catalogos() };
  });
}

function apiSalir(token) {
  return _api(function () {
    try {
      const c = _ctx(token);
      _tb(TR.H.SESIONES).agregar({ 'Fecha': _hoy(), 'Hora': _hora(), 'Cuenta': c.email, 'Equipo': c.area, 'Evento': 'SALIDA', 'Dispositivo': '' });
    } catch (e) { }
    return true;
  });
}


/* ======================= DATOS DE LA PANTALLA ======================= */

/**
 * Todo lo que la pantalla necesita, en un solo viaje:
 *  traspasos  → los de esta área (o todos, si es Administración)
 *  activos    → todos los que siguen en movimiento (para validar escaneos al instante)
 *  avisos, solicitudes (admin)
 */
function apiDatos(token) {
  return _api(function () {
    const c = _ctx(token);
    const A = _areas();
    const todos = _traspasos().filter(function (t) { return t.estatus !== 'ELIMINADO'; });
    const hace = new Date(Date.now() - 45 * 86400000);
    const corte = Utilities.formatDate(hace, TR.ZONA, 'yyyy-MM-dd');
    const reciente = function (t) { return t.estatus !== 'ENTREGADO' || String(t.act || t.fecha) >= corte; };

    // El código de la credencial nunca sale a la pantalla.
    const limpiar = function (t) { const o = {}; Object.keys(t).forEach(function (k) { if (k !== '_fila' && k !== 'cred') o[k] = t[k]; }); o.por = String(o.por || '').split(' · ')[0]; return o; };
    const activos = todos.filter(reciente).map(limpiar);

    let mios;
    if (c.area === TR.AREA_ADMIN) {
      mios = activos;
    } else {
      mios = activos.filter(function (t) {
        return t.origen === c.area || t.ubic === c.area || R.esEntrante(t, c.area, A);
      });
    }

    // Avisos: los de esta área, y en sucursales también los de su "hermana" (PV ↔ Rebotica)
    const para = {};
    para[c.area] = true;
    if (c.area !== TR.AREA_ADMIN && A[c.area] && (A[c.area].tipo === 'SUCURSAL' || A[c.area].tipo === 'FORANEA')) {
      Object.keys(A).forEach(function (id) { if (A[id].suc === A[c.area].suc) para[id] = true; });
    }
    if (c.admin) para[TR.AREA_ADMIN] = true;
    const avisos = _tb(TR.H.AVISOS).filas()
      .filter(function (f) { return para[String(f['Para (área)']).trim().toUpperCase()]; })
      .slice(-40).reverse()
      .map(function (f) {
        return { fecha: _txt(f['Fecha']), hora: _txt(f['Hora']), folio: String(f['Folio']),
                 msg: String(f['Mensaje']), visto: _si(f['Visto']), para: String(f['Para (área)']) };
      });

    let solicitudes = [];
    if (c.admin) {
      solicitudes = _tb(TR.H.SOLICITUDES).filas()
        .filter(function (f) { return _norm(f['Estado']) === 'pendiente'; })
        .map(function (f) {
          return { id: String(f['ID']), fecha: _txt(f['Fecha']), folio: String(f['Folio']),
                   solicito: String(f['Solicitó']), area: String(f['Área']), motivo: String(f['Motivo']) };
        });
    }

    return { traspasos: mios, activos: activos, avisos: avisos, solicitudes: solicitudes, cajas: _cajasVisibles(), ahora: _ahoraTxt() };
  });
}

/** Historia completa de un traspaso (línea de tiempo). */
function apiDetalle(token, folio) {
  return _api(function () {
    const c = _ctx(token);
    const t = _buscarT(folio);
    if (!t || (t.estatus === 'ELIMINADO' && !c.admin)) throw new Error('No encontré el folio ' + folio + '.');
    const f = R.limpio(t.folio);
    const mov = _tb(TR.H.MOV).filas()
      .filter(function (m) { return R.limpio(m['Folio']) === f; })
      .map(function (m) {
        return { fecha: _txt(m['Fecha']), hora: _txt(m['Hora']), accion: String(m['Acción']),
                 nuevo: String(m['Estatus nuevo'] || ''), donde: String(m['Dónde ocurrió (área)'] || ''),
                 persona: String(m['Persona'] || ''), medio: String(m['Medio'] || ''), detalle: String(m['Detalle'] || '') };
      });
    delete t._fila; delete t.cred;
    t.por = String(t.por || '').split(' · ')[0];
    return { traspaso: t, movimientos: mov };
  });
}


/* ======================= CREDENCIALES ======================= */

/** d = 'credencial'  ó  {codigo}  ó  {usuario, nip} */
function apiPersona(token, d) {
  return _api(function () {
    _ctx(token);
    const p = _personaPorCodigo(d);
    if (!p) throw new Error(_noReconocido(d));
    return _publico(p);
  });
}

function apiGestor(token, d) {
  return _api(function () {
    _ctx(token);
    const g = _gestorPorCodigo(d);
    if (!g) throw new Error(_noReconocido(d));
    return _publico(g);
  });
}

/** Cualquiera: persona o gestor (Recepción Oficinas). */
function apiIdentificar(token, d) {
  return _api(function () {
    _ctx(token);
    const q = _identificar(d, '');
    if (!q) throw new Error(_noReconocido(d));
    return _publico(q);
  });
}


/* ======================= CREAR TRASPASO ======================= */

/** ¿Esta área trabaja con la cuenta abierta, sin credencial? (Oficinas) */
function _sinCredencial(area) {
  const a = _areas()[area];
  return !!a && a.tipo === 'OFICINAS';
}

/** En Oficinas quien hace la acción es la cuenta abierta. Si en CAT_Personas hay columna "Correo", se usa su nombre. */
function _personaDeCuenta(c) {
  let nombre = '';
  try {
    const f = _tb(TR.H.PERSONAS).filas().filter(function (p) { return String(p['Correo'] || '').trim().toLowerCase() === c.email && _activo(p['Activo']); })[0];
    if (f) nombre = String(f['Nombre completo'] || '');
  } catch (e) { }
  return { tipo: 'PERSONA', nombre: nombre || c.email, codigo: '', via: 'cuenta ' + c.email, area: c.area };
}

/**
 * d = { codigo }  ó  { usuario, nip }  (en Oficinas no hace falta: se usa la cuenta abierta)
 *     + destino, desc, bultos
 */
function apiCrear(token, d) {
  return _api(function () {
    const c = _ctx(token);
    const me = c.area;
    if (me === TR.AREA_ADMIN) throw new Error('Para crear un traspaso entra como un área, no como Administración.');
    const A = _areas();
    if (!A[me]) throw new Error('Tu área ya no existe en CAT_Areas.');
    d = d || {};
    const dest = String(d.destino || '').toUpperCase();
    if (!A[dest] || !A[dest].activa) throw new Error('Elige un destino válido.');
    if (dest === me) throw new Error('El destino no puede ser tu misma área.');
    if (R.esPausa(dest)) throw new Error('Recepción Oficinas es solo un punto de paso, no un destino. Elige el área que lo va a recibir.');
    const desc = String(d.desc || '').trim();
    if (!desc) throw new Error('Describe qué envías.');
    const bultos = Math.max(1, Math.min(99, parseInt(d.bultos, 10) || 1));

    let persona;
    if (_sinCredencial(me)) {
      persona = _personaDeCuenta(c);
    } else {
      const quien = d.codigo ? { codigo: d.codigo } : { usuario: d.usuario, nip: d.nip };
      if (!quien.codigo && !String(quien.usuario || '').trim()) throw new Error('Escanea tu credencial, o teclea tu usuario y NIP.');
      persona = _personaPorCodigo(quien);
      if (!persona) throw new Error(_noReconocido(quien));
    }
    const sinCred = !persona.codigo;
    const cred = persona.via;

    return _conCandado(function () {
      const folio = _siguienteFolio(me);
      const via = (A[me].tipo === 'FORANEA' || A[dest].tipo === 'FORANEA') ? 'VIA_LOGISTICA' : 'DIRECTA';
      const por = persona.nombre;   // el código de la credencial va aparte (columna Credencial), nunca a la vista
      const fila = {
        'Folio': folio, 'Fecha creación': _hoy(), 'Hora': _hora(),
        'Origen (prefijo)': me, 'Origen': R.nom(A, me), 'Destino (prefijo)': dest, 'Destino': R.nom(A, dest),
        'Descripción': desc, 'Bultos': bultos, 'Creado por': por, 'Credencial': cred, 'Sin credencial': sinCred ? 'SI' : 'NO',
        'Estatus': 'NUEVO', 'Ruta': via, 'Reimpresiones': 0, 'Eliminación solicitada': 'NO',
        'Última actualización': _ahoraTxt()
      };
      _tb(TR.H.TRASPASOS).agregar(fila);
      const t = { folio: folio, bultos: bultos };
      const lista = [];
      for (let i = 1; i <= bultos; i++) lista.push(i);
      _tb(TR.H.MOV).agregarVarias([
        _movObj(t, 'CREADO', '', 'NUEVO', { donde: me, persona: persona.nombre, cred: cred,
          medio: persona.codigo ? 'CREDENCIAL' : (_sinCredencial(me) ? 'CUENTA DE OFICINAS' : 'USUARIO Y NIP'), equipo: me,
          detalle: via === 'VIA_LOGISTICA' ? 'Ruta con paquetería vía Logística' : '' }),
        _movObj(t, 'ETIQUETAS IMPRESAS', '', '', { donde: me, persona: persona.nombre, detalle: bultos + ' etiqueta(s)' })
      ]);
      _tb(TR.H.ETIQUETAS).agregarVarias(_etiquetasObj(t, lista, 'ORIGINAL', persona.nombre, ''));
      _aviso(dest, folio, 'Nuevo traspaso para ti desde ' + R.nom(A, me));
      const nuevo = _tObj(_buscarFila(folio));
      delete nuevo.cred; delete nuevo._fila;
      return nuevo;
    });
  });
}

function _buscarFila(folio) {
  const f = R.limpio(folio);
  const filas = _tb(TR.H.TRASPASOS).filas();
  for (let i = filas.length - 1; i >= 0; i--) if (R.limpio(filas[i]['Folio']) === f) return filas[i];
  throw new Error('No encontré el folio ' + folio + '.');
}


/* ======================= ESCÁNER: CONFIRMAR LOTE ======================= */

/**
 * d = { modo: 'RECIBIR'|'ENTREGAR', gestorCodigo, items:[{folio, faltan}], escaneos:[{texto,resultado,mensaje}] }
 * El servidor vuelve a validar cada folio (la página ya lo hizo, pero aquí manda la verdad).
 */
function apiConfirmarLote(token, d) {
  return _api(function () {
    const c = _ctx(token);
    const me = c.area;
    if (me === TR.AREA_ADMIN) throw new Error('Para escanear entra como un área.');
    d = d || {};
    const modo = String(d.modo || '').toUpperCase();
    if (modo !== 'RECIBIR' && modo !== 'ENTREGAR') throw new Error('Modo no válido.');
    const A = _areas();
    const E = _mapaEstatus();
    let gestor = null, receptor = null;
    if (modo === 'ENTREGAR') {
      // Se lo puede llevar cualquier persona registrada (CAT_Gestores o CAT_Personas).
      gestor = _gestorPorCodigo(d.gestor || d.gestorCodigo);
      if (!gestor) throw new Error('Primero identifica a quien se lo lleva (credencial, o usuario y NIP).');
    } else if (_sinCredencial(me)) {
      receptor = _personaDeCuenta(c);
    } else {
      // Sucursales: es obligatorio registrar quién recibe.
      receptor = _personaPorCodigo(d.receptor);
      if (!receptor) throw new Error(d.receptor ? _noReconocido(d.receptor) : 'Escanea la credencial de quien recibe.');
    }

    const res = _conCandado(function () {
      const mapa = {};
      _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
      const movs = [], avisos = [], resultados = [], vistos = {};

      // Si escanearon la etiqueta de una CAJA, se reciben todos los traspasos que trae.
      const cajas = _mapaCajas();
      const items = [], cajasTocadas = {};
      (d.items || []).forEach(function (it) {
        const k = R.folioDe(it.folio);
        if (cajas[k]) { cajasTocadas[k] = true; cajas[k].traspasos.forEach(function (f) { items.push({ folio: f, faltan: false }); }); }
        else { items.push(it); if (it.caja && cajas[R.folioDe(it.caja)]) cajasTocadas[R.folioDe(it.caja)] = true; }
      });

      items.slice(0, 300).forEach(function (it) {
        const k = R.folioDe(it.folio);
        if (vistos[k]) return;
        vistos[k] = true;
        const t = mapa[k];
        const v = modo === 'RECIBIR' ? R.recibir(t, me, A, E) : R.salir(t, me, A, E, 'ENTREGAR');
        if (v.k !== 'ok') { resultados.push({ folio: it.folio, ok: false, msg: v.m }); return; }
        const antes = t.estatus;

        if (modo === 'ENTREGAR') {
          _actualizarT(t, { 'Estatus': 'RECOLECTADO', 'Gestor': gestor.nombre, 'Fecha recolección': _ahoraTxt(), 'Ubicación actual': '' });
          movs.push(_movObj(t, 'RECOLECTADO POR GESTORÍA', antes, 'RECOLECTADO',
            { donde: me, persona: gestor.nombre, cred: gestor.via, medio: gestor.codigo ? 'CREDENCIAL DEL GESTOR' : 'USUARIO Y NIP DEL GESTOR', equipo: me }));
          avisos.push(_avisoObj(t.destino, t.folio, 'Va en camino para ti · lo lleva ' + gestor.nombre));
          resultados.push({ folio: t.folio, ok: true, msg: 'Entregado a ' + gestor.nombre });
          return;
        }

        const nota = v.salto ? 'Llegó sin registro de recolección (se saltó ese paso). ' : '';
        if (v.accion === 'EN_LOGISTICA') {
          _actualizarT(t, { 'Estatus': 'EN_LOGISTICA', 'Ruta': 'VIA_LOGISTICA_OK', 'Ubicación actual': '' });
          movs.push(_movObj(t, 'RECIBIDO EN LOGÍSTICA', antes, 'EN_LOGISTICA',
            { donde: me, medio: 'ESCÁNER', equipo: me, persona: receptor.nombre, cred: receptor.via,
              detalle: nota + (R.esMor(A, t.destino) ? 'Por enviar a Morelia por paquetería' : 'Por distribuir') }));
          avisos.push(_avisoObj(t.destino, t.folio, 'Llegó a Logística (Oficinas) · ' +
            (R.esMor(A, t.destino) ? 'se enviará por paquetería' : 'en camino a ti')));
          resultados.push({ folio: t.folio, ok: true, msg: 'Recibido en Logística' });
          return;
        }

        const nuevo = it.faltan ? 'INCIDENCIA' : 'ENTREGADO';
        _actualizarT(t, {
          'Estatus': nuevo, 'Fecha entrega': _ahoraTxt(), 'Recibido por': receptor.nombre + ' (' + R.nom(A, me) + ')',
          'Bultos recibidos': it.faltan ? 'INCOMPLETO' : (t.bultos + ' de ' + t.bultos), 'Ubicación actual': ''
        });
        movs.push(_movObj(t, it.faltan ? 'RECIBIDO CON INCIDENCIA' : 'ENTREGADO', antes, nuevo,
          { donde: me, medio: 'ESCÁNER', equipo: me, persona: receptor.nombre, cred: receptor.via,
            detalle: nota + (it.faltan ? 'Faltan bultos o llegó dañado' : (t.bultos + ' bulto(s)')) }));
        avisos.push(_avisoObj(t.origen, t.folio, (it.faltan ? 'Recibido CON INCIDENCIA en ' : 'Entregado en ') + R.nom(A, me) + ' · recibió ' + receptor.nombre));
        resultados.push({ folio: t.folio, ok: true, msg: it.faltan ? 'Recibido con incidencia' : 'Entregado' });
      });

      _tb(TR.H.MOV).agregarVarias(movs);
      _tb(TR.H.AVISOS).agregarVarias(avisos);
      if (modo === 'RECIBIR') _cerrarCajasRecibidas(Object.keys(cajasTocadas));
      return resultados;
    });

    // Bitácora de escaneos (incluye los errores, para detectar fallas humanas)
    const esc = (d.escaneos || []).slice(0, 300).map(function (e) {
      return { 'Fecha': _hoy(), 'Hora': String(e.hora || _hora()), 'Área': R.nom(A, me), 'Equipo': me,
               'Modo': modo === 'RECIBIR' ? 'RECIBIR' : 'ENTREGAR_A_GESTOR', 'Texto escaneado': String(e.texto || ''),
               'Resultado': String(e.resultado || ''), 'Mensaje mostrado': String(e.mensaje || '') };
    });
    try { _tb(TR.H.ESCANEOS).agregarVarias(esc); } catch (e) { }

    return { resultados: res, receptor: receptor ? receptor.nombre : '' };
  });
}

/** "Está aquí": lo escanearon en un lugar que no es su destino. */
function apiUbicar(token, folio) {
  return _api(function () {
    const c = _ctx(token);
    const me = c.area;
    const A = _areas();
    return _conCandado(function () {
      const t = _buscarT(folio);
      if (!t || t.estatus === 'ELIMINADO') throw new Error('No encontré el folio ' + folio + '.');
      if (t.estatus === 'ENTREGADO') throw new Error(t.folio + ' ya fue entregado.');
      const antes = t.estatus;
      _actualizarT(t, { 'Estatus': 'UBICADO', 'Ubicación actual': me });
      _mov(t, 'EL TRASPASO ESTÁ EN: ' + R.nom(A, me), antes, 'UBICADO',
        { donde: me, medio: 'ESCÁNER', equipo: me, detalle: 'Se escaneó aquí y no es su destino' });
      _tb(TR.H.AVISOS).agregarVarias([
        _avisoObj(t.destino, t.folio, 'Atención: tu traspaso está en ' + R.nom(A, me) + ', no en su destino'),
        _avisoObj(t.origen, t.folio, 'Atención: tu traspaso quedó en ' + R.nom(A, me)),
        _avisoObj(TR.AREA_ADMIN, t.folio, 'Traspaso fuera de lugar: está en ' + R.nom(A, me))
      ]);
      return true;
    });
  });
}


/* ======================= REIMPRESIÓN, ELIMINACIÓN, PAQUETERÍA ======================= */

/** d = {folio, bulto (0 = todas), motivo, codigo} */
function apiReimprimir(token, d) {
  return _api(function () {
    const c = _ctx(token);
    d = d || {};
    const t = _buscarT(d.folio);
    if (!t || t.estatus === 'ELIMINADO') throw new Error('No encontré el folio.');
    if (!c.admin && t.origen !== c.area) throw new Error('Solo el área que creó el traspaso puede reimprimir.');
    // Reimprimir NUNCA pide credencial: queda registrado con la cuenta y el área de esta computadora.
    const quien = c.email + (c.area === TR.AREA_ADMIN ? ' (administrador)' : ' · ' + _nom(c.area));
    const b = parseInt(d.bulto, 10) || 0;
    const lista = [];
    if (b) lista.push(Math.min(b, t.bultos)); else for (let i = 1; i <= t.bultos; i++) lista.push(i);
    const n = t.reimp + 1;
    _actualizarT(t, { 'Reimpresiones': n });
    _tb(TR.H.ETIQUETAS).agregarVarias(_etiquetasObj(t, lista, 'R' + n, quien, d.motivo));
    _mov(t, b ? ('REIMPRESIÓN BULTO ' + b + ' DE ' + t.bultos) : 'REIMPRESIÓN DE TODAS LAS ETIQUETAS', '', '',
      { donde: c.area === TR.AREA_ADMIN ? '' : c.area, persona: quien, cred: '', medio: 'CUENTA',
        detalle: 'Motivo: ' + (d.motivo || '—') });
    const tt = _tObj(_buscarFila(t.folio));
    delete tt.cred; delete tt._fila;
    tt.por = String(tt.por || '').split(' · ')[0];
    return { traspaso: tt, bultos: lista, rp: n };
  });
}

function apiSolicitarEliminacion(token, folio, motivo) {
  return _api(function () {
    const c = _ctx(token);
    motivo = String(motivo || '').trim();
    if (!motivo) throw new Error('Escribe por qué se debe eliminar.');
    const t = _buscarT(folio);
    if (!t) throw new Error('No encontré el folio.');
    if (!R.eliminable(t, c.area)) throw new Error('Solo se puede solicitar desde el área que lo creó y antes de que se recolecte.');
    _actualizarT(t, { 'Eliminación solicitada': 'SI' });
    _tb(TR.H.SOLICITUDES).agregar({
      'ID': _id('S'), 'Fecha': _ahoraTxt(), 'Folio': t.folio, 'Solicitó': c.email, 'Área': _nom(c.area),
      'Motivo': motivo, 'Estado': 'PENDIENTE'
    });
    _mov(t, 'SOLICITUD DE ELIMINACIÓN', t.estatus, t.estatus, { donde: c.area, persona: c.email, detalle: motivo });
    _aviso(TR.AREA_ADMIN, t.folio, 'Solicitud de eliminación desde ' + _nom(c.area) + ': ' + motivo);
    return true;
  });
}

function apiPaqueteria(token, folio, paqueteria, guia) {
  return _api(function () {
    const c = _ctx(token);
    const A = _areas();
    guia = String(guia || '').trim();
    if (!guia) throw new Error('Captura el número de guía.');
    const t = _buscarT(folio);
    if (!t) throw new Error('No encontré el folio.');
    if (!R.paqueteria(t, c.area, A)) throw new Error(t.folio + ' no está listo para enviarse por paquetería desde aquí.');
    const antes = t.estatus;
    _actualizarT(t, { 'Estatus': 'PAQUETERIA', 'Paquetería': String(paqueteria || ''), 'Guía': guia });
    _mov(t, 'ENVIADO POR PAQUETERÍA', antes, 'PAQUETERIA', { donde: c.area, persona: c.email, detalle: paqueteria + ' · guía ' + guia });
    const para = R.esMor(A, c.area) ? 'LOG' : t.destino;
    _aviso(para, t.folio, 'Va en camino por paquetería · ' + paqueteria + ' · guía ' + guia);
    return true;
  });
}

function apiAvisosVistos(token) {
  return _api(function () {
    const c = _ctx(token);
    const A = _areas();
    const para = {};
    para[c.area] = true;
    if (A[c.area] && (A[c.area].tipo === 'SUCURSAL' || A[c.area].tipo === 'FORANEA')) {
      Object.keys(A).forEach(function (id) { if (A[id].suc === A[c.area].suc) para[id] = true; });
    }
    if (c.admin) para[TR.AREA_ADMIN] = true;
    const ta = _tb(TR.H.AVISOS);
    const col = ta.col('Visto') + 1;
    ta.filas().forEach(function (f) {
      if (para[String(f['Para (área)']).trim().toUpperCase()] && !_si(f['Visto'])) ta.sh.getRange(f._fila, col).setValue('SI');
    });
    return true;
  });
}


/* ======================= ADMINISTRADORES ======================= */

/** cambios = {estatus, destino, ubic}; motivo opcional */
function apiAdminEditar(token, folio, cambios, motivo) {
  return _api(function () {
    const c = _ctx(token);
    _exigirAdmin(c);
    const A = _areas();
    const E = _mapaEstatus();
    cambios = cambios || {};
    const t = _buscarT(folio);
    if (!t) throw new Error('No encontré el folio.');
    const set = {}, antes = [], despues = [];
    const est = String(cambios.estatus || '').toUpperCase();
    if (est && est !== t.estatus) {
      if (!E[est]) throw new Error('Estatus no válido: ' + est);
      set['Estatus'] = est; antes.push(E[t.estatus] || t.estatus); despues.push(E[est]);
    }
    const dest = String(cambios.destino || '').toUpperCase();
    if (dest && dest !== t.destino) {
      if (!A[dest]) throw new Error('Destino no válido.');
      set['Destino (prefijo)'] = dest; set['Destino'] = R.nom(A, dest);
      antes.push('destino ' + R.nom(A, t.destino)); despues.push('destino ' + R.nom(A, dest));
    }
    if ((est || t.estatus) === 'UBICADO') {
      const ub = String(cambios.ubic || '').toUpperCase();
      if (ub && ub !== t.ubic && A[ub]) { set['Ubicación actual'] = ub; despues.push('está en ' + R.nom(A, ub)); }
    } else if (t.ubic && est && est !== 'UBICADO') {
      set['Ubicación actual'] = '';
    }
    if (est && t.solicitud && est !== t.estatus) { /* la solicitud sigue viva hasta resolverla */ }
    if (!Object.keys(set).length) throw new Error('No hay cambios.');
    _actualizarT(t, set);
    _mov(t, 'EDITADO POR ADMINISTRADOR', t.estatus, set['Estatus'] || t.estatus,
      { persona: c.email, medio: 'ADMINISTRADOR', detalle: despues.join(' · ') + (motivo ? ' · motivo: ' + motivo : '') });
    _adminLog(c.email, 'EDITAR', t.folio, antes.join(' · '), despues.join(' · '), motivo);
    return true;
  });
}

function apiAdminEliminar(token, folio, motivo) {
  return _api(function () {
    const c = _ctx(token);
    _exigirAdmin(c);
    const t = _buscarT(folio);
    if (!t) throw new Error('No encontré el folio.');
    _actualizarT(t, { 'Estatus': 'ELIMINADO', 'Eliminación solicitada': 'NO' });
    _mov(t, 'ELIMINADO POR ADMINISTRADOR', t.estatus, 'ELIMINADO', { persona: c.email, medio: 'ADMINISTRADOR', detalle: motivo || '' });
    _adminLog(c.email, 'ELIMINAR', t.folio, t.estatus, 'ELIMINADO', motivo);
    _aviso(t.origen, t.folio, 'Un administrador eliminó este traspaso');
    return true;
  });
}

function apiAdminResolver(token, idSolicitud, aprobar, comentario) {
  return _api(function () {
    const c = _ctx(token);
    _exigirAdmin(c);
    const ts = _tb(TR.H.SOLICITUDES);
    const s = ts.filas().filter(function (f) { return String(f['ID']) === String(idSolicitud); })[0];
    if (!s) throw new Error('No encontré la solicitud.');
    if (_norm(s['Estado']) !== 'pendiente') throw new Error('Esa solicitud ya fue resuelta.');
    ts.actualizar(s._fila, { 'Estado': aprobar ? 'APROBADA' : 'RECHAZADA', 'Administrador': c.email,
                             'Fecha respuesta': _ahoraTxt(), 'Comentario': String(comentario || '') });
    const t = _buscarT(s['Folio']);
    if (t) {
      if (aprobar) {
        _actualizarT(t, { 'Estatus': 'ELIMINADO', 'Eliminación solicitada': 'NO' });
        _mov(t, 'ELIMINADO (SOLICITUD APROBADA)', t.estatus, 'ELIMINADO', { persona: c.email, medio: 'ADMINISTRADOR', detalle: comentario || '' });
        _aviso(t.origen, t.folio, 'Se aprobó tu solicitud: el traspaso fue eliminado');
      } else {
        _actualizarT(t, { 'Eliminación solicitada': 'NO' });
        _mov(t, 'SOLICITUD RECHAZADA', t.estatus, t.estatus, { persona: c.email, medio: 'ADMINISTRADOR', detalle: comentario || '' });
        _aviso(t.origen, t.folio, 'Se rechazó tu solicitud de eliminación' + (comentario ? ': ' + comentario : ''));
      }
    }
    _adminLog(c.email, aprobar ? 'APROBAR SOLICITUD' : 'RECHAZAR SOLICITUD', String(s['Folio']), '', '', comentario);
    return true;
  });
}
