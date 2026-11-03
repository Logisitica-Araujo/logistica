// Pruebas del servidor de la APP GESTORES con un simulador de Apps Script.
// Uso (desde esta carpeta):  node pruebas.js
const { crearEntorno } = require('./simulador');
const path = require('path');
const D = path.join(__dirname, '..', 'apps-script');

let fallas = 0, total = 0;
function ok(cond, txt) { total++; if (cond) console.log('  ✔ ' + txt); else { fallas++; console.log('  ✘ ' + txt); } }
function titulo(t) { console.log('\n== ' + t); }

const ID = '1cPHTH2JwM92iD2wSxf4JauYLk9VBLv6T2fHhtxP-kmc';

function preparar() {
  // 2026-10-20 08:00 en CDMX = 14:00 UTC
  const E = crearEntorno({ inicio: '2026-10-20T14:00:00Z' });
  const L = E.libroNuevo('Logística Operaciones', ID);
  const H = (n, d) => { const h = L.insertSheet(n); h.datos = d; return h; };
  H('APP_Config', [['Clave', 'Valor', 'Descripción'], ['CACHE_SEG', 15, ''], ['REVISAR_NUEVOS_SEG', 120, ''],
    ['EXIGIR_FIRMA_ENTREGA', false, ''], ['EXIGIR_FOTO_ENTREGA', true, ''], ['CANDADO_VEHICULO_MIN', 30, ''],
    ['DURACION_SESION_HORAS', 14, ''], ['VEHICULO_SIN', 'Sin vehículo', '']]);
  H('APP_Usuarios', [['Gestor', 'Codigo', 'Correo', 'Activo', 'UltimoAcceso', 'Notas'],
    ['Juan Perez', '123', '', true, '', ''], ['Ana Lopez', '456', '', true, '', '']]);
  H('APP_Vehiculos', [['Vehiculo', 'Placa', 'Activo', 'Notas', 'Tipo'], ['Saveiro', 'ABC', true, '', 'AUTO'],
    ['Gixxer', 'M1', true, '', 'MOTO'], ['Sin vehículo', '', true, '', 'NINGUNO']]);
  H('APP_Sesiones', [['Token', 'Gestor', 'Vehiculo', 'InicioISO', 'UltimoCambioVehISO', 'Activa', 'UserAgent']]);
  H('APP_Vehiculos_Uso', [['FechaHora', 'Gestor', 'VehiculoAnterior', 'VehiculoNuevo', 'Motivo', 'Token']]);
  H('APP_Entregas', [['FechaHora', 'IDPedido', 'Gestor', 'Vehiculo', 'Resultado', 'Motivo', 'Cliente', 'Direccion',
    'Observaciones', 'Area', 'SubArea', 'URLFoto', 'URLFirma', 'Latitud', 'Longitud', 'ComentarioGestor', 'Recibio']]);
  H('APP_Traspasos', [['Folio', 'FechaRecoleccionISO', 'Gestor', 'Vehiculo', 'Origen', 'Destino', 'Area', 'Contenido', 'Estado', 'URLFotoRecoleccion']]);
  H('APP_Traspasos_Hist', [['FechaHora', 'Folio', 'Gestor', 'Vehiculo', 'Evento', 'Origen', 'Destino', 'Area', 'Contenido',
    'Resultado', 'Motivo', 'ComentarioGestor', 'URLFoto', 'Latitud', 'Longitud']]);
  H('APP_Catalogo_Traspasos', [['Folio', 'Origen', 'Destino', 'Area', 'Contenido']]);
  H('APP_Sucursales', [['Sucursal', 'Direccion', 'URLMaps', 'Activo'], ['VERTIZ PV', 'Dir', 'url', true]]);
  H('APP_Motivos', [['Tipo', 'Motivo', 'PideComentario', 'Activo'], ['CANCELADO', 'Entrega incorrecta', false, true],
    ['RETORNO', 'No se encontraba cliente', false, true], ['TRASPASO', 'Otro', true, true]]);
  H('APP_Log', [['FechaHora', 'Gestor', 'Accion', 'Detalle']]);
  H('APP_Documentos', [['Categoria', 'Titulo', 'Tipo', 'Contenido', 'Activo', 'Orden']]);
  // Operaciones: fila 1 basura, fila 2 encabezados, datos desde la 3. Columnas A..AH (34)
  const enc = new Array(34).fill('');
  enc[0] = 'ID Pedido / Tarea'; enc[3] = 'Nombre'; enc[4] = 'Dirección / Destino'; enc[8] = 'Gestores'; enc[15] = 'ESTATUS';
  enc[17] = 'Fecha RETORNADO'; enc[18] = 'Pedido Retornado'; enc[21] = 'Fecha de Entrega'; enc[22] = 'Marcar como Entregado';
  enc[24] = 'Gestor Asignado'; enc[25] = 'GPS'; enc[26] = 'Foto'; enc[27] = 'Firma'; enc[28] = 'Motivo'; enc[29] = 'Solución'; enc[33] = 'Observaciones';
  const fila = (id, nombre, gestor, est) => { const f = new Array(34).fill(''); f[0] = id; f[3] = nombre; f[4] = 'Calle ' + id; f[8] = gestor; f[15] = est || ''; return f; };
  H('Operaciones', [new Array(34).fill('x'), enc,
    fila('#100', 'Cliente A', 'Juan Perez'), fila('#101', 'Cliente B', 'Juan Perez'), fila('#102', 'Cliente C', 'Juan Perez'),
    fila('#103', 'Cliente D', 'Ana Lopez'), fila('#104', 'Cliente E', 'Juan Perez', 'ENTREGADO')]);
  H('Datos', [['x'], ['Gestores', 'Codigos']]);

  // Todos los archivos juntos, como los carga Apps Script
  E.cargar(require('fs').readdirSync(D).filter(f => f.endsWith('.gs')).sort().map(f => path.join(D, f)));
  return { E, L };
}

