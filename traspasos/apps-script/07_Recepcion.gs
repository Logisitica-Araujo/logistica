/***********************************************************************
 * TRASPASOS FADERMEX — 07_Recepcion.gs
 * ---------------------------------------------------------------------
 * RECEPCIÓN OFICINAS (la computadora del patio, área REC)
 *
 *  Recepción es un CENTRO DE PAUSA: aquí los traspasos esperan, nunca es destino final.
 *
 *  DEJAR   → un gestor (o cualquier persona registrada) deja traspasos en el stand.
 *            Estatus: "En Recepción Oficinas". Al destino le llega aviso.
 *  RECOGER → • un GESTOR se los lleva a su destino (sucursal, etc.)
 *              → "Recolectado por gestoría"
 *            • una PERSONA de Oficinas recoge lo de su área
 *              → "Entregado" (recibido por esa persona)
 *
 * Todo se identifica con credencial, o con usuario y NIP.
 ***********************************************************************/

const AREA_REC = 'REC';

/** d = { modo:'DEJAR'|'RECOGER', quien:{codigo}|{usuario,nip}, folios:[...] } */
function apiRecepcion(token, d) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== AREA_REC) throw new Error('Esto solo se hace desde la computadora de Recepción Oficinas.');
    d = d || {};
    const modo = String(d.modo || '').toUpperCase();
    if (modo !== 'DEJAR' && modo !== 'RECOGER') throw new Error('Modo no válido.');
    const quien = _identificar(d.quien, '');
    if (!quien) throw new Error(_noReconocido(d.quien));
    // DEJAR: cualquier persona registrada (gestor o empleado) puede dejar traspasos.
    const A = _areas();
    const E = _mapaEstatus();

    // Si el gestor se lleva solo una parte, tiene que decir por qué se quedan los demás.
    Object.keys(d.lleva || {}).forEach(function (f) {
      if ((Number(d.lleva[f]) < Number((d.max || {})[f] || 0)) && !String((d.motivos || {})[f] || '').trim()) throw new Error(f + ': elige por qué se quedan los demás bultos.');
    });
    return _conCandado(function () {
      const mapa = {};
      _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
      const movs = [], avisos = [], resultados = [], vistos = {};

      (d.folios || []).slice(0, 200).forEach(function (x) {
        const k = R.folioDe(x);
        if (!k || vistos[k]) return;
        vistos[k] = true;
        const t = mapa[k];
        const v = modo === 'DEJAR' ? R.dejable(t, A, E) : R.recogible(t, A, E, quien);
        if (v.k !== 'ok') { resultados.push({ folio: k, ok: false, msg: v.m }); return; }
        const antes = t.estatus;

        if (modo === 'DEJAR') {
          _actualizarT(t, { 'Estatus': 'EN_RECEPCION', 'Ubicación actual': AREA_REC });
          movs.push(_movObj(t, 'DEJADO EN RECEPCIÓN OFICINAS', antes, 'EN_RECEPCION',
            { donde: AREA_REC, persona: quien.nombre, cred: quien.via, medio: 'RECEPCIÓN', equipo: AREA_REC }));
          avisos.push(_avisoObj(t.destino, t.folio, 'Tu traspaso está en pausa en Recepción Oficinas (lo dejó ' + quien.nombre + ')'));
          resultados.push({ folio: t.folio, ok: true, msg: 'En Recepción' });
          return;
        }

        if (quien.tipo === 'GESTOR') {
          const it = { lleva: (d.lleva || {})[t.folio], motivo: (d.motivos || {})[t.folio] };
          const sb = _salidaBultos(t, it, v, AREA_REC);
          const cam = Object.assign({ 'Gestor': quien.nombre, 'Fecha recolección': _ahoraTxt(), 'Ubicación actual': '' }, sb.cambios);
          if (!v.resto) cam['Estatus'] = 'RECOLECTADO';
          _actualizarT(t, cam);
          movs.push(_movObj(t, v.resto ? 'RECOGIDO EN RECEPCIÓN: BULTO(S) QUE FALTABAN' : (sb.quedan ? 'RECOGIDO EN RECEPCIÓN PARCIAL (' + sb.lleva + ' DE ' + t.bultos + ')' : 'RECOGIDO EN RECEPCIÓN POR GESTORÍA'),
            antes, v.resto ? antes : 'RECOLECTADO',
            { donde: AREA_REC, persona: quien.nombre, cred: quien.via, medio: 'RECEPCIÓN', equipo: AREA_REC,
              detalle: [antes === 'EN_RECEPCION' || v.resto ? '' : 'Salida por Recepción (no se había registrado como dejado)', sb.detalle].filter(String).join(' · ') }));
          if (t.origen !== t.destino) avisos.push(_avisoObj(t.origen, t.folio, 'Salió de Oficinas · lo lleva ' + quien.nombre));
          avisos.push(_avisoObj(t.destino, t.folio, 'Va en camino para ti · lo lleva ' + quien.nombre + (sb.quedan ? ' · vienen ' + sb.lleva + ' de ' + t.bultos + ' (se quedó ' + sb.quedan + ' en Recepción Oficinas)' : v.resto ? ' · son los bultos que faltaban' : '')));
          resultados.push({ folio: t.folio, ok: true, msg: 'Se lo lleva ' + quien.nombre + (sb.quedan ? ' (' + sb.lleva + ' de ' + t.bultos + ')' : '') });
        } else if (v.log) {
          // Logística recoge del stand lo que va a Morelia: queda "En Logística", listo para la caja/paquetería.
          _actualizarT(t, { 'Estatus': 'EN_LOGISTICA', 'Ruta': 'VIA_LOGISTICA_OK', 'Ubicación actual': '' });
          movs.push(_movObj(t, 'RECIBIDO EN LOGÍSTICA (RECOGIDO EN RECEPCIÓN)', antes, 'EN_LOGISTICA',
            { donde: 'LOG', persona: quien.nombre, cred: quien.via, medio: 'RECEPCIÓN', equipo: AREA_REC,
              detalle: R.esMor(A, t.destino) ? 'Por enviar a Morelia por paquetería' : 'Por distribuir' }));
          avisos.push(_avisoObj(t.destino, t.folio, 'Llegó a Logística (Oficinas) · ' + (R.esMor(A, t.destino) ? 'se enviará por paquetería' : 'en camino a ti')));
          resultados.push({ folio: t.folio, ok: true, msg: 'Recibido en Logística' });
        } else {
          _actualizarT(t, {
            'Estatus': 'ENTREGADO', 'Fecha entrega': _ahoraTxt(), 'Ubicación actual': '',
            'Recibido por': quien.nombre + ' (recogido en Recepción Oficinas)', 'Bultos recibidos': t.bultos + ' de ' + t.bultos
          });
          movs.push(_movObj(t, 'ENTREGADO (RECOGIDO EN RECEPCIÓN)', antes, 'ENTREGADO',
            { donde: AREA_REC, persona: quien.nombre, cred: quien.via, medio: 'RECEPCIÓN', equipo: AREA_REC }));
          avisos.push(_avisoObj(t.origen, t.folio, 'Entregado: lo recogió ' + quien.nombre + ' en Recepción Oficinas'));
          resultados.push({ folio: t.folio, ok: true, msg: 'Entregado a ' + quien.nombre });
        }
      });

      _tb(TR.H.MOV).agregarVarias(movs);
      _tb(TR.H.AVISOS).agregarVarias(avisos);
      return { resultados: resultados, quien: quien.nombre };
    });
  });
}


