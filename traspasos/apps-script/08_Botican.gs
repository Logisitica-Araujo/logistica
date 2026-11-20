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
    recol: col(function (h) { return h.indexOf('recoleccion de gestor') === 0; }, 28),
    // "Producción · Pasó a sucursal (fecha y hora)" — 0 si todavía no existe (la crea Instalar / reparar)
    fprod: col(function (h) { return h.indexOf('produccion') === 0 && h.indexOf('paso a sucursal') >= 0; }, 0)
  };
  return { sh: sh, C: C };
}

const COL_FPROD = 'Producción · Pasó a sucursal (fecha y hora)';
/** Crea la columna de fecha de Producción al final del renglón de encabezados si no existe. Regresa su número. */
function _asegurarColFprod(E) {
  E = E || _envios();
  if (E.C.fprod) return E.C.fprod;
  const n = E.sh.getLastColumn() + 1;
  E.sh.getRange(BOT.FILA_ENC, n).setValue(COL_FPROD);
  E.C.fprod = n;
  return n;
}
function _fechaHora(fecha, hora) { return Utilities.parseDate(String(fecha).slice(0, 10) + ' ' + String(hora).slice(0, 5), TR.ZONA, 'yyyy-MM-dd HH:mm'); }
function _ponerFprod(sh, fila, col, fecha) {
  const r = sh.getRange(fila, col);
  if (fecha) { r.setValue(fecha); try { r.setNumberFormat('dd/mm/yyyy hh:mm'); } catch (e) { } } else r.setValue('');
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
  // getLastRow() cuenta filas con fórmulas aunque estén vacías: el último pedido real
  // es la última fila con Identificador.
  const fin = sh.getLastRow();
  if (fin <= BOT.FILA_ENC) return { E: E, filas: [] };
  const ids = sh.getRange(BOT.FILA_ENC + 1, C.id, fin - BOT.FILA_ENC, 1).getDisplayValues();
  let ult = BOT.FILA_ENC;
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]).trim()) { ult = BOT.FILA_ENC + 1 + i; break; }
  const desde = Math.max(BOT.FILA_ENC + 1, ult - BOT.REVISAR_FILAS + 1);
  if (ult < desde) return { E: E, filas: [] };
  const hasta = Math.max(C.estatus, C.id, C.contacto, C.dir, C.area, C.listo, C.recol);
  const v = sh.getRange(desde, 1, ult - desde + 1, hasta).getDisplayValues();
  const filas = [], suc = _sucursalesMano();
  v.forEach(function (f, i) {
    const id = _pedidoDe(f[C.id - 1]);
    if (!id || id === '#') return;
    filas.push({ fila: desde + i, id: id, estado: _estadoBot(f[C.estatus - 1]),
      contacto: String(f[C.contacto - 1] || '').trim(), lugar: _lugarCorto(f[C.dir - 1]),
      area: String(f[C.area - 1] || '').trim(), listo: String(f[C.listo - 1] || '').trim(),
      recolecto: String(f[C.recol - 1] || '').trim(), mano: _manoDe(f[C.dir - 1], suc) });
  });
  return { E: E, filas: filas };
}

/**
 * PASA A SUCURSAL (mano a mano): pedidos cuya "Dirección entrega" dice "Sucursal Vértiz"
 * (o la sucursal que se ponga en CFG_Ajustes → botican_pasa_a_sucursal) no se los lleva un gestor:
 * alguien de Producción los saca escaneando SU credencial y los deja en esa sucursal.
 */
function _sucursalesMano() {
  let v = _ajuste('botican_pasa_a_sucursal', null);
  if (v == null) v = Object.prototype.hasOwnProperty.call(__AJ || {}, 'botican_pasa_a_sucursal') ? '' : 'Vértiz';   // vacío en CFG_Ajustes = desactivado
  return String(v).split(/[,;]+/)
    .map(function (x) { return x.trim(); }).filter(String);
}
function _manoDe(dir, lista) {
  const d = ' ' + _norm(dir).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (let i = 0; i < lista.length; i++) if (d.indexOf(' sucursal ' + _norm(lista[i]) + ' ') >= 0) return lista[i];
  return '';
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
      .map(function (p) { return { id: p.id, estado: p.estado, contacto: p.contacto, lugar: p.lugar, area: p.area, listo: p.listo, mano: p.mano }; });
  });
}

