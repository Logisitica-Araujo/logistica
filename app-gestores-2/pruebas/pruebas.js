// Pruebas de App Gestores 2 con el simulador de Apps Script.
// Uso (desde esta carpeta):  node pruebas.js
const { crearEntorno } = require('./simulador');
const path = require('path');
const fs = require('fs');
const D = path.join(__dirname, '..', 'apps-script');
const ARCHIVOS = fs.readdirSync(D).filter(f => f.endsWith('.gs')).sort().map(f => path.join(D, f));

let fallas = 0, total = 0;
function ok(cond, txt) { total++; if (cond) console.log('  ✔ ' + txt); else { fallas++; console.log('  ✘ ' + txt); } }
function titulo(t) { console.log('\n== ' + t); }

function preparar() {
  const E = crearEntorno({ inicio: '2026-10-29T14:00:00Z' });
  const L = E.libroNuevo('App Gestores · Datos (PRUEBA)', 'ARCHIVO_APP');
  E.activar(L);
  E.cargar(ARCHIVOS);
  E.correr('INSTALAR');
  return { E, L };
}
const hoja = (L, n) => L.getSheetByName(n);
const encab = (L, n) => hoja(L, n).datos[0];

titulo('Instalar');
{
  const { E, L } = preparar();
  const nombres = ['APP_Config', 'APP_Usuarios', 'APP_Vehiculos', 'APP_Motivos', 'APP_Documentos', 'APP_Pedidos',
    'APP_Cierres', 'APP_Recolecciones', 'APP_Sesiones', 'APP_Log', 'APP_Problemas'];
  ok(nombres.every(n => hoja(L, n)), 'Crea las 11 pestañas');
  ok(encab(L, 'APP_Usuarios').join() === E.ctx.APPG.ENC.APP_Usuarios.join(), 'APP_Usuarios con sus encabezados');
  ok(hoja(L, 'APP_Motivos').getLastRow() === 12, 'Carga los 11 motivos de la app actual');
  ok(hoja(L, 'APP_Config').datos.some(f => f[0] === 'EXIGIR_FOTO_ENTREGA' && f[1] === true), 'Foto obligatoria por defecto');
  ok(hoja(L, 'APP_Config').datos.some(f => f[0] === 'EXIGIR_FIRMA_ENTREGA' && f[1] === false), 'Firma opcional por defecto');
  ok(E.props.getProperty('SAL') && E.props.getProperty('SAL').length > 40, 'Crea la sal secreta en Propiedades');
  ok(E.props.getProperty('ID_ARCHIVO') === 'ARCHIVO_APP', 'Recuerda el ID del archivo');

  // Reparar: no duplica nada y conserva lo editado
  const sal = E.props.getProperty('SAL');
  hoja(L, 'APP_Config').datos[1][1] = false;          // la administradora cambió un valor
  const filasCfg = hoja(L, 'APP_Config').getLastRow();
  E.correr('INSTALAR');
  ok(hoja(L, 'APP_Config').getLastRow() === filasCfg, 'Reinstalar no duplica la configuración');
  ok(hoja(L, 'APP_Config').datos[1][1] === false, 'Reinstalar respeta lo que editaste');
  ok(hoja(L, 'APP_Motivos').getLastRow() === 12, 'Reinstalar no duplica motivos');
  ok(E.props.getProperty('SAL') === sal, 'Reinstalar NO cambia la sal (las contraseñas siguen sirviendo)');

  // Columna nueva en una versión futura: se agrega al final sin mover las demás
  hoja(L, 'APP_Usuarios').datos[0] = hoja(L, 'APP_Usuarios').datos[0].filter(h => h !== 'Notas');
  E.correr('INSTALAR');
  ok(encab(L, 'APP_Usuarios').indexOf('Notas') === encab(L, 'APP_Usuarios').length - 1, 'Repara una columna que falte');
}

titulo('Alta de gestor e inicio de sesión');
{
  const { E, L } = preparar();
  const alta = E.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
  ok(alta.numero === 'G-01' && alta.clave.length === 8, 'Alta: número G-01 y contraseña temporal de 8');
  const fila = hoja(L, 'APP_Usuarios').datos[1];
  ok(fila.indexOf(alta.clave) < 0, 'La contraseña NO queda escrita en la hoja (solo cifrada)');
  ok(E.correr('altaGestor', 'Antonio', 'Antonio "A"', 'antonio').numero === 'G-02', 'Segundo gestor: G-02');
  let err = null; try { E.correr('altaGestor', 'Otro', 'Otro', 'joseluis'); } catch (e) { err = e; }
  ok(err && /Ya existe/.test(err.message), 'No deja repetir usuario');
  err = null; try { E.correr('altaGestor', 'X', 'X', 'jose luis'); } catch (e) { err = e; }
  ok(err, 'No acepta usuario con espacios');

  const r1 = E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave, dispositivo: 'Android' });
  ok(r1.ok && r1.token && r1.debeCambiar === true && r1.numero === 'G-01', 'Entra y le pide cambiar la contraseña');
  ok(E.post({ accion: 'login', usuario: 'JoseLuis ', clave: alta.clave }).ok, 'El usuario no distingue mayúsculas ni espacios');
  ok(hoja(L, 'APP_Sesiones').getLastRow() === 3, 'Cada intento queda en APP_Sesiones');

  const corta = E.post({ accion: 'cambiarClave', token: r1.token, actual: alta.clave, nueva: '123' });
  ok(!corta.ok && corta.codigo === 'CAP-01', 'Contraseña corta: CAP-01');
  const mala = E.post({ accion: 'cambiarClave', token: r1.token, actual: 'otra', nueva: 'segura-2026' });
  ok(!mala.ok && mala.codigo === 'APP-02', 'Contraseña actual equivocada: APP-02');
  const r2 = E.post({ accion: 'cambiarClave', token: r1.token, actual: alta.clave, nueva: 'segura-2026' });
  ok(r2.ok && r2.token, 'Cambia su contraseña');
  ok(E.post({ accion: 'yo', token: r1.token }).ok, 'El token anterior sigue sirviendo (otros celulares no se salen)');
  ok(!E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave }).ok, 'La temporal ya no sirve');
  const r3 = E.post({ accion: 'login', usuario: 'joseluis', clave: 'segura-2026' });
  ok(r3.ok && r3.debeCambiar === false, 'Entra con la nueva, ya sin pedir cambio');

  const yo = E.post({ accion: 'yo', token: r3.token });
  ok(yo.ok && yo.nombre === 'Jose Luis' && yo.reglas.exigirFotoEntrega === true && yo.reglas.exigirFirmaEntrega === false,
     'yo: perfil y reglas (foto sí, firma no)');
  ok(yo.reglas.palabrasExigenFirma.join() === 'Efectivo,Factura,Cortes', 'yo: palabras que exigen firma');
}

