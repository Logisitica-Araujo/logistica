// Prueba de punta a punta: App Gestores 2  ⇄  API de OPERACIONES  ⇄  Sistema de Traspasos.
// Carga el código REAL de los dos proyectos en dos simuladores que comparten los mismos "archivos".
// Uso (desde esta carpeta):  node prueba-integrada.js   [OPS=/ruta/a/operaciones/apps-script]
const { crearEntorno } = require('./simulador');
const path = require('path');
const fs = require('fs');

const DIR_APP = path.join(__dirname, '..', 'apps-script');
const DIR_OPS = process.env.OPS || path.join(__dirname, '..', '..', '..', 'operaciones', 'apps-script');
const gs = d => fs.readdirSync(d).filter(f => f.endsWith('.gs')).sort().map(f => path.join(d, f));
if (!fs.existsSync(DIR_OPS)) { console.log('No encuentro el código de OPERACIONES en ' + DIR_OPS + ' (usa OPS=...)'); process.exit(1); }

let fallas = 0, total = 0;
function ok(cond, txt) { total++; if (cond) console.log('  ✔ ' + txt); else { fallas++; console.log('  ✘ ' + txt); } }
function titulo(t) { console.log('\n== ' + t); }

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

titulo('Instalar y conectar con OPERACIONES');
APP.correr('INSTALAR');
const msg = APP.correr('conectarOperaciones', URL_OPS, 'app.gestores', 'PIN-APP-1');
ok(/Conectado/.test(msg) && /5 pedidos abiertos/.test(msg), 'Conecta con la API: ve los 5 pedidos abiertos con gestor (el entregado no)');
ok(filasDe('APP_Vehiculos').length === 4 && filasDe('APP_Vehiculos').find(v => v.Vehiculo === 'Suzuki 4B1228').Tipo === 'MOTO', 'Importa los vehículos de "Datos" (Suzuki = MOTO) + "Sin vehículo"');
ok(APP.props.getProperty('OPS_PIN') === 'PIN-APP-1' && !/PIN-APP-1/.test(JSON.stringify(appL.hojas.map(h => h.datos))), 'El PIN queda en Propiedades, no en ninguna hoja');
let err = null; try { APP.correr('conectarOperaciones', URL_OPS, 'app.gestores', 'malo'); } catch (e) { err = e; }
ok(err && err.codigo === 'API-01', 'PIN equivocado: API-01');
APP.correr('conectarOperaciones', URL_OPS, 'app.gestores', 'PIN-APP-1');

titulo('Gestores y primer día');
const jl = APP.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
const an = APP.correr('altaGestor', 'Antonio', 'Antonio', 'antonio');
let tJL = APP.post({ accion: 'login', usuario: 'joseluis', clave: jl.clave }).token;
tJL = APP.post({ accion: 'cambiarClave', token: tJL, actual: jl.clave, nueva: 'jose-2026' }).token;
const tAN = APP.post({ accion: 'login', usuario: 'antonio', clave: an.clave }).token;
let r = robot();
ok(r.errores.length === 0, 'Primera vuelta del robot sin errores ' + (r.errores.join(' | ')));
ok(filasDe('APP_Pedidos').length === 4, 'APP_Pedidos: 4 pedidos (3 de Jose Luis, 1 de Antonio; el de Miriam no tiene usuario)');
ok(filasDe('APP_Problemas').some(p => p.Codigo === 'ROB-02' && /Miriam/.test(p.Detalle)), 'Avisa que "Miriam" no tiene usuario (ROB-02)');
let ini = APP.post({ accion: 'inicio', token: tJL });
ok(ini.ok && ini.vehiculo === '' && ini.pedidos.length === 3, 'Inicio: sin vehículo hoy y 3 pedidos');
ok(ini.motivos.RETORNO.length === 4 && ini.checklist.MOTO.length === 8, 'Inicio: motivos y revisión de moto');
ok(APP.post({ accion: 'vehiculo', token: tJL, vehiculo: 'Suzuki 4B1228', checklist: [{ texto: 'Casco', ok: true }] }).ok, 'Elige Suzuki 4B1228');
const ocupado = APP.post({ accion: 'vehiculo', token: tAN, vehiculo: 'Suzuki 4B1228' });
ok(!ocupado.ok && ocupado.codigo === 'CAP-06' && /Jose Luis ya trae/.test(ocupado.mensaje), 'Antonio no puede tomar la misma moto el mismo día');
ok(APP.post({ accion: 'inicio', token: tAN }).vehiculos.find(v => v.nombre === 'Suzuki 4B1228').ocupadoPor === 'Jose Luis', 'A Antonio le sale ocupada por Jose Luis');
APP.post({ accion: 'vehiculo', token: tAN, vehiculo: 'FED 2 14KGC4' });

