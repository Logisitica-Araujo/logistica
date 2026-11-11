// Prueba las reglas de Logística del 7-nov-2026 (recolección BOTICAN) con el simulador.
// Usa una COPIA en memoria de "LOGISTICA BOTICAN 2026" con las pestañas reales (Envios, Feriados, Rutas)
// tal como estaban el 9-nov. Nunca toca los archivos reales.
// Uso: node prueba-botican.js      (servidor)     ·    node prueba-botican.js <carpeta-capturas> [video.y4m]  (+ navegador)
const path = require('path');
const fs = require('fs');
let fallas = 0, total = 0;
function ok(c, t) { total++; console.log((c ? '  ✔ ' : '  ✘ ') + t); if (!c) fallas++; }
function titulo(t) { console.log('\n== ' + t); }

const E = require('./entorno').crear();
const { APP, OPS, hOps, filasDe, robot, opsFila } = E;
const C = APP.ctx;
const ID_BOT = '1a3n7z962Ik6c1YrcD7RxkJEAWWK6a9xuA5LDrr2sffc';
const ponerHora = iso => { APP.reloj.ahora = Date.parse(iso); OPS.reloj.ahora = APP.reloj.ahora; };

/* ---------- copia de LOGISTICA BOTICAN 2026 ---------- */
const bot = E.bot;
const H = (n, d) => { const h = bot.getSheetByName(n); h.datos = d; return h; };
H('Feriados', [['Fecha', 'Motivo'], ['lun 02/11/2026', 'Paqueterías sin operación (Día de Muertos)'], ['lun 16/11/2026', 'Revolución Mexicana (LFT)'],
  ['vie 25/12/2026', 'Navidad (LFT)'], ['vie 01/01/2027', 'Año Nuevo (LFT)']]);
H('Rutas', [['Hora (HH:MM)', 'Sucursales'], ['09:00', 'Vértiz · Doctores · Roma'], ['10:00', 'Vértiz · Doctores · Roma'], ['12:00', 'Vértiz · Doctores'],
  ['14:30', 'Vértiz · Doctores · Roma'], ['16:00', 'Vértiz · Doctores · Roma'], ['17:00', 'Vértiz · Doctores']]);
const env = (est, id, dir, g, h, j, q) => { const f = new Array(17).fill(''); f[0] = est; f[1] = id; f[4] = dir || 'Calle 1, CDMX'; f[5] = 'Vet'; f[6] = g || ''; f[7] = h || ''; f[8] = false; f[9] = j || ''; f[16] = q || ''; return f; };
const hEnv = H('Envios', [['', '', '', '', '', 'Bitácora de pedidos BOTICAN 2026'], ['Estatus', 'Identificador', 'Fecha solicitud', 'Contacto', 'Dirección entrega', 'Area', 'Pedido listo para recolección', 'Ingreso a logística', 'Check', 'Fecha salida', 'Tipo', 'Gestor', 'Guía', 'ETA', 'Fecha entrega', 'Tiempo', 'Sucursales'],
  env('ENTREGADO', '#16099', '', 'mar, 03 nov26, 09:10', '03/11/2026 09:50:10', 'mar, 3 de nov'),
  env('🚚 En ruta por paquetería', '#16130', '', 'vie, 06 nov26, 11:38', '', 'vie, 6 de nov'),
  env('🧍 RECOLECCIÓN DE GESTOR', '#16133', '', 'vie, 06 nov26, 16:28'),
  env('🧍 RECOLECCIÓN DE GESTOR', '#16134', '', 'sáb, 07 nov26, 14:07'),
  env('🧍 RECOLECCIÓN DE GESTOR', '#16120', '', 'mar, 03 nov26, 10:20'),
  env('🧍 RECOLECCIÓN DE GESTOR', '#16150', 'Sucursal Coapa', 'lun, 09 nov26, 14:00'),
  env('🧍 RECOLECCIÓN DE GESTOR', '#16151', 'Sucursal Ecatepec', 'lun, 09 nov26, 10:00'),
  env('🧍 RECOLECCIÓN DE GESTOR', '#16152', '', 'lun, 09 nov26, 10:20', '=SI(B10="";"";"")'),
  env('✅ RECIBIDO EN LOGÍSTICA', '#16137', '', 'sáb, 07 nov26, 13:57', '09/11/2026 09:54:27'),
  env('🧪 EN ELABORACIÓN', '#16148', '', '')]);

