/***********************************************************************
 * CUSTODIA by AARX — 06_Cajas.gs
 * ---------------------------------------------------------------------
 * MÓDULO ENVÍO EXTERNO: CAJAS CONSOLIDADAS Y GUÍAS DE PAQUETERÍA
 *
 *  1. El centro de envíos (R.HUB) arma una caja con varios traslados → folio CJ-0001
 *     y su etiqueta. Las etiquetas de cada traslado se quedan en sus piezas.
 *  2. Cuando la paquetería da la guía, se captura en la pantalla Paquetería
 *     (apiCapturarGuia) para la caja o para un traslado suelto: pasan a
 *     "Enviado por paquetería".
 *  3. La ubicación foránea escanea la etiqueta de la caja y recibe todo junto.
 *  Un cliente puede leer las guías de otro sistema con el enchufe clienteGuias()
 *  (ver ejemplos/Cliente_Ejemplo_Operaciones.gs.txt).
 ***********************************************************************/

/** Lee RES_Cajas. Regresa [] si la hoja aún no existe. */
function _cajas() {
  if (!_libro().getSheetByName(TR.H.CAJAS)) return [];
  return _tb(TR.H.CAJAS).filas().map(function (f) {
    return {
      folio: String(f['Folio caja']).trim(),
      fecha: _txt(f['Fecha']), hora: _txt(f['Hora']),
      destino: String(f['Destino']).trim(),
      traspasos: String(f['Traspasos'] || '').split(/[\s,;]+/).map(R.limpio).filter(Boolean),
      bultos: Number(f['Bultos']) || 0,
      creo: String(f['Creó'] || ''),
      paqueteria: String(f['Paquetería'] || ''), guia: String(f['Guía'] || ''), eta: _txt(f['ETA']),
      estatus: String(f['Estatus'] || '').trim().toUpperCase(),
      _fila: f._fila
    };
  }).filter(function (c) { return c.folio; });
}
function _mapaCajas() {
  const m = {};
  _cajas().forEach(function (c) { m[R.limpio(c.folio)] = c; });
  return m;
}
/** Para la pantalla: cajas que no se han recibido, o de los últimos 30 días. */
function _cajasVisibles() {
  const corte = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), TR.ZONA, 'yyyy-MM-dd');
  return _cajas().filter(function (c) { return c.estatus !== 'RECIBIDA' || c.fecha >= corte; })
    .map(function (c) { const o = {}; Object.keys(c).forEach(function (k) { if (k !== '_fila') o[k] = c[k]; }); return o; });
}

function _siguienteCaja() {
  let n = 0;
  _cajas().forEach(function (c) { const m = R.limpio(c.folio).match(/^CJ-(\d+)$/); if (m) n = Math.max(n, Number(m[1])); });
  const tf = _tb(TR.H.FOLIOS);
  const f = tf.filas().filter(function (x) { return String(x['Prefijo']).trim().toUpperCase() === 'CJ'; })[0];
  if (f) n = Math.max(n, Number(f['Último número']) || 0);
  n++;
  if (f) tf.actualizar(f._fila, { 'Último número': n, 'Actualizado': _ahoraTxt() });
  else tf.agregar({ 'Prefijo': 'CJ', 'Último número': n, 'Actualizado': _ahoraTxt() });
  return 'CJ-' + String(n).padStart(4, '0');
}


/* ======================= ARMAR CAJA ======================= */

