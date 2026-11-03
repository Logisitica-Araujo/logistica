// Prueba los PERFILES de la versión 0.4.0 / app 2.1.0:
//   Gestoría (azul) · Facturación = traslados (verde) · Administrador (A1–A9).
// Primero el servidor (simulador de Apps Script + OPERACIONES), luego la app en un navegador real con capturas.
// Uso: node prueba-perfiles.js <carpeta-capturas> [video-cámara.y4m]      (servidor web en :8803 en la raíz del repo)
const path = require('path');
const fs = require('fs');
const SALIDA = process.argv[2] || path.join(__dirname, 'capturas-perfiles');
const Y4M = process.argv[3];
const SOLO_SERVIDOR = process.env.SOLO_SERVIDOR;
let fallas = 0, total = 0;
function ok(c, t) { total++; console.log((c ? '  ✔ ' : '  ✘ ') + t); if (!c) fallas++; }
function titulo(t) { console.log('\n== ' + t); }

const E = require('./entorno').crear();
const { APP, hOps, madre, hRes, encT, hEnt, filasDe, robot, opsFila, FOTO } = E;
const fila35 = o => { const f = new Array(35).fill(''); Object.keys(o).forEach(k => { f[Number(k) - 1] = o[k]; }); return f; };
// Datos de ejemplo de Facturación: un pedido al IMSS y uno de facturas, asignados a Alejandro en Operaciones.
hOps.datos.push(fila35({ 1: 'IMSS-0412', 2: 'IMSS', 3: 'HGZ 32 Farmacia', 4: 'IMSS HGZ 32', 5: 'Calz. de Tlalpan 931', 8: 'Logística Interna', 9: 'Alejandro', 16: 'ENVIADO POR LOGÍSTICA INTERNA', 19: false, 21: false, 23: false }));
hOps.datos.push(fila35({ 1: 'TAREA # 15300', 2: 'FADERMEX', 4: 'Oficinas Facturación', 5: 'Tlacotalpan 104', 8: 'Logística Interna', 9: 'Alejandro', 16: 'ENVIADO POR LOGÍSTICA INTERNA', 19: false, 21: false, 23: false }));
const datos = madre.getSheetByName('Datos').datos;
const dA = new Array(40).fill(''); dA[0] = 'Alejandro'; datos.splice(5, 0, dA);
hRes.datos.push((() => { const f = new Array(encT.length).fill(''); const o = { Folio: 'V-RB-0031', Estatus: 'NUEVO', 'Descripción': 'Cortes de caja', Bultos: 1, Origen: 'Vertiz · Rebotica', 'Origen (prefijo)': 'V-RB', Destino: 'Oficinas', 'Destino (prefijo)': 'OFI', 'Eliminación solicitada': 'NO' }; encT.forEach((h, i) => { if (o[h] != null) f[i] = o[h]; }); return f; })());

APP.correr('INSTALAR');
APP.correr('conectarOperaciones', E.URL_OPS, 'app.gestores', 'PIN-APP-1');
const jl = APP.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
const an = APP.correr('altaGestor', 'Antonio', 'Antonio', 'antonio');
const al = APP.correr('altaGestor', 'Alejandro', 'Alejandro', 'alejandro', 'Facturación');
const jar = APP.correr('altaGestor', 'Jorge', 'Jorge', 'jorge');
const us = E.hoja('APP_Usuarios');
const cRol = us.datos[0].indexOf('Rol'), cUsr = us.datos[0].indexOf('Usuario'), cArea = us.datos[0].indexOf('Area');
us.datos.find(f => f[cUsr] === 'jorge')[cRol] = 'Administrador';
const marcarVehiculo = [['Saviero LKC-752-D', 'AUTO', 'LKC-752-D', true], ['Suzuki 4B1228', 'MOTO', '4B1228', true], ['FED 2 14KGC4', 'AUTO', '14KGC4', true], ['A pie', 'NINGUNO', '', true]];
const hv = E.hoja('APP_Vehiculos'); marcarVehiculo.forEach(v => { if (!hv.datos.some(f => f[0] === v[0])) hv.datos.push([v[0], v[1], v[2], v[3], false]); });
robot();

const post = o => APP.post(o);
const entrar = (u, c) => post({ accion: 'login', usuario: u, clave: c }).token;
const tJL = entrar('joseluis', jl.clave), tAL = entrar('alejandro', al.clave), tAD = entrar('jorge', jar.clave), tAN = entrar('antonio', an.clave);