titulo('La sesión no caduca, pero se puede cerrar desde la oficina');
{
  const { E, L } = preparar();
  const alta = E.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
  const t = E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave }).token;
  E.avanzar(24 * 90);  // 90 días después
  ok(E.post({ accion: 'yo', token: t }).ok, '90 días después sigue dentro');

  E.correr('bajaGestor', 'joseluis');
  const b = E.post({ accion: 'yo', token: t });
  ok(!b.ok && b.codigo === 'CEL-06', 'Dado de baja: sale de inmediato (CEL-06)');
  ok(!E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave }).ok, 'Dado de baja: no puede entrar');

  const f = hoja(L, 'APP_Usuarios').datos[1]; f[E.ctx.APPG.ENC.APP_Usuarios.indexOf('Activo')] = true;
  E.cache.remove('usr_joseluis');
  const nueva = E.correr('restablecerClave', 'joseluis');
  const r = E.post({ accion: 'yo', token: t });
  ok(!r.ok && r.codigo === 'CEL-06', 'Al restablecer la contraseña se cierran sus sesiones');
  ok(E.post({ accion: 'login', usuario: 'joseluis', clave: nueva }).debeCambiar === true, 'Con la nueva temporal entra y debe cambiarla');
}

titulo('Seguridad');
{
  const { E } = preparar();
  const alta = E.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
  const t = E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave }).token;
  const falso = Buffer.from('antonio|1').toString('base64') + '.' + t.split('.')[1];
  ok(E.post({ accion: 'yo', token: falso }).codigo === 'CEL-06', 'Token inventado: rechazado');
  ok(E.post({ accion: 'yo' }).codigo === 'CEL-06', 'Sin token: rechazado');
  const n1 = E.post({ accion: 'login', usuario: 'nadie', clave: 'x' });
  const n2 = E.post({ accion: 'login', usuario: 'joseluis', clave: 'x' });
  ok(n1.mensaje === n2.mensaje, 'Mismo mensaje si el usuario no existe o la contraseña está mal');
  for (let i = 0; i < 4; i++) E.post({ accion: 'login', usuario: 'joseluis', clave: 'x' });
  const bloq = E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave });
  ok(!bloq.ok && /Demasiados intentos/.test(bloq.mensaje), 'A los 5 intentos fallidos se bloquea, aunque luego ponga la buena');
  E.avanzar(0.26);  // 16 minutos
  ok(E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave }).ok, 'Pasados 15 minutos puede entrar');
}

titulo('Mantenimiento, errores y acciones futuras');
{
  const { E, L } = preparar();
  const alta = E.correr('altaGestor', 'Jose Luis', 'Jose Luis', 'joseluis');
  const t = E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave }).token;
  const cfg = hoja(L, 'APP_Config').datos; cfg.find(f => f[0] === 'APP_BLOQUEADA')[1] = true;
  E.cache.remove('cfg');
  const m = E.post({ accion: 'yo', token: t });
  ok(!m.ok && m.codigo === 'APP-07' && /mantenimiento/.test(m.mensaje), 'APP_BLOQUEADA: avisa mantenimiento (APP-07)');
  ok(E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave }).codigo === 'APP-07', 'APP_BLOQUEADA: tampoco deja entrar');
  cfg.find(f => f[0] === 'APP_BLOQUEADA')[1] = false; E.cache.remove('cfg');

  ok(E.post({ accion: 'inicio', token: t }).codigo === 'APP-09', 'Acción de la etapa 2: avisa que viene después (APP-09)');
  ok(E.post({ accion: 'borrarTodo', token: t }).codigo === 'APP-01', 'Acción desconocida: APP-01');
  const g = E.ctx.doGet({ parameter: { ping: '1' } });
  ok(JSON.parse(g.texto).version === E.ctx.APPG.VERSION, 'ping responde la versión');

  hoja(L, 'APP_Usuarios').datos[0][3] = 'Usr';  // alguien renombró la columna Usuario
  E.cache.remove('usr_joseluis');
  const r = E.post({ accion: 'login', usuario: 'joseluis', clave: alta.clave });
  ok(!r.ok && r.codigo === 'APP-02', 'Columna renombrada: no deja entrar (y no truena)');
}

titulo('Prueba del editor (PRUEBA_ETAPA1)');
{
  const { E } = preparar();
  const txt = E.correr('PRUEBA_ETAPA1');
  ok(!/✘/.test(txt) && (txt.match(/✔/g) || []).length === 8, 'PRUEBA_ETAPA1 pasa sus 8 revisiones');
}

console.log('\n' + (total - fallas) + '/' + total + ' pruebas correctas');
process.exit(fallas ? 1 : 0);
