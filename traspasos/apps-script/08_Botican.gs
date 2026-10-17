/***********************************************************************
 * TRASPASOS FADERMEX — 08_Botican.gs
 * ---------------------------------------------------------------------
 * RECOLECCIÓN PEDIDOS BOTICAN (sin bitácora de papel)
 *
 * La bitácora de pedidos de Botican está en el archivo "LOGISTICA BOTICAN 2026",
 * hoja "Envios" (la hoja Cat de Operaciones solo la importa).
 *   A  Estatus  ← fórmula: si AB tiene algo → "🧍 RECOLECCIÓN DE GESTOR"
 *   B  Identificador (#15975)   D Contacto entrega   E Dirección   F Area
 *   G  Pedido listo para recolección
 *   AB Recolección de Gestor   ← AQUÍ escribe el sistema el nombre del gestor
 *
 * En la computadora de Botican: el gestor escanea su credencial, se marcan
 * (o escanean) los pedidos ELABORADOS que se lleva y confirma.
 *   1. Se escribe su nombre en Envios!AB → la fórmula cambia el estatus sola.
 *   2. Se guarda el acuse RB-0001 en RES_RecoleccionesBotican.
 *   3. Cada pedido queda con su línea de tiempo marcada BOTICAN (RES_Movimientos).
 ***********************************************************************/

const BOT = {
  ID_ARCHIVO: '1a3n7z962Ik6c1YrcD7RxkJEAWWK6a9xuA5LDrr2sffc',   // LOGISTICA BOTICAN 2026
  HOJA: 'Envios',
  FILA_ENC: 2,
  REVISAR_FILAS: 900,       // solo las últimas N filas (las recientes)
  AREA: 'BOT'
};

function _idBotican() {
  const v = String(_ajuste('botican_archivo', '') || '');
  const m = v.match(/\/d\/([-\w]{20,})/) || v.match(/^([-\w]{30,})$/);
  return m ? m[1] : BOT.ID_ARCHIVO;
}

/** Hoja Envios y la posición (1 = A) de cada columna, buscada por su encabezado. */
function _envios() {
  const sh = SpreadsheetApp.openById(_idBotican()).getSheetByName(BOT.HOJA);
  if (!sh) throw new Error('No encontré la hoja "' + BOT.HOJA + '" en el archivo de Botican.');
  const enc = sh.getRange(BOT.FILA_ENC, 1, 1, sh.getLastColumn()).getValues()[0].map(_norm);
  const col = function (prueba, porDefecto) { for (let i = 0; i < enc.length; i++) if (prueba(enc[i])) return i + 1; return porDefecto; };
  const C = {
    estatus: col(function (h) { return h === 'estatus'; }, 1),
    id: col(function (h) { return h.indexOf('identificador') === 0; }, 2),
    contacto: col(function (h) { return h.indexOf('contacto') === 0; }, 4),
    dir: col(function (h) { return h.indexOf('direccion') === 0; }, 5),
    area: col(function (h) { return h === 'area'; }, 6),
    listo: col(function (h) { return h.indexOf('pedido listo') === 0; }, 7),
    recol: col(function (h) { return h.indexOf('recoleccion de gestor') === 0; }, 28)
  };
  return { sh: sh, C: C };
}

/** Normaliza lo que se escanea o teclea: "15975", "#15975", " #pf195 " → "#15975" / "#PF195" */
function _pedidoDe(x) {
  const s = String(x == null ? '' : x).trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return '';
  return s.charAt(0) === '#' ? s : '#' + s;
}

function _estadoBot(txt) {
  const n = _norm(txt);
  if (n.indexOf('en elaboracion') >= 0) return 'EN_ELABORACION';
  if (n.indexOf('elaborado') >= 0) return 'ELABORADO';
  return '';
}

/** Colonia/ciudad corta para la lista: los dos pedazos de la dirección que van antes del CP. */
function _lugarCorto(dir) {
  const partes = String(dir || '').replace(/\s+/g, ' ').split(',').map(function (x) { return x.trim(); }).filter(String);
  let i = -1;
  for (let k = 0; k < partes.length; k++) if (/\b\d{5}\b/.test(partes[k])) { i = k; break; }
  if (i < 0) return partes.slice(-2).join(', ').slice(0, 70);
  const resto = partes[i].replace(/C\.?\s*P\.?/ig, '').replace(/\d{5}/, '').replace(/^[\s.:-]+|[\s:-]+$/g, '');
  const lugar = resto ? [partes[i - 1], resto] : [partes[i - 2], partes[i - 1]];
  return lugar.filter(Boolean).join(', ').slice(0, 70);
}

/** Lee las filas recientes: [{fila, id, estado, contacto, lugar, area, listo, recolecto}] */
function _leerEnvios() {
  const E = _envios(), sh = E.sh, C = E.C;
  const ult = sh.getLastRow();
  const desde = Math.max(BOT.FILA_ENC + 1, ult - BOT.REVISAR_FILAS + 1);
  if (ult < desde) return { E: E, filas: [] };
  const hasta = Math.max(C.estatus, C.id, C.contacto, C.dir, C.area, C.listo, C.recol);
  const v = sh.getRange(desde, 1, ult - desde + 1, hasta).getDisplayValues();
  const filas = [];
  v.forEach(function (f, i) {
    const id = _pedidoDe(f[C.id - 1]);
    if (id === '#') return;
    filas.push({ fila: desde + i, id: id, estado: _estadoBot(f[C.estatus - 1]),
      contacto: String(f[C.contacto - 1] || '').trim(), lugar: _lugarCorto(f[C.dir - 1]),
      area: String(f[C.area - 1] || '').trim(), listo: String(f[C.listo - 1] || '').trim(),
      recolecto: String(f[C.recol - 1] || '').trim() });
  });
  return { E: E, filas: filas };
}