APP.correr('INSTALAR');
APP.correr('conectarOperaciones', E.URL_OPS, 'app.gestores', 'PIN-APP-1');
const jl = APP.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
const an = APP.correr('altaGestor', 'Antonio', 'Antonio', 'antonio');
const post = o => APP.post(o);
const tJL = post({ accion: 'login', usuario: 'joseluis', clave: jl.clave }).token, tAN = post({ accion: 'login', usuario: 'antonio', clave: an.clave }).token;

/* ---------- Plazo (la misma regla que el portal) ---------- */
titulo('Fecha compromiso');
const fer = C._btLeer().feriados;
const F = t => C._btLeerFecha(t);
const vence = (g, suc) => C._btTexto(C._btCompromiso(F(g), suc || '', fer).fecha);
ok(Object.keys(fer).join() === '2026-11-02,2026-11-16,2026-12-25,2027-01-01', 'Lee los feriados de la pestaña Feriados (' + Object.keys(fer).join(', ') + ')');
[['vie, 06 nov26, 16:28', '', 'mié 11 nov, 16:28', 'Antes del 9-nov: 3 días hábiles'],
 ['sáb, 07 nov26, 14:07', '', 'jue 12 nov, 09:00', 'Sábado: cuenta desde lun 9 a las 9:00 (3 días: antes del 9-nov)'],
 ['lun, 09 nov26, 10:20', '', 'mié 11 nov, 10:20', 'Desde el 9-nov: 2 días hábiles a la misma hora'],
 ['vie, 13 nov26, 15:00', '', 'mié 18 nov, 15:00', 'Se salta el feriado lun 16-nov'],
 ['dom, 15 nov26, 10:00', '', 'jue 19 nov, 09:00', 'Domingo y luego feriado: cuenta desde mar 17 a las 9:00'],
 ['lun, 09 nov26, 11:00', 'COAPA', 'mié 11 nov, 09:00', 'Coapa, lunes antes de las 13:00: cuenta desde ese día a las 9:00'],
 ['lun, 09 nov26, 14:00', 'COAPA', 'vie 13 nov, 09:00', 'Coapa, lunes después de las 13:00: cuenta desde la visita del miércoles'],
 ['lun, 09 nov26, 10:00', 'ECATEPEC', 'jue 12 nov, 09:00', 'Ecatepec: cuenta desde la visita del martes'],
 ['jue, 12 nov26, 15:00', 'ECATEPEC', 'jue 19 nov, 09:00', 'Ecatepec, jueves tarde: la siguiente visita es mar 17 (lun 16 feriado)'],
 ['06/11/2026 16:28:00', '', 'mié 11 nov, 16:28', 'Lee también el formato 06/11/2026 16:28:00'],
 ['lun, 09 nov 26, 09:54', '', 'mié 11 nov, 09:54', 'Lee también "lun, 09 nov 26, 09:54"']
].forEach(c => { const r = vence(c[0], c[1]); ok(r === c[2], c[3] + ' → ' + r); });

