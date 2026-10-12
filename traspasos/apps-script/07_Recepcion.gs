/***********************************************************************
 * TRASPASOS FADERMEX — 07_Recepcion.gs
 * ---------------------------------------------------------------------
 * RECEPCIÓN OFICINAS (la computadora del patio, área REC)
 *
 *  DEJAR   → un gestor deja traspasos en el stand de Oficinas.
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
    if (modo === 'DEJAR' && quien.tipo !== 'GESTOR') throw new Error('Para DEJAR traspasos se identifica un gestor.');
    const A = _areas();
    const E = _mapaEstatus();

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
          avisos.push(_avisoObj(t.destino, t.folio, 'Tu traspaso está en Recepción Oficinas (lo dejó ' + quien.nombre + ')'));
          resultados.push({ folio: t.folio, ok: true, msg: 'En Recepción' });
          return;
        }

        if (quien.tipo === 'GESTOR') {
          _actualizarT(t, { 'Estatus': 'RECOLECTADO', 'Gestor': quien.nombre, 'Fecha recolección': _ahoraTxt(), 'Ubicación actual': '' });
          movs.push(_movObj(t, 'RECOGIDO EN RECEPCIÓN POR GESTORÍA', antes, 'RECOLECTADO',
            { donde: AREA_REC, persona: quien.nombre, cred: quien.via, medio: 'RECEPCIÓN', equipo: AREA_REC }));
          avisos.push(_avisoObj(t.destino, t.folio, 'Va en camino para ti · lo lleva ' + quien.nombre));
          resultados.push({ folio: t.folio, ok: true, msg: 'Se lo lleva ' + quien.nombre });
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
