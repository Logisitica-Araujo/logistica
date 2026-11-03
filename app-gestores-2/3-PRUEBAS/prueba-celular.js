// Prueba la app del celular (v2/) en un navegador real, conectada al servidor REAL simulado.
// Toma capturas de cada pantalla.  Uso: node prueba-celular.js <carpeta-capturas> [video-cámara.y4m]
// Necesita un servidor web en la raíz del repositorio:  python3 -m http.server 8803 -d <raíz>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const SALIDA = process.argv[2] || path.join(__dirname, 'capturas');
const Y4M = process.argv[3];
fs.mkdirSync(SALIDA, { recursive: true });
const BASE = 'http://localhost:8803/v2/index.html';
const API = 'https://script.google.com/macros/s/APP-PRUEBA/exec';

let fallas = 0, total = 0;
function ok(c, t) { total++; console.log((c ? '  ✔ ' : '  ✘ ') + t); if (!c) fallas++; }

const E = require('./entorno').crear();
const { APP } = E;
APP.correr('INSTALAR');
APP.correr('conectarOperaciones', E.URL_OPS, 'app.gestores', 'PIN-APP-1');
const jl = APP.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
APP.correr('altaGestor', 'Antonio', 'Antonio', 'antonio');
E.robot();
let sinRed = false;