/* ------------------------------------------------------------------ */
titulo('1. Login trae el arranque (un viaje menos)');
let { E, L } = preparar();
let r = E.post({ accion: 'login', nombre: 'Juan Perez', codigo: '123' });
ok(r.ok, 'login correcto');
ok(r.datos.arranque && r.datos.arranque.estado && r.datos.arranque.catalogos, 'login devuelve estado y catálogos');
ok(r.datos.arranque.estado.vehiculo === '', 'recién entrado no trae vehículo');
const tokJuan = r.datos.token;
ok(L.getSheetByName('APP_Sesiones').datos[0][7] === 'UltimaActividadISO', 'APP_Sesiones ganó las columnas nuevas');

titulo('2. Elegir vehículo devuelve el estado del menú');
r = E.post({ accion: 'setVehiculo', token: tokJuan, vehiculo: 'Saveiro' });
ok(r.ok && r.datos.vehiculo === 'Saveiro', 'vehículo asignado');
ok(r.datos.estado && r.datos.estado.vehiculo === 'Saveiro', 'trae el estado ya con el vehículo');
ok(r.datos.estado.contadores.pedidos === 3, 'cuenta 3 pendientes (el #104 ya está ENTREGADO)');

titulo('3. Otro gestor no puede tomar el mismo vehículo hoy');
const tokAna = E.post({ accion: 'login', nombre: 'Ana Lopez', codigo: '456' }).datos.token;
r = E.post({ accion: 'setVehiculo', token: tokAna, vehiculo: 'Saveiro' });
ok(!r.ok && /OCUPADO/.test(r.error), 'Saveiro sale ocupado por Juan');

titulo('4. La sesión ya NO se cierra a las 14 horas');
E.avanzar(13);           // 21:00 CDMX
r = E.post({ accion: 'estado', token: tokJuan });
ok(r.ok, 'a las 13 h sigue entrando (y se anota actividad)');
E.avanzar(2);            // 15 h desde el login, 23:00 CDMX, mismo día
r = E.post({ accion: 'estado', token: tokJuan });
ok(r.ok, 'a las 15 h sigue entrando (antes aquí ya lo sacaba)');
ok(r.datos.vehiculo === 'Saveiro', 'mismo día: conserva el vehículo');

titulo('5. Día siguiente: misma sesión, pero pide vehículo y checklist');
E.avanzar(10);           // día 21, 09:00 CDMX
r = E.post({ accion: 'arranque', token: tokJuan });
ok(r.ok, 'al día siguiente entra sin login');
ok(r.datos.estado.vehiculo === '', 'el vehículo de ayer se soltó → la app pedirá elegirlo');
r = E.post({ accion: 'setVehiculo', token: tokAna, vehiculo: 'Saveiro' });
ok(r.ok, 'Ana ya puede tomar la Saveiro (lo de ayer no bloquea)');
r = E.post({ accion: 'setVehiculo', token: tokJuan, vehiculo: 'Gixxer' });
ok(r.ok && r.datos.estado.vehiculo === 'Gixxer', 'Juan elige la Gixxer sin candado (primera del día)');

titulo('6. Sin usar la app 72 h → se cierra sola');
E.avanzar(71);
r = E.post({ accion: 'estado', token: tokJuan });
ok(r.ok, 'a las 71 h sin usarla sigue abierta');
E.avanzar(73);
r = E.post({ accion: 'estado', token: tokJuan });
ok(!r.ok && r.error === 'SESION_EXPIRADA', 'a las 73 h sin usarla expira');