titulo('Perfiles por área');
ok(us.datos[0].indexOf('Area') >= 0, 'APP_Usuarios tiene la columna Area');
ok(us.datos.find(f => f[cUsr] === 'alejandro')[cArea] === 'Facturación', 'Alta con área Facturación');
ok(us.datos.find(f => f[cUsr] === 'joseluis')[cArea] === 'Gestoría', 'Por defecto: Gestoría');
let iAL = post({ accion: 'inicio', token: tAL });
ok(iAL.ok && iAL.perfil.area === 'FACTURACION' && !iAL.perfil.admin, 'Alejandro: perfil Facturación');
ok(post({ accion: 'inicio', token: tJL }).perfil.area === 'GESTORIA', 'Jose Luis: perfil Gestoría');
ok(post({ accion: 'inicio', token: tAD }).perfil.admin === true, 'Jorge: administrador');
ok(iAL.pedidos.some(p => p.id === 'IMSS-0412' && p.clase === 'IMSS'), 'El pedido del IMSS llega marcado como IMSS');
ok(iAL.porRecoger.some(r => r.folio === 'C-PV-0017' && r.sucursalId === 'C') && iAL.porRecoger.some(r => r.folio === 'V-RB-0031' && r.sucursalId === 'V'), 'Ve lo que espera a ser recogido en cada sucursal');
ok(!iAL.porRecoger.some(r => r.folio === 'BOT-0005'), 'No incluye traspasos con eliminación solicitada');

titulo('Traslados: recoger, entregar varios con una foto, efectivo e IMSS');
const rec = post({ accion: 'recolectar', token: tAL, codigos: ['C-PV-0017', 'C-PV-0019', 'BOT-0013'] });
ok(rec.resultados.every(r => r.ok), 'Recoge 3 traspasos');
iAL = post({ accion: 'inicio', token: tAL });
const efe = iAL.lleva.find(l => l.codigo === 'C-PV-0017');
ok(efe.clase === 'EFECTIVO' && efe.esperado === 2654, 'El sobre de efectivo se reconoce con su monto ($2,654.00)');
ok(iAL.lleva.find(l => l.codigo === 'C-PV-0019').destinoId === 'D', 'Agrupa por sucursal destino (Doctores)');
const varios = post({ accion: 'cerrarVarios', token: tAL, idLocal: 'cv000000001', resultado: 'ENTREGADO', foto: FOTO, sucursal: 'Doctores',
  items: [{ idLocal: 'cvitem000001', tipo: 'TRASPASO', id: 'C-PV-0019' }, { idLocal: 'cvitem000002', tipo: 'TRASPASO', id: 'BOT-0013' }] });
ok(varios.ok && varios.cierres.length === 2 && varios.cierres.every(c => !c.error), 'Entrega 2 juntos');
let cs = filasDe('APP_Cierres');
const c19 = cs.find(c => c.ID === 'C-PV-0019'), c13 = cs.find(c => c.ID === 'BOT-0013');
ok(c19.URLFoto && c19.URLFoto === c13.URLFoto, 'Una sola foto para los dos');
ok(c19.DondeEntrego === 'Doctores', 'Queda dónde se entregó');
const mal = post({ accion: 'cerrar', token: tAL, idLocal: 'efe00000001', tipo: 'TRASPASO', id: 'C-PV-0017', resultado: 'ENTREGADO', clase: 'EFECTIVO', monto: '2,600.00', esperado: 2654, recibio: 'Encargada Laura', comentario: 'faltaron 54' });
ok(mal.ok, 'Entrega el efectivo (monto opcional)');
cs = filasDe('APP_Cierres');
const ce = cs.find(c => c.ID === 'C-PV-0017');
ok(ce.Monto === 2600 && /Monto entregado: \$2600\.00/.test(ce.Comentario) && ce.Clase === 'EFECTIVO', 'Guarda el monto en su columna y en la nota');
ok(filasDe('APP_Problemas').some(p => p.Codigo === 'CAP-09' && /2600\.00.*2654\.00/.test(p.Detalle)), 'Monto que no cuadra → aviso a Administración (CAP-09)');
const imssSin = post({ accion: 'cerrar', token: tAL, idLocal: 'imss0000001', tipo: 'PEDIDO', id: 'IMSS-0412', resultado: 'ENTREGADO', clase: 'IMSS', areaImss: 'Farmacia' });
ok(!imssSin.ok && imssSin.codigo === 'CAP-04' && /acuse/.test(imssSin.mensaje), 'IMSS sin foto del acuse: no deja');
const imss = post({ accion: 'cerrar', token: tAL, idLocal: 'imss0000002', tipo: 'PEDIDO', id: 'IMSS-0412', resultado: 'ENTREGADO', clase: 'IMSS', areaImss: 'Farmacia', foto: FOTO, recibio: 'Lic. Ramírez', matricula: '99887766' });
ok(imss.ok, 'IMSS con acuse: entregado');
robot();
cs = filasDe('APP_Cierres');
ok(cs.filter(c => ['C-PV-0019', 'BOT-0013', 'C-PV-0017', 'IMSS-0412'].indexOf(c.ID) >= 0).every(c => c.Estado === 'ENVIADO'), 'El robot pasa los 4 a su sistema');
ok(E.estT('C-PV-0019') === 'ENTREGADO_GESTOR' && E.estT('BOT-0013') === 'ENTREGADO_GESTOR', 'Sistema de Traspasos: ENTREGADO_GESTOR');
const fI = opsFila('IMSS-0412');
ok(fI[22] === true && /Área IMSS: Farmacia/.test(fI[29]) && fI[34] === 'Lic. Ramírez · Mat. 99887766', 'Operaciones: W ✓, el área en AD y quién recibió con matrícula en AI');

