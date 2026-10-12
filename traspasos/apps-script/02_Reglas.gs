/***********************************************************************
 * TRASPASOS FADERMEX — 02_Reglas.gs
 * ---------------------------------------------------------------------
 * LAS REGLAS DEL NEGOCIO, EN UN SOLO LUGAR.
 * Este mismo código lo usa el servidor (para validar de verdad) y la
 * página (para validar al instante cada escaneo en ráfaga). Por eso va
 * escrito como una función que se manda tal cual a la página.
 *
 * A = mapa de áreas: { 'NR': {id, corto, suc, sucNombre, tipo}, ... }
 *     tipo: OFICINAS | SUCURSAL | FORANEA | INDEPENDIENTE
 * E = mapa de estatus: { 'NUEVO': 'Nuevo traspaso', ... }
 ***********************************************************************/

function TR_REGLAS() {
  var R = {};

  R.limpio = function (s) { return String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, ''); };

  /** Lo que lee la pistola o lo que teclean. Acepta "NR-0040" y también "NR-0040-2/3". */
  R.folioDe = function (texto) {
    var s = R.limpio(texto);
    var m = s.match(/^(.+?-\d{3,})(-\d+\/\d+)?$/);
    return m ? m[1] : s;
  };
  R.valido = function (texto) { return /^[A-Z][A-Z0-9-]*-\d{3,}$/.test(R.folioDe(texto)); };

  R.esOf  = function (A, id) { return !!A[id] && A[id].tipo === 'OFICINAS'; };
  R.esMor = function (A, id) { return !!A[id] && A[id].tipo === 'FORANEA'; };

  R.nom = function (A, id) {
    var a = A[id];
    if (!a) return String(id || '');
    if (a.tipo === 'OFICINAS') return 'Oficinas · ' + a.corto;
    if (!a.sucNombre || R.limpio(a.corto) === R.limpio(a.sucNombre)) return a.corto;
    return a.sucNombre + ' · ' + a.corto;
  };

  /** En sucursales cualquiera recibe lo de PV o de Rebotica. En Oficinas, cada área lo suyo. */
  R.mismaSuc = function (A, dest, me) {
    if (dest === me) return true;
    var a = A[dest], b = A[me];
    if (!a || !b) return false;
    if (a.tipo !== 'SUCURSAL' && a.tipo !== 'FORANEA') return false;
    return a.suc === b.suc;
  };

  R.viaLog  = function (t) { return String(t.ruta || '').indexOf('VIA_LOGISTICA') === 0; };
  R.pasoLog = function (t) { return String(t.ruta || '') === 'VIA_LOGISTICA_OK'; };

  /** ¿Este traspaso aparece en "Entrantes" de esta área? */
  R.esEntrante = function (t, me, A) {
    if (R.mismaSuc(A, t.destino, me)) return true;
    return me === 'LOG' && R.viaLog(t) && (!R.pasoLog(t) || t.estatus === 'EN_LOGISTICA');
  };

  var nomE = function (E, k) { return (E && E[k]) || k; };

  /** ¿Puede "me" RECIBIR este traspaso? → {k:'ok'|'warn'|'err', m, accion, ubicable} */
  R.recibir = function (t, me, A, E) {
    if (!t) return { k: 'err', m: 'Ese folio no existe. Revisa que esté bien tecleado.' };
    if (t.solicitud) return { k: 'err', m: t.folio + ' tiene una solicitud de eliminación pendiente. No se debe mover hasta que responda un administrador.' };
    var esLog = me === 'LOG' && R.viaLog(t) && !R.pasoLog(t);
    if (!R.mismaSuc(A, t.destino, me) && !esLog) {
      var aqui = (A[me] && (A[me].tipo === 'SUCURSAL' || A[me].tipo === 'FORANEA')) ? A[me].sucNombre : R.nom(A, me);
      return { k: 'err', m: 'Este traspaso NO es para ' + aqui + '. Va para: ' + R.nom(A, t.destino) + '.', ubicable: true };
    }
    if (t.estatus === 'ENTREGADO') return { k: 'warn', m: t.folio + ' ya fue recibido anteriormente.' };
    var permitidos;
    if (esLog) {
      permitidos = R.esOf(A, t.origen) ? ['NUEVO', 'RECOLECTADO', 'ENTREGADO_GESTOR']
                                       : ['RECOLECTADO', 'ENTREGADO_GESTOR', 'PAQUETERIA'];
    } else {
      permitidos = ['RECOLECTADO', 'ENTREGADO_GESTOR', 'PAQUETERIA', 'EN_LOGISTICA', 'UBICADO', 'EXTRAVIADO'];
      if (R.esOf(A, t.origen) && R.esOf(A, t.destino)) permitidos.push('NUEVO');   // entrega interna en Oficinas
    }
    if (permitidos.indexOf(t.estatus) < 0) {
      if (t.estatus === 'NUEVO') return { k: 'err', m: t.folio + ' todavía no ha sido recolectado por gestoría.' };
      return { k: 'err', m: t.folio + ' está como "' + nomE(E, t.estatus) + '". No se puede recibir.' };
    }
    return { k: 'ok', m: '', accion: esLog ? 'EN_LOGISTICA' : 'ENTREGADO' };
  };

  /** ¿Se le puede entregar al gestor? modo 'ENTREGAR' (desde un área) o 'GESTOR' (celular del gestor). */
  R.salir = function (t, me, A, E, modo) {
    if (!t) return { k: 'err', m: 'Ese folio no existe. Revisa que esté bien tecleado.' };
    if (t.solicitud) return { k: 'err', m: t.folio + ' tiene una solicitud de eliminación pendiente. No se debe mover.' };
    if (t.estatus === 'RECOLECTADO') return { k: 'warn', m: t.folio + ' ya fue recolectado' + (t.gestor ? ' por ' + t.gestor : '') + '.' };
    if (modo === 'ENTREGAR' && t.origen !== me && !(me === 'LOG' && t.estatus === 'EN_LOGISTICA')) {
      return { k: 'err', m: t.folio + ' no sale de aquí. Sale de: ' + R.nom(A, t.origen) + '.' };
    }
    var ok = (t.estatus === 'NUEVO' && !R.esMor(A, t.origen) && !(R.viaLog(t) && R.esOf(A, t.origen)) &&
              !(R.esOf(A, t.origen) && R.esOf(A, t.destino))) ||
             (t.estatus === 'EN_LOGISTICA' && !R.esMor(A, t.destino) && !R.esOf(A, t.destino));
    if (!ok) return { k: 'err', m: t.folio + ' está como "' + nomE(E, t.estatus) + '". No se puede entregar a gestoría.' };
    return { k: 'ok', m: '' };
  };

  /** ¿Puede esta área mandarlo por paquetería? (Logística hacia Morelia, o Morelia hacia acá) */
  R.paqueteria = function (t, me, A) {
    if (t.solicitud) return false;
    if (me === 'LOG' && t.estatus === 'EN_LOGISTICA' && R.esMor(A, t.destino)) return true;
    return R.esMor(A, me) && t.origen === me && t.estatus === 'NUEVO';
  };

  /** ¿Se puede meter en una caja para Morelia? (solo Logística) */
  R.empacable = function (t, A) {
    return !!t && !t.solicitud && t.estatus === 'EN_LOGISTICA' && R.esMor(A, t.destino);
  };

  /** ¿Se puede solicitar eliminarlo? Solo el origen, y solo antes de que se mueva. */
  R.eliminable = function (t, me) {
    return t.origen === me && t.estatus === 'NUEVO' && !t.solicitud;
  };

  return R;
}

var R = TR_REGLAS();