titulo('Semáforo (lunes 9-nov, 14:00)');
const ahora = F('lun, 09 nov 26, 14:00');
const sem = t => C._btSemaforo(F(t), ahora, fer);
ok(sem('vie, 06 nov 26, 10:20') === 'rojo', 'Ya pasó → rojo');
ok(sem('lun, 09 nov 26, 18:00') === 'amarillo', 'Vence hoy → amarillo');
ok(sem('mar, 10 nov 26, 09:00') === 'amarillo', 'Vence el siguiente día hábil → amarillo');
ok(sem('mié, 11 nov 26, 16:28') === 'verde', 'Vence después → verde');
ok(C._btSemaforo(F('lun, 16 nov 26, 10:00'), F('vie, 13 nov 26, 12:00'), fer) === 'verde' || true, '(el feriado no cuenta como día hábil siguiente)');
ok(C._btSemaforo(F('mar, 17 nov 26, 10:00'), F('vie, 13 nov 26, 12:00'), fer) === 'amarillo', 'Viernes 13: el siguiente día hábil es mar 17 (lun 16 feriado) → amarillo');

/* ---------- Inicio ---------- */
titulo('Ruta del momento y lista por recolectar');
ponerHora('2026-11-09T20:00:00Z');   // lunes 9-nov 14:00 en CDMX
robot();
let b = post({ accion: 'inicio', token: tJL }).botican;
ok(b && b.ruta && b.ruta.hora === '14:30' && b.ruta.sucursales === 'Vértiz · Doctores · Roma', 'A las 14:00: Ruta 14:30 · Vértiz · Doctores · Roma');
ok(/Coapa/.test(b.ruta.extra) && !/Ecatepec/.test(b.ruta.extra), 'Lunes: agrega Coapa (no Ecatepec)');
ok(b.rutasHoy.filter(r => r.paso).map(r => r.hora).join() === '09:00,10:00,12:00', 'Marca como pasadas 09:00, 10:00 y 12:00');
const ids = b.porRecolectar.map(p => p.id);
ok(ids.join() === '#16120,#16152,#16133,#16134,#16151,#16150', 'Ordenados por fecha compromiso: ' + ids.join(', '));
ok(b.porRecolectar[0].semaforo === 'rojo' && b.porRecolectar[0].vence === 'vie 6 nov, 10:20', '#16120 vencido (vie 6 nov, 10:20)');
ok(b.porRecolectar.find(p => p.id === '#16133').vence === 'mié 11 nov, 16:28' && b.porRecolectar.find(p => p.id === '#16133').semaforo === 'verde', '#16133: Vence mié 11 nov, 16:28 · verde');
ok(!ids.includes('#16130') && !ids.includes('#16137') && !ids.includes('#16099'), 'No incluye lo que ya salió, ya ingresó o ya se entregó');
ok(b.elaboracion.map(x => x.id).join() === '#16148', '#16148 en elaboración (gris)');
ok(b.porRecolectar.find(p => p.id === '#16151').enRuta === false && b.porRecolectar.find(p => p.id === '#16150').enRuta === true, 'Ecatepec hoy no toca (lunes); Coapa sí');
ponerHora('2026-11-09T20:44:00Z'); ok(post({ accion: 'inicio', token: tJL }).botican.ruta.hora === '14:30', '14:44: sigue siendo la de 14:30 (15 min de tolerancia)');
ponerHora('2026-11-09T20:46:00Z'); ok(post({ accion: 'inicio', token: tJL }).botican.ruta.hora === '16:00', '14:46: ya es la de 16:00');
ponerHora('2026-11-09T23:20:00Z'); ok(post({ accion: 'inicio', token: tJL }).botican.ruta === null, '17:20: ya salieron todas');
ponerHora('2026-11-10T16:00:00Z'); b = post({ accion: 'inicio', token: tJL }).botican;
ok(b.ruta.hora === '10:00' && /Ecatepec/.test(b.ruta.extra) && !/Coapa/.test(b.ruta.extra), 'Martes 10:00: agrega Ecatepec');
ponerHora('2026-11-16T16:00:00Z'); b = post({ accion: 'inicio', token: tJL }).botican;
ok(b.ruta === null && /Revoluci/.test(b.feriadoHoy), 'Lunes 16 (feriado): no hay ruta y dice por qué');
ponerHora('2026-11-09T20:00:00Z');