titulo('Vehículo: motivo al cambiar y en taller');
post({ accion: 'vehiculo', token: tJL, vehiculo: 'Saviero LKC-752-D' });
post({ accion: 'vehiculo', token: tJL, vehiculo: 'FED 2 14KGC4', motivo: 'Llanta ponchada' });
ok(/Saviero.*→ FED 2 14KGC4 · Llanta ponchada/.test(us.datos.find(f => f[cUsr] === 'joseluis')[us.datos[0].indexOf('VehiculoNota')]), 'Guarda de cuál a cuál y el motivo');
ok(post({ accion: 'admin', token: tAD, que: 'vehiculoCambiar', vehiculo: 'Saviero LKC-752-D', enTaller: true }).ok, 'Admin: Saviero en taller');
const taller = post({ accion: 'vehiculo', token: tAN, vehiculo: 'Saviero LKC-752-D' });
ok(!taller.ok && /taller/.test(taller.mensaje), 'Nadie puede elegir un vehículo en taller');
ok(post({ accion: 'inicio', token: tAN }).vehiculos.find(v => v.nombre === 'Saviero LKC-752-D').enTaller, 'La app lo muestra en taller');
post({ accion: 'admin', token: tAD, que: 'vehiculoCambiar', vehiculo: 'Saviero LKC-752-D', enTaller: false });

hv.datos.push(['Sin Vehiculo', 'AUTO', '', true, false]);   // como vino de Operaciones, con Tipo equivocado
ok(post({ accion: 'vehiculo', token: tJL, vehiculo: 'Sin Vehiculo' }).ok && post({ accion: 'vehiculo', token: tAN, vehiculo: 'Sin Vehiculo' }).ok, '"Sin vehículo" lo pueden elegir varios a la vez (aunque diga AUTO)');
ok(!post({ accion: 'inicio', token: tAL }).vehiculos.find(v => v.nombre === 'Sin Vehiculo').ocupadoPor, '…y nunca sale "Lo trae…"');
post({ accion: 'vehiculo', token: tJL, vehiculo: 'FED 2 14KGC4' }); post({ accion: 'vehiculo', token: tAN, vehiculo: 'A pie' });

titulo('Administración: permisos y Hoy');
const noAdm = post({ accion: 'admin', token: tJL, que: 'hoy' });
ok(!noAdm.ok && noAdm.codigo === 'APP-02', 'Un gestor no puede entrar a Administración');
const hoy = post({ accion: 'admin', token: tAD, que: 'hoy' });
ok(hoy.ok && hoy.equipo.length === 4 && hoy.totales.entregados === 4, 'Hoy: equipo y totales (' + hoy.totales.entregados + ' entregados)');
ok(hoy.atender.some(a => /CAP-09/.test(a.texto) || /P-0/.test(a.texto)), 'Atender ahora: muestra el aviso del monto');
ok(hoy.equipo.find(g => g.usuario === 'alejandro').area === 'FACTURACION', 'Distingue el área de cada quien');

