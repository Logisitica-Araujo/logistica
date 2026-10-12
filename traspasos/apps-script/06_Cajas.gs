/***********************************************************************
 * TRASPASOS FADERMEX — 06_Cajas.gs
 * ---------------------------------------------------------------------
 * CAJAS PARA MORELIA Y GUÍAS AUTOMÁTICAS DESDE "OPERACIONES"
 *
 *  1. Logística arma una caja con varios traspasos → folio CJ-0001 y su
 *     etiqueta. Las etiquetas de cada traspaso se quedan en sus bultos.
 *  2. En la hoja "Operaciones" se registra el envío como siempre, con
 *     CJ-0001 (o el folio de un traspaso suelto) en "ID Pedido / Tarea".
 *  3. Cada 10 minutos sincronizarOperaciones() busca esas filas; cuando ya
 *     tienen Nº de Guía, los traspasos pasan solos a "Enviado por
 *     paquetería" con proveedor, guía y fecha prometida.
 *  4. Morelia escanea la etiqueta de la caja y recibe todo junto.
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

/** folios = traspasos que van dentro. Solo Logística (o un administrador). */
function apiArmarCaja(token, folios) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== 'LOG' && !c.admin) throw new Error('Solo Logística puede armar cajas.');
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
        if (!R.empacable(t, A)) throw new Error(k + ' no se puede meter en caja: debe estar "En Logística" y con destino Morelia.');
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
          { donde: 'LOG', persona: c.email, detalle: 'Caja con ' + lista.length + ' traspaso(s). Registra ' + folio + ' en Operaciones con su guía.' });
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
    if (c.area !== 'LOG' && !c.admin) throw new Error('Solo Logística puede deshacer cajas.');
    const cj = _mapaCajas()[R.folioDe(folioCaja)];
    if (!cj) throw new Error('No encontré la caja.');
    if (cj.estatus !== 'ARMADA') throw new Error('Esa caja ya salió; no se puede deshacer.');
    _tb(TR.H.CAJAS).actualizar(cj._fila, { 'Estatus': 'CANCELADA', 'Última actualización': _ahoraTxt() });
    const mapa = {};
    _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
    _tb(TR.H.MOV).agregarVarias(cj.traspasos.filter(function (f) { return mapa[f]; }).map(function (f) {
      return _movObj(mapa[f], 'SACADO DE LA CAJA ' + cj.folio, mapa[f].estatus, mapa[f].estatus, { donde: 'LOG', persona: c.email, detalle: 'Caja deshecha' });
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

function _idOperaciones() {
  const v = String(_ajuste('url_archivo_operaciones', '') || '');
  const m = v.match(/\/d\/([-\w]{20,})/) || v.match(/^([-\w]{30,})$/);
  return m ? m[1] : TR.OPS.ID_ARCHIVO;
}

/** Lee de "Operaciones" las filas con guía: { 'CJ-0001': {prov, guia, eta}, 'NR-0003': {...} } */
function _guiasOperaciones() {
  const sh = SpreadsheetApp.openById(_idOperaciones()).getSheetByName(TR.OPS.HOJA);
  if (!sh) throw new Error('No encontré la hoja "' + TR.OPS.HOJA + '" en el archivo de Operaciones.');
  const lc = sh.getLastColumn();
  const enc = sh.getRange(TR.OPS.FILA_ENC, 1, 1, lc).getValues()[0].map(_norm);
  const col = function (prueba) { for (let i = 0; i < enc.length; i++) if (prueba(enc[i])) return i; return -1; };
  const cId = col(function (h) { return h.indexOf('id pedido') === 0 || h === 'id'; });
  const cProv = col(function (h) { return h === 'proveedor'; });                 // la PRIMERA "Proveedor" (DHL, Estafeta, AMPM…)
  const cGuia = col(function (h) { return h.indexOf('guia') >= 0; });
  const cEta = col(function (h) { return h.indexOf('eta') === 0; });
  if (cId < 0 || cGuia < 0) throw new Error('En "Operaciones" no encontré las columnas "ID Pedido / Tarea" y "Nº de Guía".');
  const hasta = Math.max(cId, cProv, cGuia, cEta) + 1;
  const ult = sh.getLastRow();
  const desde = Math.max(TR.OPS.FILA_ENC + 1, ult - TR.OPS.MAX_FILAS + 1);
  if (ult < desde) return {};
  const datos = sh.getRange(desde, 1, ult - desde + 1, hasta).getValues();
  const out = {};
  datos.forEach(function (f) {
    const id = R.folioDe(f[cId]);
    const guia = String(f[cGuia] == null ? '' : f[cGuia]).trim();
    if (!id || !guia || /no aplica/i.test(guia)) return;
    out[id] = { prov: cProv >= 0 ? String(f[cProv] || '').trim() : '', guia: guia, eta: cEta >= 0 ? _txt(f[cEta]) : '' };
  });
  return out;
}

/**
 * La corre un activador cada 10 minutos (lo crea "instalar").
 * También se puede correr a mano desde la página (botón "Revisar Operaciones ahora").
 * Regresa cuántos traspasos actualizó.
 */
function sincronizarOperaciones() {
  return _conCandado(function () {
    const guias = _guiasOperaciones();
    const A = _areas();
    const mapa = {};
    _traspasos().forEach(function (t) { mapa[R.limpio(t.folio)] = t; });
    const movs = [], avisos = [];
    let n = 0;

    const enviar = function (t, g, caja) {
      if (!t || t.estatus !== 'EN_LOGISTICA' || !R.esMor(A, t.destino)) return;
      _actualizarT(t, { 'Estatus': 'PAQUETERIA', 'Paquetería': g.prov, 'Guía': g.guia });
      movs.push(_movObj(t, 'ENVIADO POR PAQUETERÍA', 'EN_LOGISTICA', 'PAQUETERIA',
        { donde: 'LOG', medio: 'OPERACIONES (AUTOMÁTICO)', detalle: (caja ? 'Caja ' + caja + ' · ' : '') + g.prov + ' · guía ' + g.guia + (g.eta ? ' · llega ' + g.eta : '') }));
      avisos.push(_avisoObj(t.destino, t.folio, 'Va en camino por paquetería · ' + g.prov + ' · guía ' + g.guia + (caja ? ' · caja ' + caja : '')));
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
      cj.traspasos.forEach(function (f) { enviar(mapa[f], g, cj.folio); });
      _tb(TR.H.CAJAS).actualizar(cj._fila, { 'Estatus': 'ENVIADA', 'Paquetería': g.prov, 'Guía': g.guia, 'ETA': g.eta, 'Última actualización': _ahoraTxt() });
    });

    // 2) Traspasos sueltos con su propio folio en Operaciones
    Object.keys(guias).forEach(function (id) {
      if (enCaja[id]) return;
      enviar(mapa[id], guias[id], '');
    });

    _tb(TR.H.MOV).agregarVarias(movs);
    _tb(TR.H.AVISOS).agregarVarias(avisos);
    return n;
  });
}

function apiSincronizar(token) {
  return _api(function () {
    const c = _ctx(token);
    if (c.area !== 'LOG' && !c.admin) throw new Error('Solo Logística o un administrador.');
    return { actualizados: sincronizarOperaciones() };
  });
}