titulo('Entregar un pedido');
const sinFoto = APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000001', tipo: 'PEDIDO', id: '#16062', resultado: 'ENTREGADO' });
ok(!sinFoto.ok && sinFoto.codigo === 'CAP-04', 'Sin foto: no deja (CAP-04)');
const c1 = APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000001', tipo: 'PEDIDO', id: '#16062', resultado: 'ENTREGADO', recibio: 'Sra. Torres', foto: FOTO, lat: 19.4, lng: -99.1, horaCelular: '2026-11-04 10:01:00' });
ok(c1.ok && /drive/.test(c1.urlFoto), 'Con foto: guardado y foto en Drive');
ok(APP.archivos.some(a => a.carpeta === '1fGcPo7r1p2QHw-wV507l1ovzesKj9-fu' && a.nombre === '#16062'), 'La foto quedó en la carpeta Entregados con el nombre #16062');
ok(APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000001', tipo: 'PEDIDO', id: '#16062', resultado: 'ENTREGADO', foto: FOTO }).repetido, 'Si llega dos veces (mala señal) no se duplica');
ok(APP.post({ accion: 'inicio', token: tJL }).pedidos.length === 2, 'Sale de su lista al instante (antes de que Operaciones se entere)');
APP.avanzar(1 / 60);
r = robot();
ok(r.hecho.cierres === 1, 'El robot pasa el cierre a la API');
ok(filasDe('APP_Cierres')[0].Estado === 'ENVIADO', 'APP_Cierres: ENVIADO');
ok(opsFila('#16062')[22] === true && opsFila('#16062')[21] instanceof Date, 'Operaciones: casilla W marcada y fecha en V');
ok(opsFila('#16062')[26] === c1.urlFoto, 'Operaciones: foto en AA');
ok(hEnt.datos.length === 2 && hEnt.datos[1][1] === '#16062' && hEnt.datos[1][4] === 'ENTREGADO' && hEnt.datos[1][16] === 'Sra. Torres', 'APP_Entregas: renglón con quién recibió (para las fórmulas de Operaciones)');
ok(hEnt.datos[1][0] === '2026-11-04 10:01:00', 'Se anota la hora real de la entrega (la del celular)');
ok(opsFila('#16062')[15] === 'ENTREGADO', 'ESTATUS: ENTREGADO');
APP.avanzar(0.5); r = robot();
ok(APP.post({ accion: 'inicio', token: tJL }).pedidos.length === 2, 'Ya no regresa a su lista (Operaciones lo da por cerrado)');
// el robot reintenta un cierre ya enviado (se perdió la respuesta): no duplica APP_Entregas
hoja('APP_Cierres').datos[1][APP.ctx.APPG.ENC.APP_Cierres.indexOf('Estado')] = 'PENDIENTE';
robot();
ok(hEnt.datos.length === 2 && filasDe('APP_Cierres')[0].Estado === 'ENVIADO', 'Reintento del mismo cierre: no se duplica en APP_Entregas');

titulo('No entregué (retorno) y seguridad');
const sinMotivo = APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000002', tipo: 'PEDIDO', id: '#16063', resultado: 'RETORNO', foto: FOTO });
ok(!sinMotivo.ok && sinMotivo.codigo === 'CAP-05', 'Retorno sin motivo: no deja (CAP-05)');
APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000002', tipo: 'PEDIDO', id: '#16063', resultado: 'RETORNO', motivo: 'No se encontraba cliente', comentario: 'Se llamó 3 veces', foto: FOTO });
// Jose Luis intenta cerrar el pedido de Antonio
APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000003', tipo: 'PEDIDO', id: '#16070', fila: 6, resultado: 'ENTREGADO', foto: FOTO });
r = robot();
ok(opsFila('#16063')[18] === true && opsFila('#16063')[28] === 'No se encontraba cliente' && opsFila('#16063')[29] === 'Se llamó 3 veces', 'Retorno: casilla S, motivo en AC y comentario en AD');
ok(opsFila('#16063')[15] === 'PEDIDO RETORNADO', 'ESTATUS: PEDIDO RETORNADO');
ok(APP.archivos.some(a => a.carpeta === '1aRw_0Xv719WXD6cyxzLD7yEGZ2jHZFpu' && a.nombre === '#16063'), 'Foto del retorno en la carpeta RETORNO');
const c3 = filasDe('APP_Cierres').find(c => c.IdCierre === 'cierre-000003');
ok(c3.Estado === 'ERROR' && /API-02/.test(c3.UltimoError), 'Cerrar el pedido de otro gestor: la API lo rechaza (API-02) y queda en ERROR');
ok(opsFila('#16070')[22] === false, 'El pedido de Antonio NO se marcó');
ok(filasDe('APP_Problemas').some(p => p.Codigo === 'API-02'), 'Queda en APP_Problemas para la administradora');

titulo('Recolectar con escaneo');
const rec = APP.post({ accion: 'recolectar', token: tJL, codigos: ['C-PV-0019', '#16018', 'VREM-00072092', 'C-PV-0002', 'BOT-0005', 'c-pv-0019'] });
const R = c => rec.resultados.find(x => x.codigo.toUpperCase() === c);
ok(R('C-PV-0019').ok && R('C-PV-0019').tipo === 'TRASPASO' && R('C-PV-0019').destino === 'Doctores · Rebotica', 'C-PV-0019: traspaso con su origen y destino');
ok(R('#16018').ok && R('#16018').tipo === 'PEDIDO' && R('#16018').enPedidos, '#16018: lo reconoce como PEDIDO (ya está en sus pedidos)');
ok(!R('VREM-00072092').ok && R('VREM-00072092').pideDestino, 'Remisión vieja: pide a dónde va');
ok(!R('C-PV-0002').ok && /ENTREGADO/.test(R('C-PV-0002').mensaje), 'C-PV-0002 ya entregado: no se puede recolectar');
ok(!R('BOT-0005').ok && /eliminación/.test(R('BOT-0005').mensaje), 'BOT-0005 con eliminación solicitada: no');
ok(rec.resultados[5].repetido, 'Leer dos veces el mismo folio (minúsculas): "Ya lo habías leído"');
const rec2 = APP.post({ accion: 'recolectar', token: tJL, codigos: [{ codigo: 'VREM-00072092', destino: 'Oficinas · Logística', contenido: 'Remisión' }, 'BOT-0013', 'C-PV-0017'] });
ok(rec2.resultados.every(x => x.ok) && rec2.resultados[0].tipo === 'OTRO', 'Con destino escrito: se recolecta como OTRO');
ok(rec2.resultados[2].exigeFirma, 'C-PV-0017 dice "Efectivo": exige firma');
r = robot();
ok(estT('C-PV-0019') === 'RECOLECTADO' && hRes.datos.find(f => f[0] === 'C-PV-0019')[encT.indexOf('Gestor')] === 'Jose Luis', 'Sistema de Traspasos: C-PV-0019 RECOLECTADO por Jose Luis (rastreo: "Recolectado por gestoría")');
ok(hMov.datos.some(m => m[3] === 'C-PV-0019' && m[4] === 'RECOLECTADO POR GESTORÍA') && hAv.datos.some(a => a[3] === 'C-PV-0019' && a[2] === 'D-RB'), 'Movimiento y aviso al destino');
ok(hHist.datos.some(h => h[1] === '#16018' && h[4] === 'RECOLECTADO') && opsFila('#16018')[15] === 'RECOLECTADO POR GESTOR', '#16018: Operaciones dice RECOLECTADO POR GESTOR');
ini = APP.post({ accion: 'inicio', token: tJL });
ok(ini.lleva.length === 4 && ini.hoy.recolectados === 5, 'Lleva 4 cosas fuera de sus pedidos (C-PV-0019, VREM, BOT-0013, C-PV-0017); 5 recolectadas hoy');

titulo('Entregar traspasos');
const ef = APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000004', tipo: 'TRASPASO', id: 'C-PV-0017', resultado: 'ENTREGADO' });
ok(!ef.ok && ef.codigo === 'CAP-08', 'Efectivo sin firma ni quién recibió: no deja (CAP-08)');
const ef2 = APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000004', tipo: 'TRASPASO', id: 'C-PV-0017', resultado: 'ENTREGADO', recibio: 'Lalo', firma: FIRMA });
ok(ef2.ok, 'Con firma y nombre: sí');
ok(APP.archivos.some(a => a.carpeta.indexOf('RAIZ/') === 0 && a.nombre === 'C-PV-0017 FIRMA') && filasDe('APP_Problemas').some(p => p.Codigo === 'DRV-01'),
   'Carpeta Firmas sin permiso: la firma va al respaldo y queda DRV-01');
APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000005', tipo: 'TRASPASO', id: 'BOT-0013', resultado: 'ENTREGADO', foto: FOTO });
r = robot();
ok(estT('C-PV-0017') === 'ENTREGADO_GESTOR' && estT('BOT-0013') === 'ENTREGADO_GESTOR', 'Sistema de Traspasos: ENTREGADO_GESTOR (falta que el destino confirme)');
ok(APP.post({ accion: 'inicio', token: tJL }).lleva.length === 2, 'Salen de lo que lleva');

titulo('Los pendientes fantasma: se limpian solos');
hRes.datos.find(f => f[0] === 'C-PV-0019')[encT.indexOf('Estatus')] = 'ENTREGADO';   // el destino le dio entrada sin que él lo escaneara
r = robot();
ok(filasDe('APP_Recolecciones').find(x => x.Codigo === 'C-PV-0019').Estado === 'CERRADO EN DESTINO', 'C-PV-0019: el destino lo recibió → CERRADO EN DESTINO');
ini = APP.post({ accion: 'inicio', token: tJL });
ok(ini.lleva.length === 1 && ini.lleva[0].codigo === 'VREM-00072092', 'Solo le queda la remisión vieja');
APP.avanzar(24 * 4); r = robot();
ok(filasDe('APP_Problemas').some(p => p.Codigo === 'DIS-02' && /VREM-00072092/.test(p.Detalle)), 'A los 3 días, la remisión vieja va a APP_Problemas (DIS-02)');
const nAntes = filasDe('APP_Problemas').length; robot();
ok(filasDe('APP_Problemas').length === nAntes, 'Y solo se avisa una vez');
APP.post({ accion: 'cerrar', token: tJL, idLocal: 'cierre-000006', tipo: 'RECOLECCION', id: 'VREM-00072092', resultado: 'PAQUETERIA', foto: FOTO });
ok(APP.post({ accion: 'inicio', token: tJL }).lleva.length === 0, '"Entregado a paquetería": sale de su lista');

titulo('Cambios a la API de OPERACIONES (directo)');
const tG = OPS.post({ accion: 'login', correo: 'joseluis@x', pin: 'PIN-JL-1' }).token;
const ajeno = OPS.post({ accion: 'estado', token: tG, fila: 6, id: '#16070', tipo: 'entregado' });
ok(!ajeno.ok && ajeno.error === 'PERMISO', 'Rol Gestor: no puede marcar un pedido de otro (antes sí podía)');
const propio = OPS.post({ accion: 'estado', token: tG, fila: 7, id: '#16018', tipo: 'cancelado', motivo: 'Entrega incorrecta' });
ok(propio.ok, 'Rol Gestor: puede cancelar uno suyo con motivo (antes solo entregar)');
ok(!OPS.post({ accion: 'estado', token: tG, fila: 7, id: '#16018', tipo: 'cancelado', valor: false }).ok, 'Rol Gestor: no puede desmarcar');
ok(OPS.post({ accion: 'rutaGestores', token: tG }).error === 'PERMISO', 'rutaGestores: solo el usuario App');
const tApp = OPS.post({ accion: 'login', correo: 'app.gestores', pin: 'PIN-APP-1' }).token;
ok(OPS.post({ accion: 'guardar', token: tApp, pedido: {} }).error === 'PERMISO', 'Usuario App: no puede capturar pedidos');
OPS.post({ accion: 'enTransito', token: tApp });
const lecturas = OPS.stats.openById;
OPS.post({ accion: 'rutaGestores', token: tApp });
OPS.post({ accion: 'rutaGestores', token: tApp });
ok(OPS.stats.openById - lecturas <= 4, 'rutaGestores usa la memoria de 60 s (no relee Operaciones cada vez)');

console.log('\n' + (total - fallas) + '/' + total + ' pruebas correctas');
process.exit(fallas ? 1 : 0);