titulo('7. Sesión vieja (formato de 7 columnas) sigue funcionando');
({ E, L } = preparar());
const ahoraISO = new Date(E.reloj.ahora - 2 * 3600000).toISOString();
L.getSheetByName('APP_Sesiones').datos.push(['TVIEJO', 'Juan Perez', 'Saveiro', ahoraISO, ahoraISO, true, 'ua']);
r = E.post({ accion: 'estado', token: 'TVIEJO' });
ok(r.ok && r.datos.vehiculo === 'Saveiro', 'la sesión de antes de la actualización entra y conserva el vehículo');
const viejaVencida = new Date(E.reloj.ahora - 80 * 3600000).toISOString();
L.getSheetByName('APP_Sesiones').datos.push(['TVENCIDA', 'Juan Perez', '', viejaVencida, '', true, 'ua']);
r = E.post({ accion: 'estado', token: 'TVENCIDA' });
ok(!r.ok && r.error === 'SESION_EXPIRADA', 'una sesión vieja sin uso de 80 h expira');

titulo('8. Logout invalida al momento (aunque esté en memoria)');
({ E, L } = preparar());
let t = E.post({ accion: 'login', nombre: 'Juan Perez', codigo: '123' }).datos.token;
E.post({ accion: 'estado', token: t });
E.post({ accion: 'logout', token: t });
r = E.post({ accion: 'estado', token: t });
ok(!r.ok && r.error === 'SESION_EXPIRADA', 'después de salir ya no entra');

titulo('9. Robot: llena APP_Pedidos y no reescribe si nada cambió');
({ E, L } = preparar());
E.correr('instalarSyncPedidos');
const shP = L.getSheetByName('APP_Pedidos');
ok(shP.getLastRow() === 1 + 4, 'APP_Pedidos con 4 pendientes (3 de Juan, 1 de Ana)');
let antes = E.stats.escrituras[L.nombre + '/APP_Pedidos'] || 0;
E.correr('sincronizarPedidos');
ok((E.stats.escrituras[L.nombre + '/APP_Pedidos'] || 0) === antes, 'segunda vuelta sin cambios: no escribe nada');
E.reloj.ahora = Date.parse('2026-10-21T07:00:00Z');   // 01:00 CDMX
ok(E.correr('sincronizarPedidos') === -2, 'fuera de horario (1 a.m.) no corre');
E.reloj.ahora = Date.parse('2026-10-20T15:00:00Z');

titulo('10. Cerrar pedido: rápido, y el robot lo pasa a Operaciones');
t = E.post({ accion: 'login', nombre: 'Juan Perez', codigo: '123' }).datos.token;
E.post({ accion: 'setVehiculo', token: t, vehiculo: 'Saveiro' });
r = E.post({ accion: 'pedidos', token: t });
ok(r.ok && r.datos.length === 3, 'Juan ve sus 3 pendientes desde la hoja chica');
const escOpsAntes = E.stats.escrituras[L.nombre + '/Operaciones'] || 0;
r = E.post({ accion: 'cerrarPedido', token: t, p: { id: '#100', resultado: 'ENTREGADO', foto: 'data:image/jpeg;base64,' + Buffer.from('foto').toString('base64'), lat: '19.4', lng: '-99.1', cliente: 'Cliente A' } });
ok(r.ok, 'cierre correcto');
ok(!E.lock(), 'el candado quedó libre');
ok((E.stats.escrituras[L.nombre + '/Operaciones'] || 0) === escOpsAntes, 'el gestor NO esperó a escribir en Operaciones');
const ent = L.getSheetByName('APP_Entregas');
ok(ent.datos[1][17] === 'PENDIENTE' && ent.datos[0][17] === 'EnOperaciones', 'quedó marcado PENDIENTE para el robot');
ok(E.archivos.length === 1 && E.archivos[0].nombre === '#100', 'la foto se guardó en Drive con el ID como nombre');
r = E.post({ accion: 'pedidos', token: t });
ok(r.datos.length === 2 && !r.datos.some(p => p.id === '#100'), 'el #100 ya no aparece en pendientes');
r = E.post({ accion: 'cerrarPedido', token: t, p: { id: '#100', resultado: 'ENTREGADO', foto: 'data:image/jpeg;base64,eA==' } });
ok(!r.ok && /ya fue cerrado/.test(r.error), 'un segundo cierre del mismo pedido se rechaza');
E.correr('sincronizarPedidos');
const ops = L.getSheetByName('Operaciones').datos[2];
ok(ops[22] === true && ops[21] instanceof Date, 'el robot escribió fecha y palomita de entregado en Operaciones');
ok(ops[25] === '19.4, -99.1' && ops[26] === 'https://drive/#100', 'y también GPS y foto');
ok(ops[15] === '', 'nunca tocó la columna ESTATUS');
ok(/^OK /.test(ent.datos[1][17]), 'el cierre quedó marcado OK');
ok(shP.datos.slice(1).filter(f => f[0]).length === 3, 'APP_Pedidos ya no tiene el #100');

