/***********************************************************************
 * TRASPASOS FADERMEX — 09_Domicilio.gs
 * ---------------------------------------------------------------------
 * RECOLECCIÓN PEDIDOS A DOMICILIO (PV de Nueva Roma, Vertiz, Doctores,
 * Ecatepec y Coapa) — igual que Botican, pero con la bitácora
 * "Pedidos Logistica-Fadermex 2026", hoja "Envios" (encabezados en la fila 2):
 *   A Identificador (NRREM-00008579)   C Estatus   D Contacto entrega
 *   E Dirección entrega   F Sucursal ("NUEVA ROMA PV")
 *   H Pedido listo para recolección
 *   Z ✎ Fecha de recolección   AA Recolectado por:   ← AQUÍ escribe el sistema
 *
 * En la computadora del PV: el gestor escanea su credencial, se marcan
 * (o escanean) los pedidos LISTOS de esa sucursal y confirma.
 *   1. Se escribe la fecha/hora en Z y su nombre en AA (no se toca nada más).
 *   2. Se guarda el acuse RP-0001 en RES_RecoleccionesDomicilio.
 *   3. Cada pedido queda con su línea de tiempo (RES_Movimientos).
 * Las columnas se buscan por su encabezado: si mueven columnas, sigue funcionando.
 ***********************************************************************/

const DOM = {
  ID_ARCHIVO: '1lv35lbab-GCrv-H81xjBh2CpfO2F-EUIIN3kcWHSsHU',   // Pedidos Logistica-Fadermex 2026
  HOJA: 'Envios',
  FILA_ENC: 2,
  REVISAR_FILAS: 900,
  SUCURSALES: 'Nueva Roma, Vertiz, Doctores, Ecatepec, Coapa'
};

function _idDomicilio() {
  const v = String(_ajuste('domicilio_archivo', '') || '');
  const m = v.match(/\/d\/([-\w]{20,})/) || v.match(/^([-\w]{30,})$/);
  return m ? m[1] : DOM.ID_ARCHIVO;
}

/** ¿Esta área (PV de una de las sucursales configuradas) usa la recolección a domicilio? */
function _domicilioActivo(area) {
  const a = _areas()[area];
  if (!a || a.tipo !== 'SUCURSAL' || _norm(a.corto) !== 'pv') return false;
  const lista = String(_ajuste('domicilio_sucursales', DOM.SUCURSALES) || '').split(/[,;]+/).map(_norm).filter(String);
  return lista.indexOf(_norm(a.sucNombre)) >= 0 || lista.indexOf(_norm(a.suc)) >= 0;
}

/** "NUEVA ROMA PV" (columna Sucursal) ¿es el PV de esta área? */
function _esSucDe(txt, area) {
  const a = _areas()[area];
  if (!a) return false;
  const s = _norm(txt).replace(/\s+/g, ' ').trim(), n = _norm(a.sucNombre);
  return s === n || s === n + ' pv' || s === n + ' punto de venta';
}

function _pedidoDom(x) { return String(x == null ? '' : x).trim().toUpperCase().replace(/\s+/g, ''); }

/** Estatus de la columna C → '' (ya salió / terminó), EN_ELABORACION o LISTO. */
function _estadoDom(estatus, listo) {
  const n = _norm(estatus);
  if (/entregad|ruta|cancel|retorn|recolect|transito|camino|enviad/.test(n)) return '';
  if (String(listo || '').trim()) return 'ELABORADO';        // mismo código que Botican: se puede llevar
  if (n.indexOf('elaboracion') >= 0) return 'EN_ELABORACION';
  return '';
}

function _hojaDomicilio() {
  const sh = SpreadsheetApp.openById(_idDomicilio()).getSheetByName(DOM.HOJA);
  if (!sh) throw new Error('No encontré la hoja "' + DOM.HOJA + '" en el archivo de Pedidos Logística.');
  const enc = sh.getRange(DOM.FILA_ENC, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return _norm(String(h).replace(/[✎\n]/g, ' ')).replace(/\s+/g, ' ').trim(); });
  const col = function (prueba, porDefecto) { for (let i = 0; i < enc.length; i++) if (prueba(enc[i])) return i + 1; return porDefecto; };
  const C = {
    id: col(function (h) { return h.indexOf('identificador') === 0; }, 1),
    estatus: col(function (h) { return h === 'estatus'; }, 3),
    contacto: col(function (h) { return h.indexOf('contacto') === 0; }, 4),
    dir: col(function (h) { return h.indexOf('direccion') === 0; }, 5),
    suc: col(function (h) { return h === 'sucursal'; }, 6),
    listo: col(function (h) { return h.indexOf('pedido listo') === 0; }, 8),
    fecha: col(function (h) { return h.indexOf('fecha de recoleccion') === 0; }, 26),
    por: col(function (h) { return h.indexOf('recolectado por') === 0; }, 27)
  };
  return { sh: sh, C: C };
}