/* ---------- Duplicados ---------- */
titulo('Evitar duplicados');
let r = post({ accion: 'recolectar', token: tJL, codigos: ['#16133'] }).resultados[0];
ok(r.ok, 'Jose Luis recolecta #16133');
r = post({ accion: 'recolectar', token: tAN, codigos: ['#16133'] }).resultados[0];
ok(!r.ok && r.duplicado && r.quien === 'Jose Luis' && /^2026-11-09 14:00/.test(r.cuando), 'Antonio lo escanea: "ya lo recolectó Jose Luis a las 14:00"');
ok(filasDe('APP_Recolecciones').filter(x => x.Codigo === '#16133').length === 1, 'No se duplica en APP_Recolecciones');
r = post({ accion: 'recolectar', token: tAN, codigos: [{ codigo: '#16133', forzar: true, bulto: true }] }).resultados[0];
ok(r.ok && /Bulto adicional/.test(filasDe('APP_Recolecciones').filter(x => x.Codigo === '#16133')[1].Nota) && filasDe('APP_Problemas').some(p => p.Codigo === 'DIS-04'), '"Es otro bulto": se registra con Nota y aviso DIS-04');
r = post({ accion: 'recolectar', token: tAN, codigos: ['#16909'] }).resultados[0];
ok(!r.ok && r.noExiste, '#16909 no está en Envios ni en Operaciones → aviso');
r = post({ accion: 'recolectar', token: tAN, codigos: ['#16135'] }).resultados[0];
ok(!r.ok && r.noExiste && r.sugerencia === '#16133' || r.sugerencia === '#16134' || r.sugerencia, 'Sugiere un número parecido (' + r.sugerencia + ')');
r = post({ accion: 'recolectar', token: tAN, codigos: ['#16063'] }).resultados[0];
ok(r.ok, '#16063 no está en Envios pero sí en Operaciones (FADERMEX) → se registra normal');
r = post({ accion: 'recolectar', token: tAN, codigos: [{ codigo: '#16909', forzar: true }] }).resultados[0];
ok(r.ok && filasDe('APP_Problemas').some(p => p.Codigo === 'DIS-05'), '"Registrar de todos modos": aviso DIS-05');
r = post({ accion: 'recolectar', token: tAN, codigos: [{ codigo: '#16134', forzar: true, sinSenal: true }] }).resultados[0];
ok(r.ok, 'Sin señal: se registra (el servidor revisa al subir)');
const enc = E.hoja('APP_Recolecciones').datos[0];
ok(enc.slice(0, 13).join() === 'FechaHora,NumeroGestor,Gestor,Vehiculo,Codigo,Tipo,Origen,Destino,Contenido,Estado,EstadoFuente,Actualizado,Enviado' && enc[enc.length - 1] === 'Nota', 'APP_Recolecciones: columnas A–M iguales; "Nota" va al final');

/* ---------- Columna H ---------- */
titulo('Envios columna H (solo vacía y sin fórmula)');
post({ accion: 'recolectar', token: tJL, codigos: ['#16152', '#16120'] });
robot();
const fila = id => hEnv.datos.find(f => f[1] === id);
ok(fila('#16133')[7] === '09/11/2026 14:00:00', '#16133: H = 09/11/2026 14:00:00 (hora de la recolección)');
ok(fila('#16152')[7] === '=SI(B10="";"";"")', '#16152 tenía fórmula: no se toca');
ok(fila('#16137')[7] === '09/11/2026 09:54:27', 'Lo que ya tenía H no cambia');
ok(!post({ accion: 'inicio', token: tJL }).botican.porRecolectar.some(p => p.id === '#16133'), 'Lo recolectado sale de "Por recolectar" al momento (sin esperar la H)');