titulo('11. Sin robot instalado se escribe en Operaciones como antes');
({ E, L } = preparar());
t = E.post({ accion: 'login', nombre: 'Juan Perez', codigo: '123' }).datos.token;
E.post({ accion: 'setVehiculo', token: t, vehiculo: 'Saveiro' });
r = E.post({ accion: 'cerrarPedido', token: t, p: { id: '#101', resultado: 'RETORNO', motivo: 'No se encontraba cliente', foto: 'data:image/jpeg;base64,eA==' } });
ok(r.ok && L.getSheetByName('Operaciones').datos[3][18] === true, 'escrito al momento en Operaciones (retorno)');

titulo('12. Traspasos: recolectar y entregar');
r = E.post({ accion: 'recolectarTraspasos', token: t, folios: ['TR-1', 'TR-2', 'TR-1'] });
ok(r.ok && r.datos.guardados === 2, 'recolecta 2 (el repetido se rechaza)');
ok(!E.lock(), 'candado libre después de recolectar');
r = E.post({ accion: 'cerrarTraspaso', token: t, p: { folio: 'TR-1', resultado: 'ENTREGADO', destino: 'VERTIZ PV', foto: 'data:image/jpeg;base64,eA==' } });
ok(r.ok, 'entrega el TR-1');
r = E.post({ accion: 'cerrarTraspaso', token: t, p: { folio: 'TR-1', resultado: 'ENTREGADO', destino: 'VERTIZ PV', foto: 'data:image/jpeg;base64,eA==' } });
ok(!r.ok && /ya no está en tu lista/.test(r.error), 'no se puede entregar dos veces');
r = E.post({ accion: 'traspasosPendientes', token: t });
ok(r.ok && r.datos.length === 1 && r.datos[0].folio === 'TR-2', 'queda solo el TR-2');

titulo('13. Libro de la app abierto UNA vez por consulta');
E.stats.openById = 0;
E.post({ accion: 'arranque', token: t });
ok(E.stats.openById === 1, 'arranque abrió el libro ' + E.stats.openById + ' vez (antes: una por cada hoja leída)');

titulo('14. Migración a libro propio');
({ E, L } = preparar());
E.correr('instalarSyncPedidos');
t = E.post({ accion: 'login', nombre: 'Juan Perez', codigo: '123' }).datos.token;
E.post({ accion: 'setVehiculo', token: t, vehiculo: 'Saveiro' });
E.correr('migrarAppALibroPropio');
const idNuevo = E.props.getProperty('ID_HOJA_APP');
const N = E.libros[idNuevo];
ok(N && N.getSheetByName('APP_Sesiones') && N.getSheetByName('APP_Pedidos'), 'el libro nuevo tiene las hojas APP_');
ok(L.getSheetByName('OLD_APP_Sesiones') && !L.getSheetByName('APP_Sesiones'), 'las viejas quedaron como OLD_');
ok(L.getSheetByName('Operaciones'), 'Operaciones sigue en el libro de la oficina');
r = E.post({ accion: 'estado', token: t });
ok(r.ok && r.datos.vehiculo === 'Saveiro', 'la sesión sigue viva después de migrar');
r = E.post({ accion: 'cerrarPedido', token: t, p: { id: '#102', resultado: 'ENTREGADO', foto: 'data:image/jpeg;base64,eA==' } });
ok(!N.getSheetByName('APP_Entregas') && L.getSheetByName('APP_Entregas'), 'APP_Entregas se queda en el libro de la oficina (la usa la fórmula de V)');
ok(r.ok && L.getSheetByName('APP_Entregas').getLastRow() === 2, 'el cierre se guarda en APP_Entregas de la oficina');
ok(N.getSheetByName('APP_Log').getLastRow() > 1 && L.getSheetByName('OLD_APP_Log'), 'lo demás (bitácora, sesiones…) ya va al libro nuevo');
E.correr('sincronizarPedidos');
ok(L.getSheetByName('Operaciones').datos[4][22] === true, 'y el robot lo escribe en Operaciones del libro de la oficina');
E.stats.openById = 0;
E.post({ accion: 'estado', token: t });
ok(E.stats.openById <= 2, 'estado abre cada libro a lo más una vez (' + E.stats.openById + ')');
E.correr('deshacerMigracionLibroApp');
ok(L.getSheetByName('APP_Sesiones') && !E.props.getProperty('ID_HOJA_APP'), 'deshacer devuelve todo al libro de siempre');

console.log('\n' + (total - fallas) + ' de ' + total + ' pruebas pasaron' + (fallas ? ' — ' + fallas + ' FALLARON' : ''));
process.exit(fallas ? 1 : 0);