(async () => {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
  if (Y4M) args.push('--use-file-for-fake-video-capture=' + Y4M);
  const browser = await chromium.launch({ args });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });  // con el service worker activo, Playwright no puede simular la red
  await ctx.grantPermissions(['camera', 'geolocation', 'notifications']);
  await ctx.setGeolocation({ latitude: 19.4038, longitude: -99.1657 });
  await ctx.route('**/v2/config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.APPG_API='" + API + "';" }));
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  await ctx.route(API, async r => {
    if (sinRed) return r.abort('internetdisconnected');
    let res; try { res = E.APP.post(JSON.parse(r.request().postData() || '{}')); } catch (e) { console.log('RUTA-ERROR', e.message); res = { ok: false, codigo: 'APP-01', mensaje: e.message }; }
    if (process.env.VER) console.log('API', JSON.parse(r.request().postData()).accion, res.ok, res.codigo || '');
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) });
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  let n = 0;
  const foto = async (nombre) => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(SALIDA, String(++n).padStart(2, '0') + '-' + nombre + '.png') }); };
  const texto = async () => page.evaluate(() => document.body.innerText);

  console.log('\n== Entrar');
  await page.goto(BASE); await page.waitForTimeout(800);
  await foto('entrar');
  await page.fill('#inUsuario', 'joseluis'); await page.fill('#inClave', jl.clave); await page.click('button[type=submit]');
  await page.waitForTimeout(900);
  ok(/Crea tu contraseña/.test(await texto()), 'Primera vez: pide crear su contraseña');
  await foto('crear-contrasena');
  await page.fill('#inActual', jl.clave); await page.fill('#inNueva', 'jose-2026'); await page.fill('#inNueva2', 'jose-2026'); await page.click('button[type=submit]');
  await page.waitForTimeout(900);
  ok(/¿Con qué sales hoy\?/.test(await texto()), 'Luego pregunta el vehículo');
  await page.click('text=Suzuki 4B1228'); await page.waitForTimeout(300);
  await page.check('#chk0'); await page.check('#chk1');
  await foto('vehiculo-y-revision');
  await page.click('text=Salir a ruta'); await page.waitForTimeout(900);
  let t = await texto();
  ok(/Jose Luis/.test(t) && /Pedidos a domicilio/.test(t), 'Pantalla de inicio');
  await foto('inicio');

  console.log('\n== Pedidos y entrega');
  await page.click('.mosaico >> nth=0'); await page.waitForTimeout(500);
  t = await texto();
  ok(/#16062/.test(t) && /#16063/.test(t) && !/#16070/.test(t), 'Ve sus pedidos y no los de Antonio');
  await foto('pedidos');
  ok(!/paquetería/i.test(await texto()), 'Ya no hay botón de paquetería');
  await page.click('.card:has-text("#16062") >> text=Entregar'); await page.waitForTimeout(400);
  await page.click('text=Finalizar entrega'); await page.waitForTimeout(300);
  ok(/Falta la foto/.test(await texto()), 'Sin foto no deja finalizar');
  await page.click('.zona-foto'); await page.waitForTimeout(1500);
  await foto('camara-en-la-app');
  await page.click('#camDisparo'); await page.waitForTimeout(500);
  await page.fill('#inRecibio', 'Sra. Torres');
  const cv = await page.locator('#firmaCanvas').boundingBox();
  await page.mouse.move(cv.x + 30, cv.y + 90); await page.mouse.down();
  for (const [x, y] of [[60, 40], [90, 110], [130, 50], [170, 100], [230, 70], [300, 80]]) await page.mouse.move(cv.x + x, cv.y + y, { steps: 5 });
  await page.mouse.up();
  await foto('entregar-lleno');
  await page.click('text=Finalizar entrega'); await page.waitForTimeout(1500);
  ok(/Entrega registrada/.test(await texto()), 'Entrega registrada');
  await foto('entregado-whatsapp');
  const c = E.filasDe('APP_Cierres').find(x => x.ID === '#16062');
  ok(c && c.Recibio === 'Sra. Torres' && /drive/.test(c.URLFoto) && /drive/.test(c.URLFirma) && c.Lat, 'El servidor recibió foto, firma, quién recibió y GPS');
  E.robot();
  ok(E.opsFila('#16062')[15] === 'ENTREGADO', 'El robot la pasó a Operaciones: ENTREGADO');

  console.log('\n== No entregué');
  await page.click('text=Ahora no'); await page.waitForTimeout(500);
  await page.click('.card:has-text("#16063") >> text=No entregué'); await page.waitForTimeout(400);
  await page.click('text=No se encontraba cliente');
  await page.fill('#inComent', 'Se llamó 3 veces');
  await page.click('.zona-foto'); await page.waitForTimeout(1300); await page.click('#camDisparo'); await page.waitForTimeout(400);
  await foto('no-entregue-retorno');
  await page.click('text=Registrar retorno'); await page.waitForTimeout(1500);
  ok(E.filasDe('APP_Cierres').some(x => x.ID === '#16063' && x.Resultado === 'RETORNO' && x.Motivo === 'No se encontraba cliente'), 'Retorno con motivo en el servidor');

  console.log('\n== Escanear (recolectar)');
  await page.evaluate(() => vistaEscaner('recolectar')); await page.waitForTimeout(1500);
  for (const f of ['C-PV-0019', 'C-PV-0002', 'VREM-00072092', 'C-PV-0019']) { await page.fill('#inCodigo', f); await page.click('.teclear button'); await page.waitForTimeout(700); }
  t = await texto();
  ok(/Va a Doctores · Rebotica · Eje 3 Sur/.test(t), 'C-PV-0019 recolectado: destino con la dirección de la sucursal');
  ok(/ya está ENTREGADO/.test(t), 'C-PV-0002: avisa que ya estaba entregado');
  ok(/Escribe a dónde va/.test(t), 'Remisión vieja: pide destino');
  ok(/Ya leíste C-PV-0019/.test(t), 'No cuenta dos veces el mismo folio');
  await foto('escanear-recolectar');
  await page.click('.leido:has-text("VREM") >> text=Destino'); await page.fill('#inDestino', 'Oficinas · Logística'); await page.click('#modal .btn'); await page.waitForTimeout(800);
  await page.click('text=Listo'); await page.waitForTimeout(600);
  E.robot();
  ok(E.estT('C-PV-0019') === 'RECOLECTADO', 'Sistema de Traspasos: RECOLECTADO (rastreo "Recolectado por gestoría")');
  await page.evaluate(() => actualizar()); await page.waitForTimeout(700);
  await page.click('.mosaico >> nth=1'); await page.waitForTimeout(500);
  t = await texto();
  ok(/C-PV-0019/.test(t) && /VREM-00072092/.test(t), 'Lo que llevo: el traspaso y la remisión');
  ok(/Eje 3 Sur/.test(t) && /En camino/.test(t), 'Lo que llevo: dirección de la sucursal destino y su estatus');
  await foto('lo-que-llevo');
  await page.click('.card:has-text("VREM") >> text=No entregué'); await page.waitForTimeout(400);
  await foto('no-entregue-traspaso');
  await page.evaluate(() => cancelarCierre()); await page.waitForTimeout(300);

  console.log('\n== Escanear (entregar) y limpieza sola');
  await page.evaluate(() => vistaEscaner('entregar')); await page.waitForTimeout(800);
  await page.fill('#inCodigo', 'C-PV-0019'); await page.click('.teclear button'); await page.waitForTimeout(600);
  ok(/Entregar/.test(await texto()) && /C-PV-0019/.test(await texto()), 'Al leer el folio abre su entrega');
  t = await texto();
  ok(/¿Dónde lo entregaste\?/.test(t) && !/Firma/.test(t) && !/Quién recibió/.test(t), 'Entregar traspaso: dónde lo entregó y foto; sin firma ni quién recibió');
  ok(await page.inputValue('#selSuc') === 'Doctores', 'Ya viene elegida la sucursal destino (Doctores)');
  await foto('entregar-traspaso');
  await page.click('text=Finalizar entrega'); await page.waitForTimeout(1200);
  E.robot();
  ok(E.estT('C-PV-0019') === 'ENTREGADO_GESTOR', 'Sistema de Traspasos: ENTREGADO_GESTOR');

  console.log('\n== Sin señal');
  sinRed = true;
  await page.evaluate(() => vistaPedidos()); await page.waitForTimeout(400);
  ok(!/#16063/.test(await texto()), 'El retorno ya no está en su lista');
  await page.evaluate(() => { S.datos.pedidos.push({ id: '#16018', fila: 7, cliente: 'Cliente Cuatro', direccion: 'Calle 4', area: 'BOTICAN', estatus: '' }); vistaPedidos(); });
  await page.click('.card:has-text("#16018") >> text=Entregar'); await page.waitForTimeout(300);
  await page.click('.zona-foto'); await page.waitForTimeout(1300); await page.click('#camDisparo'); await page.waitForTimeout(300);
  await page.click('text=Finalizar entrega'); await page.waitForTimeout(1500);
  await page.click('text=Ahora no'); await page.waitForTimeout(300);
  await page.evaluate(() => vistaInicio()); await page.waitForTimeout(300);
  t = await texto();
  ok(/por subir/.test(t), 'Sin señal: queda "por subir" en el celular');
  await foto('sin-senal');
  await page.evaluate(() => verCola()); await page.waitForTimeout(300);
  await foto('por-subir');
  await page.evaluate(() => cerrarModal());
  await page.reload(); await page.waitForTimeout(1500);
  t = await texto();
  ok(/Jose Luis/.test(t) && !/Contraseña/.test(t), 'Recargar sin señal: abre directo, sin pedir contraseña');
  sinRed = false;
  await page.evaluate(() => subirCola()); await page.waitForTimeout(1500);
  ok(E.filasDe('APP_Cierres').some(x => x.ID === '#16018'), 'Regresa la señal: se sube solo');

  console.log('\n== Manual');
  await page.evaluate(() => vistaManual()); await page.waitForTimeout(900);
  ok(/Cómo entregar un pedido a domicilio/.test(await texto()), 'Manual con el protocolo');
  await page.click('summary:has-text("Cómo entregar")'); await page.waitForTimeout(300);
  await foto('manual');
  await page.evaluate(() => vistaYo()); await page.waitForTimeout(300);
  await foto('mi-cuenta');
  await page.evaluate(() => cerrarModal());
  // Captura a medias: Android cierra la app con la foto tomada
  await page.evaluate(() => { S.datos.pedidos.push({ id: '#16099', fila: 9, cliente: 'Cliente Seis', direccion: 'Calle 9', area: 'BOTICAN', estatus: '' }); vistaPedidos(); });
  await page.click('.card:has-text("#16099") >> text=Entregar'); await page.waitForTimeout(300);
  await page.click('.zona-foto'); await page.waitForTimeout(1300); await page.click('#camDisparo'); await page.waitForTimeout(300);
  await page.fill('#inRecibio', 'Don Pepe'); await page.dispatchEvent('#inRecibio', 'input'); await page.waitForTimeout(300);
  await page.reload(); await page.waitForTimeout(1800);
  ok(/Tienes una captura a medias/.test(await texto()), 'Si Android cierra la app, ofrece continuar la captura');
  await foto('captura-a-medias');
  await page.click('#modal >> text=Continuar'); await page.waitForTimeout(500);
  ok(/Don Pepe/.test(await page.inputValue('#inRecibio')) && (await page.$('.previa img')) !== null, 'Regresa con la foto y quién recibió');

  ok(errores.length === 0, 'Sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log('\n' + (total - fallas) + '/' + total + ' pruebas correctas · capturas en ' + SALIDA);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