/* ======================= CENTRO DE IMPRESIÓN =======================
 * La computadora de Recepción es la única con la etiquetadora conectada por cable.
 * Las áreas de Oficinas crean sus traspasos en su computadora y aquí se imprimen.
 * Solo aparecen los traspasos en "Nuevo traspaso" (pedido creado, sin moverse aún).
 * ================================================================== */

/** Áreas de Oficinas que pueden mandar a imprimir aquí (no incluye Recepción). */
function _areasOficinas(A) {
  return Object.keys(A).filter(function (id) {
    return A[id].activa && A[id].tipo === 'OFICINAS' && id !== AREA_REC;
  });
}

/**
 * ¿Este traspaso se puede imprimir desde Recepción?
 * "Nuevo traspaso" de un área de Oficinas; también los que ya pasaron a "En Recepción Oficinas"
 * al imprimirse aquí (para poder reimprimir).
 */
function _imprimibleEnRec(t, A) {
  if (!t || t.solicitud || !A[t.origen] || A[t.origen].tipo !== 'OFICINAS' || t.origen === AREA_REC) return false;
  return t.estatus === 'NUEVO' || (t.estatus === 'EN_RECEPCION' && t.ubic === AREA_REC);
}

/** Cuántas veces se ha impreso cada folio en Recepción: { 'CONT-0006': 1, ... } */
function _impresosEnRec() {
  const out = {};
  _tb(TR.H.ETIQUETAS).filas().forEach(function (f) {
    if (String(f['Impresión']).trim().toUpperCase() !== 'RECEPCIÓN') return;
    const k = R.limpio(f['Folio']);
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}

/** Para el desplegable: las áreas de Oficinas con cuántos traspasos tienen por imprimir. */
function apiCentroImpresion(token) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== AREA_REC) throw new Error('El Centro de Impresión solo está en la computadora de Recepción Oficinas.');
    const A = _areas();
    const n = {};
    _traspasos().forEach(function (t) { if (_imprimibleEnRec(t, A)) n[t.origen] = (n[t.origen] || 0) + 1; });
    return _areasOficinas(A)
      .map(function (id) { return { id: id, nombre: A[id].corto, pendientes: n[id] || 0 }; })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  });
}