/**
 * d = { gestor: credencial | {usuario, nip}, pedidos: ['#15975', ...], sucursal?: 'Vértiz' }
 * Con gestor: escribe su nombre en Envios!AB y guarda el acuse RB-xxxx.
 * Con sucursal (mano a mano): "gestor" es la credencial de la persona de Producción que los saca;
 * escribe "Pasó a Vértiz · Nombre" en Envios!AB y guarda el acuse RS-xxxx.
 */
function apiBoticanRecolectar(token, d) {
  return _api(function () {
    const c = _ctx(token);
    _soloBotican(c);
    d = d || {};
    let suc = '';
    if (d.sucursal) {
      suc = _sucursalesMano().filter(function (s) { return _norm(s) === _norm(d.sucursal); })[0];
      if (!suc) throw new Error('"' + d.sucursal + '" ya no está en CFG_Ajustes → botican_pasa_a_sucursal. Actualiza la página.');
    }
    const g = suc ? _personaPorCodigo(d.gestor) : _gestorPorCodigo(d.gestor);
    if (!g) throw new Error(d.gestor ? _noReconocido(d.gestor) : (suc ? 'Primero escanea tu credencial (Producción).' : 'Primero escanea la credencial del gestor.'));
    if (suc && g.area !== BOT.AREA) throw new Error(g.nombre + ' no está registrado como personal de Botican / Producción (en CAT_Personas su área debe ser ' + BOT.AREA + ').');
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
        else if (suc && p.mano !== suc) malos.push(k + ': no es de los que se recogen en ' + suc + ' (va con gestor)');
      });
      if (malos.length) throw new Error('No se guardó nada. ' + malos.join(' · '));

      // Antes de escribir, confirmar que cada fila sigue siendo ese pedido (por si se movieron filas)
      pedidos.forEach(function (k) {
        const p = porId[k];
        if (_pedidoDe(sh.getRange(p.fila, C.id).getDisplayValue()) !== k) throw new Error('La bitácora de Botican cambió mientras se guardaba. Vuelve a intentar.');
      });
      const texto = suc ? 'Pasó a ' + suc + ' · ' + g.nombre : g.nombre;
      const hoy = _hoy(), hora = _hora();
      const colF = suc ? _asegurarColFprod(L.E) : 0, cuando = suc ? _fechaHora(hoy, hora) : null;
      pedidos.forEach(function (k) {
        sh.getRange(porId[k].fila, C.recol).setValue(texto);
        if (suc) _ponerFprod(sh, porId[k].fila, colF, cuando);
      });
      SpreadsheetApp.flush();

      ['Tipo', 'Se dejó en', 'Estado'].forEach(function (h) { _agregarColumna(TR.H.BOTICAN, h); });
      const acuse = _siguienteFolio(suc ? 'RS' : 'RB');
      _tb(TR.H.BOTICAN).agregarVarias(pedidos.map(function (k) {
        const p = porId[k];
        return { 'Acuse': acuse, 'Fecha': hoy, 'Hora': hora, 'Pedido': k, 'Contacto entrega': p.contacto, 'Estado': 'VIGENTE',
                 'Lugar': p.lugar, 'Área': p.area, 'Gestor': g.nombre, 'Credencial': g.via, 'Registró (cuenta)': c.email,
                 'Tipo': suc ? 'PASA A SUCURSAL (PRODUCCIÓN)' : 'GESTOR', 'Se dejó en': suc };
      }));
      _tb(TR.H.MOV).agregarVarias(pedidos.map(function (k) {
        return suc
          ? _movObj({ folio: k }, 'PRODUCCIÓN LO PASÓ A ' + suc.toUpperCase(), 'ELABORADO', 'ENTREGADO_EN_SUCURSAL',
              { donde: BOT.AREA, persona: g.nombre, cred: g.via, medio: 'BOTICAN · PASA A SUCURSAL (MANO A MANO)', equipo: BOT.AREA,
                detalle: 'Acuse ' + acuse + ' · lo dejó en ' + suc + ' · ' + pedidos.length + ' pedido(s) · ' + (porId[k].contacto || '') })
          : _movObj({ folio: k }, 'RECOLECTADO EN BOTICAN', 'ELABORADO', 'RECOLECCION_GESTOR',
              { donde: BOT.AREA, persona: g.nombre, cred: g.via, medio: 'BOTICAN · RECOLECCIÓN DE PEDIDOS', equipo: BOT.AREA,
                detalle: 'Acuse ' + acuse + ' · ' + pedidos.length + ' pedido(s) · ' + (porId[k].contacto || '') });
      }));
      return { acuse: acuse, gestor: g.nombre, sucursal: suc, pedidos: pedidos, fecha: hoy, hora: hora };
    });
  });
}