/** Filas recientes: [{fila, id, estado, contacto, lugar, suc, listo, recolecto}] */
function _leerDomicilio() {
  const E = _hojaDomicilio(), sh = E.sh, C = E.C;
  const fin = sh.getLastRow();
  if (fin <= DOM.FILA_ENC) return { E: E, filas: [] };
  const ids = sh.getRange(DOM.FILA_ENC + 1, C.id, fin - DOM.FILA_ENC, 1).getDisplayValues();
  let ult = DOM.FILA_ENC;
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]).trim()) { ult = DOM.FILA_ENC + 1 + i; break; }
  const desde = Math.max(DOM.FILA_ENC + 1, ult - DOM.REVISAR_FILAS + 1);
  if (ult < desde) return { E: E, filas: [] };
  const hasta = Math.max(C.id, C.estatus, C.contacto, C.dir, C.suc, C.listo, C.fecha, C.por);
  const v = sh.getRange(desde, 1, ult - desde + 1, hasta).getDisplayValues();
  const filas = [];
  v.forEach(function (f, i) {
    const id = _pedidoDom(f[C.id - 1]);
    if (!id) return;
    const listo = String(f[C.listo - 1] || '').trim();
    filas.push({ fila: desde + i, id: id, estado: _estadoDom(f[C.estatus - 1], listo),
      contacto: String(f[C.contacto - 1] || '').trim(), lugar: _lugarCorto(f[C.dir - 1]),
      suc: String(f[C.suc - 1] || '').trim(), listo: listo, recolecto: String(f[C.por - 1] || '').trim() });
  });
  return { E: E, filas: filas };
}

function _soloDomicilio(c) {
  if (!_domicilioActivo(c.area)) throw new Error('La recolección de pedidos a domicilio solo se hace desde la computadora del PV de Nueva Roma, Vertiz, Doctores, Ecatepec o Coapa.');
}

/** Pedidos de ESTA sucursal: listos sin recolectar (y en elaboración, en gris). */
function apiDomicilioPendientes(token) {
  return _api(function () {
    const c = _ctx(token);
    _soloDomicilio(c);
    return _leerDomicilio().filas
      .filter(function (p) { return !p.recolecto && p.estado && _esSucDe(p.suc, c.area); })
      .map(function (p) { return { id: p.id, estado: p.estado, contacto: p.contacto, lugar: p.lugar, listo: p.listo }; });
  });
}

/**
 * d = { gestor: credencial | {usuario, nip}, pedidos: ['NRREM-00008579', ...] }
 * Escribe fecha y gestor en la bitácora y guarda el acuse RP-xxxx.
 */
