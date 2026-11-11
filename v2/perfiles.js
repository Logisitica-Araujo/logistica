/***********************************************************************
 * APP GESTORES 2 — perfiles.js
 * ---------------------------------------------------------------------
 * Lo que cambia según la persona (columna Area y Rol de APP_Usuarios):
 *   • Gestoría     (azul)   → app.js tal cual: pedidos a domicilio, recolecciones.
 *   • Facturación  (verde)  → "Traslados": su ruta ordenada por PARADA, entregar
 *                             varias cosas juntas con una foto, efectivo con monto,
 *                             entregas en áreas del IMSS con acuse sellado.
 *   • Administrador (oscuro) → sección Administración (A1–A9), además de su app.
 * Usa las utilidades de app.js ($, esc, srv, pintar, modal…).
 ***********************************************************************/

function perfil() { return (S.datos && S.datos.perfil) || { area: 'GESTORIA', admin: false }; }
function esFac() { return perfil().area === 'FACTURACION'; }
function aplicarTema() {
  var b = document.body; if (!b) return;
  b.classList.toggle('fac', !!S.token && esFac() && !S.enAdmin);
  b.classList.toggle('adm', !!S.token && !!S.enAdmin);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', S.enAdmin ? '#111A2E' : esFac() ? '#1E5E3A' : '#0B3D91');
}
var ICP = {
  escudo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  ruta: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/></svg>',
  buscar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  gente: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
  coche: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
  engrane: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};
function dinero(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* =====================================================================
 *  FACTURACIÓN · TRASLADOS
 * ===================================================================== */

/** Junta lo que lleva y sus pedidos por PARADA (sucursal, área del IMSS o domicilio). */
function armarParadas() {
  var d = S.datos, paradas = [], porK = {};
  function parada(k, nombre, dir, maps) {
    if (!porK[k]) { porK[k] = { k: k, nombre: nombre, direccion: dir || '', maps: maps || '', items: [], recoger: [] }; paradas.push(porK[k]); }
    return porK[k];
  }
  d.lleva.forEach(function (l, i) {
    var k = l.destinoId ? 'S:' + l.destinoId : 'D:' + clave(l.destino);
    parada(k, l.destinoSucursal || l.destino || 'Sin destino', l.destinoDireccion, l.destinoMaps)
      .items.push({ fuente: 'lleva', i: i, tipo: l.tipo === 'TRASPASO' ? 'TRASPASO' : 'RECOLECCION', id: l.codigo, clase: l.clase || '', texto: l.contenido, esperado: l.esperado || 0 });
  });
  d.pedidos.forEach(function (p, i) {
    var imss = p.clase === 'IMSS';
    var k = imss ? 'I:' + clave(p.cliente) : 'P:' + clave(p.direccion || p.cliente);
    parada(k, (imss && !/imss/i.test(p.cliente) ? 'IMSS · ' : '') + p.cliente, p.direccion, '')
      .items.push({ fuente: 'pedido', i: i, tipo: 'PEDIDO', id: p.id, clase: p.clase || '', texto: [p.subarea, p.notas].filter(String).join(' · '), esperado: p.esperado || 0 });
  });
  var sucs = {}; (d.sucursales || []).forEach(function (s) { sucs[s.id] = s; });
  var yaLlevo = {}; d.lleva.forEach(function (l) { yaLlevo[clave(l.codigo)] = true; });
  var otras = {};
  (d.porRecoger || []).forEach(function (r) {
    if (yaLlevo[clave(r.folio)]) return;
    var k = 'S:' + r.sucursalId;
    if (porK[k]) porK[k].recoger.push(r);
    else { var s = sucs[r.sucursalId]; (otras[k] = otras[k] || { k: k, nombre: s ? s.nombre : r.sucursalId, direccion: s ? s.direccion : '', maps: s ? s.maps : '', items: [], recoger: [] }).recoger.push(r); }
  });
  return { paradas: paradas, porK: porK, soloRecoger: Object.keys(otras).map(function (k) { return otras[k]; }) };
}
function chipsParada(p) {
  var c = [], efe = p.items.some(function (x) { return x.clase === 'EFECTIVO'; }), imss = p.items.some(function (x) { return x.clase === 'IMSS'; }),
      doc = p.items.some(function (x) { return x.clase === 'DOCUMENTO'; });
  if (p.items.length) c.push('<span class="pchip v">ENTREGAR ' + p.items.length + '</span>');
  if (p.recoger.length) c.push('<span class="pchip a">RECOGER ' + p.recoger.length + '</span>');
  if (efe) c.push('<span class="pchip n">EFECTIVO</span>');
  if (doc) c.push('<span class="pchip g">DOCUMENTOS</span>');
  if (imss) c.push('<span class="pchip r">PIDE ACUSE</span>');
  return c.join('');
}

function vistaRuta() {
  S.vista = 'inicio'; pararEscaner(); aplicarTema();
  var d = S.datos; if (!d) return;
  var x = estadoTexto(), R = armarParadas();
  S.paradas = R;
  var aviso = S.aviso && Date.now() - S.aviso.hora < 30 * 60000 ? S.aviso : null;
  var html = '<div class="cab"><div class="cab-fila"><img src="../iconos/icono-192.png" alt="">' +
    '<div class="cab-nombre"><small>' + saludo() + ' · Traslados</small><b>' + esc(d.gestor.nombre) + '</b></div>' +
    (perfil().admin ? '<button class="btn-ic" onclick="entrarAdmin()" aria-label="Administración">' + ICP.escudo + '</button>' : '') +
    '<button class="btn-ic" onclick="vistaYo()" aria-label="Mi cuenta">' + IC.campana + (aviso ? '<span class="punto"></span>' : '') + '</button></div>' +
    '<div class="chips"><button class="chip" onclick="vistaVehiculo(false)">' + esc(d.vehiculo || 'Sin vehículo') + ' · cambiar</button>' +
    '<span class="chip" id="estado" onclick="verCola()"><i class="' + (x.amb ? 'amb' : '') + '"></i>' + esc(x.t) + '</span></div></div>' +
    '<div class="cuerpo con-nav">';
  if (aviso) html += '<div class="aviso">' + esc(aviso.texto) + '</div>';
  html += tarjetaRutaBotican(true) + '<div class="dos-grandes"><button class="grande" onclick="vistaEscaner(\'recolectar\')"><span><b>Escanear</b><small>Recoger o entregar lo asignado</small></span></button>' +
    '<button class="grande linea" onclick="vistaLibre()"><span><b>+ Registrar entrega</b><small>Algo que no estaba en tu ruta</small></span></button></div>' +
    '<span class="etiqueta">Tu ruta de hoy · por parada</span>';
  if (!R.paradas.length) html += '<div class="vacio"><b>No llevas nada por entregar</b><span>Escanea lo que recojas; aparece aquí agrupado por la sucursal o área a donde va.</span></div>';
  R.paradas.forEach(function (p, n) {
    html += '<button class="parada" onclick="vistaParada(\'' + esc(p.k) + '\')"><span class="pnum">' + (n + 1) + '</span><span class="ptx"><b>' + esc(p.nombre) + '</b>' +
      (p.direccion ? '<small>' + esc(p.direccion) + '</small>' : '') + '<span class="pchips">' + chipsParada(p) + '</span></span></button>';
  });
  if (R.soloRecoger.length) {
    html += '<span class="etiqueta">Esperan a que pases por ellos</span>';
    R.soloRecoger.forEach(function (p) {
      html += '<details class="doc"><summary><span class="pchip a">RECOGER ' + p.recoger.length + '</span>' + esc(p.nombre) + '</summary><div class="cuerpo-doc">' +
        p.recoger.slice(0, 20).map(function (r) { return '<div><b class="mono">' + esc(r.folio) + '</b> · va a ' + esc(r.destino) + (r.contenido ? ' · ' + esc(r.contenido) : '') + '</div>'; }).join('') +
        (p.recoger.length > 20 ? '<div>… y ' + (p.recoger.length - 20) + ' más</div>' : '') + '</div></details>';
    });
  }
  html += bloqueLibresHoy();
  html += '<span class="etiqueta">Hoy</span><div class="hoy"><div><b style="color:var(--verde)">' + d.hoy.entregados + '</b><span>Entregados</span></div>' +
    '<div><b style="color:var(--azul)">' + d.hoy.recolectados + '</b><span>Recogidos</span></div><div><b style="color:var(--rojo)">' + d.hoy.noEntregados + '</b><span>No entregados</span></div></div></div>' + navFac('inicio');
  pintar(html);
}
function navFac(act) {
  var b = function (id, ic, t, fn) { return '<button class="' + (act === id ? 'act' : '') + '" onclick="' + fn + '">' + ic + t + '</button>'; };
  return '<nav class="nav" aria-label="Secciones">' + b('inicio', ICP.ruta, 'Ruta', 'vistaInicio()') + b('escaner', IC.scan.replace(/30/g, '22'), 'Escanear', "vistaEscaner('recolectar')") +
    b('lleva', IC.caja.replace(/24/g, '22'), 'Lo que llevo', 'vistaLleva()') + b('manual', IC.libro, 'Manual', 'vistaManual()') + '</nav>';
}

/* ---------- T2 · Llegué a una parada ---------- */
function vistaParada(k) {
  pararEscaner();
  var R = armarParadas(); S.paradas = R;
  var p = R.porK[k];
  if (!p) return vistaInicio();
  if (!S.parada || S.parada.k !== k) S.parada = { k: k, marcados: {}, foto: null, recibio: '', comentario: '', inicial: true };
  var st = S.parada;
  if (st.inicial) { p.items.forEach(function (x) { if (x.clase !== 'EFECTIVO' && x.clase !== 'IMSS') st.marcados[x.id] = true; }); st.inicial = false; }
  S.vista = 'parada';
  var n = R.paradas.indexOf(p);
  var normales = p.items.filter(function (x) { return x.clase !== 'EFECTIVO' && x.clase !== 'IMSS'; });
  var especiales = p.items.filter(function (x) { return x.clase === 'EFECTIVO' || x.clase === 'IMSS'; });
  var marc = normales.filter(function (x) { return st.marcados[x.id]; });
  var fotoObl = marc.some(function (x) { return x.tipo === 'PEDIDO'; }) && S.datos.reglas.exigirFotoEntrega;
  var html = '<div class="barra"><button class="volver" onclick="S.parada=null;vistaInicio()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>' + esc(p.nombre) + '</b><small>Parada ' + (n + 1) + ' de ' + R.paradas.length +
    (p.direccion ? ' · ' + esc(p.direccion) : '') + '</small></div>' +
    (p.maps || p.direccion ? '<a class="volver" aria-label="Mapa" href="' + esc(p.maps || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.direccion)) + '" target="_blank" rel="noopener">' + IC.mapa + '</a>' : '') + '</div><div class="cuerpo">';
  if (normales.length) {
    html += '<span class="etiqueta">Entregar aquí (' + normales.length + ')</span>';
    normales.forEach(function (x) {
      html += '<label class="marca"><input type="checkbox" ' + (st.marcados[x.id] ? 'checked' : '') + ' onchange="S.parada.marcados[\'' + esc(x.id) + '\']=this.checked;vistaParada(\'' + esc(k) + '\')">' +
        '<span class="tx"><b class="mono">' + esc(x.id) + (x.clase === 'DOCUMENTO' ? ' · DOCUMENTO' : '') + '</b><span>' + esc(x.texto || (x.tipo === 'PEDIDO' ? 'Pedido' : 'Traspaso')) + '</span></span>' +
        '<button class="b chico" onclick="event.preventDefault();noEntregueItem(\'' + x.fuente + '\',' + x.i + ')">No</button></label>';
    });
    html += '<div class="bloque"><div class="cab-b"><span class="paso' + (st.foto ? ' ok' : '') + '">1</span><b>Foto de la entrega</b>' + (fotoObl ? '<span class="req">obligatoria</span>' : '<span class="opc">opcional</span>') + '</div>' +
      (st.foto ? '<div class="previa"><img src="' + st.foto + '" alt="Foto tomada"><button onclick="tomarFoto()">Repetir</button></div>'
               : '<button class="zona-foto" onclick="tomarFoto()">' + IC.cam + '<b>Tomar foto</b><small>Una foto para ' + (marc.length === 1 ? 'el marcado' : 'los ' + marc.length) + '</small></button>') +
      '<label class="et" for="inRecParada">¿Quién recibió? <span class="opc">(opcional)</span></label><input class="campo" id="inRecParada" value="' + esc(st.recibio) + '" oninput="S.parada.recibio=this.value" autocomplete="off">' +
      '<label class="et" for="inNotaParada">Nota <span class="opc">(opcional)</span></label><input class="campo" id="inNotaParada" value="' + esc(st.comentario) + '" oninput="S.parada.comentario=this.value" autocomplete="off"></div>';
  }
  if (especiales.length) {
    html += '<span class="etiqueta">Se entregan aparte</span>';
    especiales.forEach(function (x) {
      var efe = x.clase === 'EFECTIVO';
      html += '<div class="marca ' + (efe ? 'efe' : 'imss') + '"><span class="tx"><b class="mono">' + esc(x.id) + ' · ' + (efe ? 'EFECTIVO' : 'IMSS') + '</b><span>' + esc(x.texto) + (efe && x.esperado ? ' · ' + dinero(x.esperado) : '') + '</span></span>' +
        '<button class="b verde chico" onclick="abrirCierreFac(\'' + x.fuente + '\',' + x.i + ')">' + (efe ? 'Entregar' : 'Con acuse') + '</button></div>';
    });
  }
  if (p.recoger.length) {
    html += '<span class="etiqueta">Recoger aquí (' + p.recoger.length + ')</span>';
    p.recoger.slice(0, 15).forEach(function (r) { html += '<div class="marca"><span class="tx"><b class="mono">' + esc(r.folio) + '</b><span>Va a ' + esc(r.destino) + '</span></span></div>'; });
    html += '<button class="btn linea" onclick="vistaEscaner(\'recolectar\')">Escanear lo que recojo</button>';
  }
  html += '</div>';
  if (normales.length) html += '<div class="pie"><button class="btn verde" ' + (marc.length ? '' : 'disabled') + ' onclick="entregarParada()">' + (marc.length ? 'Entregar ' + (marc.length === 1 ? 'el marcado' : 'los ' + marc.length + ' marcados') : 'Marca lo que entregas') + '</button></div>';
  pintar(html);
}
function noEntregueItem(fuente, i) {
  var x = fuente === 'pedido' ? S.datos.pedidos[i] : S.datos.lleva[i];
  S.volverParada = S.parada && S.parada.k;
  if (fuente === 'pedido') abrirCierre('PEDIDO', i, 'RETORNO');
  else abrirCierre(x.tipo === 'TRASPASO' ? 'TRASPASO' : 'RECOLECCION', i, 'NO_ENTREGADO');
}
function abrirCierreFac(fuente, i) {
  var x = fuente === 'pedido' ? S.datos.pedidos[i] : S.datos.lleva[i];
  S.volverParada = S.parada && S.parada.k;
  abrirCierre(fuente === 'pedido' ? 'PEDIDO' : (x.tipo === 'TRASPASO' ? 'TRASPASO' : 'RECOLECCION'), i, 'ENTREGADO');
}
function entregarParada() {
  var R = armarParadas(), st = S.parada, p = R.porK[st.k]; if (!p) return vistaInicio();
  var marc = p.items.filter(function (x) { return x.clase !== 'EFECTIVO' && x.clase !== 'IMSS' && st.marcados[x.id]; });
  if (!marc.length) return;
  if (marc.some(function (x) { return x.tipo === 'PEDIDO'; }) && S.datos.reglas.exigirFotoEntrega && !st.foto) return falla(errCod('CAP-04', 'Falta la foto (llevas un pedido).'));
  cargando('Guardando…');
  obtenerGPS().then(function (g) {
    var items = marc.map(function (x) {
      var o = x.fuente === 'pedido' ? S.datos.pedidos[x.i] : S.datos.lleva[x.i];
      return { idLocal: idLocal(), tipo: x.tipo, id: x.id, fila: o.fila || '', clase: x.clase };
    });
    var datos = { idLocal: idLocal(), items: items, resultado: 'ENTREGADO', foto: st.foto, sucursal: /^S:/.test(st.k) ? p.nombre : '', recibio: st.recibio, comentario: st.comentario,
                  lat: g.lat, lng: g.lng, horaCelular: horaTxt() };
    var etiqueta = p.nombre + ' · ' + items.length + ' entregado' + (items.length > 1 ? 's' : '');
    return encolar('cerrarVarios', datos, etiqueta).then(function () {
      var ids = {}; items.forEach(function (x) { ids[clave(x.id)] = true; });
      S.datos.pedidos = S.datos.pedidos.filter(function (x) { return !ids[clave(x.id)]; });
      S.datos.lleva = S.datos.lleva.filter(function (x) { return !ids[clave(x.codigo)]; });
      S.datos.hoy.entregados += items.length; DB.set('inicio', S.datos);
      quitarCargando(); sonido('entregado'); S.parada = null;
      var queda = armarParadas().porK[p.k];
      var volver = queda && (queda.items.length || queda.recoger.length) ? "vistaParada('" + esc(p.k) + "')" : 'vistaInicio()';
      var lista = marc.map(function (x) { return x.id + (x.texto ? ' · ' + x.texto : ''); });
      vistaWA({ titulo: 'Entregado en ' + p.nombre, sub: items.length + (items.length > 1 ? ' cosas · ya salieron de tu ruta' : ' · ya salió de tu ruta'), foto: st.foto, id: p.nombre, volver: volver,
                msg: msgEntrega({ id: p.nombre, detalle: '\n• ' + lista.join('\n• '), donde: p.nombre, recibio: st.recibio, nota: st.comentario }) });
      subirCola();
    });
  }).catch(function (e) { quitarCargando(); falla(e); });
}