/* ======================= EDITAR / DESHACER (solo administradores) ======================= */

/** Último acuse del pedido en RES_RecoleccionesBotican (el vigente si hay; si no, el último). */
function _acuseBot(k) {
  const fs = _tb(TR.H.BOTICAN).filas().filter(function (f) { return _pedidoDe(f['Pedido']) === k; });
  const vig = fs.filter(function (f) { return String(f['Estado'] || '').toUpperCase() !== 'CANCELADO'; });
  const f = (vig.length ? vig : fs).slice(-1)[0];
  if (!f) return null;
  const suc = String(f['Se dejó en'] || '').trim();
  return { fila: f._fila, acuse: String(f['Acuse']), tipo: suc ? 'SUCURSAL' : 'GESTOR', nombre: String(f['Gestor'] || ''), sucursal: suc,
           fecha: _txt(f['Fecha']), hora: _txt(f['Hora']), estado: String(f['Estado'] || '').toUpperCase() === 'CANCELADO' ? 'CANCELADO' : 'VIGENTE' };
}
/** Nombres para los desplegables del administrador. */
function _opcionesBot() {
  const act = function (h, filtro) {
    if (!_libro().getSheetByName(h)) return [];
    return _tb(h).filas().filter(function (p) { return _activo(p['Activo']) && filtro(p); }).map(function (p) { return String(p['Nombre completo']).trim(); }).filter(String);
  };
  const gest = act(TR.H.GESTORES, function () { return true; })
    .concat(act(TR.H.PERSONAS, function (p) { return /gestor/i.test(String(p['Puesto'] || '')); }));
  return { personas: act(TR.H.PERSONAS, function (p) { return String(p['Área (prefijo)'] || '').trim().toUpperCase() === BOT.AREA; }),
           gestores: gest.filter(function (x, i) { return gest.indexOf(x) === i; }), sucursales: _sucursalesMano() };
}
function _soloAdmin(c) { if (!c.admin) throw new Error('Solo un administrador puede editar o deshacer un registro (entra al Modo administrador).'); }

/** d = { pedido, nombre, sucursal?, fecha?, hora? } — corrige el registro vigente del pedido. */
function apiBoticanEditar(token, d) {
  return _api(function () {
    const c = _ctx(token); _soloAdmin(c); d = d || {};
    const k = _pedidoDe(d.pedido), nombre = String(d.nombre || '').trim();
    if (!nombre) throw new Error('Elige a la persona.');
    return _conCandado(function () {
      const a = _acuseBot(k);
      if (!a || a.estado === 'CANCELADO') throw new Error(k + ' no tiene un registro vigente para editar.');
      const L = _leerEnvios(), p = L.filas.filter(function (x) { return x.id === k; }).slice(-1)[0];
      if (!p) throw new Error(k + ' ya no está en la bitácora de Botican.');
      const sh = L.E.sh, C = L.E.C, cambios = [], nuevo = {};
      let suc = a.sucursal, fecha = a.fecha, hora = a.hora;
      if (a.tipo === 'SUCURSAL') {
        suc = _sucursalesMano().filter(function (s) { return _norm(s) === _norm(d.sucursal || a.sucursal); })[0] || a.sucursal;
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha || ''))) fecha = d.fecha;
        if (/^\d{1,2}:\d{2}$/.test(String(d.hora || ''))) hora = ('0' + d.hora).slice(-5);
      }
      if (nombre !== a.nombre) { cambios.push((a.tipo === 'SUCURSAL' ? 'Persona: ' : 'Gestor: ') + a.nombre + ' → ' + nombre); nuevo['Gestor'] = nombre; }
      if (suc !== a.sucursal) { cambios.push('Sucursal: ' + a.sucursal + ' → ' + suc); nuevo['Se dejó en'] = suc; }
      if (fecha !== a.fecha || hora !== a.hora) { cambios.push('Fecha y hora: ' + a.fecha + ' ' + a.hora + ' → ' + fecha + ' ' + hora); nuevo['Fecha'] = fecha; nuevo['Hora'] = hora; }
      if (!cambios.length) throw new Error('No cambiaste nada.');
      const antesAB = p.recolecto;
      const ab = a.tipo === 'SUCURSAL' ? 'Pasó a ' + suc + ' · ' + nombre : nombre;
      sh.getRange(p.fila, C.recol).setValue(ab);
      if (a.tipo === 'SUCURSAL') _ponerFprod(sh, p.fila, _asegurarColFprod(L.E), _fechaHora(fecha, hora));
      SpreadsheetApp.flush();
      _agregarColumna(TR.H.BOTICAN, 'Editado');
      nuevo['Editado'] = _ahoraTxt() + ' · ' + c.email;
      _tb(TR.H.BOTICAN).actualizar(a.fila, nuevo);
      _mov({ folio: k }, 'REGISTRO EDITADO · ' + a.acuse, '', '', { donde: TR.AREA_ADMIN, persona: c.email, medio: 'ADMINISTRADOR',
        detalle: cambios.join(' · ') + ' · Antes: "' + antesAB + '" · Después: "' + ab + '"' });
      return { ok: true };
    });
  });
}