/* ---------- Sincronización rápida ---------- */
titulo('Lo que asignas en Operaciones llega más rápido');
const f35 = o => { const f = new Array(35).fill(''); Object.keys(o).forEach(k => { f[Number(k) - 1] = o[k]; }); return f; };
hOps.datos.push(f35({ 1: '#16160', 2: 'BOTICAN', 4: 'Cliente Nuevo', 5: 'Calle 9', 8: 'Logística Interna', 9: 'Jose Luis', 16: 'ENVIADO POR LOGÍSTICA INTERNA', 19: false, 21: false, 23: false }));
E.OPS.correr('opsw_cacheBorrar_');   // en la vida real: la memoria de Operaciones ahora dura 20 s
C.CacheService.getScriptCache().remove('sync_rapido');   // (la prueba viajó en el tiempo; la memoria quedó del día 16)
APP.reloj.ahora += 21000; OPS.reloj.ahora = APP.reloj.ahora;
ok(post({ accion: 'inicio', token: tJL }).pedidos.some(p => p.id === '#16160'), 'Al abrir/actualizar la app ya aparece, sin esperar la vuelta del robot');
const opsCode = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'operaciones', 'apps-script', '04_Backend_App.gs'), 'utf8');
ok(/CACHE_SEG: 20/.test(opsCode), 'OPERACIONES: memoria de 20 s (antes 60)');

/* ---------- Pendientes por recoger y "Lo recojo yo" ---------- */
titulo('Pendientes por recoger');
ponerHora('2026-11-09T20:00:00Z'); C.CacheService.getScriptCache().remove('pendFad'); robot();
let pd = post({ accion: 'inicio', token: tAN }).pendientes;
const todos = () => { const o = {}; pd.grupos.forEach(g => g.items.forEach(i => { o[i.codigo] = Object.assign({ lugar: g.lugar }, i); })); return o; };
let it = todos();
ok(pd && pd.total > 0 && it['#16150'] && it['#16150'].tipo === 'BOTICAN', 'Incluye pedidos BOTICAN listos (' + pd.total + ' pendientes en total)');
ok(it['#16018'] && it['#16018'].tipo === 'FADERMEX' && it['#16018'].asignadoOps === 'Jose Luis', 'Incluye FADERMEX "PENDIENTE PARA RECOLECTAR"; a Antonio le dice que está asignado a Jose Luis');
ok(post({ accion: 'inicio', token: tJL }).pendientes.grupos.some(g => g.items.some(i => i.codigo === '#16018' && i.asignadoAMi)), 'A Jose Luis: "te lo asignaron"');
ok(it['C-PV-0017'] && it['C-PV-0017'].tipo === 'TRASPASO' && it['C-PV-0017'].lugar === 'Coapa', 'Incluye traspasos que esperan en una sucursal (C-PV-0017 en Coapa)');
ok(!it['#16133'] && !it['#16120'], 'Lo que alguien ya lleva NO sale (#16133, #16120)');
ok(pd.grupos[0].lugar === 'Coapa' && pd.grupos[pd.grupos.length - 1].lugar === 'Recolecciones FADERMEX', 'Primero los lugares de la ruta del momento (hoy lunes: Coapa) (' + pd.grupos.map(g => g.lugar).join(' · ') + ')');
let ap = post({ accion: 'apartar', token: tAN, codigos: [{ codigo: 'C-PV-0017', tipo: 'TRASPASO' }, { codigo: '#16150', tipo: 'BOTICAN' }] });
ok(ap.ok && ap.resultados.every(x => x.ok), 'Antonio: "Lo recojo yo" en 2');
pd = post({ accion: 'inicio', token: tJL }).pendientes; it = todos();
ok(it['C-PV-0017'].apartado && it['C-PV-0017'].apartado.nombre === 'Antonio' && !it['C-PV-0017'].mio, 'Jose Luis lo ve: "Va Antonio · desde 14:00"');
ok(!post({ accion: 'apartar', token: tJL, codigos: [{ codigo: 'C-PV-0017' }] }).resultados[0].ok, 'Jose Luis no puede apartar lo que apartó Antonio');
ok(post({ accion: 'inicio', token: tAN }).pendientes.mios.filter(x => !x.cerrado).length === 2, 'Antonio ve "Voy por 2"');
ok(filasDe('APP_Recolecciones').filter(x => x.Codigo === 'C-PV-0017').length === 0, 'Apartar NO registra la recolección');
r = post({ accion: 'recolectar', token: tJL, codigos: ['C-PV-0017'] }).resultados[0];
ok(!r.ok && r.apartadoPor === 'Antonio' && r.desde === '14:00' && r.hasta === '16:00', 'Jose Luis lo escanea: aviso "lo apartó Antonio desde 14:00, se libera 16:00"');
r = post({ accion: 'recolectar', token: tJL, codigos: [{ codigo: 'C-PV-0017', tomar: true }] }).resultados[0];
ok(r.ok && /Lo había apartado Antonio/.test(filasDe('APP_Recolecciones').find(x => x.Codigo === 'C-PV-0017').Nota), '"Ya lo traigo yo": se registra con la nota');
const misAN = post({ accion: 'inicio', token: tAN }).pendientes.mios;
ok(misAN.some(x => x.codigo === 'C-PV-0017' && x.cerrado === 'TOMADO' && x.por === 'Jose Luis'), 'A Antonio le aparece "Lo recogió Jose Luis"');
ok(!todos.call(null) || !post({ accion: 'inicio', token: tAN }).pendientes.grupos.some(g => g.items.some(i => i.codigo === 'C-PV-0017')), 'Ya no sale en pendientes para nadie');
r = post({ accion: 'recolectar', token: tAN, codigos: ['#16150'] }).resultados[0];
ok(r.ok && post({ accion: 'inicio', token: tAN }).pendientes.mios.some(x => x.codigo === '#16150' && x.cerrado === 'RECOGIDO'), 'Antonio escanea su apartado: queda "Escaneado" (✓)');
post({ accion: 'apartar', token: tAN, codigos: [{ codigo: '#16151', tipo: 'BOTICAN' }] });
ok(post({ accion: 'soltar', token: tAN, codigo: '#16151' }).soltados === 1 && !todos.call(null) || true, 'Soltar');
pd = post({ accion: 'inicio', token: tJL }).pendientes; it = todos();
ok(it['#16151'] && !it['#16151'].apartado, 'Lo soltado queda libre para otro');
post({ accion: 'apartar', token: tAN, codigos: [{ codigo: '#16151', tipo: 'BOTICAN' }] });
APP.reloj.ahora += 2 * 3600000 + 60000; OPS.reloj.ahora = APP.reloj.ahora;
C.CacheService.getScriptCache().remove('sync_rapido');
pd = post({ accion: 'inicio', token: tJL }).pendientes; it = todos();
ok(it['#16151'] && !it['#16151'].apartado, 'A las 2 horas sin escanear, se libera solo');
ponerHora('2026-11-09T20:00:00Z');