titulo('Administración: reasignar (Operaciones columna I)');
const reas = post({ accion: 'admin', token: tAD, que: 'reasignar', id: '#16063', a: 'G-02' });
ok(reas.ok && opsFila('#16063')[8] === 'Antonio', 'Operaciones: #16063 ahora es de Antonio');
robot();
ok(post({ accion: 'inicio', token: tAN }).pedidos.some(p => p.id === '#16063'), 'A Antonio le aparece');
ok(!post({ accion: 'inicio', token: tJL }).pedidos.some(p => p.id === '#16063'), 'A Jose Luis le desaparece');

titulo('Administración: corregir un cierre ya pasado');
post({ accion: 'cerrar', token: tJL, idLocal: 'jl000000001', tipo: 'PEDIDO', id: '#16062', resultado: 'ENTREGADO', foto: FOTO, recibio: 'Sra. Torres' });
robot();
ok(opsFila('#16062')[22] === true, 'Antes: #16062 entregado en Operaciones');
const bus = post({ accion: 'admin', token: tAD, que: 'buscar', q: '16062' });
ok(bus.ok && bus.resultados[0].cierres.length === 1 && bus.resultados[0].historial.length >= 1, 'Buscar encuentra el pedido y su historial');
const sinPorque = post({ accion: 'admin', token: tAD, que: 'corregir', idCierre: 'jl000000001', modo: 'resultado', resultado: 'RETORNO', motivo: 'No se encontraba cliente' });
ok(!sinPorque.ok, 'Sin "por qué" no deja corregir');
const corr = post({ accion: 'admin', token: tAD, que: 'corregir', idCierre: 'jl000000001', modo: 'resultado', resultado: 'RETORNO', motivo: 'No se encontraba cliente', porque: 'Se equivocó de botón' });
ok(corr.ok, 'Corrige entregado → retorno');
const f62 = opsFila('#16062');
ok(f62[22] === false && f62[18] === true && f62[28] === 'No se encontraba cliente', 'Operaciones: se quita W, se marca S y el motivo en AC');
ok(hEnt.datos.some(f => f[1] === '#16062' && f[4] === 'ENTREGADO (CORREGIDO)') && hEnt.datos.some(f => f[1] === '#16062' && f[4] === 'RETORNO'), 'APP_Entregas: el viejo queda (CORREGIDO) y se anota el retorno');
cs = filasDe('APP_Cierres');
ok(cs.find(c => c.IdCierre === 'jl000000001').Estado === 'CORREGIDO' && /Jorge.*Se equivocó/.test(cs.find(c => c.IdCierre === 'jl000000001').Corregido), 'Queda quién lo corrigió y por qué');
const reab = post({ accion: 'admin', token: tAD, que: 'corregir', idCierre: cs.find(c => c.ID === '#16062' && c.Resultado === 'RETORNO').IdCierre, modo: 'reabrir', porque: 'Va otra vez mañana' });
ok(reab.ok && opsFila('#16062')[18] === false, 'Reabrir: se quita la casilla de retorno');
E.formulaEstatus(); robot();
ok(post({ accion: 'inicio', token: tJL }).pedidos.some(p => p.id === '#16062'), 'Reabierto: vuelve a la lista de Jose Luis');
const corrTr = post({ accion: 'admin', token: tAD, que: 'corregir', idCierre: c19.IdCierre, modo: 'reabrir', porque: 'No lo había entregado' });
ok(corrTr.ok && E.estT('C-PV-0019') === 'RECOLECTADO', 'Traspaso reabierto: vuelve a "en camino" en el Sistema de Traspasos');
ok(post({ accion: 'inicio', token: tAL }).lleva.some(l => l.codigo === 'C-PV-0019'), '…y regresa a "Lo que llevo" de Alejandro');

