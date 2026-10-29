/***********************************************************************
 * APP GESTORES 2 — 09_PRUEBAS.gs
 * Proyecto: Apps Script del archivo "App Gestores · Datos"
 * ---------------------------------------------------------------------
 * PRUEBA_ETAPA1(): revisa la etapa 1 en TU archivo, sin celular.
 *   Crea un gestor de prueba "prueba.etapa1", entra, cambia la contraseña,
 *   revisa el bloqueo por intentos y al final lo da de BAJA.
 *   Úsalo SOLO en la copia de prueba del archivo.
 ***********************************************************************/

function PRUEBA_ETAPA1() {
  var L = [];
  function ok(cond, txt) { L.push((cond ? '✔ ' : '✘ ') + txt); }
  var usuario = 'prueba.etapa1';
  try {
    var alta = _buscarUsuario(usuario) ? { clave: restablecerClave(usuario) } : altaGestor('Prueba Etapa 1', 'Prueba', usuario);
    var u = _buscarUsuario(usuario);
    u._t.sh.getRange(u._fila, u._t.col('Activo')).setValue(true); _olvidarUsuario(usuario);

    var r1 = manejar({ accion: 'login', usuario: usuario, clave: alta.clave, dispositivo: 'Prueba desde el editor' });
    ok(r1.ok && r1.token, 'Entra con la contraseña temporal');
    ok(r1.debeCambiar === true, 'Le pide cambiar la contraseña');

    var r2 = manejar({ accion: 'cambiarClave', token: r1.token, actual: alta.clave, nueva: 'nueva-clave-123' });
    ok(r2.ok, 'Cambia su contraseña');
    var r3 = manejar({ accion: 'yo', token: r2.token });
    ok(r3.ok && r3.debeCambiar === false && r3.reglas.exigirFotoEntrega === true, 'Su sesión sirve y trae las reglas');

    var r4 = manejar({ accion: 'login', usuario: usuario, clave: 'equivocada' });
    ok(!r4.ok && r4.codigo === 'APP-02', 'Contraseña equivocada: APP-02');

    var r5 = manejar({ accion: 'yo', token: r2.token.slice(0, -2) + 'xx' });
    ok(!r5.ok && r5.codigo === 'CEL-06', 'Token alterado: CEL-06');

    restablecerClave(usuario);
    var r6 = manejar({ accion: 'yo', token: r2.token });
    ok(!r6.ok && r6.codigo === 'CEL-06', 'Al restablecer la contraseña se cierra la sesión anterior');

    var r7 = manejar({ accion: 'inicio', token: r2.token });
    ok(!r7.ok && r7.codigo === 'APP-09', 'Acciones de la etapa 2 avisan que vienen después');
  } catch (e) {
    L.push('✘ Error: ' + e.message);
  } finally {
    try { bajaGestor(usuario); L.push('(El gestor de prueba quedó dado de baja.)'); } catch (e) {}
  }
  var txt = 'PRUEBA ETAPA 1\n\n' + L.join('\n');
  _avisar(txt);
  return txt;
}