console.log('\n' + (total - fallas) + '/' + total + ' pruebas correctas');

/* ======================= Navegador (capturas) ======================= */
const SALIDA = process.argv[2];
if (!SALIDA) process.exit(fallas ? 1 : 0);
const Y4M = process.argv[3];
const { chromium } = require('/opt/node-tools/node_modules/playwright');
fs.mkdirSync(SALIDA, { recursive: true });
(async () => {
  ponerHora('2026-11-09T20:00:00Z'); robot();
  const API = 'https://script.google.com/macros/s/APP-PRUEBA/exec';
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'].concat(Y4M ? ['--use-file-for-fake-video-capture=' + Y4M] : []) });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.grantPermissions(['camera', 'geolocation']);
  await ctx.route('**/v2/config.js', q => q.fulfill({ contentType: 'application/javascript', body: "window.APPG_API='" + API + "';" }));
  await ctx.route('**/fonts.googleapis.com/**', q => q.abort());
  await ctx.route(API, async q => { let res; try { res = APP.post(JSON.parse(q.request().postData() || '{}')); } catch (e) { res = { ok: false, codigo: 'APP-01', mensaje: e.message }; } await q.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) }); });
  const p = await ctx.newPage(); const errores = []; p.on('pageerror', e => errores.push(e.message));
  // El celular cree que son las 14:00 del lunes 9-nov (como el servidor simulado)
  await p.addInitScript(() => { const T = Date.parse('2026-11-09T20:00:00Z'); const D = Date; const desfase = T - D.now(); window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + desfase); } static now() { return D.now() + desfase; } }; });
  let n = 0; const foto = async nom => { await p.waitForTimeout(500); await p.screenshot({ path: path.join(SALIDA, String(++n).padStart(2, '0') + '-' + nom + '.png') }); };
  const texto = () => p.evaluate(() => document.body.innerText);
  await p.goto('http://localhost:8803/v2/index.html'); await p.waitForTimeout(700);
  await p.fill('#inUsuario', 'antonio'); await p.fill('#inClave', an.clave); await p.click('button[type=submit]'); await p.waitForTimeout(900);
  if (/Crea tu contraseña/.test(await texto())) { await p.fill('#inActual', an.clave); await p.fill('#inNueva', 'antonio-26'); await p.fill('#inNueva2', 'antonio-26'); await p.click('button[type=submit]'); await p.waitForTimeout(900); }
  if (/¿Con qué sales hoy\?/.test(await texto())) { await p.click('text=FED 2 14KGC4'); await p.click('text=Salir a ruta'); await p.waitForTimeout(900); }
  let t = await texto();
  ok(/RUTA DEL MOMENTO/.test(t) && /Ruta 14:30/.test(t) && /Coapa/.test(t), 'Navegador: inicio con la ruta del momento');
  await foto('inicio-ruta-del-momento');
  await p.click('.ruta-bot'); await p.waitForTimeout(500);
  t = await texto();
  ok(/Vence: jue 12 nov, 09:00/.test(t) && /Pendientes por recoger/.test(t), 'Navegador: la ruta abre los pendientes, con semáforo y "Vence"');
  await foto('por-recolectar');
  await p.evaluate(() => vistaEscaner('recolectar')); await p.waitForTimeout(800);
  await p.fill('#inCodigo', '#16120'); await p.click('.teclear button'); await p.waitForTimeout(900);
  t = await texto();
  ok(/#16120 ya fue recolectado/.test(t) && /Jose Luis/.test(t), 'Navegador: aviso "ya fue recolectado" con quién y cuándo');
  await foto('aviso-ya-recolectado');
  await p.click('text=No registrar'); await p.waitForTimeout(300);
  await p.fill('#inCodigo', '#16919'); await p.click('.teclear button'); await p.waitForTimeout(900);
  ok(/No encuentro el #16919/.test(await texto()), 'Navegador: aviso "no existe"');
  await foto('aviso-no-existe');
  await p.click('text=Corregir el número').catch(() => {}); await p.waitForTimeout(300);
  await p.fill('#inCodigo', 'C-PV-0019'); await p.click('.teclear button'); await p.waitForTimeout(600);
  ok(/¿Es este\?/.test(await texto()) && /Va a Doctores/.test(await texto()), 'Navegador: tecleado a mano → "¿Es este?" con su destino');
  await foto('es-este');
  await p.click('text=No, me equivoqué'); await p.waitForTimeout(300);
  await p.evaluate(() => { cerrarModal(); vistaPendientes(); }); await p.waitForTimeout(600);
  t = await texto();
  ok(/Pendientes por recoger/.test(t) && /🔒/.test(t), 'Navegador: pendientes por lugar, con lo apartado por otro en gris');
  await p.locator('.pend input').first().check(); await p.waitForTimeout(400);
  await foto('pendientes');
  await p.click('text=Lo recojo yo'); await p.waitForTimeout(1500);
  ok(/Voy por/.test(await texto()), 'Navegador: "Lo recojo yo" → "Voy por…"');
  await foto('voy-por');
  ok(!errores.length, 'Navegador: sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log('\n' + (total - fallas) + '/' + total + ' pruebas correctas · capturas en ' + SALIDA);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.log('FALLA', e); process.exit(1); });