/** folios = traslados que van dentro. Solo el centro de envíos (o un administrador). */
function apiArmarCaja(token, folios) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== R.HUB && !c.admin) throw new Error('Solo el centro de envíos puede armar cajas.');
    if (!_libro().getSheetByName(TR.H.CAJAS)) throw new Error('Falta la hoja RES_Cajas. Corre 🔄 Traspasos → Instalar / reparar.');
    const A = _areas();
    return _conCandado(function () {
      const mapa = {};
      _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
      const enCaja = {};
      _cajas().forEach(function (cj) { if (cj.estatus === 'ARMADA') cj.traspasos.forEach(function (f) { enCaja[f] = cj.folio; }); });

      const lista = [], vistos = {};
      (folios || []).forEach(function (x) {
        const k = R.folioDe(x);
        if (!k || vistos[k]) return;
        vistos[k] = true;
        const t = mapa[k];
        if (!R.empacable(t, A)) throw new Error(k + ' no se puede meter en caja: debe estar en el centro de envíos y con destino foráneo.');
        if (enCaja[k]) throw new Error(k + ' ya está en la caja ' + enCaja[k] + '.');
        lista.push(t);
      });
      if (!lista.length) throw new Error('Escanea al menos un traspaso.');

      const suc = A[lista[0].destino].suc;
      if (lista.some(function (t) { return A[t.destino].suc !== suc; })) throw new Error('Todos los traspasos de una caja deben ir a la misma sucursal.');

      const folio = _siguienteCaja();
      const bultos = lista.reduce(function (s, t) { return s + t.bultos; }, 0);
      _tb(TR.H.CAJAS).agregar({
        'Folio caja': folio, 'Fecha': _hoy(), 'Hora': _hora(), 'Destino': A[lista[0].destino].sucNombre,
        'Traspasos': lista.map(function (t) { return t.folio; }).join(', '), 'Bultos': bultos, 'Creó': c.email,
        'Estatus': 'ARMADA', 'Última actualización': _ahoraTxt()
      });
      _tb(TR.H.MOV).agregarVarias(lista.map(function (t) {
        return _movObj(t, 'EMPACADO EN CAJA ' + folio, t.estatus, t.estatus,
          { donde: R.HUB, persona: c.email, detalle: 'Caja con ' + lista.length + ' traslado(s). Captura su guía en Paquetería cuando la tengas.' });
      }));
      return {
        folio: folio, fecha: _hoy(), hora: _hora(), destino: A[lista[0].destino].sucNombre, bultos: bultos, estatus: 'ARMADA',
        traspasos: lista.map(function (t) { return t.folio; }),
        detalle: lista.map(function (t) { return { folio: t.folio, destino: t.destino, bultos: t.bultos }; })
      };
    });
  });
}

/** Deshacer una caja armada por error (antes de que tenga guía). */
function apiDeshacerCaja(token, folioCaja) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== R.HUB && !c.admin) throw new Error('Solo el centro de envíos puede deshacer cajas.');
    const cj = _mapaCajas()[R.folioDe(folioCaja)];
    if (!cj) throw new Error('No encontré la caja.');
    if (cj.estatus !== 'ARMADA') throw new Error('Esa caja ya salió; no se puede deshacer.');
    _tb(TR.H.CAJAS).actualizar(cj._fila, { 'Estatus': 'CANCELADA', 'Última actualización': _ahoraTxt() });
    const mapa = {};
    _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
    _tb(TR.H.MOV).agregarVarias(cj.traspasos.filter(function (f) { return mapa[f]; }).map(function (f) {
      return _movObj(mapa[f], 'SACADO DE LA CAJA ' + cj.folio, mapa[f].estatus, mapa[f].estatus, { donde: R.HUB, persona: c.email, detalle: 'Caja deshecha' });
    }));
    return true;
  });
}

/** Al recibir: si ya llegaron todos los traspasos de una caja, la caja queda RECIBIDA. */
function _cerrarCajasRecibidas(folios) {
  if (!folios || !folios.length) return;
  const cajas = _mapaCajas();
  const est = {};
  _traspasos().forEach(function (t) { est[R.limpio(t.folio)] = t.estatus; });
  folios.forEach(function (k) {
    const cj = cajas[k];
    if (!cj || cj.estatus === 'RECIBIDA') return;
    const listo = cj.traspasos.every(function (f) { return est[f] === 'ENTREGADO' || est[f] === 'INCIDENCIA' || est[f] === 'ELIMINADO'; });
    if (listo) _tb(TR.H.CAJAS).actualizar(cj._fila, { 'Estatus': 'RECIBIDA', 'Última actualización': _ahoraTxt() });
  });
}


/* ======================= GUÍAS DESDE "OPERACIONES" ======================= */

/** Estatus desde los que una guía manda el traslado a "Enviado por paquetería". */
const ANTES_DE_ENVIAR = ['NUEVO', 'RECOLECTADO', 'ENTREGADO_GESTOR', 'EN_LOGISTICA', 'EN_RECEPCION', 'UBICADO', 'EXTRAVIADO'];