titulo('Administración: equipo, cerrar por él, problemas, ajustes');
ok(post({ accion: 'admin', token: tAD, que: 'equipoCambiar', usuario: 'antonio', campo: 'area', valor: 'Facturación' }).ok, 'Pasar a Antonio a Facturación');
ok(post({ accion: 'inicio', token: tAN }).perfil.area === 'FACTURACION', 'Su app cambia al momento (sin esperar 5 min)');
post({ accion: 'admin', token: tAD, que: 'equipoCambiar', usuario: 'antonio', campo: 'area', valor: 'Gestoría' });
const yoMismo = post({ accion: 'admin', token: tAD, que: 'equipoCambiar', usuario: 'jorge', campo: 'activo', valor: false });
ok(!yoMismo.ok, 'No se puede dar de baja a sí mismo');
const tmp = post({ accion: 'admin', token: tAD, que: 'equipoCambiar', usuario: 'antonio', campo: 'clave' });
ok(tmp.ok && tmp.temporal.length === 8 && !post({ accion: 'inicio', token: tAN }).ok, 'Contraseña temporal: cierra su sesión');
const nuevo = post({ accion: 'admin', token: tAD, que: 'alta', nombre: 'Belarmino', nombreOps: 'Belarmino', usuario: 'belarmino', area: 'Facturación' });
ok(nuevo.ok && us.datos.find(f => f[cUsr] === 'belarmino')[cArea] === 'Facturación', 'Alta de Belarmino en Facturación desde la app');
const porEl = post({ accion: 'cerrar', token: tAD, comoNumero: 'G-01', idLocal: 'adm00000001', tipo: 'PEDIDO', id: '#16018', resultado: 'ENTREGADO', foto: FOTO });
ok(porEl.ok && filasDe('APP_Cierres').find(c => c.IdCierre === 'adm00000001').NumeroGestor === 'G-01' && /Cerrado por Jorge/.test(filasDe('APP_Cierres').find(c => c.IdCierre === 'adm00000001').Comentario), 'Cerrar por él: a nombre del gestor y queda que fue la administradora');
ok(!post({ accion: 'cerrar', token: tJL, comoNumero: 'G-02', idLocal: 'jl000000099', tipo: 'PEDIDO', id: '#16070', resultado: 'ENTREGADO', foto: FOTO }).ok, 'Un gestor no puede cerrar a nombre de otro');
const prob = post({ accion: 'admin', token: tAD, que: 'problemas' });
ok(prob.ok && prob.problemas.length >= 1, 'Problemas: lista los abiertos');
ok(post({ accion: 'admin', token: tAD, que: 'resolver', numero: prob.problemas[0].numero, nota: 'Ya se habló con él' }).ok &&
   post({ accion: 'admin', token: tAD, que: 'problemas' }).problemas.length === prob.problemas.length - 1, 'Marcar como resuelto');
ok(post({ accion: 'admin', token: tAD, que: 'ajuste', clave: 'EXIGIR_FIRMA_ENTREGA', valor: true }).ok && post({ accion: 'yo', token: tJL }).reglas.exigirFirmaEntrega === true, 'Ajuste: firma obligatoria se aplica');
ok(!post({ accion: 'admin', token: tAD, que: 'ajuste', clave: 'OPERACIONES_URL', valor: 'x' }).ok, 'No deja cambiar ajustes delicados (OPERACIONES_URL)');
post({ accion: 'admin', token: tAD, que: 'ajuste', clave: 'EXIGIR_FIRMA_ENTREGA', valor: false });
const aj = post({ accion: 'admin', token: tAD, que: 'ajustes' });
const bot = aj.sucursales.find(s => s.nombre === 'Botican');
ok(post({ accion: 'admin', token: tAD, que: 'sucursal', fila: bot.fila, direccion: 'Calle Botican 1' }).ok && post({ accion: 'admin', token: tAD, que: 'ajustes' }).sucursales.find(s => s.nombre === 'Botican').direccion === 'Calle Botican 1', 'Sucursal: dirección de Botican');
ok(post({ accion: 'admin', token: tAD, que: 'motivo', tipo: 'RETORNO', motivo: 'Cliente pidió otra fecha' }).ok, 'Agregar un motivo');
post({ accion: 'admin', token: tAD, que: 'ajuste', clave: 'APP_BLOQUEADA', valor: true });
ok(!post({ accion: 'inicio', token: tJL }).ok && post({ accion: 'admin', token: tAD, que: 'hoy' }).ok && post({ accion: 'login', usuario: 'jorge', clave: jar.clave }).ok, 'Mantenimiento: los gestores no entran, el administrador sí');
post({ accion: 'admin', token: tAD, que: 'ajuste', clave: 'APP_BLOQUEADA', valor: false });

if (SOLO_SERVIDOR) { console.log('\n' + (total - fallas) + '/' + total + ' pruebas correctas'); process.exit(fallas ? 1 : 0); }