/* ---------- T3 / T4 · bloques extra en la pantalla de cierre ---------- */
/* app.js llama a bloqueCierreFac(c, n) cuando la persona es de Facturación. Devuelve {html, n, saltar*}. */
function bloqueCierreFac(c, n) {
  var r = S.datos.reglas, html = '';
  if (c.resultado !== 'ENTREGADO') return null;
  if (c.clase === 'IMSS') {
    var areas = r.areasImss && r.areasImss.length ? r.areasImss : ['Farmacia', 'Almacén', 'Urgencias', 'Otro'];
    html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.areaImss ? ' ok' : '') + '">' + (n++) + '</span><label class="et" for="selArea" style="flex:1">Área o servicio donde se entregó</label></div>' +
      '<select class="campo" id="selArea" onchange="S.cierre.areaImss=this.value;guardarBorrador()"><option value="">— Elige el área —</option>' +
      areas.map(function (a) { return '<option' + (a === c.areaImss ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></div>';
    html += bloqueFoto(c, n++, 'Foto del acuse sellado', 'Que se vea el sello y la firma del IMSS', r.exigirAcuseImss !== false);
    html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.recibio ? ' ok' : '') + '">' + (n++) + '</span><label class="et" for="inRecibio" style="flex:1">Quién recibió</label><span class="opc">opcional</span></div>' +
      '<input class="campo" id="inRecibio" autocomplete="off" placeholder="Nombre" value="' + esc(c.recibio) + '" oninput="S.cierre.recibio=this.value;guardarBorrador()">' +
      '<input class="campo" id="inMatricula" autocomplete="off" placeholder="Matrícula o puesto" value="' + esc(c.matricula || '') + '" oninput="S.cierre.matricula=this.value;guardarBorrador()"></div>' +
      '<p class="nota">La foto se guarda con el número del pedido. En Operaciones queda el área en la nota.</p>';
    return { html: html, n: n, titulo: 'Entrega IMSS', boton: 'Finalizar entrega IMSS' };
  }
  if (c.tipo === 'PEDIDO') return null;                       // un pedido normal: la pantalla de siempre
  var cls = c.clase || 'TRASPASO';
  html += '<div class="segm" role="group" aria-label="¿Qué entregas?">' + [['TRASPASO', 'Traspaso'], ['EFECTIVO', 'Efectivo'], ['DOCUMENTO', 'Documentos'], ['INSUMO', 'Insumos']].map(function (o) {
    return '<button class="' + (cls === o[0] ? 'act' : '') + '" onclick="preservar();S.cierre.clase=\'' + o[0] + '\';pintarCierre()">' + o[1] + '</button>';
  }).join('') + '</div>';
  if (cls === 'EFECTIVO') {
    if (c.esperado) html += '<div class="sobre"><small>DICE EL SOBRE</small><b>' + dinero(c.esperado) + '</b><span>' + esc(c.direccion) + '</span></div>';
    var cuadra = c.monto === '' || c.monto == null || !c.esperado ? null : Math.abs(Number(String(c.monto).replace(/[$,\s]/g, '')) - c.esperado) < 0.01;
    html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.monto ? ' ok' : '') + '">' + (n++) + '</span><label class="et" for="inMonto" style="flex:1">¿Cuánto entregaste?</label><span class="opc">opcional</span></div>' +
      '<input class="campo grande-num" id="inMonto" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(c.monto || '') + '" onchange="preservar();pintarCierre()">' +
      (cuadra === true ? '<span class="ok-txt">Cuadra con el sobre</span>' : cuadra === false ? '<span class="req">No cuadra con el sobre: escribe una nota</span>' : '') + '</div>';
  }
  html += '<div class="bloque"><div class="cab-b"><span class="paso' + (c.sucursal ? ' ok' : '') + '">' + (n++) + '</span><label class="et" for="selSuc" style="flex:1">¿Dónde lo entregaste?</label><span class="opc">opcional</span></div>' +
    '<select class="campo" id="selSuc" onchange="S.cierre.sucursal=this.value;guardarBorrador()"><option value="">— Elige la sucursal —</option>' +
    (S.datos.sucursales || []).map(function (x) { return '<option' + (x.nombre === c.sucursal ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') +
    '<option' + (c.sucursal === 'Otro lugar' ? ' selected' : '') + '>Otro lugar</option></select>' +
    '<label class="et" for="inRecibio">¿Quién lo recibió? <span class="opc">(opcional)</span></label><input class="campo" id="inRecibio" autocomplete="off" value="' + esc(c.recibio) + '" oninput="S.cierre.recibio=this.value;guardarBorrador()">' +
    '<label class="et" for="inComent">Nota <span class="opc">(opcional)</span></label><textarea class="campo" id="inComent" rows="2">' + esc(c.comentario) + '</textarea></div>';
  html += bloqueFoto(c, n++, cls === 'EFECTIVO' ? 'Foto del sobre o del recibo' : 'Foto de la entrega', 'Dónde y a quién lo entregaste', false);
  if (cls === 'EFECTIVO') html += '<p class="nota">Si el monto no cuadra, se avisa a Administración con tu nota.</p>';
  return { html: html, n: n, titulo: cls === 'EFECTIVO' ? 'Entregar efectivo' : cls === 'DOCUMENTO' ? 'Entregar documentos' : cls === 'INSUMO' ? 'Entregar insumos' : 'Entregar traspaso',
           boton: cls === 'EFECTIVO' ? 'Entregué el efectivo' : 'Finalizar entrega' };
}
function bloqueFoto(c, n, titulo, ayuda, obl) {
  return '<div class="bloque"><div class="cab-b"><span class="paso' + (c.foto ? ' ok' : '') + '">' + n + '</span><b>' + titulo + '</b>' + (obl ? '<span class="req">obligatoria</span>' : '<span class="opc">opcional</span>') + '</div>' +
    (c.foto ? '<div class="previa"><img src="' + c.foto + '" alt="Foto tomada"><button onclick="tomarFoto()">Repetir</button></div>'
            : '<button class="zona-foto" onclick="tomarFoto()">' + IC.cam + '<b>Tomar foto</b><small>' + ayuda + '</small></button>') + '</div>';
}
/** Revisa lo propio de Facturación antes de mandar. Devuelve un error o null. */
function revisarCierreFac(c) {
  if (c.resultado !== 'ENTREGADO') return null;
  if (c.clase === 'IMSS' && S.datos.reglas.exigirAcuseImss !== false && !c.foto) return errCod('CAP-04', 'Falta la foto del acuse sellado.');
  if (c.clase === 'EFECTIVO' && c.monto !== '' && c.monto != null) {
    var m = Number(String(c.monto).replace(/[$,\s]/g, ''));
    if (!isFinite(m)) return errCod('CAP-09', 'El monto no es un número.');
    if (c.esperado && Math.abs(m - c.esperado) >= 0.01 && !String(c.comentario || '').trim()) return errCod('CAP-09', 'El monto no cuadra con el sobre: escribe una nota.');
  }
  return null;
}

/* =====================================================================
 *  ADMINISTRACIÓN (A1–A9)
 * ===================================================================== */

function adm(que, datos) { return srv('admin', Object.assign({ que: que }, datos || {})); }
function entrarAdmin() { S.enAdmin = true; aplicarTema(); admHoy(); }
function salirAdmin() { S.enAdmin = false; aplicarTema(); vistaInicio(); }
function navAdm(act) {
  var b = function (id, ic, t, fn) { return '<button class="' + (act === id ? 'act' : '') + '" onclick="' + fn + '">' + ic + t + '</button>'; };
  return '<nav class="nav nav5" aria-label="Administración">' + b('hoy', IC.casa, 'Hoy', 'admHoy()') + b('buscar', ICP.buscar, 'Buscar', 'admBuscar()') +
    b('equipo', ICP.gente, 'Equipo', 'admEquipo()') + b('veh', ICP.coche, 'Vehículos', 'admVehiculos()') + b('ajustes', ICP.engrane, 'Ajustes', 'admAjustes()') + '</nav>';
}
function barraAdm(titulo, sub, volver) {
  return '<div class="barra"><button class="volver" onclick="' + (volver || 'admHoy()') + '" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>' + esc(titulo) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></div>';
}
function admCargar(que, datos, pinta, sub) {
  pintar((sub || '') + '<div class="cuerpo"><div class="vacio"><b>Cargando…</b></div></div>');
  return adm(que, datos).then(pinta).catch(function (e) {
    pintar((sub || '') + '<div class="cuerpo"><div class="vacio"><b>No se pudo cargar</b><span>' + esc(e.message) + (e.codigo ? ' (' + e.codigo + ')' : '') + '</span>' +
      '<button class="btn" onclick="admHoy()">Reintentar</button><button class="btn linea" onclick="salirAdmin()">Volver a mi app</button></div></div>' + navAdm(''));
  });
}
function admHacer(que, datos, luego) {
  cargando('Guardando…');
  return adm(que, datos).then(function (r) {
    quitarCargando(); beep();
    if (r.aviso) {
      S.admOtraVez = function () { admHacer(que, Object.assign({}, datos, { aunAsi: true }), luego); };
      return modal('<h2>¿Seguro?</h2><p>' + esc(r.aviso) + '</p><button class="btn rojo" onclick="cerrarModal();S.admOtraVez()">Sí, hacerlo</button><button class="btn linea" onclick="cerrarModal()">Cancelar</button>');
    }
    if (r.temporal) modal('<h2>Contraseña temporal</h2><p>' + esc(r.mensaje) + '</p><div class="clave-grande mono">' + esc(r.temporal) + '</div><button class="btn" onclick="cerrarModal()">Ya la anoté</button>');
    else toast(r.mensaje || 'Listo', 'ok');
    if (luego) luego();
  }).catch(function (e) { quitarCargando(); falla(e); });
}
function hace(min) { return min == null ? '' : min < 1 ? 'ahora' : min < 60 ? 'hace ' + min + ' min' : 'hace ' + Math.round(min / 60) + ' h'; }
function iniciales(n) { return String(n || '?').split(/\s+/).map(function (x) { return x.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
function tagArea(a) { return a === 'FACTURACION' ? '<span class="tag fac">FACTURACIÓN</span>' : '<span class="tag a">GESTORÍA</span>'; }

/* ---------- A1 · Hoy ---------- */
function admHoy() {
  S.vista = 'adm'; S.enAdmin = true; aplicarTema(); pararEscaner();
  var f = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  var cab = function (r) {
    return '<div class="cab"><div class="cab-fila"><div class="cab-nombre"><small>ADMINISTRACIÓN</small><b>Hoy · ' + esc(f) + '</b></div>' +
      '<button class="chip" onclick="salirAdmin()">Mi app</button></div>' +
      (r ? '<div class="chips"><span class="chip"><i class="' + (r.robotSeg == null || r.robotSeg > 180 ? 'amb' : '') + '"></i>Robot ' + (r.robot ? 'hace ' + (r.robotSeg < 90 ? r.robotSeg + ' s' : Math.round(r.robotSeg / 60) + ' min') : 'sin datos') + '</span>' +
        (r.bloqueada ? '<span class="chip"><i class="amb"></i>EN MANTENIMIENTO</span>' : '') + '</div>' : '') + '</div>';
  };
  admCargar('hoy', {}, function (r) {
    S.admHoy = r;
    var t = r.totales;
    var html = cab(r) + '<div class="cuerpo con-nav"><div class="kpis">' +
      '<div><b style="color:var(--verde)">' + t.entregados + '</b><span>Entregados</span></div><div><b style="color:var(--azul2)">' + t.pendientes + '</b><span>Pendientes</span></div>' +
      '<div><b style="color:var(--rojo)">' + t.noEntregados + '</b><span>No entregados</span></div><button onclick="admProblemas()"><b style="color:var(--ambar)">' + t.porRevisar + '</b><span>Por revisar ›</span></button></div>';
    if (r.atender.length) {
      html += '<div class="bloque atender"><div class="cab-b"><b>Atender ahora</b></div>' + r.atender.map(function (a) {
        var fn = a.tipo === 'gestor' ? "admGestor('" + esc(a.numero) + "')" : a.tipo === 'cierre' ? "admBuscar('" + esc(a.id) + "')" : 'admProblemas()';
        return '<button class="fila-at" onclick="' + fn + '"><span class="pt"></span><span>' + esc(a.texto) + '</span></button>';
      }).join('') + '</div>';
    }
    ['GESTORIA', 'FACTURACION'].forEach(function (area) {
      var eq = r.equipo.filter(function (g) { return g.area === area; });
      if (!eq.length) return;
      html += '<span class="etiqueta">' + (area === 'FACTURACION' ? 'Facturación · traslados' : 'Gestoría · domicilio') + ' (' + eq.length + ')</span>';
      eq.forEach(function (g) { html += tarjetaGestor(g); });
    });
    pintar(html + '</div>' + navAdm('hoy'));
  }, cab(null));
}
function tarjetaGestor(g) {
  var estado = !g.entroHoy ? '<span class="tag r">' + (g.nuncaEntro ? 'NUNCA HA ENTRADO' : 'NO HA ENTRADO') + '</span>' : '<span class="tag v">ACTIVO</span>';
  return '<button class="persona" onclick="admGestor(\'' + esc(g.numero) + '\')"><span class="ini ' + (g.area === 'FACTURACION' ? 'fac' : '') + '">' + esc(iniciales(g.nombre)) + '</span>' +
    '<span class="tx"><b>' + esc(g.nombre) + (g.admin ? ' · admin' : '') + '</b><small>' + esc(g.vehiculo || 'Sin vehículo hoy') + ' · ' + g.entregados + ' entregados · ' + g.pendientes + ' pendientes' + (g.lleva ? ' · lleva ' + g.lleva : '') + '</small></span>' +
    '<span class="der">' + estado + '<small>' + esc(hace(g.minutos)) + '</small></span></button>';
}

/* ---------- A2 · Un gestor ---------- */
function admGestor(numero) {
  S.vista = 'adm';
  var sub = barraAdm(numero, '');
  admCargar('gestor', { numero: numero }, function (r) {
    S.admG = r;
    var g = r.gestor;
    var html = barraAdm(g.nombre + ' · ' + g.numero, esc((g.vehiculo ? g.vehiculo + ' desde ' + g.desde : 'Sin vehículo hoy') + (g.ultimoAcceso ? ' · último acceso ' + g.ultimoAcceso.slice(5, 16) : ''))) +
      '<div class="cuerpo con-nav">' + tagArea(g.area) +
      '<div class="kpis k3"><div><b style="color:var(--verde)">' + g.entregados + '</b><span>Entregados</span></div><div><b style="color:var(--azul2)">' + g.pendientes + '</b><span>Pendientes</span></div><div><b>' + g.lleva + '</b><span>Lleva</span></div></div>';
    if (r.pedidos.length) {
      html += '<span class="etiqueta">Pendientes</span>';
      r.pedidos.forEach(function (p, i) {
        html += '<div class="card"><div class="linea"><span class="id">' + esc(p.id) + '</span><span class="espacio"></span><span class="hora">' + esc(p.area) + '</span></div><div class="t1">' + esc(p.cliente) + '</div><div class="t2">' + esc(p.direccion) + '</div>' +
          '<div class="botones"><button class="b" onclick="admReasignar(' + i + ')">Reasignar</button><button class="b verde" onclick="admCerrarPor(' + i + ')">Cerrar por él</button><span></span></div></div>';
      });
    }
    if (r.lleva.length) {
      html += '<span class="etiqueta">Lo que lleva</span>';
      r.lleva.forEach(function (l) { html += '<div class="card"><div class="linea"><span class="id">' + esc(l.codigo) + '</span><span class="tag a">' + esc(l.tipo) + '</span><span class="espacio"></span><span class="hora">' + esc(String(l.desde).slice(5)) + '</span></div><div class="t2">Va a ' + esc(l.destino) + ' · ' + esc(l.contenido) + '</div></div>'; });
    }
    html += '<span class="etiqueta">Lo que hizo hoy</span>';
    if (!r.hizo.length) html += '<div class="vacio"><b>Todavía nada hoy</b></div>';
    r.hizo.forEach(function (h) {
      var color = h.resultado === 'ENTREGADO' ? 'v' : h.resultado === 'RECOLECTADO' ? 'a' : 'r';
      html += '<button class="hecho" ' + (h.idCierre ? 'onclick="admBuscar(\'' + esc(h.id) + '\')"' : 'disabled') + '><span class="tag ' + color + '">' + esc(h.resultado) + '</span><span class="tx"><b class="mono">' + esc(h.id) + '</b><small>' + esc(h.detalle || '') +
        (h.estado === 'ERROR' ? ' · NO LLEGÓ' : h.estado === 'CORREGIDO' || h.estado === 'ANULADO' ? ' · corregido' : '') + '</small></span><span class="hora">' + esc(h.hora) + '</span></button>';
    });
    html += '<div class="botones dos"><button class="b" onclick="admLiberar(\'' + esc(g.numero) + '\')" ' + (g.vehiculo ? '' : 'disabled') + '>Quitarle el vehículo</button><button class="b" onclick="admEquipo(\'' + esc(g.usuario) + '\')">Contraseña y acceso</button></div>';
    pintar(html + '</div>' + navAdm(''));
  }, sub);
}
function admLiberar(numero) {
  modal('<h2>¿Quitarle el vehículo de hoy?</h2><p>Queda libre para otro gestor. A él la app le pide elegir vehículo otra vez.</p>' +
    '<button class="btn" onclick="cerrarModal();admHacer(\'liberar\',{numero:\'' + esc(numero) + '\'},function(){admGestor(\'' + esc(numero) + '\')})">Quitárselo</button><button class="btn linea" onclick="cerrarModal()">Cancelar</button>');
}
/** La administradora cierra un pedido a nombre del gestor: la misma pantalla de entrega, con su nombre. */
function admCerrarPor(i) {
  var p = S.admG.pedidos[i], g = S.admG.gestor;
  S.volverA = 'adm'; S.admVolver = g.numero;
  S.cierre = { tipo: 'PEDIDO', resultado: 'ENTREGADO', id: p.id, fila: p.fila, cliente: p.cliente, direccion: p.direccion, exigeFirma: false, foto: null, firma: null,
               recibio: '', motivo: '', comentario: '', sucursal: '', comoNumero: g.numero, comoNombre: g.nombre };
  pintarCierre();
}

/* ---------- A3 · Buscar ---------- */
function admBuscar(q) {
  S.vista = 'adm';
  if (q != null) S.admQ = q;
  var html = barraAdm('Buscar', 'Pedido, folio de traspaso, cliente o gestor') + '<div class="cuerpo con-nav">' +
    '<form class="teclear" onsubmit="event.preventDefault();admBuscar($(\'inAdmQ\').value.trim())"><input class="campo" id="inAdmQ" placeholder="Ej. 16062, C-PV-0019, Torres" value="' + esc(S.admQ || '') + '" autocomplete="off"><button class="b" style="height:50px">Buscar</button></form><div id="admRes"></div></div>' + navAdm('buscar');
  pintar(html);
  if (!S.admQ) return;
  $('admRes').innerHTML = '<div class="vacio"><b>Buscando…</b></div>';
  adm('buscar', { q: S.admQ }).then(function (r) {
    S.admRes = r.resultados;
    if (!r.resultados.length) { $('admRes').innerHTML = '<div class="vacio"><b>Sin resultados</b><span>Revisa el número o busca por cliente.</span></div>'; return; }
    $('admRes').innerHTML = r.resultados.map(function (b, i) {
      var vivos = b.cierres.filter(function (c) { return c.estado !== 'ANULADO' && c.estado !== 'CORREGIDO'; });
      var ult = vivos[vivos.length - 1];
      var tag = ult ? '<span class="tag ' + (ult.resultado === 'ENTREGADO' ? 'v' : 'r') + '">' + esc(ult.resultado) + '</span>' : b.pedido ? '<span class="tag a">ABIERTO</span>' : '';
      return '<div class="card"><div class="linea"><span class="id">' + esc(b.id) + '</span>' + tag + '<span class="espacio"></span><span class="hora">' + esc(ult ? ult.hora : '') + '</span></div>' +
        (ult ? '<div class="t1">' + esc(ult.cliente || '') + '</div><div class="t2">' + esc(ult.gestor) + (ult.recibio ? ' · Recibió: ' + esc(ult.recibio) : '') + (ult.donde ? ' · ' + esc(ult.donde) : '') + (ult.monto ? ' · ' + dinero(ult.monto) : '') + '</div>'
             : b.pedido ? '<div class="t1">' + esc(b.pedido.cliente) + '</div><div class="t2">Lo lleva ' + esc(b.pedido.gestor) + '</div>' : '') +
        '<div class="historial">' + b.historial.map(function (h) { return '<div><span class="hora">' + esc(String(h.hora).slice(11, 16)) + '</span> ' + esc(h.texto) + '</div>'; }).join('') + '</div>' +
        '<div class="botones">' + (ult ? '<button class="b" onclick="admCorregir(' + i + ')">Corregir</button>' : '<span></span>') +
        (ult && ult.foto ? '<a class="b" href="' + esc(ult.foto) + '" target="_blank" rel="noopener">Ver foto</a>' : '<span></span>') +
        (ult && ult.gps ? '<a class="b" href="https://www.google.com/maps/search/?api=1&query=' + esc(ult.gps) + '" target="_blank" rel="noopener">' + IC.mapa + 'Dónde</a>' : '<span></span>') + '</div></div>';
    }).join('');
  }).catch(function (e) { $('admRes').innerHTML = '<div class="vacio"><b>' + esc(e.message) + '</b></div>'; });
}

/* ---------- A4 · Corregir ---------- */
function admCorregir(i) {
  var b = S.admRes[i], vivos = b.cierres.filter(function (c) { return c.estado !== 'ANULADO' && c.estado !== 'CORREGIDO'; });
  var c = vivos[vivos.length - 1]; if (!c) return;
  S.admC = { c: c, modo: 'resultado', resultado: '', motivo: '', recibio: c.recibio, comentario: '', porque: '' };
  pintarCorregir();
}
function pintarCorregir() {
  S.vista = 'adm';
  var x = S.admC, c = x.c, esPedido = c.tipo === 'PEDIDO';
  var ops = esPedido ? ['ENTREGADO', 'RETORNO', 'CANCELADO'] : ['ENTREGADO', 'NO_ENTREGADO'];
  var lista = (S.datos.motivos || {})[esPedido ? x.resultado : 'TRASPASO'] || [];
  var efecto = x.modo === 'datos' ? 'Se corrige en la app. En Operaciones quedan los datos anteriores (si hace falta, ajústalos en AC, AD o AI).'
    : !esPedido ? 'En el Sistema de Traspasos el folio vuelve a "en camino" y regresa a "Lo que llevo" de ' + c.gestor + (x.modo === 'resultado' && x.resultado === 'ENTREGADO' ? '; luego se marca entregado.' : '.')
    : c.estado !== 'ENVIADO' ? 'Todavía no llegaba a Operaciones: se cambia aquí y el robot pasa lo correcto.'
    : x.modo === 'reabrir' ? 'En Operaciones se quita la casilla de ' + c.resultado.toLowerCase() + ' y su fecha. El pedido vuelve a la lista de ' + c.gestor + ' en menos de 1 minuto.'
    : 'En Operaciones se quita la casilla de ' + c.resultado.toLowerCase() + ' y su fecha' + (x.resultado ? ' y se marca ' + x.resultado.toLowerCase() + ' con la fecha de ahora' + (x.motivo ? ' y el motivo en AC' : '') : '') + '. ESTATUS cambia solo.';
  var html = barraAdm('Corregir ' + c.id, 'Hoy dice: ' + esc(c.resultado.toLowerCase()) + ' por ' + esc(c.gestor) + ' ' + esc(c.hora), 'admBuscar()') + '<div class="cuerpo">' +
    '<div class="bloque"><div class="cab-b"><b>¿Qué quieres hacer?</b></div><div class="opciones">' +
    [['datos', 'Corregir quién recibió, motivo o nota'], ['resultado', 'Cambiar el resultado'], ['reabrir', 'Reabrir: vuelve a su lista para hacerlo bien']].map(function (o) {
      return '<button class="opcion' + (x.modo === o[0] ? ' sel' : '') + '" onclick="admCPres();S.admC.modo=\'' + o[0] + '\';pintarCorregir()"><span class="radio"></span><span>' + o[1] + '</span></button>';
    }).join('') + '</div></div>';
  if (x.modo === 'resultado') {
    html += '<div class="bloque"><div class="cab-b"><b>Nuevo resultado</b></div><div class="segm">' + ops.filter(function (o) { return o !== c.resultado; }).map(function (o) {
      return '<button class="' + (x.resultado === o ? 'act' : '') + '" onclick="admCPres();S.admC.resultado=\'' + o + '\';S.admC.motivo=\'\';pintarCorregir()">' + o.replace('_', ' ').toLowerCase() + '</button>';
    }).join('') + '</div>';
    if (x.resultado && x.resultado !== 'ENTREGADO') html += '<label class="et" for="selAdmMot">Motivo' + (esPedido ? '' : ' (opcional)') + '</label><select class="campo" id="selAdmMot" onchange="S.admC.motivo=this.value"><option value="">— Elige —</option>' +
      lista.map(function (m) { return '<option' + (m.motivo === x.motivo ? ' selected' : '') + '>' + esc(m.motivo) + '</option>'; }).join('') + '</select>';
    html += '</div>';
  }
  if (x.modo === 'datos') {
    html += '<div class="bloque"><label class="et" for="inAdmRec">Quién recibió</label><input class="campo" id="inAdmRec" value="' + esc(x.recibio) + '">' +
      '<label class="et" for="inAdmMot">Motivo</label><input class="campo" id="inAdmMot" value="' + esc(x.motivo || c.motivo) + '">' +
      '<label class="et" for="inAdmCom">Nota</label><textarea class="campo" id="inAdmCom" rows="2">' + esc(x.comentario || c.comentario) + '</textarea></div>';
  }
  html += '<div class="bloque"><div class="cab-b"><label class="et" for="inPorque" style="flex:1">¿Por qué lo corriges?</label><span class="req">obligatorio</span></div><textarea class="campo" id="inPorque" rows="2" placeholder="Ej. se equivocó de botón, me avisó por teléfono">' + esc(x.porque) + '</textarea></div>' +
    '<div class="aviso">Qué va a pasar: ' + esc(efecto) + ' Queda anotado que lo corregiste tú, a qué hora y por qué.</div></div>' +
    '<div class="pie"><button class="btn" onclick="admGuardarCorr()">Guardar corrección</button></div>';
  pintar(html);
}
function admCPres() {
  var x = S.admC; if (!x) return;
  if ($('inPorque')) x.porque = $('inPorque').value;
  if ($('inAdmRec')) x.recibio = $('inAdmRec').value;
  if ($('inAdmMot')) x.motivo = $('inAdmMot').value;
  if ($('inAdmCom')) x.comentario = $('inAdmCom').value;
  if ($('selAdmMot')) x.motivo = $('selAdmMot').value;
}
function admGuardarCorr() {
  admCPres();
  var x = S.admC;
  if (!x.porque.trim()) return falla(errCod('CAP-01', 'Escribe por qué lo corriges.'));
  if (x.modo === 'resultado' && !x.resultado) return falla(errCod('CAP-01', 'Elige el resultado nuevo.'));
  if (x.modo === 'resultado' && x.c.tipo === 'PEDIDO' && x.resultado !== 'ENTREGADO' && !x.motivo) return falla(errCod('CAP-05', 'Elige el motivo.'));
  var d = { idCierre: x.c.idCierre, modo: x.modo, resultado: x.resultado, porque: x.porque, motivo: x.motivo };
  if (x.modo === 'datos') { d.recibio = x.recibio; d.comentario = x.comentario; }
  admHacer('corregir', d, function () { admBuscar(); });
}

/* ---------- A5 · Reasignar ---------- */
function admReasignar(i) {
  var p = S.admG.pedidos[i], de = S.admG.gestor;
  S.vista = 'adm';
  pintar(barraAdm('Reasignar', esc(p.id + ' · ' + p.cliente), "admGestor('" + esc(de.numero) + "')") + '<div class="cuerpo"><div class="vacio"><b>Cargando equipo…</b></div></div>');
  var pinta = function (eq) {
    var html = barraAdm('Reasignar', esc(p.id + ' · ' + p.cliente), "admGestor('" + esc(de.numero) + "')") + '<div class="cuerpo"><p class="nota" style="text-align:left">Hoy la lleva <b>' + esc(de.nombre) + '</b>. ¿A quién se la pasas?</p>';
    eq.filter(function (g) { return g.numero !== de.numero && g.activo; }).forEach(function (g) {
      html += '<button class="persona" onclick="admConfirmarReasig(\'' + esc(p.id) + '\',\'' + esc(g.numero) + '\',\'' + esc(g.nombre) + '\',\'' + esc(de.nombre) + '\',\'' + esc(de.numero) + '\')"><span class="ini ' + (g.area === 'FACTURACION' ? 'fac' : '') + '">' + esc(iniciales(g.nombre)) + '</span>' +
        '<span class="tx"><b>' + esc(g.nombre) + '</b><small>' + esc(g.vehiculo || 'Sin vehículo') + ' · ' + g.pendientes + ' pendientes' + (g.entroHoy ? '' : ' · no ha entrado hoy') + '</small></span>' + tagArea(g.area) + '</button>';
    });
    pintar(html + '<div class="aviso">En Operaciones cambia la columna I (gestor). Al anterior le desaparece en menos de 1 minuto y al nuevo le suena como tarea nueva.</div></div>');
  };
  if (S.admHoy) pinta(S.admHoy.equipo); else adm('hoy').then(function (r) { S.admHoy = r; pinta(r.equipo); }).catch(falla);
}
function admConfirmarReasig(id, numero, nombre, deNombre, deNumero) {
  modal('<h2>¿Pasársela a ' + esc(nombre) + '?</h2><p><b class="mono">' + esc(id) + '</b> deja de estar con ' + esc(deNombre) + '.</p>' +
    '<button class="btn" onclick="cerrarModal();admHacer(\'reasignar\',{id:\'' + esc(id) + '\',a:\'' + esc(numero) + '\'},function(){admGestor(\'' + esc(deNumero) + '\')})">Pasársela a ' + esc(nombre) + '</button><button class="btn linea" onclick="cerrarModal()">Cancelar</button>');
}

/* ---------- A6 · Problemas ---------- */
function admProblemas() {
  S.vista = 'adm';
  var sub = barraAdm('Por revisar', 'Cada uno con su código de la guía de errores');
  admCargar('problemas', {}, function (r) {
    var html = barraAdm('Por revisar (' + (r.problemas.length + r.errores.length) + ')', 'Cada uno con su código de la guía de errores') + '<div class="cuerpo con-nav">';
    if (!r.problemas.length && !r.errores.length) html += '<div class="vacio"><b>Nada por revisar</b><span>Todo llegó a su sistema.</span></div>';
    r.errores.forEach(function (c) {
      html += '<div class="card"><div class="linea"><span class="tag r">NO LLEGÓ</span><span class="id">' + esc(c.id) + '</span><span class="espacio"></span><span class="hora">' + esc(c.fecha.slice(5)) + '</span></div>' +
        '<div class="t1">' + esc(c.gestor) + ' · ' + esc(c.resultado.toLowerCase()) + '</div><div class="t2">' + esc(c.error) + '</div>' +
        '<div class="botones"><button class="b verde" onclick="admHacer(\'resolver\',{idCierre:\'' + esc(c.idCierre) + '\',reintentar:true},admProblemas)">Reintentar</button>' +
        '<button class="b" onclick="admHacer(\'resolver\',{idCierre:\'' + esc(c.idCierre) + '\'},admProblemas)">Descartar</button><span></span></div></div>';
    });
    r.problemas.forEach(function (p) {
      html += '<div class="card"><div class="linea"><span class="tag n">' + esc(p.codigo) + '</span><span class="id">' + esc(p.numero) + '</span><span class="espacio"></span><span class="hora">' + esc(p.fecha.slice(5)) + '</span></div>' +
        '<div class="t2">' + esc(p.detalle) + '</div><div class="t2" style="color:var(--gris)">' + esc(p.quien) + '</div>' +
        '<button class="b verde" onclick="admResolver(\'' + esc(p.numero) + '\')">Marcar como resuelto</button></div>';
    });
    pintar(html + '<p class="nota">Los resueltos (' + r.resueltos + ') se guardan en APP_Problemas con quién y cuándo.</p></div>' + navAdm(''));
  }, sub);
}
function admResolver(numero) {
  modal('<h2>Resolver ' + esc(numero) + '</h2><label class="et" for="inNotaRes">¿Qué se hizo? <span class="opc">(opcional)</span></label><input class="campo" id="inNotaRes">' +
    '<button class="btn verde" onclick="var n=$(\'inNotaRes\').value;cerrarModal();admHacer(\'resolver\',{numero:\'' + esc(numero) + '\',nota:n},admProblemas)">Resuelto</button><button class="btn linea" onclick="cerrarModal()">Cancelar</button>');
}

/* ---------- A7 · Equipo y accesos ---------- */
function admEquipo(abrir) {
  S.vista = 'adm';
  var sub = barraAdm('Equipo y accesos', 'Lo mismo que APP_Usuarios, desde el celular');
  admCargar('equipo', {}, function (r) {
    S.admEq = r.equipo;
    var html = barraAdm('Equipo y accesos', 'Lo mismo que APP_Usuarios, desde el celular') + '<div class="cuerpo con-nav"><button class="btn linea" onclick="admNuevo()">+ Nuevo gestor</button>';
    [['GESTORIA', 'Gestoría · pedidos a domicilio y recolecciones'], ['FACTURACION', 'Facturación · traslados, efectivo, documentos, IMSS']].forEach(function (a) {
      var eq = r.equipo.filter(function (g) { return g.area === a[0] && g.activo; });
      html += '<span class="etiqueta">' + a[1] + ' (' + eq.length + ')</span>';
      if (!eq.length) html += '<div class="vacio"><span>Nadie en esta área.</span></div>';
      eq.forEach(function (g) { html += tarjetaEquipo(g, abrir); });
    });
    var bajas = r.equipo.filter(function (g) { return !g.activo; });
    if (bajas.length) { html += '<span class="etiqueta">De baja (' + bajas.length + ')</span>'; bajas.forEach(function (g) { html += tarjetaEquipo(g, abrir); }); }
    html += '<div class="aviso">El área decide qué app ve cada quien: <b>Gestoría</b> (azul) o <b>Facturación</b> (verde). También se cambia en APP_Usuarios, columna Area. Administradores: columna Rol = Administrador.</div>';
    pintar(html + '</div>' + navAdm('equipo'));
    if (abrir) { var el = document.getElementById('eq_' + clave(abrir)); if (el) el.scrollIntoView({ block: 'center' }); }
  }, sub);
}
function tarjetaEquipo(g, abrir) {
  var u = esc(g.usuario), otra = g.area === 'FACTURACION' ? 'Gestoría' : 'Facturación';
  var estado = !g.activo ? '<span class="tag">DE BAJA</span>' : g.nuncaEntro ? '<span class="tag r">NUNCA HA ENTRADO</span>' : '<span class="tag v">ACTIVO</span>';
  return '<div class="card' + (clave(abrir) === clave(g.usuario) ? ' resalta' : '') + '" id="eq_' + clave(g.usuario) + '"><div class="linea"><b>' + esc(g.nombre) + ' · ' + esc(g.numero) + '</b>' + (g.admin ? '<span class="tag n">ADMIN</span>' : '') + '<span class="espacio"></span>' + estado + '</div>' +
    '<div class="t2">' + u + ' · ' + (g.nuncaEntro ? (g.debeCambiar ? 'tiene contraseña temporal' : 'no ha entrado') : 'último acceso ' + esc(String(g.ultimoAcceso).slice(5, 16))) + ' · en Operaciones: ' + esc(g.nombreOps) + '</div>' +
    (g.activo ? '<div class="botones"><button class="b ' + (g.area === 'FACTURACION' ? '' : 'verde') + '" onclick="admCambiarArea(\'' + u + '\',\'' + esc(g.nombre) + '\',\'' + otra + '\')">Pasar a ' + otra + '</button>' +
      '<button class="b" onclick="admClave(\'' + u + '\',\'' + esc(g.nombre) + '\')">Contraseña</button><button class="b" onclick="admMas(\'' + u + '\')">Más…</button></div>'
      : '<div class="botones"><button class="b verde" onclick="admHacer(\'equipoCambiar\',{usuario:\'' + u + '\',campo:\'activo\',valor:true},admEquipo)">Reactivar</button><span></span><span></span></div>') + '</div>';
}
function admCambiarArea(usuario, nombre, area) {
  modal('<h2>¿Pasar a ' + esc(nombre) + ' a ' + esc(area) + '?</h2><p>' + (area === 'Facturación' ? 'Su app cambia a verde: ruta por parada, efectivo, documentos e IMSS.' : 'Su app cambia a azul: pedidos a domicilio y recolecciones.') + ' Se nota en menos de 1 minuto con la app abierta.</p>' +
    '<button class="btn" onclick="cerrarModal();admHacer(\'equipoCambiar\',{usuario:\'' + esc(usuario) + '\',campo:\'area\',valor:\'' + esc(area) + '\'},function(){admEquipo(\'' + esc(usuario) + '\')})">Pasar a ' + esc(area) + '</button><button class="btn linea" onclick="cerrarModal()">Cancelar</button>');
}
function admClave(usuario, nombre) {
  modal('<h2>Contraseña de ' + esc(nombre) + '</h2><p>Cualquiera de las dos cierra su sesión en todos sus celulares.</p>' +
    '<button class="btn" onclick="cerrarModal();admHacer(\'equipoCambiar\',{usuario:\'' + esc(usuario) + '\',campo:\'clave\'})">Darle una temporal al azar</button>' +
    '<label class="et" for="inClaveAdm">O escribe una (mínimo 6)</label><input class="campo" id="inClaveAdm" autocomplete="off">' +
    '<label class="check"><input type="checkbox" id="chkDebe" checked> Que la cambie al entrar</label>' +
    '<button class="btn linea" onclick="var c=$(\'inClaveAdm\').value,d=$(\'chkDebe\').checked;if(c.length<6)return toast(\'Mínimo 6 caracteres\',\'err\');cerrarModal();admHacer(\'equipoCambiar\',{usuario:\'' + esc(usuario) + '\',campo:\'ponerClave\',valor:c,debeCambiar:d})">Poner esta</button>');
}
function admMas(usuario) {
  var g = S.admEq.filter(function (x) { return x.usuario === usuario; })[0]; if (!g) return;
  var u = esc(usuario);
  modal('<h2>' + esc(g.nombre) + '</h2>' +
    '<button class="btn linea" onclick="cerrarModal();admHacer(\'equipoCambiar\',{usuario:\'' + u + '\',campo:\'sesion\'},admEquipo)">Sacar sesión (celular perdido)</button>' +
    '<button class="btn linea" onclick="cerrarModal();admHacer(\'equipoCambiar\',{usuario:\'' + u + '\',campo:\'rol\',valor:\'' + (g.admin ? 'Gestor' : 'Administrador') + '\'},admEquipo)">' + (g.admin ? 'Quitarle administrador' : 'Hacerlo administrador') + '</button>' +
    '<label class="et" for="inOpsAdm">Nombre en Operaciones (columna I)</label><input class="campo" id="inOpsAdm" value="' + esc(g.nombreOps) + '">' +
    '<button class="btn linea" onclick="var v=$(\'inOpsAdm\').value;cerrarModal();admHacer(\'equipoCambiar\',{usuario:\'' + u + '\',campo:\'nombreOps\',valor:v},admEquipo)">Guardar nombre</button>' +
    '<button class="btn linea" style="color:var(--rojo)" onclick="cerrarModal();admHacer(\'equipoCambiar\',{usuario:\'' + u + '\',campo:\'activo\',valor:false},admEquipo)">Dar de baja (se conserva su historial)</button>');
}
function admNuevo() {
  modal('<h2>Nuevo gestor</h2><label class="et" for="nNom">Nombre para mostrar</label><input class="campo" id="nNom" placeholder="Ej. Jose Luis">' +
    '<label class="et" for="nOps">Nombre EXACTO en Operaciones (Datos, columna Gestores)</label><input class="campo" id="nOps">' +
    '<label class="et" for="nUsu">Usuario para entrar (sin espacios)</label><input class="campo" id="nUsu" autocapitalize="off">' +
    '<div class="segm" id="nArea"><button class="act" onclick="this.parentNode.querySelectorAll(\'button\').forEach(function(b){b.classList.remove(\'act\')});this.classList.add(\'act\')">Gestoría</button><button onclick="this.parentNode.querySelectorAll(\'button\').forEach(function(b){b.classList.remove(\'act\')});this.classList.add(\'act\')">Facturación</button></div>' +
    '<button class="btn" onclick="var a=document.querySelector(\'#nArea .act\').textContent;var d={nombre:$(\'nNom\').value,nombreOps:$(\'nOps\').value,usuario:$(\'nUsu\').value,area:a};cerrarModal();admHacer(\'alta\',d,admEquipo)">Dar de alta</button>');
}

/* ---------- A8 · Vehículos ---------- */
function admVehiculos() {
  S.vista = 'adm';
  var sub = barraAdm('Vehículos hoy', 'Quién trae cuál, cambios y lo que faltó en la revisión');
  admCargar('vehiculos', {}, function (r) {
    var html = sub + '<div class="cuerpo con-nav">';
    r.vehiculos.filter(function (v) { return v.activo; }).forEach(function (v) {
      html += '<div class="card"><div class="linea"><b>' + esc(v.nombre) + '</b><span class="tag">' + esc(v.tipo === 'MOTO' ? 'Moto' : v.tipo === 'NINGUNO' ? 'A pie' : 'Auto') + '</span><span class="espacio"></span>' +
        (v.enTaller ? '<span class="tag r">EN TALLER</span>' : v.quien ? '<span class="tag a">EN USO</span>' : '<span class="tag v">LIBRE</span>') + '</div>' +
        (v.quien ? '<div class="t1">' + esc(v.quien) + ' desde ' + esc(v.desde) + '</div>' : '') + (v.nota ? '<div class="t2">' + esc(v.nota) + '</div>' : '') +
        (v.tipo === 'NINGUNO' ? '' : '<div class="botones"><button class="b" onclick="admHacer(\'vehiculoCambiar\',{vehiculo:\'' + esc(v.nombre) + '\',enTaller:' + (!v.enTaller) + '},admVehiculos)">' + (v.enTaller ? 'Ya salió del taller' : 'Marcar en taller') + '</button>' +
          (v.quien ? '<button class="b" onclick="admHacer(\'liberar\',{numero:\'' + esc(v.numero) + '\'},admVehiculos)">Liberar</button>' : '<span></span>') + '<span></span></div>') + '</div>';
    });
    pintar(html + '<p class="nota">Al cambiar de vehículo a medio día, la app le pide el motivo al gestor y aquí lo ves.</p></div>' + navAdm('veh'));
  }, sub);
}

/* ---------- A9 · Ajustes ---------- */
function admAjustes() {
  S.vista = 'adm';
  var sub = barraAdm('Ajustes y reglas', 'Se aplican a todos en menos de 1 minuto');
  admCargar('ajustes', {}, function (r) {
    S.admAj = r;
    var a = r.ajustes, si = function (v) { return v === true || /^(true|si|sí|1|verdadero)$/i.test(String(v)); };
    var tog = function (k, t) { return '<label class="check sw"><span style="flex:1">' + t + '</span><input type="checkbox" ' + (si(a[k]) ? 'checked' : '') + ' onchange="admHacer(\'ajuste\',{clave:\'' + k + '\',valor:this.checked})"></label>'; };
    var html = sub + '<div class="cuerpo con-nav">' +
      '<div class="bloque"><div class="cab-b"><b>Pedidos a domicilio</b></div>' + tog('EXIGIR_FOTO_ENTREGA', 'Foto obligatoria al entregar') + tog('EXIGIR_FIRMA_ENTREGA', 'Firma obligatoria') +
      tog('EXIGIR_QUIEN_RECIBIO', 'Quién recibió obligatorio') + tog('EXIGIR_FOTO_NOENTREGA', 'Foto obligatoria al no entregar') + '</div>' +
      '<div class="bloque"><div class="cab-b"><b>Facturación · traslados</b></div>' + tog('EXIGIR_ACUSE_IMSS', 'Foto del acuse sellado obligatoria (IMSS)') +
      admTexto('AREAS_IMSS', 'Áreas del IMSS (separadas con | )', a) + admTexto('PALABRAS_EFECTIVO', 'Palabras que marcan efectivo', a) + '</div>' +
      '<details class="doc"><summary>Motivos de no entrega</summary><div class="cuerpo-doc">' + r.motivos.map(function (m) {
        return '<label class="check sw"><span style="flex:1"><small class="tag">' + esc(m.tipo) + '</small> ' + esc(m.motivo) + '</span><input type="checkbox" ' + (m.activo ? 'checked' : '') + ' onchange="admHacer(\'motivo\',{fila:' + m.fila + ',activo:this.checked})"></label>';
      }).join('') + '<div class="segm" id="mTipo"><button class="act" onclick="admSegm(this)">RETORNO</button><button onclick="admSegm(this)">CANCELADO</button><button onclick="admSegm(this)">TRASPASO</button></div>' +
      '<input class="campo" id="inMotNuevo" placeholder="Motivo nuevo"><button class="btn linea" onclick="admHacer(\'motivo\',{tipo:document.querySelector(\'#mTipo .act\').textContent,motivo:$(\'inMotNuevo\').value},admAjustes)">Agregar motivo</button></div></details>' +
      '<details class="doc"><summary>Mensaje de WhatsApp al entregar</summary><div class="cuerpo-doc">' + admTexto('WA_MSG_ENTREGADO', 'Usa {id} {cliente} {recibio} {gestor} {fecha} {hora}', a, true) + '</div></details>' +
      '<details class="doc"><summary>Sucursales y direcciones</summary><div class="cuerpo-doc">' + r.sucursales.map(function (s) {
        return '<label class="et" for="suc' + s.fila + '">' + esc(s.nombre) + (s.direccion ? '' : ' <span class="req">sin dirección</span>') + '</label><input class="campo" id="suc' + s.fila + '" value="' + esc(s.direccion) + '" onchange="admHacer(\'sucursal\',{fila:' + s.fila + ',direccion:this.value})">';
      }).join('') + '</div></details>' +
      '<details class="doc"><summary>Revisión antes de salir</summary><div class="cuerpo-doc">' + admTexto('CHECK_MOTO', 'Moto', a, true) + admTexto('CHECK_AUTO', 'Auto', a, true) + admTexto('MOTIVOS_CAMBIO_VEHICULO', 'Motivos para cambiar de vehículo', a, true) + '</div></details>' +
      '<div class="bloque peligro"><label class="check sw"><span style="flex:1"><b>Modo mantenimiento</b><br><small>Nadie entra mientras está prendido (tú sí)</small></span><input type="checkbox" ' + (si(a.APP_BLOQUEADA) ? 'checked' : '') + ' onchange="admHacer(\'ajuste\',{clave:\'APP_BLOQUEADA\',valor:this.checked})"></label></div>';
    pintar(html + '</div>' + navAdm('ajustes'));
  }, sub);
}
function admTexto(k, t, a, largo) {
  return '<label class="et" for="aj_' + k + '">' + esc(t) + '</label>' + (largo ? '<textarea class="campo" rows="3" id="aj_' + k + '" onchange="admHacer(\'ajuste\',{clave:\'' + k + '\',valor:this.value})">' + esc(String(a[k]).replace(/\\n/g, '\n')) + '</textarea>'
    : '<input class="campo" id="aj_' + k + '" value="' + esc(a[k]) + '" onchange="admHacer(\'ajuste\',{clave:\'' + k + '\',valor:this.value})">');
}
function admSegm(b) { b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.remove('act'); }); b.classList.add('act'); }


/* =====================================================================
 *  FACTURACIÓN · ENTREGA SIN ASIGNAR (T5–T7) y WhatsApp después de entregar
 * ===================================================================== */
/** "Registrado por ti hoy": lo usan Facturación (ruta) y Gestoría (inicio). */
function bloqueLibresHoy() {
  var libres = listaLibresHoy(), html = '';
  if (!libres.length) return '';
  html += '<span class="etiqueta">Registrado por ti hoy (sin asignar)</span>';
  libres.forEach(function (x, i) {
    html += '<button class="libre" onclick="waLibre(' + i + ')"><span class="tag n">' + esc(x.id) + '</span><span class="tx"><b>' + esc(x.detalle) + ' · ' + esc(x.donde) + '</b><small>' + esc(x.hora) +
      (x.recibio ? ' · Recibió ' + esc(x.recibio) : '') + (x.monto ? ' · ' + dinero(x.monto) : '') + (x.local ? ' · por subir' : '') + '</small></span><span class="wa-txt">WhatsApp</span></button>';
  });
  return html;
}
var QUE_LIBRE = ['Medicamento', 'Facturas', 'Documentos', 'Efectivo', 'Insumos', 'Otro'];

/** Lo registrado hoy: lo que ya está en el servidor + lo que sigue en la fila del celular. */
function listaLibresHoy() {
  var serv = (S.datos && S.datos.libresHoy) || [], vistos = {};
  serv.forEach(function (x) { vistos[x.id] = true; });
  var loc = S.cola.filter(function (c) { return c.accion === 'cerrar' && c.datos.tipo === 'LIBRE' && !vistos[c.datos.id]; }).map(function (c) {
    return { id: c.datos.id, que: c.datos.que, detalle: c.datos.que + (c.datos.detalle ? ' · ' + c.datos.detalle : ''), donde: c.datos.donde, recibio: c.datos.recibio,
             monto: c.datos.monto, hora: String(c.creado).slice(11, 16), local: true, foto: !!c.datos.foto };
  });
  return serv.concat(loc).concat((S.libresSubidos || []).filter(function (x) { return !vistos[x.id] && !loc.some(function (l) { return l.id === x.id; }); }));
}
function folioLibre() {
  var d = new Date(), mmdd = ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  var ini = iniciales(S.datos.gestor.nombre) || 'G';
  var n = listaLibresHoy().length + 1, f;
  do { f = 'E-' + mmdd + '-' + ini + n++; } while (listaLibresHoy().some(function (x) { return x.id === f; }));
  return f;
}
function vistaLibre() {
  pararEscaner();
  if (!S.libre) S.libre = { que: '', detalle: '', dondeTipo: 'IMSS', unidad: '', area: '', sucursal: '', otro: '', foto: null, recibio: '', matricula: '', pidio: '', monto: '', comentario: '' };
  S.vista = 'libre';
  var x = S.libre, r = S.datos.reglas || {};
  var areas = r.areasImss && r.areasImss.length ? r.areasImss : ['Farmacia', 'Almacén', 'Urgencias', 'Otro'];
  var nPed = (S.datos.pedidos || []).length;
  var html = '<div class="barra"><button class="volver" onclick="S.libre=null;vistaInicio()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>Registrar entrega</b><small>Algo que no estaba en tu ruta</small></div></div><div class="cuerpo">' +
    (nPed ? '<div class="aviso warn"><b>¿Es un pedido o TAREA que te asignaron?</b> Entrégalo desde <b>' + (esFac() ? 'tu ruta' : 'Pedidos a domicilio') + '</b> (tienes ' + nPed + '), así se marca en Operaciones. Esto es solo para lo que NO te asignaron.' +
      (esFac() ? '' : '<button class="b" style="margin-top:8px;width:100%" onclick="S.libre=null;vistaPedidos()">Ver mis pedidos</button>') + '</div>' : '') +
    '<div class="bloque"><div class="cab-b"><span class="paso' + (x.que ? ' ok' : '') + '">1</span><b>¿Qué entregaste?</b></div><div class="pildoras">' +
    QUE_LIBRE.map(function (q) { return '<button class="pildora' + (x.que === q ? ' sel' : '') + '" onclick="libPres();S.libre.que=\'' + q + '\';vistaLibre()">' + q + '</button>'; }).join('') + '</div>' +
    '<input class="campo" id="lbDet" placeholder="Detalle (ej. 3 cajas, receta 37F…)" value="' + esc(x.detalle) + '" autocomplete="off">' +
    (x.que === 'Efectivo' ? '<label class="et" for="lbMonto">Monto <span class="opc">(opcional)</span></label><input class="campo grande-num" id="lbMonto" inputmode="decimal" placeholder="0.00" value="' + esc(x.monto) + '" autocomplete="off">' : '') + '</div>' +
    '<div class="bloque"><div class="cab-b"><span class="paso' + (libDonde() ? ' ok' : '') + '">2</span><b>¿Dónde?</b></div><div class="segm">' +
    [['IMSS', 'IMSS'], ['SUCURSAL', 'Sucursal'], ['OTRO', 'Otro lugar']].map(function (o) { return '<button class="' + (x.dondeTipo === o[0] ? 'act' : '') + '" onclick="libPres();S.libre.dondeTipo=\'' + o[0] + '\';vistaLibre()">' + o[1] + '</button>'; }).join('') + '</div>' +
    (x.dondeTipo === 'IMSS' ? '<input class="campo" id="lbUni" placeholder="Unidad (ej. HGZ 32, UMF 7)" value="' + esc(x.unidad) + '" autocomplete="off">' +
        '<select class="campo" id="lbArea"><option value="">— Área —</option>' + areas.map(function (a) { return '<option' + (a === x.area ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select>'
     : x.dondeTipo === 'SUCURSAL' ? '<select class="campo" id="lbSuc"><option value="">— Elige la sucursal —</option>' + (S.datos.sucursales || []).map(function (sc) { return '<option' + (sc.nombre === x.sucursal ? ' selected' : '') + '>' + esc(sc.nombre) + '</option>'; }).join('') + '</select>'
     : '<input class="campo" id="lbOtro" placeholder="Dónde (ej. Notaría 12, Banco…)" value="' + esc(x.otro) + '" autocomplete="off">') + '</div>' +
    bloqueFoto(x, 3, 'Foto (acuse, sello o entrega)', 'Que se vea el sello o a quién se lo diste', false) +
    '<div class="bloque"><div class="cab-b"><span class="paso' + (x.recibio ? ' ok' : '') + '">4</span><b>¿Quién recibió?</b><span class="opc">opcional</span></div>' +
    '<div class="fila2"><input class="campo" id="lbRec" placeholder="Nombre" value="' + esc(x.recibio) + '" autocomplete="off"><input class="campo" id="lbMat" placeholder="Matrícula" value="' + esc(x.matricula) + '" autocomplete="off"></div>' +
    '<input class="campo" id="lbPidio" placeholder="¿Quién te lo pidió? (opcional)" value="' + esc(x.pidio) + '" autocomplete="off">' +
    '<input class="campo" id="lbNota" placeholder="Nota (opcional)" value="' + esc(x.comentario) + '" autocomplete="off"></div>' +
    '</div><div class="pie"><button class="btn verde" onclick="guardarLibre()">Guardar entrega</button></div>';
  pintar(html);
}
function libPres() {
  var x = S.libre; if (!x) return;
  var v = function (id) { return $(id) ? $(id).value : null; };
  [['lbDet', 'detalle'], ['lbMonto', 'monto'], ['lbUni', 'unidad'], ['lbArea', 'area'], ['lbSuc', 'sucursal'], ['lbOtro', 'otro'], ['lbRec', 'recibio'], ['lbMat', 'matricula'], ['lbPidio', 'pidio'], ['lbNota', 'comentario']]
    .forEach(function (k) { var y = v(k[0]); if (y != null) x[k[1]] = y.trim(); });
}
function libDonde() {
  var x = S.libre;
  if (x.dondeTipo === 'IMSS') return x.unidad || x.area ? 'IMSS ' + [x.unidad, x.area].filter(String).join(' · ') : '';
  if (x.dondeTipo === 'SUCURSAL') return x.sucursal;
  return x.otro;
}
/** ¿Lo que escribió es uno de sus pedidos asignados? Devuelve el índice o -1. */
function pedidoEnTexto(x) {
  var txt = clave([x.detalle, x.comentario, x.pidio, x.otro].join(' '));
  if (!txt) return -1;
  return (S.datos.pedidos || []).findIndex(function (p) { var k = clave(p.id); return k.length >= 4 && txt.indexOf(k) >= 0; });
}
function entregarComoPedido(j) {
  var x = S.libre; cerrarModal();
  S.libre = null; abrirCierre('PEDIDO', j, 'ENTREGADO');
  if (x) { S.cierre.foto = x.foto; S.cierre.recibio = x.recibio; S.cierre.comentario = x.comentario; pintarCierre(); }
}
function guardarLibre() {
  libPres();
  var x = S.libre;
  var j = x.noEsPedido ? -1 : pedidoEnTexto(x);
  if (j >= 0) {
    var ped = S.datos.pedidos[j];
    return modal('<h2>Ese es tu pedido ' + esc(ped.id) + '</h2><p>' + esc(ped.cliente) + ' · ' + esc(ped.direccion) + '</p>' +
      '<div class="aviso">Entrégalo como pedido para que se marque en Operaciones. Se pasa tu foto y quién recibió.</div>' +
      '<button class="btn verde" onclick="entregarComoPedido(' + j + ')">Entregarlo como pedido</button>' +
      '<button class="btn linea" onclick="cerrarModal();S.libre.noEsPedido=true;guardarLibre()">No, es otra cosa</button>');
  }
  if (!x.que) return falla(errCod('CAP-01', 'Elige qué entregaste.'));
  var donde = libDonde();
  if (!donde) return falla(errCod('CAP-01', 'Escribe dónde lo entregaste.'));
  if (x.que === 'Efectivo' && x.monto && !isFinite(Number(String(x.monto).replace(/[$,\s]/g, '')))) return falla(errCod('CAP-09', 'El monto no es un número.'));
  cargando('Guardando…');
  obtenerGPS().then(function (g) {
    var folio = folioLibre();
    var datos = { idLocal: idLocal(), tipo: 'LIBRE', id: folio, resultado: 'ENTREGADO', que: x.que, detalle: x.detalle, donde: donde, areaImss: x.dondeTipo === 'IMSS' ? x.area : '',
                  foto: x.foto, recibio: x.recibio, matricula: x.matricula, pidio: x.pidio, comentario: x.comentario, monto: x.que === 'Efectivo' ? x.monto : '',
                  lat: g.lat, lng: g.lng, horaCelular: horaTxt() };
    return encolar('cerrar', datos, folio + ' · ' + x.que + ' · ' + donde).then(function () {
      S.libresSubidos = (S.libresSubidos || []).concat([{ id: folio, que: x.que, detalle: x.que + (x.detalle ? ' · ' + x.detalle : ''), donde: donde, recibio: x.recibio, monto: datos.monto, hora: horaTxt().slice(11, 16), foto: !!x.foto }]);
      S.datos.hoy.entregados++; DB.set('inicio', S.datos);
      quitarCargando(); sonido('entregado');
      var o = { id: folio, que: x.que, detalle: x.detalle, donde: donde, recibio: x.recibio, matricula: x.matricula, monto: datos.monto, pidio: x.pidio, foto: x.foto, nota: x.comentario };
      S.libre = null; subirCola();
      vistaWA({ titulo: 'Entrega guardada', sub: folio + ' · ya la ve Administración', msg: msgEntrega(o), foto: o.foto, id: folio, volver: 'vistaInicio()' });
    });
  }).catch(function (e) { quitarCargando(); falla(e); });
}
/* El mensaje de WhatsApp con lo capturado. */
function msgEntrega(o) {
  var ahora = new Date(), L = [(o.encabezado || 'ENTREGA REALIZADA') + ' · ' + o.id];
  if (o.de || o.a) L.push('De: ' + (o.de || '—') + '  →  A: ' + (o.a || '—'));
  if (o.motivo) L.push('Motivo: ' + o.motivo);
  if (o.que || o.detalle) L.push('Qué: ' + [o.que, o.detalle].filter(Boolean).join(' · '));
  if (o.monto) L.push('Monto: ' + dinero(Number(String(o.monto).replace(/[$,\s]/g, ''))));
  if (o.donde) L.push('Dónde: ' + o.donde);
  if (o.recibio || o.matricula) L.push('Recibió: ' + (o.recibio || '—') + (o.matricula ? ' (Mat. ' + o.matricula + ')' : ''));
  if (o.pidio) L.push('Lo pidió: ' + o.pidio);
  if (o.nota) L.push('Nota: ' + o.nota);
  L.push((o.quien || 'Entregó') + ': ' + S.datos.gestor.nombre);
  L.push(ahora.toLocaleDateString('es-MX') + ' · ' + ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
  return L.join('\n');
}
/** Pantalla "listo" con el botón de WhatsApp (entregas de Facturación). */
function vistaWA(o) {
  S.vista = 'listo'; S.wa = { msg: o.msg, foto: o.foto, id: o.id }; S.waOpts = o;
  pintar('<div class="listo"><div class="verde-top"><span class="palomita">' + IC.palomita + '</span><b>' + esc(o.titulo) + '</b><span>' + esc(o.sub) + '</span></div>' +
    '<div class="cuerpo"><b>¿Avisar por WhatsApp?</b><p class="nota" style="text-align:left;margin:0">Tú eliges a quién: a quien te lo pidió, al cliente o al grupo.</p>' +
    '<div class="wa-burbuja"><div>' + (o.foto ? '<img src="' + o.foto + '" alt="">' : '') + '<pre>' + esc(o.msg) + '</pre></div></div>' +
    (o.foto ? '<label class="check"><input type="checkbox" id="waFoto" checked> Incluir la foto</label><button class="b" onclick="tomarFoto()">Cambiar la foto</button>'
            : '<button class="b" onclick="tomarFoto()">' + IC.cam + ' Agregar una foto</button>') + '</div>' +
    '<div class="pie"><button class="btn wa" onclick="mandarWA()">Enviar por WhatsApp</button><button class="btn linea" onclick="' + o.volver + '">Ahora no · volver</button></div></div>');
}
function waLibre(i) {
  var x = listaLibresHoy()[i]; if (!x) return;
  vistaWA({ titulo: 'Entrega ' + x.id, sub: x.hora + (x.local ? ' · por subir' : ' · guardada'), id: x.id, foto: null, volver: 'vistaInicio()',
            msg: msgEntrega({ id: x.id, detalle: x.detalle, donde: x.donde, recibio: x.recibio, monto: x.monto }) });
}
/** Después de una entrega asignada (IMSS, efectivo, traspaso): mensaje con lo que se capturó. */
function waDespuesDeCierre(c, volver) {
  if (c.resultado !== 'ENTREGADO') {
    var t = { RETORNO: 'RETORNO', CANCELADO: 'CANCELADO', NO_ENTREGADO: 'NO ENTREGADO' }[c.resultado] || c.resultado;
    return vistaWA({ titulo: t.charAt(0) + t.slice(1).toLowerCase() + ' registrado', sub: c.id + ' · guardado', foto: c.foto, id: c.id, volver: volver,
      msg: msgEntrega({ encabezado: t, id: c.id, detalle: c.cliente + (c.direccion && c.direccion !== c.cliente ? ' · ' + c.direccion : ''), motivo: c.motivo, nota: c.comentario, quien: 'Gestor' }) });
  }
  var o = { id: c.id, que: c.clase === 'IMSS' ? 'Entrega IMSS' : c.clase ? ({ EFECTIVO: 'Efectivo', DOCUMENTO: 'Documentos', INSUMO: 'Insumos', TRASPASO: 'Traspaso' })[c.clase] || '' : (c.tipo === 'PEDIDO' ? 'Pedido' : 'Traspaso'),
            detalle: c.clase === 'IMSS' ? c.cliente : c.direccion, donde: c.clase === 'IMSS' ? [c.cliente, c.areaImss].filter(Boolean).join(' · ') : (c.sucursal || c.cliente),
            recibio: c.recibio, matricula: c.matricula, monto: c.clase === 'EFECTIVO' ? c.monto : '', nota: c.comentario, foto: c.foto };
  vistaWA({ titulo: 'Entrega registrada', sub: c.id + ' · ya salió de tu ruta', msg: msgEntrega(o), foto: c.foto, id: c.id, volver: volver });
}


/* ---------- WhatsApp de lo que recoges y de lo que llevas (todos los perfiles) ---------- */
function msgRecoleccion(lista) {
  var ahora = new Date(), L = [lista.length === 1 ? 'RECOLECTADO · ' + lista[0].codigo : 'RECOLECTÉ ' + lista.length];
  lista.forEach(function (l) {
    if (lista.length > 1) L.push('• ' + l.codigo);
    if (l.origen || l.destino) L.push((lista.length > 1 ? '   ' : '') + 'De: ' + (l.origen || '—') + '  →  A: ' + (l.destino || '—'));
    if (l.contenido) L.push((lista.length > 1 ? '   ' : '') + 'Qué: ' + l.contenido);
  });
  L.push('Lo lleva: ' + S.datos.gestor.nombre + (S.datos.vehiculo ? ' · ' + S.datos.vehiculo : ''));
  L.push(ahora.toLocaleDateString('es-MX') + ' · ' + ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
  return L.join('\n');
}
function waRecoleccion(lista, volver) {
  vistaWA({ titulo: lista.length === 1 ? 'Recolectado' : lista.length + ' recolectados', sub: 'Ya sale en el rastreo', foto: null, id: lista[0].codigo, volver: volver || 'vistaInicio()', msg: msgRecoleccion(lista) });
}
function waLeido(i) { var l = S.leidos[i]; if (l) { pararEscaner(); waRecoleccion([l], "vistaEscaner('recolectar')"); } }
function waLleva(i) {
  var l = S.datos.lleva[i]; if (!l) return;
  waRecoleccion([{ codigo: l.codigo, origen: l.origen, destino: l.destino + (l.destinoDireccion ? ' (' + l.destinoDireccion + ')' : ''), contenido: l.contenido }], 'vistaLleva()');
}


/* =====================================================================
 *  RECOLECCIÓN BOTICAN (reglas de Logística del 7-nov-2026)
 *  Ruta del momento (pestaña Rutas), pedidos por fecha compromiso con semáforo,
 *  y avisos al escanear un pedido ya recolectado o que no existe.
 * ===================================================================== */
var SEM = { rojo: ['#B42318', 'VENCIDO', 'Venció'], amarillo: ['#E0A100', 'VENCE PRONTO', 'Vence'], verde: ['#1E7E45', 'EN TIEMPO', 'Vence'], gris: ['#A0A8B6', 'EN ELABORACIÓN', ''] };
function puntoSem(s) { return '<span class="sem" style="background:' + SEM[s][0] + '"></span>'; }

/** Tarjeta "Ruta del momento" del inicio. compacta = para la pantalla de Facturación. */
function tarjetaRutaBotican(compacta) {
  var b = S.datos && S.datos.botican;
  if (!b) return '';
  if (b.error) return '<div class="aviso warn">' + esc(b.error) + '</div>';
  var lista = (b.porRecolectar || []).filter(function (p) { return p.enRuta; });
  var html = '<button class="ruta-bot" onclick="vistaPendientes()">';
  if (b.ruta) {
    html += '<span class="rb-fila"><span class="rb-tag">RUTA DEL MOMENTO</span><small>' + (b.ruta.enMin > 0 ? 'sale en ' + b.ruta.enMin + ' min' : 'saliendo') + '</small></span>' +
      '<b class="rb-tit">Ruta ' + esc(b.ruta.hora) + ' · ' + esc(String(b.ruta.sucursales).replace(/\s*·\s*/g, ', ')) + '</b>' +
      (b.ruta.extra ? '<small class="rb-extra">Hoy también: <b>' + esc(b.ruta.extra) + '</b></small>' : '');
  } else {
    html += '<span class="rb-fila"><span class="rb-tag gris">SIN RUTA</span></span><b class="rb-tit">' + (b.habilHoy ? 'Ya salieron todas las rutas de hoy' : 'Hoy no hay ruta' + (b.feriadoHoy ? ' · ' + esc(b.feriadoHoy) : ' (día inhábil)')) + '</b>';
  }
  if (!compacta) {
    html += '<span class="rb-sub">POR RECOLECTAR · BOTICAN (' + lista.length + ')</span>';
    lista.slice(0, 3).forEach(function (p) {
      html += '<span class="rb-ped">' + puntoSem(p.semaforo) + '<b class="mono">' + esc(p.id) + '</b><span>' + SEM[p.semaforo][2] + ': ' + esc(p.vence) + '</span></span>';
    });
    if (!lista.length) html += '<span class="rb-ped"><span>Nada pendiente de recoger por ahora.</span></span>';
  } else if (lista.length) {
    var rojos = lista.filter(function (p) { return p.semaforo === 'rojo'; }).length;
    html += '<span class="rb-ped">' + puntoSem(rojos ? 'rojo' : lista[0].semaforo) + '<span>' + lista.length + ' pedido(s) BOTICAN por recolectar' + (rojos ? ' · ' + rojos + ' vencido(s)' : '') + '</span></span>';
  }
  var pd = S.datos.pendientes, misVig = pd ? pd.mios.filter(function (x) { return !x.cerrado; }).length : 0;
  return html + '<span class="rb-mas">Pendientes por recoger' + (pd ? ' (' + pd.total + ')' : '') + ' ›' + (misVig ? ' · voy por ' + misVig : '') + '</span></button>';
}

/** R2 · Por recolectar, ordenados por fecha compromiso. */
function vistaBotican() {
  S.vista = 'botican'; pararEscaner();
  var b = (S.datos && S.datos.botican) || {}, lista = b.porRecolectar || [];
  var cuenta = { rojo: 0, amarillo: 0, verde: 0 };
  lista.forEach(function (p) { cuenta[p.semaforo]++; });
  var html = '<div class="barra"><button class="volver" onclick="vistaInicio()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>Por recolectar · BOTICAN</b><small>Los que vencen primero, arriba</small></div></div><div class="cuerpo con-nav">';
  if (b.ruta) html += '<div class="aviso">Ruta del momento: <b>' + esc(b.ruta.hora) + ' · ' + esc(b.ruta.sucursales) + '</b>' + (b.ruta.extra ? ' · hoy también ' + esc(b.ruta.extra) : '') + '</div>';
  html += '<div class="sem-res">' + (cuenta.rojo ? '<span class="sr r">● ' + cuenta.rojo + ' vencido' + (cuenta.rojo > 1 ? 's' : '') + '</span>' : '') +
    (cuenta.amarillo ? '<span class="sr a">● ' + cuenta.amarillo + ' vence pronto</span>' : '') + (cuenta.verde ? '<span class="sr v">● ' + cuenta.verde + ' en tiempo</span>' : '') +
    ((b.elaboracion || []).length ? '<span class="sr g">● ' + b.elaboracion.length + ' en elaboración</span>' : '') + '</div>';
  if (!lista.length) html += '<div class="vacio"><b>Nada por recolectar</b><span>Cuando Producción marque un pedido como listo, aparece aquí con su fecha compromiso.</span></div>';
  lista.forEach(function (p) {
    html += '<div class="ped-bot" style="border-left-color:' + SEM[p.semaforo][0] + '"><div class="pb-fila"><b class="mono">' + esc(p.id) + '</b><span class="pb-tag" style="color:' + SEM[p.semaforo][0] + '">' + SEM[p.semaforo][1] + '</span><span class="espacio"></span><small>' + esc(p.sucTxt) + (p.enRuta ? '' : ' · hoy no') + '</small></div>' +
      '<b class="pb-vence"' + (p.semaforo === 'rojo' ? ' style="color:var(--rojo)"' : '') + '>' + SEM[p.semaforo][2] + ': ' + esc(p.vence) + '</b><small>' + esc(p.explicacion) + (p.area ? ' · ' + esc(p.area) : '') + '</small></div>';
  });
  (b.elaboracion || []).forEach(function (p) {
    html += '<div class="ped-bot gris" style="border-left-color:' + SEM.gris[0] + '"><div class="pb-fila"><b class="mono">' + esc(p.id) + '</b><span class="pb-tag" style="color:var(--gris)">EN ELABORACIÓN</span></div><small>Producción aún no lo marca listo</small></div>';
  });
  html += '<p class="nota">Horarios y feriados: pestañas Rutas y Feriados de LOGISTICA BOTICAN 2026' + (b.proxFeriado ? ' · próximo feriado: ' + esc(b.proxFeriado) : '') + '.</p>';
  pintar(html + '</div><div class="pie con-nav-pie"><button class="btn" onclick="vistaEscaner(\'recolectar\')">Escanear lo que recojo</button></div>' + nav(''));
}

/** R3 / R4 · Aviso al escanear: ya lo recolectó alguien, o no existe. */
function avisoRecoleccion(l) {
  var r = l && l.aviso; if (!r) return;
  var i = S.leidos.indexOf(l);
  if (r.apartadoPor) {
    return modal('<h2>🔒 ' + esc(r.codigo) + ' lo apartó ' + esc(r.apartadoPor) + '</h2>' +
      '<div class="tabla-mini"><div><span>Desde</span><b>' + esc(r.desde) + '</b></div><div><span>Se libera</span><span>' + esc(r.hasta) + ' si no lo escanea</span></div></div>' +
      '<p>Si ya lo traes tú en la mano (por ejemplo, ' + esc(r.apartadoPor) + ' no llegó), regístralo: a ' + esc(r.apartadoPor) + ' le avisa la app y a Administración le queda anotado.</p>' +
      '<button class="btn" onclick="cerrarModal();decidirLeido(' + i + ',\'dejar\')">Dejarlo · que lo recoja ' + esc(r.apartadoPor) + '</button>' +
      '<button class="btn linea" onclick="cerrarModal();decidirLeido(' + i + ',\'tomar\')">Ya lo traigo yo · registrar</button>');
  }
  if (r.duplicado) {
    modal('<h2>' + esc(r.codigo) + ' ya fue recolectado</h2>' +
      '<div class="tabla-mini"><div><span>Lo recogió</span><b>' + esc(r.quien) + '</b></div><div><span>Cuándo</span><b>' + esc(fechaBonita(r.cuando)) + '</b></div><div><span>Estado</span><span>' + esc(estadoRec(r.estado)) + '</span></div></div>' +
      '<p>Si es el mismo paquete, no lo registres otra vez. Si es <b>otro bulto del mismo pedido</b>, regístralo y queda anotado como "bulto adicional".</p>' +
      '<button class="btn" onclick="cerrarModal();decidirLeido(' + i + ',\'no\')">No registrar · es el mismo</button>' +
      '<button class="btn linea" onclick="cerrarModal();decidirLeido(' + i + ',\'bulto\')">Es otro bulto · registrar</button>');
  } else {
    modal('<h2>No encuentro el ' + esc(r.codigo) + '</h2>' +
      '<div class="tabla-mini"><div><span style="color:var(--rojo)">✕</span><span>No está en <b>Envios</b> de LOGISTICA BOTICAN 2026</span></div><div><span style="color:var(--rojo)">✕</span><span>No está en <b>Operaciones</b></span></div>' +
      (r.sugerencia ? '<div><span>¿Quisiste decir?</span><b class="mono">' + esc(r.sugerencia) + '</b></div>' : '') + '</div>' +
      '<p>Revisa el número en la etiqueta. Si de verdad no existe, pregunta en Producción antes de llevártelo.</p>' +
      '<button class="btn" onclick="cerrarModal();decidirLeido(' + i + ',\'corregir\')">' + (r.sugerencia ? 'Usar ' + esc(r.sugerencia) : 'Corregir el número') + '</button>' +
      '<button class="btn linea" onclick="cerrarModal();decidirLeido(' + i + ',\'forzar\')">Registrar de todos modos</button>');
  }
}
function decidirLeido(i, que) {
  var l = S.leidos[i]; if (!l) return;
  var r = l.aviso;
  if (que === 'dejar') { l.aviso = null; l.estado = 'mal'; l.texto = 'No se registró: lo va a recoger ' + r.apartadoPor; return pintarLeidos(); }
  if (que === 'tomar') { l.aviso = null; l.estado = 'esp'; l.texto = 'Registrando…'; pintarLeidos(); return mandarRecoleccion([{ codigo: r.codigo, tomar: true }], [l]); }
  if (que === 'no') { l.aviso = null; l.estado = 'mal'; l.texto = 'No se registró: ya lo había recolectado ' + r.quien; return pintarLeidos(); }
  if (que === 'corregir') {
    S.leidos.splice(i, 1); pintarLeidos();
    if (r.sugerencia) return alLeer(r.sugerencia);
    var c = $('inCodigo'); if (c) { c.value = r.codigo; c.focus(); c.select(); }
    return;
  }
  l.aviso = null; l.estado = 'esp'; l.texto = 'Registrando…'; pintarLeidos();
  mandarRecoleccion([{ codigo: r.codigo, forzar: true, bulto: que === 'bulto' }], [l]);
}
function fechaBonita(t) {
  var m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(String(t || '')); if (!m) return t;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()] + ' ' + (+m[3]) + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+m[2] - 1] + ', ' + m[4] + ':' + m[5];
}
function estadoRec(e) {
  e = String(e || '');
  return /ENTREGADO/.test(e) ? 'Ya lo entregó' : /EN RUTA/.test(e) ? 'Lo trae en este momento' : /CERRADO/.test(e) ? 'Ya llegó a su destino' : e.toLowerCase();
}


/* =====================================================================
 *  PENDIENTES POR RECOGER · "Lo recojo yo" (apartar) · ¿Es este?
 *  Apartar NO registra la recolección: eso solo pasa al escanear la etiqueta.
 * ===================================================================== */
var TIPO_PEND = { BOTICAN: ['BOTICAN', '#6B3FA0', '#F1EAFB'], FADERMEX: ['FADERMEX', '#9A5400', '#FFF1DE'], TRASPASO: ['TRASPASO', '#0B3D91', '#E2EAF8'] };
function chipTipo(t) { var x = TIPO_PEND[t] || [t, '#3D4757', '#EEF1F6']; return '<span class="pchip-t" style="color:' + x[1] + ';background:' + x[2] + '">' + x[0] + '</span>'; }

function vistaPendientes() {
  S.vista = 'pendientes'; pararEscaner();
  var pd = (S.datos && S.datos.pendientes) || { grupos: [], total: 0, mios: [] }, b = S.datos.botican || {};
  S.pendSel = S.pendSel || {}; S.pendFiltro = S.pendFiltro || 'TODO';
  var cuenta = { TODO: 0, BOTICAN: 0, FADERMEX: 0, TRASPASO: 0 };
  pd.grupos.forEach(function (g) { g.items.forEach(function (i) { cuenta.TODO++; cuenta[i.tipo] = (cuenta[i.tipo] || 0) + 1; }); });
  var misVig = pd.mios.filter(function (x) { return !x.cerrado; }).length;
  var marc = Object.keys(S.pendSel).filter(function (k) { return S.pendSel[k]; });
  var html = '<div class="barra"><button class="volver" onclick="S.pendSel={};vistaInicio()" aria-label="Volver">' + IC.atras + '</button><div class="titulo"><b>Pendientes por recoger</b><small>' +
    (b.ruta ? 'Ruta ' + esc(b.ruta.hora) + ' · ' + esc(String(b.ruta.sucursales).replace(/\s*·\s*/g, ', ')) + (b.ruta.extra ? ' · hoy también ' + esc(b.ruta.extra.replace(/\s*\(.*$/, '')) : '') : 'Sin ruta en este momento') + '</small></div>' +
    (misVig ? '<button class="chip-mios" onclick="vistaMios()">Voy por ' + misVig + '</button>' : '') + '</div><div class="cuerpo con-nav">' +
    '<div class="filtros">' + ['TODO', 'BOTICAN', 'FADERMEX', 'TRASPASO'].map(function (f) {
      return '<button class="' + (S.pendFiltro === f ? 'act' : '') + '" onclick="S.pendFiltro=\'' + f + '\';vistaPendientes()">' + ({ TODO: 'Todo', BOTICAN: 'BOTICAN', FADERMEX: 'FADERMEX', TRASPASO: 'Traspasos' })[f] + ' · ' + (cuenta[f] || 0) + '</button>';
    }).join('') + '</div>';
  var hay = false;
  pd.grupos.forEach(function (g) {
    var its = g.items.filter(function (i) { return S.pendFiltro === 'TODO' || i.tipo === S.pendFiltro; });
    if (!its.length) return; hay = true;
    html += '<span class="etiqueta">' + esc(g.lugar) + '</span>';
    its.forEach(function (i) {
      var borde = i.semaforo ? SEM[i.semaforo][0] : TIPO_PEND[i.tipo] ? TIPO_PEND[i.tipo][1] : 'var(--borde)';
      var bloqueado = (i.apartado && !i.mio) || i.asignadoOps;
      var k = clave(i.codigo);
      if (bloqueado) {
        html += '<div class="pend bloq"><span class="pend-ic">🔒</span><span class="tx"><span class="pend-l1"><b class="mono">' + esc(i.codigo) + '</b>' + chipTipo(i.tipo) + '</span><small>' +
          (i.apartado ? 'Va ' + esc(i.apartado.nombre) + ' · desde ' + esc(i.apartado.desde) : 'Asignado a ' + esc(i.asignadoOps) + ' en Operaciones') + '</small></span></div>';
      } else if (i.mio) {
        html += '<div class="pend mio" style="border-left-color:' + borde + '"><span class="pend-ic">✋</span><span class="tx"><span class="pend-l1"><b class="mono">' + esc(i.codigo) + '</b>' + chipTipo(i.tipo) + '</span><small>Apartado por ti · se libera ' + esc(i.apartado.hasta) + '</small><small>' + esc(i.texto) + '</small></span></div>';
      } else {
        html += '<label class="pend" style="border-left-color:' + borde + '"><input type="checkbox" ' + (S.pendSel[k] ? 'checked' : '') + ' onchange="S.pendSel[\'' + k + '\']=this.checked;vistaPendientes()">' +
          '<span class="tx"><span class="pend-l1"><b class="mono">' + esc(i.codigo) + '</b>' + chipTipo(i.tipo) + (i.asignadoAMi ? '<span class="pchip-t" style="color:var(--verde);background:var(--verde-suave)">TE LO ASIGNARON</span>' : '') + '</span>' +
          '<small' + (i.semaforo === 'rojo' ? ' style="color:var(--rojo);font-weight:700"' : '') + '>' + esc(i.texto) + (i.hoy === false ? ' · hoy no se visita' : '') + '</small></span></label>';
      }
    });
  });
  if (!hay) html += '<div class="vacio"><b>Nada pendiente por recoger</b><span>Cuando haya pedidos listos o traspasos esperando, aparecen aquí. Lo que alguien ya lleva no sale.</span></div>';
  html += '</div><div class="pie con-nav-pie">' + (marc.length ? '<button class="btn" onclick="apartarMarcados()">Lo recojo yo · ' + marc.length + (marc.length > 1 ? ' marcados' : ' marcado') + '</button>'
    : '<button class="btn linea" onclick="vistaEscaner(\'recolectar\')">Escanear lo que recojo</button>') +
    '<p class="nota" style="margin:0">Apartar NO registra la recolección: eso es al escanear la etiqueta.</p></div>' + nav('');
  pintar(html);
}
function itemsPend() { var o = {}; ((S.datos.pendientes || {}).grupos || []).forEach(function (g) { g.items.forEach(function (i) { o[clave(i.codigo)] = i; }); }); return o; }
function apartarMarcados() {
  var todos = itemsPend(), cods = Object.keys(S.pendSel).filter(function (k) { return S.pendSel[k] && todos[k]; }).map(function (k) { return { codigo: todos[k].codigo, tipo: todos[k].tipo }; });
  if (!cods.length) return;
  cargando('Apartando…');
  srv('apartar', { codigos: cods }).then(function (r) {
    quitarCargando();
    var mal = r.resultados.filter(function (x) { return !x.ok; });
    S.pendSel = {};
    if (mal.length) { sonido('error'); toast(mal.map(function (x) { return x.mensaje; }).join(' · '), 'err'); } else sonido('escaneo');
    return actualizar().then(vistaMios);
  }).catch(function (e) { quitarCargando(); falla(e.red ? errCod('CEL-02', 'Sin señal: para apartar necesitas señal. Igual puedes escanear y se registra.') : e); });
}
function vistaMios() {
  S.vista = 'mios'; pararEscaner();
  var pd = (S.datos && S.datos.pendientes) || { mios: [], horas: 2 };
  var vig = pd.mios.filter(function (x) { return !x.cerrado; }), cerr = pd.mios.filter(function (x) { return x.cerrado; });
  var html = '<div class="cab"><div class="cab-fila"><button class="btn-ic" onclick="vistaPendientes()" aria-label="Volver">' + IC.atras + '</button><div class="cab-nombre"><small>Voy por</small><b>' + vig.length + (vig.length === 1 ? ' pendiente' : ' pendientes') + '</b></div></div>' +
    '<small style="color:var(--azul-claro)">Los demás ven "Va ' + esc(S.datos.gestor.nombre) + '". Se liberan solos a las ' + pd.horas + ' horas si no los escaneas.</small></div><div class="cuerpo con-nav">';
  if (!vig.length && !cerr.length) html += '<div class="vacio"><b>No has apartado nada</b><span>En "Pendientes por recoger" marca lo que vas a recoger y toca "Lo recojo yo".</span></div>';
  vig.forEach(function (i) {
    html += '<div class="pend mio" style="border-left-color:' + (i.semaforo ? SEM[i.semaforo][0] : 'var(--azul)') + '"><span class="tx"><span class="pend-l1"><b class="mono">' + esc(i.codigo) + '</b>' + chipTipo(i.tipo) + '</span><small>' + esc(i.lugar) + ' · ' + esc(i.texto) + '</small>' +
      '<small style="color:var(--gris)">Apartado ' + esc(i.apartado.desde) + ' · se libera ' + esc(i.apartado.hasta) + '</small></span><button class="b chico" onclick="soltar(\'' + esc(i.codigo) + '\')">Soltar</button></div>';
  });
  cerr.forEach(function (i) {
    var mio = i.cerrado === 'RECOGIDO';
    html += '<div class="pend ' + (mio ? 'hecho-ok' : 'bloq') + '"><span class="pend-ic">' + (mio ? '✓' : '↪') + '</span><span class="tx"><span class="pend-l1"><b class="mono">' + esc(i.codigo) + '</b>' + chipTipo(i.tipo) + '</span><small>' +
      (mio ? 'Escaneado ' + esc(i.hora) + ' · ya está en "Lo que llevo"' : 'Lo recogió ' + esc(i.por) + ' a las ' + esc(i.hora)) + '</small></span></div>';
  });
  html += '<div class="aviso warn">Cuando escaneas la etiqueta de uno de estos, se marca solo y pasa a "Lo que llevo". Si escaneas algo que no apartaste, también se registra (si nadie más lo apartó).</div></div>' +
    '<div class="pie con-nav-pie"><button class="btn" onclick="vistaEscaner(\'recolectar\')">Escanear las etiquetas</button></div>' + nav('');
  pintar(html);
}
function soltar(codigo) {
  cargando('Soltando…');
  srv('soltar', { codigo: codigo }).then(function () { quitarCargando(); toast(codigo + ' quedó libre para otro gestor', 'ok'); return actualizar().then(vistaMios); })
    .catch(function (e) { quitarCargando(); falla(e); });
}
/** Tecleado a mano: si lo conocemos, "¿Es este?". Devuelve true si mostró la pregunta. */
function confirmarTecleado(codigo) {
  var k = clave(codigo), i = itemsPend()[k], info = null;
  if (i) info = { codigo: i.codigo, tipo: i.tipo, l1: i.texto, l2: 'Se recoge en ' + i.lugar };
  if (!info) { var p = (S.datos.pedidos || []).filter(function (x) { return clave(x.id) === k; })[0]; if (p) info = { codigo: p.id, tipo: 'PEDIDO', l1: p.cliente, l2: p.direccion }; }
  if (!info) return false;
  S.tecleado = info.codigo;
  modal('<p style="margin:0">Tecleaste <b class="mono">' + esc(codigo) + '</b></p><h2>¿Es este?</h2>' +
    '<div class="es-este"><div class="pend-l1"><b class="mono" style="font-size:17px">' + esc(info.codigo) + '</b>' + chipTipo(info.tipo) + '</div><b>' + esc(info.l1) + '</b><small>' + esc(info.l2) + '</small></div>' +
    '<p>Compáralo con la etiqueta (nombre o destino) antes de confirmar.</p>' +
    '<button class="btn verde" onclick="cerrarModal();alLeer(S.tecleado)">Sí, es este · registrar</button>' +
    '<button class="btn linea" onclick="cerrarModal();var c=$(\'inCodigo\');if(c){c.value=\'' + esc(codigo) + '\';c.focus();c.select()}">No, me equivoqué</button>');
  return true;
}