/** Deshace el registro vigente: borra AB (y la fecha de Producción) y marca el acuse CANCELADO. */
function apiBoticanDeshacer(token, pedido) {
  return _api(function () {
    const c = _ctx(token); _soloAdmin(c);
    const k = _pedidoDe(pedido);
    return _conCandado(function () {
      const a = _acuseBot(k);
      if (!a || a.estado === 'CANCELADO') throw new Error(k + ' no tiene un registro vigente para deshacer.');
      const L = _leerEnvios(), p = L.filas.filter(function (x) { return x.id === k; }).slice(-1)[0];
      if (!p) throw new Error(k + ' ya no está en la bitácora de Botican.');
      const antes = p.recolecto;
      L.E.sh.getRange(p.fila, L.E.C.recol).setValue('');
      if (L.E.C.fprod) _ponerFprod(L.E.sh, p.fila, L.E.C.fprod, null);
      SpreadsheetApp.flush();
      ['Estado', 'Editado'].forEach(function (h) { _agregarColumna(TR.H.BOTICAN, h); });
      _tb(TR.H.BOTICAN).actualizar(a.fila, { 'Estado': 'CANCELADO', 'Editado': _ahoraTxt() + ' · deshecho por ' + c.email });
      _mov({ folio: k }, 'REGISTRO DESHECHO · ' + a.acuse + ' CANCELADO', '', 'ELABORADO', { donde: TR.AREA_ADMIN, persona: c.email, medio: 'ADMINISTRADOR',
        detalle: 'Antes: "' + antes + '"' + (a.tipo === 'SUCURSAL' ? ', ' + a.fecha + ' ' + a.hora : '') + ' · Después: (vacío) · el pedido vuelve a Listos para recolección' });
      return { ok: true };
    });
  });
}

/** Pedidos que Producción pasó antes de que existiera la columna de fecha: se llena una sola vez. */
function _rellenarFprod() {
  if (!_libro().getSheetByName(TR.H.BOTICAN)) return 0;
  const acs = _tb(TR.H.BOTICAN).filas().filter(function (f) {
    return String(f['Se dejó en'] || '').trim() && String(f['Estado'] || '').toUpperCase() !== 'CANCELADO';
  });
  if (!acs.length) return 0;
  const L = _leerEnvios(), col = _asegurarColFprod(L.E), porId = {};
  L.filas.forEach(function (p) { porId[p.id] = p; });
  let n = 0;
  acs.forEach(function (f) {
    const p = porId[_pedidoDe(f['Pedido'])];
    if (!p || !/^Pasó a /.test(p.recolecto)) return;
    if (String(L.E.sh.getRange(p.fila, col).getDisplayValue()).trim()) return;
    _ponerFprod(L.E.sh, p.fila, col, _fechaHora(_txt(f['Fecha']), _txt(f['Hora'])));
    n++;
  });
  return n;
}

/** Historia de un pedido de Botican (para el Buscador): sus movimientos en Traspasos. */
function _detalleBotican(id, c) {
  const k = _pedidoDe(id);
  const mov = _tb(TR.H.MOV).filas().filter(function (m) { return String(m['Folio']).trim().toUpperCase() === k; });
  if (!mov.length) return null;
  const reg = _acuseBot(k);
  return {
    pedido: { folio: k, botican: true, registro: reg, opciones: c && c.admin && reg && reg.estado === 'VIGENTE' ? _opcionesBot() : null },
    movimientos: mov.map(function (m) {
      return { fecha: _txt(m['Fecha']), hora: _txt(m['Hora']), accion: String(m['Acción']), nuevo: String(m['Estatus nuevo'] || ''),
               donde: String(m['Dónde ocurrió (área)'] || ''), persona: String(m['Persona'] || ''), medio: String(m['Medio'] || ''), detalle: String(m['Detalle'] || '') };
    })
  };
}
