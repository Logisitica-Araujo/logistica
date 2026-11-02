// Arma los dos simuladores (App Gestores 2 y OPERACIONES) con archivos de ejemplo compartidos.
const { crearEntorno } = require('./simulador');
const path = require('path');
const fs = require('fs');

const DIR_APP = path.join(__dirname, '..', 'apps-script');
const DIR_OPS = process.env.OPS || path.join(__dirname, '..', '..', '..', 'operaciones', 'apps-script');
const gs = d => fs.readdirSync(d).filter(f => f.endsWith('.gs')).sort().map(f => path.join(d, f));
if (!fs.existsSync(DIR_OPS)) { console.log('No encuentro el código de OPERACIONES en ' + DIR_OPS + ' (usa OPS=...)'); process.exit(1); }

function crear() {

const ID_MADRE = '1cPHTH2JwM92iD2wSxf4JauYLk9VBLv6T2fHhtxP-kmc';
const ID_TRAS = '1Fn5VKZZ-gUS_QRYIbos1WwCFzXpnIF_g7ofApN5vIxg';
const URL_OPS = 'https://script.google.com/a/macros/fadermex.com/s/OPS/exec';
const FOTO = Buffer.from('foto-jpeg-de-prueba').toString('base64');
const FIRMA = Buffer.from('firma-png-de-prueba').toString('base64');

/* ---------- los "archivos" compartidos ---------- */
const libros = {};
const red = { ops: null };
const OPS = crearEntorno({ inicio: '2026-11-04T16:00:00Z', libros });
const APP = crearEntorno({ inicio: '2026-11-04T16:00:00Z', libros, carpetasNegadas: ['153U2PjEDCaNvkIxoIfuz2nYLGrEixM7q'],
  red: (url, o) => {
    if (url !== URL_OPS) throw new Error('URL desconocida ' + url);
    if (!o.headers || !/^Bearer /.test(o.headers.Authorization)) throw new Error('sin token OAuth');
    const r = OPS.post(JSON.parse(o.payload));
    return { getContentText: () => JSON.stringify(r), getResponseCode: () => 200 };
  } });
function sincronizarRelojes() { OPS.reloj.ahora = APP.reloj.ahora; }

// Archivo madre (Logística FED 2026)
const madre = OPS.libroNuevo('Logística FED 2026', ID_MADRE);
const H = (L, n, d) => { const h = L.insertSheet(n); h.datos = d; return h; };
const fila = (o) => { const f = new Array(35).fill(''); Object.keys(o).forEach(k => { f[Number(k) - 1] = o[k]; }); return f; };
const encOps = new Array(35).fill('').map((_, i) => 'col' + (i + 1));
const opsDatos = [new Array(35).fill('').map((_, i) => i + 1), encOps, new Array(35).fill('desc'),
  fila({ 1: '#16062', 2: 'BOTICAN', 4: 'Cliente Uno', 5: 'Calle 1', 8: 'Logística Interna', 9: 'Jose Luis', 16: 'ENVIADO POR LOGÍSTICA INTERNA', 19: false, 21: false, 23: false }),
  fila({ 1: '#16063', 2: 'BOTICAN', 4: 'Cliente Dos', 5: 'Calle 2', 8: 'Logística Interna', 9: 'Jose Luis', 16: 'ENVIADO POR LOGÍSTICA INTERNA', 19: false, 21: false, 23: false }),
  fila({ 1: '#16070', 2: 'FADERMEX', 4: 'Cliente Tres', 5: 'Calle 3', 8: 'Logística Interna', 9: 'Antonio', 16: 'ENVIADO POR LOGÍSTICA INTERNA', 19: false, 21: false, 23: false }),
  fila({ 1: '#16018', 2: 'BOTICAN', 4: 'Cliente Cuatro', 5: 'Calle 4', 8: 'Recolección', 9: 'Jose Luis', 16: 'PENDIENTE PARA RECOLECTAR', 19: false, 21: false, 23: false }),
  fila({ 1: '#16080', 2: 'BOTICAN', 4: 'Cliente Cinco', 5: 'Calle 5', 8: 'Logística Interna', 9: 'Miriam', 16: 'ENVIADO POR LOGÍSTICA INTERNA' }),
  fila({ 1: '#15995', 2: 'BOTICAN', 4: 'Ya entregado', 5: 'Calle 6', 8: 'Logística Interna', 9: 'Jose Luis', 16: 'ENTREGADO', 22: '2026-10-20' })];
const hOps = H(madre, 'Operaciones', opsDatos);
const datosLista = [['Gestores'], ['x'], ['Jose Luis'], ['Antonio'], ['Miriam']].map(r => { const f = new Array(40).fill(''); f[0] = r[0]; return f; });
['Vehículos', 'x', 'Suzuki 4B1228', 'Saviero LKC-752-D', 'FED 2 14KGC4'].forEach((v, i) => { datosLista[i][4] = v; });
H(madre, 'Datos', datosLista);
H(madre, 'OPS_Usuarios', [['correo', 'nombre', 'rol', 'pin', 'activo']]);
H(madre, 'OPS_Log', [['fecha', 'usuario', 'accion', 'detalle']]);
const hEnt = H(madre, 'APP_Entregas', [['FechaHora', 'IDPedido', 'Gestor', 'Vehiculo', 'Resultado', 'Motivo', 'Cliente', 'Direccion', 'Observaciones', 'Area', 'SubArea', 'URLFoto', 'URLFirma', 'Latitud', 'Longitud', 'ComentarioGestor', 'Recibio', 'Cordenadas Excatas']]);
const hHist = H(madre, 'APP_Traspasos_Hist', [['FechaHora', 'Folio', 'Gestor', 'Vehiculo', 'Evento', 'Origen', 'Destino', 'Area', 'Contenido', 'Resultado', 'Motivo', 'ComentarioGestor', 'URLFoto', 'Latitud', 'Longitud']]);

// La fórmula de ESTATUS (columna P), simplificada: se recalcula después de cada cambio.
function formulaEstatus() {
  hOps.datos.slice(3).forEach(f => {
    if (f[21]) f[15] = 'ENTREGADO'; else if (f[19]) f[15] = 'PEDIDO CANCELADO'; else if (f[17]) f[15] = 'PEDIDO RETORNADO';
    else if (f[7] === 'Recolección') f[15] = hHist.datos.some(h => h[1] === f[0] && h[4] === 'RECOLECTADO') ? 'RECOLECTADO POR GESTOR' : 'PENDIENTE PARA RECOLECTAR';
  });
}

// Sistema de Traspasos
const tras = OPS.libroNuevo('Traspasos_FADERMEX_BD', ID_TRAS);
const encT = ['Folio', 'Fecha creación', 'Hora', 'Origen (prefijo)', 'Origen', 'Destino (prefijo)', 'Destino', 'Descripción', 'Bultos', 'Creado por', 'Credencial', 'Sin credencial', 'Estatus', 'Ubicación actual', 'Ruta', 'Gestor', 'Fecha recolección', 'Paquetería', 'Guía', 'Fecha entrega', 'Recibido por', 'Bultos recibidos', 'Reimpresiones', 'Eliminación solicitada', 'Última actualización', 'Incidencia', 'Editado'];
const tr = (folio, est, desc, extra) => { const f = new Array(encT.length).fill(''); const o = Object.assign({ Folio: folio, Estatus: est, 'Descripción': desc, Bultos: 1, 'Origen': 'Coapa · PV', 'Origen (prefijo)': 'C-PV', 'Destino': 'Doctores · Rebotica', 'Destino (prefijo)': 'D-RB', 'Eliminación solicitada': 'NO' }, extra || {}); encT.forEach((h, i) => { if (o[h] != null) f[i] = o[h]; }); return f; };
const hRes = H(tras, 'RES_Traspasos', [['RES_Traspasos — no editar'], encT,
  tr('C-PV-0019', 'NUEVO', 'Receta IMSS Pediatría'), tr('C-PV-0002', 'ENTREGADO', 'Factura'), tr('BOT-0013', 'NUEVO', 'Incidencia de llegada'),
  tr('C-PV-0017', 'NUEVO', 'Efectivo 23-10-2026 $2,654.00'), tr('BOT-0005', 'NUEVO', 'Pedidos', { 'Eliminación solicitada': 'SI' })]);
const hMov = H(tras, 'RES_Movimientos', [['título'], ['ID', 'Fecha', 'Hora', 'Folio', 'Acción', 'Estatus anterior', 'Estatus nuevo', 'Persona', 'Medio', 'Detalle']]);
const hAv = H(tras, 'RES_Avisos', [['título'], ['Fecha', 'Hora', 'Para (área)', 'Folio', 'Mensaje', 'Visto']]);
const estT = folio => hRes.datos.find(f => f[0] === folio)[encT.indexOf('Estatus')];

// Archivo de la app
const appL = APP.libroNuevo('App Gestores · Datos', 'ARCHIVO_APP');
APP.activar(appL);

/* ---------- cargar el código real ---------- */
OPS.cargar(gs(DIR_OPS));
APP.cargar(gs(DIR_APP));
OPS.props.setProperty('SAL', 'sal-ops');
madre.getSheetByName('OPS_Usuarios').datos.push(['app.gestores', 'App Gestores', 'App', OPS.ctx.opsw_cifrar_('PIN-APP-1'), 'SI']);
madre.getSheetByName('OPS_Usuarios').datos.push(['joseluis@x', 'Jose Luis', 'Gestor', OPS.ctx.opsw_cifrar_('PIN-JL-1'), 'SI']);

const hoja = n => appL.getSheetByName(n);
const filasDe = n => { const d = hoja(n).datos; return d.slice(1).filter(f => f.some(v => v !== '' && v != null)).map(f => Object.fromEntries(d[0].map((h, i) => [h, f[i]]))); };
const robot = () => { sincronizarRelojes(); const r = JSON.parse(APP.correr('robot', true)); formulaEstatus(); return r; };
const opsFila = id => hOps.datos.find(f => f[0] === id);


  return { APP, OPS, appL, madre, tras, hOps, hEnt, hHist, hRes, hMov, hAv, encT, estT, hoja, filasDe, robot, opsFila, formulaEstatus, URL_OPS, FOTO, FIRMA };
}
module.exports = { crear };