/** Traspasos del área elegida que siguen en "Nuevo traspaso" (los más recientes primero). */
function apiPendientesImpresion(token, area) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== AREA_REC) throw new Error('El Centro de Impresión solo está en la computadora de Recepción Oficinas.');
    const A = _areas();
    area = String(area || '').trim().toUpperCase();
    if (_areasOficinas(A).indexOf(area) < 0) throw new Error('Elige un área de Oficinas.');
    const impresos = _impresosEnRec();
    return _traspasos()
      .filter(function (t) { return t.origen === area && _imprimibleEnRec(t, A); })
      .sort(function (a, b) { return String(b.fecha + ' ' + b.hora).localeCompare(String(a.fecha + ' ' + a.hora)); })
      .map(function (t) {
        return { folio: t.folio, destino: t.destino, destinoNombre: R.nom(A, t.destino), fecha: t.fecha, hora: t.hora,
                 bultos: t.bultos, desc: t.desc, por: String(t.por || '').split(' · ')[0],
                 impresoEnRec: impresos[R.limpio(t.folio)] ? true : false, enRecepcion: t.estatus === 'EN_RECEPCION' };
      });
  });
}

/**
 * Registra la impresión en Recepción y regresa el traspaso para imprimir sus etiquetas.
 * folios = uno o varios. Cada uno debe seguir en "Nuevo traspaso" y ser de Oficinas.
 */