function _soloBotican(c) {
  if (c.area !== BOT.AREA && !c.admin) throw new Error('La recolección de pedidos BOTICAN solo se hace desde la computadora de Botican.');
}

/** Pedidos para la pantalla: ELABORADOS sin recolectar (y EN ELABORACIÓN, en gris). */
function apiBoticanPendientes(token) {
  return _api(function () {
    _soloBotican(_ctx(token));
    return _leerEnvios().filas
      .filter(function (p) { return !p.recolecto && (p.estado === 'ELABORADO' || p.estado === 'EN_ELABORACION'); })
      .map(function (p) { return { id: p.id, estado: p.estado, contacto: p.contacto, lugar: p.lugar, area: p.area, listo: p.listo }; });
  });
}

/**
 * d = { gestor: credencial | {usuario, nip}, pedidos: ['#15975', ...] }
 * Escribe el nombre del gestor en Envios!AB y guarda el acuse RB-xxxx.
 */
function apiBoticanRecolectar(token, d) {
  return _api(function () {
    const c = _ctx(token);
    _soloBotican(c);
    d = d || {};
    const g = _gestorPorCodigo(d.gestor);
    if (!g) throw new Error(d.gestor ? _noReconocido(d.gestor) : 'Primero escanea la credencial del gestor.');
    const pedidos = [];
    (d.pedidos || []).forEach(function (x) { const k = _pedidoDe(x); if (k && k !== '#' && pedidos.indexOf(k) < 0) pedidos.push(k); });
    if (!pedidos.length) throw new Error('Marca o escanea al menos un pedido.');

    return _conCandado(function () {
      const L = _leerEnvios(), sh = L.E.sh, C = L.E.C;
      const porId = {};
      L.filas.forEach(function (p) { porId[p.id] = p; });           // si se repite, gana la fila más reciente
      const malos = [];
      pedidos.forEach(function (k) {
        const p = porId[k];
        if (!p) malos.push(k + ': no está en la bitácora de Botican');
        else if (p.recolecto) malos.push(k + ': ya lo recolectó ' + p.recolecto);
        else if (p.estado !== 'ELABORADO') malos.push(k + ': todavía no está Elaborado');
      });
      if (malos.length) throw new Error('No se guardó nada. ' + malos.join(' · '));

      // Antes de escribir, confirmar que cada fila sigue siendo ese pedido (por si se movieron filas)
      pedidos.forEach(function (k) {
        const p = porId[k];
        if (_pedidoDe(sh.getRange(p.fila, C.id).getDisplayValue()) !== k) throw new Error('La bitácora de Botican cambió mientras se guardaba. Vuelve a intentar.');
      });
      pedidos.forEach(function (k) { sh.getRange(porId[k].fila, C.recol).setValue(g.nombre); });
      SpreadsheetApp.flush();

      const acuse = _siguienteFolio('RB');
      _tb(TR.H.BOTICAN).agregarVarias(pedidos.map(function (k) {
        const p = porId[k];
        return { 'Acuse': acuse, 'Fecha': _hoy(), 'Hora': _hora(), 'Pedido': k, 'Contacto entrega': p.contacto,
                 'Lugar': p.lugar, 'Área': p.area, 'Gestor': g.nombre, 'Credencial': g.via, 'Registró (cuenta)': c.email };
      }));
      _tb(TR.H.MOV).agregarVarias(pedidos.map(function (k) {
        return _movObj({ folio: k }, 'RECOLECTADO EN BOTICAN', 'ELABORADO', 'RECOLECCION_GESTOR',
          { donde: BOT.AREA, persona: g.nombre, cred: g.via, medio: 'BOTICAN · RECOLECCIÓN DE PEDIDOS', equipo: BOT.AREA,
            detalle: 'Acuse ' + acuse + ' · ' + pedidos.length + ' pedido(s) · ' + (porId[k].contacto || '') });
      }));
      return { acuse: acuse, gestor: g.nombre, pedidos: pedidos, fecha: _hoy(), hora: _hora() };
    });
  });
}

/** Historia de un pedido de Botican (para el Buscador): sus movimientos en Traspasos. */
function _detalleBotican(id) {
  const k = _pedidoDe(id);
  const mov = _tb(TR.H.MOV).filas().filter(function (m) { return String(m['Folio']).trim().toUpperCase() === k; });
  if (!mov.length) return null;
  return {
    pedido: { folio: k, botican: true },
    movimientos: mov.map(function (m) {
      return { fecha: _txt(m['Fecha']), hora: _txt(m['Hora']), accion: String(m['Acción']), nuevo: String(m['Estatus nuevo'] || ''),
               donde: String(m['Dónde ocurrió (área)'] || ''), persona: String(m['Persona'] || ''), medio: String(m['Medio'] || ''), detalle: String(m['Detalle'] || '') };
    })
  };
}
