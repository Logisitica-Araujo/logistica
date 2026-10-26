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
  /** Va a (o viene de) Morelia y todavía no pasa por Logística: Logística lo tiene que recibir. */
  R.paraLog = function (t) { return R.viaLog(t) && !R.pasoLog(t); };

  /** ¿Este traspaso aparece en "Entrantes" de esta área? */
  /**
   * ¿Está esperando salir por Recepción con un gestor? Todo lo de Oficinas que va FUERA de Oficinas
   * sale por Recepción, aunque nadie lo haya registrado ahí ("Nuevo" de un área de Oficinas, o "En Logística"
   * por distribuir). No cuenta: entregas internas de Oficinas (van en mano) ni lo de Morelia (va por Logística).
   */
  R.porSalirRec = function (t, A) {
    if (!t || t.solicitud || R.esOf(A, t.destino) || R.esMor(A, t.destino) || R.esPausa(t.destino)) return false;
    if (t.estatus === 'EN_RECEPCION' || t.estatus === 'EN_LOGISTICA') return true;
    return t.estatus === 'NUEVO' && R.esOf(A, t.origen) && !R.esPausa(t.origen) && !R.viaLog(t);
  };

  R.esEntrante = function (t, me, A) {
    if (me === 'REC') return t.estatus === 'EN_RECEPCION' || R.porSalirRec(t, A);
    if (R.mismaSuc(A, t.destino, me)) return true;
    return me === 'LOG' && R.viaLog(t) && (!R.pasoLog(t) || t.estatus === 'EN_LOGISTICA');
  };

  var nomE = function (E, k) { return (E && E[k]) || k; };

  /** Estatus que ya no se pueden recibir. */
  R.FINALES = ['ENTREGADO', 'ELIMINADO', 'INCIDENCIA'];

  /** Recepción Oficinas es un "centro de pausa": nunca es destino final. */
  R.esPausa = function (id) { return id === 'REC'; };

  /**
   * ¿Puede "me" RECIBIR este traspaso? → {k:'ok'|'warn'|'err', m, accion, ubicable, salto}
   * Si el paquete llegó físicamente pero alguien se saltó un paso (el gestor no
   * registró la recolección, etc.), SÍ se recibe: salto = true y queda en la bitácora.
   */
  R.recibir = function (t, me, A, E) {
    if (!t) return { k: 'err', m: 'Ese folio no existe. Revisa que esté bien tecleado.' };
    if (t.solicitud) return { k: 'err', m: t.folio + ' tiene una solicitud de eliminación pendiente. No se debe mover hasta que responda un administrador.' };
    var esLog = me === 'LOG' && R.viaLog(t) && !R.pasoLog(t);
    if (!R.mismaSuc(A, t.destino, me) && !esLog) {
      var aqui = (A[me] && (A[me].tipo === 'SUCURSAL' || A[me].tipo === 'FORANEA')) ? A[me].sucNombre : R.nom(A, me);
      return { k: 'err', m: 'Este traspaso NO es para ' + aqui + '. Va para: ' + R.nom(A, t.destino) + '.', ubicable: true };
    }
    if (t.estatus === 'ENTREGADO') return { k: 'warn', m: t.folio + ' ya fue recibido anteriormente.' };
    if (R.FINALES.indexOf(t.estatus) >= 0) return { k: 'err', m: t.folio + ' está como "' + nomE(E, t.estatus) + '". No se puede recibir.' };
    if (esLog && t.estatus === 'EN_LOGISTICA') return { k: 'warn', m: t.folio + ' ya está en Logística.' };
    // Lo normal es que llegue recolectado / en paquetería. Si viene "Nuevo" es que se saltó la
    // recolección: se recibe igual (el paquete está aquí) y se anota el salto.
    var salto = t.estatus === 'NUEVO' && !(R.esOf(A, t.origen) && (esLog || R.esOf(A, t.destino)));
    return { k: 'ok', m: '', accion: esLog ? 'EN_LOGISTICA' : 'ENTREGADO', salto: salto };
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
             (t.estatus === 'EN_LOGISTICA' && !R.esMor(A, t.destino) && !R.esOf(A, t.destino)) ||
             (t.estatus === 'EN_RECEPCION' && modo === 'GESTOR');
    if (!ok) return { k: 'err', m: t.folio + ' está como "' + nomE(E, t.estatus) + '". No se puede entregar a gestoría.' };
    return { k: 'ok', m: '' };
  };

  /** ¿Puede esta área mandarlo por paquetería? (Logística hacia Morelia, o Morelia hacia acá) */
  R.paqueteria = function (t, me, A) {
    if (t.solicitud) return false;
    if (me === 'LOG' && R.empacable(t, A)) return true;
    return R.esMor(A, me) && t.origen === me && t.estatus === 'NUEVO';
  };

  /* ---------- Recepción Oficinas ---------- */

  /** ¿El gestor lo puede DEJAR en Recepción Oficinas? */
  R.dejable = function (t, A, E) {
    if (!t) return { k: 'err', m: 'Ese folio no existe. Revisa que esté bien tecleado.' };
    if (t.solicitud) return { k: 'err', m: t.folio + ' tiene una solicitud de eliminación pendiente. No se debe mover.' };
    if (t.estatus === 'EN_RECEPCION') return { k: 'warn', m: t.folio + ' ya está en Recepción Oficinas.' };
    // Cualquier traspaso que siga en camino se puede dejar en pausa aquí (aunque se haya saltado un paso).
    var ok = R.FINALES.indexOf(t.estatus) < 0;
    if (!ok) return { k: 'err', m: t.folio + ' está como "' + nomE(E, t.estatus) + '". No se puede dejar en Recepción.' };
    return { k: 'ok', m: '' };
  };

  /**
   * ¿Lo puede RECOGER esta persona o gestor? quien = {tipo:'PERSONA'|'GESTOR', area}
   * GESTOR: se lo lleva a donde vaya (transporta para otros). PERSONA: solo lo de su área / sucursal.
   */
  R.recogible = function (t, A, E, quien) {
    if (!t) return { k: 'err', m: 'Ese folio no existe. Revisa que esté bien tecleado.' };
    if (t.solicitud) return { k: 'err', m: t.folio + ' tiene una solicitud de eliminación pendiente. No se debe mover.' };
    // El gestor da la salida de todo lo de Oficinas que va fuera, aunque nadie lo haya "dejado" aquí.
    if (quien && quien.tipo === 'GESTOR' && R.porSalirRec(t, A)) return { k: 'ok', m: '' };
    // Lo que va a un área de Oficinas NO se lo lleva un gestor: lo recoge esa área aquí en Recepción.
    if (quien && quien.tipo === 'GESTOR' && t.estatus === 'EN_RECEPCION' && R.esOf(A, t.destino))
      return { k: 'err', m: t.folio + ' es para ' + R.nom(A, t.destino) + ' (aquí en Oficinas): lo recoge esa área en Recepción, no un gestor.' };
    if (t.estatus !== 'EN_RECEPCION') return { k: 'err', m: t.folio + ' no está en Recepción (está como "' + nomE(E, t.estatus) + '").' };
    // Lo que va a Morelia (PV o Rebotica) lo recoge Logística para mandarlo por paquetería; un gestor no.
    if (R.paraLog(t)) {
      if (quien && quien.tipo === 'PERSONA' && quien.area === 'LOG') return { k: 'ok', m: '', log: true };
      return { k: 'err', m: t.folio + ' va a ' + R.nom(A, t.destino) + ' por paquetería: lo recoge Logística aquí en Recepción.' };
    }
    if (quien && quien.tipo === 'PERSONA' && !R.mismaSuc(A, t.destino, quien.area)) {
      return { k: 'err', m: t.folio + ' es para ' + R.nom(A, t.destino) + '. Solo lo puede recoger esa área o un gestor.' };
    }
    return { k: 'ok', m: '' };
  };

  /**
   * ¿Se puede meter en una caja / mandar por paquetería a Morelia? (solo Logística)
   * Ya recibido en Logística, o creado por la misma Logística (no pasa por otra área).
   */
  R.empacable = function (t, A) {
    if (!t || t.solicitud || !R.esMor(A, t.destino)) return false;
    return t.estatus === 'EN_LOGISTICA' || (t.origen === 'LOG' && t.estatus === 'NUEVO');
  };

  /** ¿Se puede solicitar eliminarlo? Solo el origen, y solo antes de que se mueva. */
  R.eliminable = function (t, me) {
    return t.origen === me && t.estatus === 'NUEVO' && !t.solicitud;
  };
  /** El DESTINO (quien lo pidió) también puede solicitar la cancelación mientras siga en "Nuevo traspaso".
   *  La responsabilidad queda en su área, no en la que lo creó. */
  R.cancelableDestino = function (t, me, A) {
    return !!t && t.estatus === 'NUEVO' && !t.solicitud && t.origen !== me && R.mismaSuc(A, t.destino, me);
  };
  /** Editar contenido (qué se envía y bultos): cualquier área, UNA sola vez, mientras no esté terminado.
   *  Los bultos solo se cambian antes de que se lo lleve el gestor (las etiquetas dicen 1/3, 2/3…). */
  R.editable = function (t) { return !!t && !t.editado && !t.solicitud && R.FINALES.indexOf(t.estatus) < 0; };
  R.bultosEditables = function (t) { return !!t && t.estatus === 'NUEVO'; };
  /** Solicitar cambio de destino: el área que lo creó o la que lo recibe, mientras no esté terminado.
   *  No cambia nada hasta que un administrador lo aprueba. */
  R.destinoSolicitable = function (t, me, A) {
    return !!t && R.FINALES.indexOf(t.estatus) < 0 && (t.origen === me || R.mismaSuc(A, t.destino, me) || (A[me] && A[me].tipo === 'OFICINAS' && t.destino === me));
  };
  /** Tipos de incidencia al recibir. Con INCOMPLETO o AMBOS se pide cuántos bultos llegaron. */
  R.INCIDENCIAS = { DANADO: 'Llegó dañado / roto', INCOMPLETO: 'Llegó incompleto (faltan bultos)', AMBOS: 'Dañado e incompleto' };

  return R;
}

var R = TR_REGLAS();