function apiImprimirEnRecepcion(token, folios) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== AREA_REC) throw new Error('Solo se imprime desde la computadora de Recepción Oficinas.');
    const A = _areas();
    const lista = [].concat(folios || []).map(R.folioDe).filter(Boolean);
    if (!lista.length) throw new Error('No hay folios para imprimir.');
    const mapa = {};
    _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
    const listos = [], etiquetas = [], movs = [];
    lista.forEach(function (k) {
      const t = mapa[k];
      if (!_imprimibleEnRec(t, A)) throw new Error(k + ' ya no está en "Nuevo traspaso" o no es de Oficinas. Actualiza la lista.');
      const bultos = [];
      for (let i = 1; i <= t.bultos; i++) bultos.push(i);
      etiquetas.push.apply(etiquetas, _etiquetasObj(t, bultos, 'RECEPCIÓN', c.email, 'Centro de Impresión'));
      // Si se imprime aquí es porque el paquete está aquí: lo que sale con gestor queda "En Recepción Oficinas".
      const aqui = t.estatus === 'NUEVO' && R.porSalirRec(t, A);
      if (aqui) {
        _actualizarT(t, { 'Estatus': 'EN_RECEPCION', 'Ubicación actual': AREA_REC });
        t.estatus = 'EN_RECEPCION'; t.ubic = AREA_REC;
      }
      movs.push(_movObj(t, 'ETIQUETAS IMPRESAS EN RECEPCIÓN', aqui ? 'NUEVO' : '', aqui ? 'EN_RECEPCION' : '',
        { donde: AREA_REC, persona: c.email, equipo: AREA_REC, detalle: t.bultos + ' etiqueta(s)' + (aqui ? ' · queda en Recepción para que se lo lleve un gestor' : '') }));
      const o = {};
      Object.keys(t).forEach(function (x) { if (x !== '_fila' && x !== 'cred') o[x] = t[x]; });
      o.por = String(o.por || '').split(' · ')[0];
      listos.push({ traspaso: o, bultos: bultos });
    });
    _tb(TR.H.ETIQUETAS).agregarVarias(etiquetas);
    _tb(TR.H.MOV).agregarVarias(movs);
    return listos;
  });
}


/* ======================= AVISO: SIN SALIDA =======================
 * Lo de Oficinas que va fuera y lleva más de N horas (CFG_Ajustes → horas_alerta_sin_salida,
 * 36 por defecto) sin que un gestor le dé salida: aviso a Logística, al área que lo creó y a
 * administración. Se avisa una sola vez por traspaso. Lo corre el activador de cada 10 minutos.
 * ================================================================ */
function _horasDesde(t) {
  try {
    const f = String(t.fecha || '').slice(0, 10), hh = String(t.hora || '').slice(-5);
    const txt = /^\d{4}-\d{2}-\d{2}$/.test(f) ? f + ' ' + (/^\d{2}:\d{2}$/.test(hh) ? hh : '00:00') : String(t.act || '');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(txt)) return 0;
    const h = (Date.now() - Utilities.parseDate(txt, TR.ZONA, 'yyyy-MM-dd HH:mm').getTime()) / 3600000;
    return isFinite(h) ? h : 0;
  } catch (e) { return 0; }
}
function alertarSinSalida() {
  const lim = Number(_ajuste('horas_alerta_sin_salida', 36)) || 36;
  const A = _areas();
  const atrasados = _traspasos().filter(function (t) { return R.porSalirRec(t, A) && t.estatus !== 'EN_LOGISTICA' && _horasDesde(t) >= lim; });
  if (!atrasados.length) return 0;
  return _conCandado(function () {
    const ya = {};
    _tb(TR.H.MOV).filas().forEach(function (m) { if (String(m['Acción']).indexOf('ALERTA: SIN SALIDA') === 0) ya[R.limpio(m['Folio'])] = true; });
    const nuevos = atrasados.filter(function (t) { return !ya[R.limpio(t.folio)]; });
    if (!nuevos.length) return 0;
    const movs = [], avisos = [];
    nuevos.forEach(function (t) {
      const h = Math.floor(_horasDesde(t));
      const txt = 'Lleva ' + h + ' h sin salida registrada en Recepción (va para ' + R.nom(A, t.destino) + '). ¿Se lo llevó un gestor sin escanear?';
      movs.push(_movObj(t, 'ALERTA: SIN SALIDA ' + lim + ' H', t.estatus, t.estatus, { donde: AREA_REC, medio: 'AUTOMÁTICO', detalle: txt }));
      avisos.push(_avisoObj('LOG', t.folio, txt), _avisoObj(TR.AREA_ADMIN, t.folio, txt));
      if (t.origen !== 'LOG') avisos.push(_avisoObj(t.origen, t.folio, txt));
    });
    _tb(TR.H.MOV).agregarVarias(movs);
    _tb(TR.H.AVISOS).agregarVarias(avisos);
    return nuevos.length;
  });
}