/** guias = { FOLIO: {prov, guia, eta, fila} } (folio de caja CJ- o de traslado suelto). medio = de dónde vino. */
function _aplicarGuias(guias, medio, quien) {
    const A = _areas();
    const E = _mapaEstatus();
    const mapa = {};
    _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
    const movs = [], avisos = [], omitidos = [];
    let n = 0;

    const enviar = function (t, g, caja, id) {
      if (!t) { omitidos.push({ folio: id, motivo: 'No existe' + (g.fila ? ' (fila ' + g.fila + ')' : '') + '.' }); return; }
      if (t.estatus === 'PAQUETERIA' || t.estatus === 'ENTREGADO' || t.estatus === 'INCIDENCIA') return;   // ya avanzó: nada que hacer
      // Solo traslados que van o vienen de una ubicación foránea.
      if (!R.esMor(A, t.destino) && !R.esMor(A, t.origen)) { omitidos.push({ folio: t.folio, motivo: 'No va ni viene de una ubicación foránea.' }); return; }
      if (t.solicitud) { omitidos.push({ folio: t.folio, motivo: 'Tiene una solicitud de eliminación pendiente.' }); return; }
      if (ANTES_DE_ENVIAR.indexOf(t.estatus) < 0) { omitidos.push({ folio: t.folio, motivo: 'Está como "' + (E[t.estatus] || t.estatus) + '".' }); return; }
      const antes = t.estatus;
      const cambios = { 'Estatus': 'PAQUETERIA', 'Paquetería': g.prov, 'Guía': g.guia, 'Ubicación actual': '' };
      if (R.viaLog(t)) cambios['Ruta'] = 'VIA_LOGISTICA_OK';
      _actualizarT(t, cambios);
      movs.push(_movObj(t, 'ENVIADO POR PAQUETERÍA', antes, 'PAQUETERIA',
        { donde: R.HUB, medio: medio || 'CAPTURA', persona: quien || '', detalle: (caja ? 'Caja ' + caja + ' · ' : '') + (g.prov || 'Paquetería') + ' · guía ' + g.guia + (g.eta ? ' · llega ' + g.eta : '') }));
      avisos.push(_avisoObj(t.destino, t.folio, 'Va en camino por paquetería · ' + (g.prov || '') + ' · guía ' + g.guia + (caja ? ' · caja ' + caja : '')));
      t.estatus = 'PAQUETERIA';
      n++;
    };

    // 1) Cajas armadas que ya tienen guía
    const enCaja = {};
    _cajas().forEach(function (cj) {
      if (cj.estatus === 'ARMADA' || cj.estatus === 'ENVIADA') cj.traspasos.forEach(function (f) { enCaja[f] = true; });
      if (cj.estatus !== 'ARMADA') return;
      const g = guias[R.limpio(cj.folio)];
      if (!g) return;
      cj.traspasos.forEach(function (f) { enviar(mapa[f], g, cj.folio, f); });
      _tb(TR.H.CAJAS).actualizar(cj._fila, { 'Estatus': 'ENVIADA', 'Paquetería': g.prov, 'Guía': g.guia, 'ETA': g.eta, 'Última actualización': _ahoraTxt() });
    });

    // 2) Traslados sueltos con su propia guía
    Object.keys(guias).forEach(function (id) {
      if (enCaja[id] || /^CJ-/.test(id)) return;
      enviar(mapa[id], guias[id], '', id);
    });

    _tb(TR.H.MOV).agregarVarias(movs);
    _tb(TR.H.AVISOS).agregarVarias(avisos);
    return { n: n, omitidos: omitidos };
}

/** La corre un activador cada 10 minutos (lo crea "Instalar"): alertas por tiempo y, si el cliente lo tiene, guías de otro sistema. */
function revisionPeriodica() {
  try { alertarSinSalida(); } catch (e) { Logger.log('alertarSinSalida: ' + e); }
  if (typeof clienteGuias === 'function') {
    try {
      const guias = clienteGuias();                       // se lee FUERA del candado (otro archivo, tarda)
      if (Object.keys(guias || {}).length) _conCandado(function () { return _aplicarGuias(guias, 'AUTOMÁTICO', ''); }, 5000);
    } catch (e) { Logger.log('clienteGuias: ' + e.message); }
  }
}

/** Captura manual de la guía de una caja (CJ-0001) o de un traslado suelto. */
function apiCapturarGuia(token, folio, paqueteria, guia, eta) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== R.HUB && !c.admin) throw new Error('Solo ' + (R.HUB ? R.nom(_areas(), R.HUB) : 'el centro de envíos') + ' o un administrador.');
    guia = String(guia || '').trim();
    if (!guia) throw new Error('Captura el número de guía.');
    const k = R.limpio(folio);
    const g = {}; g[k] = { prov: String(paqueteria || '').trim(), guia: guia, eta: String(eta || '').trim(), fila: '' };
    const r = _conCandado(function () { return _aplicarGuias(g, 'CAPTURA', c.email); });
    if (!r.n && r.omitidos.length) throw new Error(r.omitidos.map(function (o) { return o.folio + ': ' + o.motivo; }).join(' '));
    return { actualizados: r.n, omitidos: r.omitidos };
  });
}