function apiDomicilioRecolectar(token, d) {
  return _api(function () {
    const c = _ctx(token);
    _soloDomicilio(c);
    d = d || {};
    const g = _gestorPorCodigo(d.gestor);
    if (!g) throw new Error(d.gestor ? _noReconocido(d.gestor) : 'Primero escanea la credencial del gestor.');
    const pedidos = [];
    (d.pedidos || []).forEach(function (x) { const k = _pedidoDom(x); if (k && pedidos.indexOf(k) < 0) pedidos.push(k); });
    if (!pedidos.length) throw new Error('Marca o escanea al menos un pedido.');
    const suc = _areas()[c.area].sucNombre;

    return _conCandado(function () {
      const L = _leerDomicilio(), sh = L.E.sh, C = L.E.C;
      const porId = {};
      L.filas.forEach(function (p) { porId[p.id] = p; });
      const malos = [];
      pedidos.forEach(function (k) {
        const p = porId[k];
        if (!p) malos.push(k + ': no está en la bitácora de pedidos');
        else if (!_esSucDe(p.suc, c.area)) malos.push(k + ': es de ' + (p.suc || 'otra sucursal') + ', no de ' + suc);
        else if (p.recolecto) malos.push(k + ': ya lo recolectó ' + p.recolecto);
        else if (p.estado !== 'ELABORADO') malos.push(k + ': todavía no está listo para recolección');
      });
      if (malos.length) throw new Error('No se guardó nada. ' + malos.join(' · '));

      pedidos.forEach(function (k) {
        if (_pedidoDom(sh.getRange(porId[k].fila, C.id).getDisplayValue()) !== k) throw new Error('La bitácora de pedidos cambió mientras se guardaba. Vuelve a intentar.');
      });
      const ahora = new Date();
      pedidos.forEach(function (k) {
        sh.getRange(porId[k].fila, C.fecha).setValue(ahora);
        sh.getRange(porId[k].fila, C.por).setValue(g.nombre);
      });
      SpreadsheetApp.flush();

      const acuse = _siguienteFolio('RP');
      _tb(TR.H.DOMICILIO).agregarVarias(pedidos.map(function (k) {
        const p = porId[k];
        return { 'Acuse': acuse, 'Fecha': _hoy(), 'Hora': _hora(), 'Pedido': k, 'Contacto entrega': p.contacto,
                 'Lugar': p.lugar, 'Sucursal': p.suc, 'Área': c.area, 'Gestor': g.nombre, 'Credencial': g.via, 'Registró (cuenta)': c.email };
      }));
      _tb(TR.H.MOV).agregarVarias(pedidos.map(function (k) {
        return _movObj({ folio: k }, 'RECOLECTADO EN SUCURSAL (DOMICILIO)', 'LISTO PARA RECOLECCIÓN', 'RECOLECCION_GESTOR',
          { donde: c.area, persona: g.nombre, cred: g.via, medio: 'PEDIDO A DOMICILIO · ' + suc, equipo: c.area,
            detalle: 'Acuse ' + acuse + ' · ' + pedidos.length + ' pedido(s) · ' + (porId[k].contacto || '') });
      }));
      return { acuse: acuse, gestor: g.nombre, pedidos: pedidos, fecha: _hoy(), hora: _hora() };
    });
  });
}

/** Historia de un pedido a domicilio (para el Buscador). */
function _detalleDomicilio(id) {
  const k = _pedidoDom(id);
  const mov = _tb(TR.H.MOV).filas().filter(function (m) { return String(m['Folio']).trim().toUpperCase() === k && /DOMICILIO/.test(String(m['Medio'] || '')); });
  if (!mov.length) return null;
  return {
    pedido: { folio: k, domicilio: true },
    movimientos: mov.map(function (m) {
      return { fecha: _txt(m['Fecha']), hora: _txt(m['Hora']), accion: String(m['Acción']), nuevo: String(m['Estatus nuevo'] || ''),
               donde: String(m['Dónde ocurrió (área)'] || ''), persona: String(m['Persona'] || ''), medio: String(m['Medio'] || ''), detalle: String(m['Detalle'] || '') };
    })
  };
}

function _crearHojaRecolDomicilio() {
  const ss = _libro();
  if (ss.getSheetByName(TR.H.DOMICILIO)) return false;
  const sh = ss.insertSheet(TR.H.DOMICILIO);
  const enc = ['Acuse', 'Fecha', 'Hora', 'Pedido', 'Contacto entrega', 'Lugar', 'Sucursal', 'Área', 'Gestor', 'Credencial', 'Registró (cuenta)'];
  sh.getRange(1, 1).setValue('RES_RecoleccionesDomicilio  —  RESULTADOS · La app ESCRIBE aquí sola · NO editar a mano.  ' +
    'Acuse digital de cada recolección de pedidos a domicilio en los PV. Un renglón por pedido.');
  sh.getRange(2, 1, 1, enc.length).setValues([enc]);
  try {
    sh.setTabColor('#0086C4');
    sh.getRange(1, 1, 1, enc.length).merge().setBackground('#E0F5FD').setFontColor('#0086C4').setFontWeight('bold').setWrap(true);
    sh.setRowHeight(1, 36);
    sh.getRange(2, 1, 1, enc.length).setBackground('#0086C4').setFontColor('#FFFFFF').setFontWeight('bold');
    sh.setFrozenRows(2);
  } catch (e) { }
  __TB = {};
  return true;
}