/* ======================= En el navegador ======================= */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
fs.mkdirSync(SALIDA, { recursive: true });
const BASE = 'http://localhost:8803/v2/index.html';
const API = 'https://script.google.com/macros/s/APP-PRUEBA/exec';
(async () => {
  // Datos frescos para las capturas: Alejandro recoge otra vez lo de Doctores y un sobre nuevo.
  hRes.datos.push((() => { const f = new Array(encT.length).fill(''); const o = { Folio: 'C-PV-0021', Estatus: 'NUEVO', 'Descripción': 'Efectivo 03-11-2026 $2,654.00 + $1,144.00', Bultos: 1, Origen: 'Coapa · PV', 'Origen (prefijo)': 'C-PV', Destino: 'Doctores · Rebotica', 'Destino (prefijo)': 'D-RB', 'Eliminación solicitada': 'NO' }; encT.forEach((h, i) => { if (o[h] != null) f[i] = o[h]; }); return f; })());
  hRes.datos.push((() => { const f = new Array(encT.length).fill(''); const o = { Folio: 'C-PV-0005', Estatus: 'NUEVO', 'Descripción': 'Receta IMSS 37F1343542', Bultos: 1, Origen: 'Coapa · PV', 'Origen (prefijo)': 'C-PV', Destino: 'Doctores · Rebotica', 'Destino (prefijo)': 'D-RB', 'Eliminación solicitada': 'NO' }; encT.forEach((h, i) => { if (o[h] != null) f[i] = o[h]; }); return f; })());
  hRes.datos.push((() => { const f = new Array(encT.length).fill(''); const o = { Folio: 'D-RB-0021', Estatus: 'NUEVO', 'Descripción': 'Devolución', Bultos: 1, Origen: 'Doctores · Rebotica', 'Origen (prefijo)': 'D-RB', Destino: 'Coapa · PV', 'Destino (prefijo)': 'C-PV', 'Eliminación solicitada': 'NO' }; encT.forEach((h, i) => { if (o[h] != null) f[i] = o[h]; }); return f; })());
  hOps.datos.push(fila35({ 1: 'IMSS-0415', 2: 'IMSS', 3: 'HGZ 32 Farmacia', 4: 'IMSS HGZ 32', 5: 'Calz. de Tlalpan 931', 8: 'Logística Interna', 9: 'Alejandro', 16: 'ENVIADO POR LOGÍSTICA INTERNA', 19: false, 21: false, 23: false }));
  post({ accion: 'recolectar', token: tAL, codigos: ['C-PV-0021', 'C-PV-0005'] });
  E.OPS.correr('opsw_cacheBorrar_'); robot(); APP.correr('_calcularPorRecoger');

  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
  if (Y4M) args.push('--use-file-for-fake-video-capture=' + Y4M);
  const browser = await chromium.launch({ args });
  const errores = [];
  async function abrir() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.grantPermissions(['camera', 'geolocation']);
    await ctx.setGeolocation({ latitude: 19.4038, longitude: -99.1657 });
    await ctx.route('**/v2/config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.APPG_API='" + API + "';" }));
    await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
    await ctx.route(API, async r => {
      let res; try { res = E.APP.post(JSON.parse(r.request().postData() || '{}')); } catch (e) { res = { ok: false, codigo: 'APP-01', mensaje: e.message }; }
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) });
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errores.push(e.message));
    return page;
  }
  let n = 0;
  const foto = async (page, nombre) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SALIDA, String(++n).padStart(2, '0') + '-' + nombre + '.png') }); };
  const texto = page => page.evaluate(() => document.body.innerText);
  async function login(page, u, c, nueva) {
    await page.goto(BASE); await page.waitForTimeout(700);
    await page.fill('#inUsuario', u); await page.fill('#inClave', c); await page.click('button[type=submit]'); await page.waitForTimeout(900);
    if (/Crea tu contraseña/.test(await texto(page))) {
      await page.fill('#inActual', c); await page.fill('#inNueva', nueva); await page.fill('#inNueva2', nueva); await page.click('button[type=submit]'); await page.waitForTimeout(900);
    }
  }

  titulo('Navegador · Facturación (Alejandro)');
  let p = await abrir();
  await login(p, 'alejandro', al.clave, 'alejandro-2026');
  ok(/¿Con qué sales hoy\?/.test(await texto(p)), 'Pide vehículo');
  await p.click('text=Suzuki 4B1228'); await p.waitForTimeout(200); await p.click('text=Salir a ruta'); await p.waitForTimeout(900);
  let t = await texto(p);
  ok(/Traslados/.test(t) && /Tu ruta de hoy/i.test(t), 'Su inicio es la ruta por parada');
  ok(await p.evaluate(() => document.body.classList.contains('fac')), 'Pantalla verde (perfil Facturación)');
  ok(/Doctores/.test(t) && /IMSS HGZ 32/.test(t) && /PIDE ACUSE/.test(t) && /EFECTIVO/.test(t), 'Paradas: Doctores (con efectivo) e IMSS (pide acuse)');
  await foto(p, 'facturacion-ruta');
  await p.click('.parada:has-text("Doctores")'); await p.waitForTimeout(500);
  t = await texto(p);
  ok(/Entregar aquí/i.test(t) && /Se entregan aparte/i.test(t) && /Recoger aquí/i.test(t) && /D-RB-0021/.test(t), 'Parada: entregar aquí, efectivo aparte y lo que hay que recoger');
  await foto(p, 'facturacion-parada');
  await p.click('.zona-foto'); await p.waitForTimeout(1500); await p.click('#camDisparo'); await p.waitForTimeout(500);
  await p.fill('#inRecParada', 'Lalo');
  await foto(p, 'facturacion-parada-foto');
  await p.click('.pie .btn'); await p.waitForTimeout(1200);
  ok(filasDe('APP_Cierres').some(c => c.ID === 'C-PV-0019' && c.Estado !== 'ANULADO' && c.Recibio === 'Lalo' && c.Corregido === ''), 'Se entregaron los marcados con la foto y quién recibió');
  t = await texto(p);
  await p.click('.marca.efe >> text=Entregar'); await p.waitForTimeout(500);
  t = await texto(p);
  ok(/Entregar efectivo/.test(t) && /DICE EL SOBRE/i.test(t) && /3,798\.00/.test(t), 'Efectivo: muestra cuánto dice el sobre ($3,798.00)');
  await p.fill('#inMonto', '3798'); await p.locator('#inMonto').blur(); await p.waitForTimeout(400);
  await p.fill('#inRecibio', 'Encargada Laura');
  ok(/Cuadra con el sobre/.test(await texto(p)), 'Avisa que cuadra');
  await foto(p, 'facturacion-efectivo');
  await p.click('text=Entregué el efectivo'); await p.waitForTimeout(1200);
  ok(filasDe('APP_Cierres').some(c => c.ID === 'C-PV-0021' && c.Monto === 3798), 'Efectivo entregado con su monto');
  await p.click('.parada:has-text("IMSS")'); await p.waitForTimeout(500);
  await p.click('.marca.imss >> text=Con acuse'); await p.waitForTimeout(500);
  t = await texto(p);
  ok(/Entrega IMSS/.test(t) && /acuse sellado/i.test(t) && /Matrícula/i.test(await p.evaluate(() => document.getElementById('inMatricula').placeholder)), 'IMSS: área, acuse y matrícula');
  await p.selectOption('#selArea', 'Farmacia');
  await p.click('text=Finalizar entrega IMSS'); await p.waitForTimeout(300);
  ok(/acuse/.test(await texto(p)), 'Sin acuse no deja');
  await p.click('.zona-foto'); await p.waitForTimeout(1500); await p.click('#camDisparo'); await p.waitForTimeout(500);
  await p.fill('#inRecibio', 'Lic. Ramírez'); await p.fill('#inMatricula', '99887766');
  await foto(p, 'facturacion-imss');
  await p.click('text=Finalizar entrega IMSS'); await p.waitForTimeout(1200);
  ok(filasDe('APP_Cierres').some(c => c.ID === 'IMSS-0415' && c.DondeEntrego === 'Farmacia'), 'IMSS entregado');
  await p.context().close();

  titulo('Navegador · Gestoría (Jose Luis) sigue igual, en azul');
  p = await abrir();
  await login(p, 'joseluis', jl.clave, 'jose-2026');
  if (/¿Con qué sales hoy\?/.test(await texto(p))) { await p.click('text=FED 2 14KGC4'); await p.click('text=Salir a ruta'); await p.waitForTimeout(800); }
  t = await texto(p);
  ok(/Gestoría/.test(t) && /Pedidos a domicilio/.test(t) && !(await p.evaluate(() => document.body.classList.contains('fac'))), 'Gestoría: su inicio de siempre, azul');
  await foto(p, 'gestoria-inicio');
  await p.click('.chip >> text=cambiar'); await p.waitForTimeout(400); await p.click('text=Saviero LKC-752-D'); await p.waitForTimeout(300);
  ok(/¿Por qué cambias de vehículo\?/.test(await texto(p)), 'Al cambiar de vehículo pregunta el motivo');
  await p.selectOption('#selMotVeh', 'Lluvia');
  await foto(p, 'gestoria-cambio-vehiculo');
  await p.click('text=Cambiar de vehículo'); await p.waitForTimeout(800);
  await p.context().close();

  titulo('Navegador · Administrador (Jorge)');
  p = await abrir();
  await login(p, 'jorge', jar.clave, 'jorge-2026');
  if (/¿Con qué sales hoy\?/.test(await texto(p))) { await p.click('text=A pie'); await p.click('text=Salir a ruta'); await p.waitForTimeout(800); }
  await p.click('[aria-label="Administración"]'); await p.waitForTimeout(900);
  t = await texto(p);
  ok(/ADMINISTRACIÓN/.test(t) && /Atender ahora/i.test(t) && /Facturación · traslados/i.test(t) && /Gestoría · domicilio/i.test(t), 'A1 Hoy: totales, atender y el equipo separado por área');
  ok(await p.evaluate(() => document.body.classList.contains('adm')), 'Pantalla oscura (Administración)');
  await foto(p, 'admin-hoy');
  await p.click('.persona:has-text("Jose Luis")'); await p.waitForTimeout(800);
  ok(/Lo que hizo hoy/i.test(await texto(p)), 'A2 Un gestor en detalle');
  await foto(p, 'admin-gestor');
  if (await p.locator('text=Reasignar').count()) { await p.click('text=Reasignar >> nth=0'); await p.waitForTimeout(600); ok(/¿A quién se la pasas\?/.test(await texto(p)), 'A5 Reasignar'); await foto(p, 'admin-reasignar'); }
  if (!(await p.locator('.nav').count())) { await p.click('[aria-label="Volver"]'); await p.waitForTimeout(900); }
  await p.click('.nav >> text=Buscar'); await p.waitForTimeout(300);
  await p.fill('#inAdmQ', '16063'); await p.click('form.teclear .b'); await p.waitForTimeout(800);
  await foto(p, 'admin-buscar');
  await p.fill('#inAdmQ', 'C-PV-0021'); await p.click('form.teclear .b'); await p.waitForTimeout(800);
  ok(/C-PV-0021/.test(await texto(p)) && /3,798/.test(await texto(p)), 'A3 Buscar: el efectivo con su monto');
  await p.click('text=Corregir'); await p.waitForTimeout(500);
  ok(/¿Qué quieres hacer\?/.test(await texto(p)) && /Qué va a pasar/.test(await texto(p)), 'A4 Corregir: dice qué va a pasar');
  await foto(p, 'admin-corregir');
  await p.click('.nav >> text=Equipo').catch(() => {}); if (!(await p.locator('.nav').count())) { await p.click('[aria-label="Volver"]'); await p.waitForTimeout(500); await p.click('.nav >> text=Equipo'); }
  await p.waitForTimeout(800);
  t = await texto(p);
  ok(/Facturación · traslados/i.test(t) && /Pasar a Facturación/.test(t) && /Pasar a Gestoría/.test(t), 'A7 Equipo por área, con "Pasar a…"');
  await foto(p, 'admin-equipo');
  await p.click('.card:has-text("Antonio") >> text=Pasar a Facturación'); await p.waitForTimeout(300);
  await foto(p, 'admin-equipo-pasar');
  await p.click('.modal .btn >> nth=0'); await p.waitForTimeout(900);
  ok(us.datos.find(f => f[cUsr] === 'antonio')[cArea] === 'Facturación', 'Antonio pasó a Facturación desde la app');
  await p.click('.nav >> text=Vehículos'); await p.waitForTimeout(800);
  ok(/Lluvia/.test(await texto(p)), 'A8 Vehículos: muestra el motivo del cambio');
  await foto(p, 'admin-vehiculos');
  await p.click('.nav >> text=Ajustes'); await p.waitForTimeout(800);
  ok(/Modo mantenimiento/.test(await texto(p)) && /acuse sellado/i.test(await texto(p)), 'A9 Ajustes');
  await foto(p, 'admin-ajustes');
  await p.click('.nav >> text=Hoy'); await p.waitForTimeout(800);
  await p.click('.kpis button'); await p.waitForTimeout(800);
  ok(/Por revisar/.test(await texto(p)), 'A6 Problemas');
  await foto(p, 'admin-problemas');
  ok(!errores.length, 'Sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log('\n' + (total - fallas) + '/' + total + ' pruebas correctas · capturas en ' + SALIDA);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.log('FALLA', e); process.exit(1); });
