/***********************************************************************
 * LOGÍSTICA FADERMEX / BOTICAN — app.js
 * ---------------------------------------------------------------------
 * La app que se instala en el celular del gestor.
 * Habla con tu Apps Script, y cuando no hay señal guarda todo en el
 * teléfono y lo sube solo al recuperar internet.
 *
 * >>>>>>>>>>  LO ÚNICO QUE TIENES QUE CAMBIAR AQUÍ  <<<<<<<<<<
 * Pega abajo la URL de tu aplicación web (la que termina en /exec).
 ***********************************************************************/

var API = 'https://script.google.com/a/macros/fadermex.com/s/AKfycbzCgGMMBhAIYGeuI0mj70n19110-9n9EoxGYvQOEP3h9pHJKcrSqVJW9dMOwdCdzlLwuQ/exec';

var VERSION_APP = '1.0.0';
var ESPERA_MS   = 45000;   // cuánto aguanta una subida antes de darse por vencida


/* ===================================================================
 *  ESTADO
 * =================================================================== */
var S = {
  token: null, gestor: '', vehiculo: '',
  estado: null, vista: 'login',
  pedidos: [], traspasos: [], sucursales: [], vehiculos: [],
  motivos: {CANCELADO:[], RETORNO:[], TRASPASO:[]},
  cierre: null,
  scanner: null, scannerSimple: null,
  colaScan: [], vistosScan: {}, contadorScan: 0,
  timerPoll: null, ultimoConteo: {pedidos:0, traspasos:0},
  tocaTitulo: 0, adminClave: null,
  cola: [], subiendo: false, hayRed: navigator.onLine !== false,
  cerradosLocal: {}, desdeCache: false, promptInstalar: null
};


/* ===================================================================
 *  GUARDADO EN EL CELULAR (IndexedDB)
 *  Aquí viven la cola de lo que falta subir y la copia de los datos
 *  para poder trabajar sin señal.
 * =================================================================== */
var DB = (function () {
  var db = null;

  function abrir() {
    if (db) return Promise.resolve(db);
    return new Promise(function (res, rej) {
      var req = indexedDB.open('fdx_logistica', 1);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('cola')) d.createObjectStore('cola', {keyPath:'id', autoIncrement:true});
        if (!d.objectStoreNames.contains('kv'))   d.createObjectStore('kv',   {keyPath:'clave'});
      };
      req.onsuccess = function () { db = req.result; res(db); };
      req.onerror   = function () { rej(req.error); };
    });
  }

  function tx(store, modo, fn) {
    return abrir().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, modo);
        var req = fn(t.objectStore(store));
        req.onsuccess = function () { res(req.result); };
        req.onerror   = function () { rej(req.error); };
        t.onerror     = function () { rej(t.error); };
      });
    });
  }

  return {
    set:  function (k, v) { return tx('kv','readwrite', function(s){ return s.put({clave:k, valor:v}); }); },
    get:  function (k)    { return tx('kv','readonly',  function(s){ return s.get(k); })
                              .then(function(r){ return r ? r.valor : null; }); },
    del:  function (k)    { return tx('kv','readwrite', function(s){ return s.delete(k); }); },
    encolar:    function (it) { return tx('cola','readwrite', function(s){ return s.add(it); }); },
    verCola:    function ()   { return tx('cola','readonly',  function(s){ return s.getAll(); }); },
    quitar:     function (id) { return tx('cola','readwrite', function(s){ return s.delete(id); }); },
    actualizar: function (it) { return tx('cola','readwrite', function(s){ return s.put(it); }); }
  };
})();

/** Si IndexedDB falla (modo privado, iOS viejo), no tumbamos la app. */
function sinFallar(p, alFallar) {
  return p.catch(function (e) { console.warn('almacenamiento:', e); return alFallar; });
}


/* ===================================================================
 *  UTILIDADES
 * =================================================================== */
function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function norm(s){
  return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/["'`´]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
}
function guardar(k,v){ try{ localStorage.setItem('fdx_'+k, v); }catch(e){} }
function leer(k){ try{ return localStorage.getItem('fdx_'+k); }catch(e){ return null; } }
function borrar(k){ try{ localStorage.removeItem('fdx_'+k); }catch(e){} }

function ahoraTexto(){
  var d=new Date(), p=function(n){ return (n<10?'0':'')+n; };
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+
         p(d.getHours())+':'+p(d.getMinutes());
}


/** Llama a la API. Devuelve una promesa con los datos ya limpios. */
function srv(accion, datos){
  var payload = {accion: accion, token: S.token};
  if (datos) for (var k in datos) payload[k] = datos[k];

  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var corte = setTimeout(function(){ if(ctrl) ctrl.abort(); }, ESPERA_MS);

  return fetch(API, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},   // evita el preflight
    body: JSON.stringify(payload),
    signal: ctrl ? ctrl.signal : undefined,
    redirect: 'follow'
  }).then(function(r){
    clearTimeout(corte);
    if(!r.ok) throw new Error('El servidor respondió ' + r.status);
    return r.json();
  }).then(function(j){
    if(j && j.ok === false){
      if(String(j.error).indexOf('SESION_EXPIRADA') >= 0){ salirPorExpiracion(); throw new Error('SESION_EXPIRADA'); }
      throw new Error(j.error);
    }
    marcarRed(true);
    return (j && j.datos !== undefined) ? j.datos : j;
  }).catch(function(e){
    clearTimeout(corte);
    if(esErrorDeRed(e)) marcarRed(false);
    throw e;
  });
}

/** ¿El error fue por falta de internet, o el servidor sí contestó y dijo que no? */
function esErrorDeRed(e){
  var m = String((e && e.message) || e).toLowerCase();
  return /failed to fetch|networkerror|load failed|network request failed|abort|the operation was aborted|respondió 5\d\d|timeout/.test(m);
}


/* ---------- Avisos en pantalla ---------- */
function cargando(texto){
  if($('cargador')) { var t=$('cargador').querySelector('span'); if(t) t.textContent=texto||'Un momento…'; return; }
  var d=document.createElement('div');
  d.id='cargador'; d.className='cargando';
  d.innerHTML='<div class="spinner"></div><span>'+esc(texto||'Un momento…')+'</span>';
  document.body.appendChild(d);
}
function quitarCargando(){ var d=$('cargador'); if(d) d.remove(); }

function toast(msg,tipo){
  var prev=document.querySelector('.toast'); if(prev) prev.remove();
  var t=document.createElement('div');
  t.className='toast '+(tipo||''); t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.remove(); }, tipo==='err'?4500:2600);
}

var AC=null;
function beep(tipo){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended') AC.resume();
    var o=AC.createOscillator(), g=AC.createGain();
    o.connect(g); g.connect(AC.destination);
    if(tipo==='malo'){ o.frequency.value=220; o.type='square'; }
    else { o.frequency.value=1180; o.type='sine'; }
    g.gain.setValueAtTime(0.0001, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.28, AC.currentTime+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+(tipo==='malo'?0.30:0.13));
    o.start(); o.stop(AC.currentTime+(tipo==='malo'?0.32:0.15));
    if(navigator.vibrate) navigator.vibrate(tipo==='malo'?[70,50,70]:35);
  }catch(e){}
}

function flash(bueno,texto){
  var d=document.createElement('div');
  d.className='flash'+(bueno?'':' malo');
  d.innerHTML='<div class="circulo">'+(bueno?'✓':'✕')+'</div>';
  document.body.appendChild(d);
  setTimeout(function(){ if(d.parentNode) d.remove(); }, 520);
  if(texto) toast(texto, bueno?'ok':'err');
}


/* ===================================================================
 *  LA BARRA DE CONEXIÓN Y LA COLA
 * =================================================================== */
function marcarRed(hay){
  if(S.hayRed === hay) return;
  S.hayRed = hay;
  pintarBarraRed();
  if(hay) setTimeout(subirCola, 800);
}

function pintarBarraRed(estado){
  var b=$('barraRed'), t=$('barraRedTexto');
  if(!b||!t) return;
  var pendientes = S.cola.length;

  if(estado==='subiendo'){
    b.className='barra-red subiendo';
    t.textContent='Subiendo '+pendientes+' registro(s)…';
  } else if(estado==='listo'){
    b.className='barra-red listo';
    t.textContent='✓ Todo subido';
    setTimeout(function(){ pintarBarraRed(); }, 2200);
  } else if(!S.hayRed){
    b.className='barra-red';
    t.textContent = pendientes
      ? 'Sin conexión · '+pendientes+' por subir cuando haya señal'
      : 'Sin conexión · lo que captures se guarda y sube solo';
  } else if(pendientes){
    b.className='barra-red';
    t.textContent=pendientes+' registro(s) esperando subir · toca para reintentar';
    b.onclick=function(){ subirCola(true); };
  } else {
    b.classList.add('oculto');
    document.body.classList.remove('con-barra-red');
    return;
  }
  b.classList.remove('oculto');
  document.body.classList.add('con-barra-red');
}

function refrescarCola(){
  return sinFallar(DB.verCola(), []).then(function(c){
    S.cola = c || [];
    pintarBarraRed();
    if(S.vista==='menu') pintarMenu();
    return S.cola;
  });
}

/** Guarda un cierre en el celular para subirlo después. */
function guardarEnCola(tipo, datos, etiqueta){
  return sinFallar(DB.encolar({
    tipo: tipo, datos: datos, etiqueta: etiqueta || '',
    creado: ahoraTexto(), intentos: 0, error: ''
  }), null).then(function(){
    return refrescarCola();
  }).then(function(){
    return {guardadoLocal:true};
  });
}

/** Intenta subir lo que está guardado. Se llama solo al recuperar señal. */
function subirCola(manual){
  if(S.subiendo) return Promise.resolve();
  if(!S.token) return Promise.resolve();

  return refrescarCola().then(function(cola){
    if(!cola.length) { if(manual) toast('No hay nada pendiente','ok'); return; }
    if(!navigator.onLine && !manual){ return; }

    S.subiendo = true;
    pintarBarraRed('subiendo');

    var lote = cola.slice(0,4);
    var items = lote.map(function(it){
      return {idLocal: it.id, tipo: it.tipo, datos: it.datos};
    });

    return srv('sincronizarLote', {items: items}).then(function(d){
      var subidos = 0;
      var pendientesDeBorrar = [];
      (d.resultados||[]).forEach(function(r){
        var it = lote.filter(function(x){ return x.id===r.idLocal; })[0];
        if(!it) return;
        if(r.ok){ subidos++; pendientesDeBorrar.push(DB.quitar(it.id)); }
        else {
          it.intentos = (it.intentos||0)+1;
          it.error = r.error || '';
          pendientesDeBorrar.push(DB.actualizar(it));
        }
      });
      return Promise.all(pendientesDeBorrar).then(function(){
        S.subiendo=false;
        return refrescarCola().then(function(resto){
          if(subidos) { beep(); pintarBarraRed(resto.length?undefined:'listo'); }
          if(subidos && manual) toast(subidos+' registro(s) subidos','ok');
          if(resto.length && S.hayRed) return subirCola();   // sigue con el resto
        });
      });
    }).catch(function(e){
      S.subiendo=false;
      if(esErrorDeRed(e)){ marcarRed(false); }
      else if(manual){ toast(e.message,'err'); }
      pintarBarraRed();
    });
  });
}

window.addEventListener('online',  function(){ marcarRed(true); });
window.addEventListener('offline', function(){ marcarRed(false); });


/* ===================================================================
 *  SESIÓN
 * =================================================================== */
function salirPorExpiracion(){
  quitarCargando(); pararScanner(); pararPoll();
  borrar('token'); S.token=null;
  toast('Tu sesión terminó. Vuelve a entrar.','err');
  vistaLogin();
}


/* ===================================================================
 *  PANTALLA 1 — LOGIN
 * =================================================================== */
function vistaLogin(){
  S.vista='login';
  $('app').innerHTML =
  '<div class="login">'+
    '<div class="marca">'+
      '<div class="logo"><img src="iconos/icono-192.png" alt="Logística BOTICAN FADERMEX" width="104" height="104"></div>'+
      '<h1 id="tituloApp" style="font-size:16px;font-weight:600;opacity:.9;margin-top:14px">ENTREGAS Y TRASPASOS</h1>'+
      '<p>Acceso para gestores</p>'+
    '</div>'+
    '<div class="caja">'+
      '<div id="avisoLogin"></div>'+
      '<div class="grupo">'+
        '<label for="inNombre">Tu nombre</label>'+
        '<input class="campo" id="inNombre" autocomplete="off" autocapitalize="words" '+
               'placeholder="Como aparece en tu credencial">'+
      '</div>'+
      '<div class="grupo">'+
        '<label for="inCodigo">Credencial</label>'+
        '<input class="campo" id="inCodigo" inputmode="numeric" autocomplete="off" '+
               'placeholder="Escanea o teclea el código">'+
        '<p class="ayuda">Escanea el código de barras de tu credencial de la empresa.</p>'+
      '</div>'+
      '<button class="btn gris chico mb" onclick="escanearCredencial()">📷 Escanear credencial</button>'+
      '<button class="btn" id="btnEntrar" onclick="hacerLogin()">Entrar</button>'+
    '</div>'+
    '<p class="centro pequeno" style="color:rgba(255,255,255,.55);margin-top:18px">v'+VERSION_APP+'</p>'+
  '</div>';

  var n=leer('nombre'); if(n) $('inNombre').value=n;

  $('tituloApp').addEventListener('click', function(){
    S.tocaTitulo++;
    clearTimeout(S._tt);
    S._tt=setTimeout(function(){ S.tocaTitulo=0; },1600);
    if(S.tocaTitulo>=5){ S.tocaTitulo=0; pedirClaveAdmin(); }
  });

  $('inCodigo').addEventListener('keydown', function(e){ if(e.key==='Enter') hacerLogin(); });
  pintarBarraRed();
}

function avisoLogin(msg,tipo){
  var d=$('avisoLogin'); if(!d) return;
  d.innerHTML = msg ? '<div class="aviso '+(tipo||'err')+'">'+esc(msg)+'</div>' : '';
}

function hacerLogin(){
  var n=$('inNombre').value.trim(), c=$('inCodigo').value.trim();
  if(!n){ avisoLogin('Escribe tu nombre.'); return; }
  if(!c){ avisoLogin('Escanea o teclea tu credencial.'); return; }
  if(!navigator.onLine){
    avisoLogin('Para entrar la primera vez necesitas señal. Una vez dentro, ya puedes trabajar sin ella.','warn');
    return;
  }
  avisoLogin('');
  $('btnEntrar').disabled=true;
  cargando('Verificando…');
  srv('login', {nombre:n, codigo:c, userAgent:navigator.userAgent}).then(function(d){
    quitarCargando();
    S.token=d.token; S.gestor=d.gestor; S.vehiculo=d.vehiculo||'';
    guardar('token',d.token); guardar('nombre',d.gestor);
    beep();
    vistaVehiculo(true);
  }).catch(function(e){
    quitarCargando();
    if($('btnEntrar')) $('btnEntrar').disabled=false;
    avisoLogin(esErrorDeRed(e) ? 'No hay conexión con el servidor. Revisa tu señal.' : e.message);
    beep('malo');
  });
}

function escanearCredencial(){
  abrirScannerSimple('Escanea tu credencial', function(codigo){
    $('inCodigo').value = codigo;
    beep(); flash(true);
    setTimeout(hacerLogin, 350);
  });
}


/* ===================================================================
 *  PANTALLA 2 — VEHÍCULO
 * =================================================================== */
function vistaVehiculo(esInicio){
  S.vista='vehiculo';
  cargando('Cargando vehículos…');

  Promise.all([
    srv('catalogos').catch(function(e){ if(esErrorDeRed(e)) return null; throw e; }),
    srv('estado').catch(function(e){ if(esErrorDeRed(e)) return null; throw e; })
  ]).then(function(r){
    quitarCargando();
    if(r[0]){
      S.vehiculos = r[0].vehiculos||[];
      S.sucursales = r[0].sucursales||[];
      S.motivos = r[0].motivos||S.motivos;
      sinFallar(DB.set('catalogos', r[0]), null);
      if(r[1]){ S.estado=r[1]; S.vehiculo=r[1].vehiculo||''; sinFallar(DB.set('estado', r[1]), null); }
      pintarVehiculo(esInicio);
      return;
    }
    // Sin señal: usamos lo último que bajamos
    return Promise.all([sinFallar(DB.get('catalogos'),null), sinFallar(DB.get('estado'),null)])
      .then(function(g){
        if(!g[0]){ toast('Sin conexión y sin datos guardados. Conéctate una vez.','err'); return; }
        S.vehiculos=g[0].vehiculos||[]; S.sucursales=g[0].sucursales||[]; S.motivos=g[0].motivos||S.motivos;
        if(g[1]){ S.estado=g[1]; S.vehiculo=g[1].vehiculo||''; }
        S.desdeCache=true;
        pintarVehiculo(esInicio);
      });
  }).catch(function(e){ quitarCargando(); toast(e.message,'err'); });
}

function pintarVehiculo(esInicio){
  var st=S.estado||{};
  var bloqueado = st.vehiculo && !st.puedeCambiarVehiculo;

  var html =
  '<div class="barra">'+
    (esInicio?'':'<button class="volver" onclick="vistaMenu()">←</button>')+
    '<div class="titulo"><h1>Vehículo de trabajo</h1><small>'+esc(S.gestor)+'</small></div>'+
  '</div><div class="cuerpo">';

  if(esInicio){
    html+='<div class="aviso info">Selecciona el vehículo con el que vas a trabajar. '+
          'Todo lo que entregues o recolectes quedará registrado con este vehículo.</div>';
  }
  if(S.desdeCache && !S.hayRed){
    html+='<div class="aviso warn">Sin señal: estás viendo la última lista guardada.</div>';
  }
  if(st.vehiculo){
    html+='<div class="aviso ok"><b>Vehículo actual:</b> '+esc(st.vehiculo)+'</div>';
  }
  if(bloqueado){
    html+='<div class="aviso warn">🔒 Cambiaste de vehículo hace poco. '+
          'Podrás volver a cambiar en <b>'+st.minutosParaCambiar+' min</b>.</div>';
  }

  html+='<div class="bloque"><h3>Vehículos disponibles</h3><div class="opciones" id="listaVeh">';
  if(!S.vehiculos.length) html+='<p class="pequeno">No hay vehículos dados de alta.</p>';
  S.vehiculos.forEach(function(v){
    var sel = norm(v.nombre)===norm(S.vehiculo);
    html+='<button class="opcion'+(sel?' sel':'')+'" data-v="'+esc(v.nombre)+'" '+
          (bloqueado?'disabled style="opacity:.45"':'')+
          ' onclick="elegirVeh(this)"><span class="radio"></span>'+
          '<span>🚗 <b>'+esc(v.nombre)+'</b>'+(v.placa?'<br><small style="color:#5F6368">'+esc(v.placa)+'</small>':'')+'</span></button>';
  });
  html+='</div></div>';

  if(st.vehiculo && !bloqueado){
    html+='<div class="bloque"><h3>Motivo del cambio <span class="req">opcional</span></h3>'+
          '<input class="campo" id="inMotivoVeh" placeholder="Ej. la camioneta se descompuso"></div>';
  }

  html+='<button class="btn verde" onclick="guardarVehiculo()" '+(bloqueado?'disabled':'')+'>'+
        (st.vehiculo?'Cambiar vehículo':'Continuar')+'</button>';
  if(st.vehiculo){
    html+='<button class="btn linea mt" onclick="vistaMenu()">Seguir con '+esc(st.vehiculo)+'</button>';
  }
  html+='</div>';
  $('app').innerHTML=html;
}

function elegirVeh(btn){
  Array.prototype.forEach.call(document.querySelectorAll('#listaVeh .opcion'),
    function(b){ b.classList.remove('sel'); });
  btn.classList.add('sel');
  S.vehiculoElegido = btn.getAttribute('data-v');
}

function guardarVehiculo(){
  var v = S.vehiculoElegido || S.vehiculo;
  if(!v){ toast('Selecciona un vehículo.','err'); return; }
  var motivo = $('inMotivoVeh') ? $('inMotivoVeh').value.trim() : '';
  cargando('Guardando…');
  srv('setVehiculo', {vehiculo:v, motivo:motivo}).then(function(d){
    quitarCargando();
    S.vehiculo=d.vehiculo; beep();
    toast('Vehículo: '+d.vehiculo,'ok');
    vistaMenu();
  }).catch(function(e){
    quitarCargando();
    if(esErrorDeRed(e)){
      toast('Sin señal: el vehículo se registra cuando vuelva la conexión.','err');
    } else { toast(e.message,'err'); }
    beep('malo');
  });
}


/* ===================================================================
 *  PANTALLA 3 — MENÚ
 * =================================================================== */
function vistaMenu(){
  S.vista='menu';
  pararScanner();
  cargando('Cargando…');

  srv('estado').then(function(st){
    quitarCargando();
    S.estado=st; S.vehiculo=st.vehiculo||''; S.desdeCache=false;
    sinFallar(DB.set('estado', st), null);
    if(!S.vehiculo){ vistaVehiculo(true); return; }
    pintarMenu(); iniciarPoll(); subirCola();
  }).catch(function(e){
    quitarCargando();
    if(!esErrorDeRed(e)){ toast(e.message,'err'); return; }
    sinFallar(DB.get('estado'), null).then(function(st){
      if(!st){ toast('Sin conexión y sin datos guardados.','err'); return; }
      S.estado=st; S.vehiculo=st.vehiculo||''; S.desdeCache=true;
      pintarMenu();
    });
  });
}

function pintarMenu(){
  var st=S.estado||{}, c=st.contadores||{};
  var iniciales = (S.gestor||'G').replace(/["'´]/g,'').trim().split(/\s+/)
                    .slice(0,2).map(function(p){return p.charAt(0);}).join('').toUpperCase();

  var html =
  '<div class="barra">'+
    '<div class="titulo"><h1>'+esc(st.gestor||S.gestor)+'</h1><small>Panel principal</small></div>'+
    '<button class="accion" onclick="cerrarSesion()">Salir</button>'+
  '</div><div class="cuerpo">'+
  '<div class="saludo">'+
    '<div class="avatar">'+esc(iniciales)+'</div>'+
    '<div class="info"><b>'+esc(st.gestor||S.gestor)+'</b>'+
      '<span>'+(c.pedidos||0)+' pedido(s) · '+(c.traspasos||0)+' traspaso(s)</span></div>'+
    '<button class="chip-veh" onclick="vistaVehiculo(false)">🚗 '+esc(st.vehiculo||S.vehiculo||'—')+'</button>'+
  '</div>';

  if(S.cola.length){
    html+='<button class="chip-cola'+(S.subiendo?' subiendo':'')+' mb" style="width:100%;justify-content:center" '+
          'onclick="verCola()"><span class="punto"></span>'+
          (S.subiendo?'Subiendo…':S.cola.length+' registro(s) guardados en el celular')+'</button>';
  }
  if(S.desdeCache){
    html+='<div class="aviso warn">Sin señal. Los números son de la última vez que tuviste conexión.</div>';
  }

  html+='<div class="rejilla">';
  (st.modulos||[]).forEach(function(m){
    var badge = m.id==='pedidos'   && c.pedidos   ? c.pedidos
              : m.id==='traspasos' && c.traspasos ? c.traspasos : 0;
    html +=
    '<button class="mod'+(m.activo?'':' off')+'" style="background:linear-gradient(140deg,'+
      m.color+',' + sombrear(m.color) + ')" onclick="abrirModulo(\''+m.id+'\','+(m.activo?'true':'false')+')">'+
      (badge?'<span class="badge">'+badge+'</span>':'')+
      (m.activo?'':'<span class="prox">PRÓXIMO</span>')+
      '<span class="ic">'+m.icono+'</span>'+
      '<span class="tt">'+esc(m.titulo)+'</span>'+
    '</button>';
  });
  html+='</div></div>';
  $('app').innerHTML=html;
  pintarBarraRed();
}

function sombrear(hex){
  try{
    var n=parseInt(String(hex).replace('#',''),16);
    var r=Math.max(0,((n>>16)&255)-42), g=Math.max(0,((n>>8)&255)-42), b=Math.max(0,(n&255)-42);
    return 'rgb('+r+','+g+','+b+')';
  }catch(e){ return hex; }
}

function abrirModulo(id, activo){
  if(!activo){ toast('Este módulo se habilitará más adelante.','err'); return; }
  if(id==='pedidos')   return vistaPedidos();
  if(id==='traspasos') return vistaTraspasos();
  if(id==='historial') return vistaHistorial();
  if(id==='vehiculos') return vistaUsoVehiculos();
  toast('Módulo no disponible.','err');
}

function cerrarSesion(){
  if(S.cola.length){
    if(!confirm('Tienes '+S.cola.length+' registro(s) sin subir.\n\n'+
                'Si cierras sesión se quedan guardados, pero es mejor esperar a tener señal.\n\n¿Salir de todos modos?')) return;
  } else if(!confirm('¿Cerrar sesión?')) return;
  pararPoll(); pararScanner();
  srv('logout').catch(function(){});
  borrar('token'); S.token=null;
  vistaLogin();
}

/* ---- Lista de lo que falta subir ---- */
function verCola(){
  var html='<div class="modal" id="modal"><div class="hoja"><div class="agarre"></div>'+
    '<h2>Guardado en el celular</h2>'+
    '<p class="sub">Esto ya quedó capturado. Sube solo cuando haya señal.</p>';

  if(!S.cola.length){
    html+='<div class="vacio"><span class="ic">✅</span><b>Nada pendiente</b><p>Todo está en el servidor.</p></div>';
  }
  S.cola.forEach(function(it){
    html+='<div class="hist pendiente">'+
      '<div class="top"><b>'+esc(it.etiqueta||it.tipo)+'</b><small>'+esc(it.creado)+'</small></div>'+
      (it.error?'<div class="l" style="color:#B3261E">'+esc(it.error)+'</div>':'')+
      (it.intentos?'<div class="l pequeno">'+it.intentos+' intento(s)</div>':'')+
    '</div>';
  });

  html+='<div class="fila-btn mt">'+
    '<button class="btn gris" onclick="cerrarModal()">Cerrar</button>'+
    (S.cola.length?'<button class="btn verde" onclick="cerrarModal();subirCola(true)">Subir ahora</button>':'')+
  '</div></div></div>';

  var m=$('modal'); if(m) m.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}


/* ---- Revisión periódica ---- */
function iniciarPoll(){
  pararPoll();
  var seg = (S.estado && S.estado.revisarCadaSeg) || 45;
  S.ultimoConteo = S.estado.contadores || {pedidos:0,traspasos:0};
  S.timerPoll = setInterval(function(){
    if(!S.token) return pararPoll();
    if(!navigator.onLine) return;
    srv('estado').then(function(st){
      var antes=S.ultimoConteo, ahora=st.contadores||{pedidos:0,traspasos:0};
      S.estado=st; S.desdeCache=false;
      sinFallar(DB.set('estado', st), null);
      if(ahora.pedidos>antes.pedidos || ahora.traspasos>antes.traspasos){
        beep();
        var n=(ahora.pedidos-antes.pedidos)+(ahora.traspasos-antes.traspasos);
        toast('🔔 Tienes '+n+' asignación(es) nueva(s)','ok');
      }
      S.ultimoConteo=ahora;
      if(S.vista==='menu') pintarMenu();
    }).catch(function(){});
    subirCola();
  }, seg*1000);
}
function pararPoll(){ if(S.timerPoll){ clearInterval(S.timerPoll); S.timerPoll=null; } }


/* ===================================================================
 *  PANTALLA 4 — PEDIDOS
 * =================================================================== */
function vistaPedidos(){
  S.vista='pedidos';
  cargando('Cargando tus pedidos…');

  srv('pedidos').then(function(lista){
    quitarCargando();
    S.pedidos = filtrarCerradosLocal(lista);
    S.desdeCache=false;
    sinFallar(DB.set('pedidos', lista), null);
    pintarPedidos();
  }).catch(function(e){
    quitarCargando();
    if(!esErrorDeRed(e)){ toast(e.message,'err'); return; }
    sinFallar(DB.get('pedidos'), []).then(function(lista){
      S.pedidos = filtrarCerradosLocal(lista||[]);
      S.desdeCache=true;
      pintarPedidos();
    });
  });
}

/** Quita los que el gestor ya cerró sin señal, para que no reaparezcan. */
function filtrarCerradosLocal(lista){
  var fuera = {};
  S.cola.forEach(function(it){
    if(it.tipo==='PEDIDO' && it.datos && it.datos.id) fuera[norm(it.datos.id)]=true;
  });
  return (lista||[]).filter(function(p){ return !fuera[norm(p.id)]; });
}

function pintarPedidos(){
  var html =
  '<div class="barra">'+
    '<button class="volver" onclick="vistaMenu()">←</button>'+
    '<div class="titulo"><h1>Pedidos pendientes</h1><small>'+S.pedidos.length+' por entregar · '+esc(S.vehiculo)+'</small></div>'+
    '<button class="accion" onclick="vistaPedidos()">↻</button>'+
  '</div><div class="cuerpo">';

  if(S.desdeCache){
    html+='<div class="aviso warn">Sin señal: esta es tu última lista descargada. '+
          'Puedes cerrar entregas igual, se suben después.</div>';
  }

  if(!S.pedidos.length){
    html+='<div class="vacio"><span class="ic">🎉</span><b>Sin pendientes</b>'+
          '<p>No tienes pedidos asignados por entregar.</p></div>';
  }

  S.pedidos.forEach(function(p,i){
    html+=
    '<div class="tarjeta'+(i===0?' abierta':'')+'" id="tp'+i+'">'+
      '<div class="cab" onclick="togglear(\'tp'+i+'\')">'+
        '<span class="n">'+(i+1)+'</span>'+
        '<span class="id">'+esc(p.id)+'</span>'+
        '<span class="flecha">▼</span>'+
      '</div>'+
      '<div class="cont">'+
        campo('Cliente', p.cliente||'—')+
        campo('Dirección', p.direccion||'—')+
        (p.notas?'<div class="dato"><div class="et">Observaciones</div>'+
                 '<div class="va nota">'+esc(p.notas)+'</div></div>':'')+
        (p.area||p.subarea ? campo('Área', [p.area,p.subarea].filter(Boolean).join(' · ')):'')+
        (p.fecha?campo('Registrado', p.fecha):'')+
        (p.direccion?'<div class="dato"><div class="et">Ubicación</div>'+
          '<a class="mapa-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+
          encodeURIComponent(p.direccion)+'">📍 Ver ubicación en mapa</a></div>':'')+
        '<div class="acciones"><div class="et">Seleccionar acción</div>'+
          '<button class="btn verde chico mb" onclick="abrirCierrePedido('+i+',\'ENTREGADO\')">✓ ENTREGADO</button>'+
          '<div class="fila-btn">'+
            '<button class="btn rojo chico" onclick="abrirCierrePedido('+i+',\'CANCELADO\')">✕ CANCELADO</button>'+
            '<button class="btn ambar chico" onclick="abrirCierrePedido('+i+',\'RETORNO\')">↩ RETORNO</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  });

  html+='</div>';
  $('app').innerHTML=html;
  pintarBarraRed();
}

function campo(et,va){
  return '<div class="dato"><div class="et">'+esc(et)+'</div><div class="va">'+esc(va)+'</div></div>';
}
function togglear(id){ var e=$(id); if(e) e.classList.toggle('abierta'); }


/* ---------- Cierre de pedido ---------- */
function abrirCierrePedido(i, resultado){
  var p=S.pedidos[i];
  S.cierre={ tipo:'PEDIDO', p:p, resultado:resultado,
             entregado:(resultado==='ENTREGADO'),
             foto:null, firma:null, motivo:'', comentario:'' };
  pintarCierrePedido();
}

function estiloResultado(res){
  if(res==='ENTREGADO') return {t:'✓ Confirmar entrega', c:'verde', b:'Finalizar entrega'};
  if(res==='RETORNO')   return {t:'↩ Pedido en retorno', c:'ambar', b:'Registrar retorno'};
  return {t:'✕ Pedido cancelado', c:'rojo', b:'Registrar cancelación'};
}

function pintarCierrePedido(){
  var c=S.cierre, p=c.p, r=(S.estado&&S.estado.reglas)||{};
  var er=estiloResultado(c.resultado);
  var html='<div class="modal" id="modal"><div class="hoja"><div class="agarre"></div>';

  html+='<h2>'+er.t+'</h2>'+
        '<p class="sub"><b>'+esc(p.id)+'</b> · '+esc(p.cliente||'')+'</p>';

  if(!S.hayRed){
    html+='<div class="aviso warn">Sin señal: se guarda en tu celular y sube solo al recuperar internet.</div>';
  }

  if(!c.entregado){
    var lista = S.motivos[c.resultado] || [];
    html+='<div class="bloque"><h3>¿Qué pasó? <span class="req">obligatorio</span>'+
          (c.motivo?'<span class="listo">✓</span>':'')+'</h3><div class="opciones">';
    if(!lista.length) html+='<p class="pequeno">No hay motivos de tipo '+esc(c.resultado)+' dados de alta.</p>';
    lista.forEach(function(m,i){
      html+='<button class="opcion'+(c.motivo===m.motivo?' sel':'')+'" onclick="elegirMotivo('+i+')">'+
            '<span class="radio"></span><span>'+esc(m.motivo)+'</span></button>';
    });
    html+='</div>'+
      '<div class="mt"><label for="inComent">Comentario (opcional)</label>'+
      '<textarea class="campo" id="inComent" rows="2" placeholder="Detalles de lo que pasó">'+esc(c.comentario)+'</textarea></div>'+
      '</div>';
  }

  var pideFoto = c.entregado ? (r.exigirFotoEntrega!==false) : (r.exigirFotoNoEntrega!==false);
  html+='<div class="bloque"><h3>📷 Fotografía '+
        (pideFoto?'<span class="req">obligatorio</span>':'<span class="pequeno">opcional</span>')+
        (c.foto?'<span class="listo">✓ Lista</span>':'')+'</h3>';
  if(c.foto){
    html+='<div class="previa"><img src="'+c.foto+'" alt="">'+
          '<button class="quitar" onclick="quitarFoto()">Cambiar</button></div>';
  }else{
    html+='<button class="zona-foto" style="width:100%" onclick="tomarFoto()">'+
          '<span class="ic">📸</span><b>Tomar foto</b>'+
          '<small>'+(c.entregado?'Fachada donde estás entregando':'Evidencia de lo ocurrido')+'</small></button>';
  }
  html+='</div>';

  if(c.entregado){
    var pideFirma = r.exigirFirmaEntrega!==false;
    html+='<div class="bloque"><h3>✍️ Firma del cliente '+
          (pideFirma?'<span class="req">obligatorio</span>':'<span class="pequeno">opcional</span>')+
          (c.firma?'<span class="listo">✓ Lista</span>':'')+'</h3>'+
          '<canvas id="firmaCanvas"></canvas>'+
          '<div class="firma-pie"><small>Que firme con el dedo dentro del recuadro</small>'+
          '<button onclick="limpiarFirma()">Borrar</button></div></div>';
  }

  html+='<div class="fila-btn mt">'+
          '<button class="btn gris" onclick="cerrarModal()">Cancelar</button>'+
          '<button class="btn '+er.c+'" onclick="enviarCierrePedido()">'+er.b+'</button>'+
        '</div></div></div>';

  var m=$('modal'); if(m) m.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  if(c.entregado) prepararFirma();
}

function elegirMotivo(i){
  preservarCierre();
  var lista = S.motivos[S.cierre.resultado] || [];
  if(lista[i]) S.cierre.motivo = lista[i].motivo;
  pintarCierrePedido();
}
function guardarComentario(){
  if($('inComent') && S.cierre) S.cierre.comentario=$('inComent').value;
}
function preservarCierre(){
  if(!S.cierre) return;
  guardarComentario();
  if(S.cierre.tipo==='PEDIDO' && S.cierre.entregado){
    var f=leerFirma();
    if(f) S.cierre.firma=f;
  }
  if($('selDestino')) S.cierre.destino=$('selDestino').value;
}
function quitarFoto(){ preservarCierre(); S.cierre.foto=null; pintarCierrePedido(); }
function cerrarModal(){ var m=$('modal'); if(m) m.remove(); S.cierre=null; }

function enviarCierrePedido(){
  var c=S.cierre, p=c.p, r=(S.estado&&S.estado.reglas)||{};
  guardarComentario();
  if(c.entregado){
    c.firma = leerFirma() || c.firma || null;
    if(r.exigirFotoEntrega!==false && !c.foto){ toast('Falta la foto de la fachada.','err'); beep('malo'); return; }
    if(r.exigirFirmaEntrega!==false && !c.firma){ toast('Falta la firma del cliente.','err'); beep('malo'); return; }
  }else{
    if(!c.motivo){ toast('Selecciona el motivo.','err'); beep('malo'); return; }
    if(r.exigirFotoNoEntrega!==false && !c.foto){ toast('Falta la foto de evidencia.','err'); beep('malo'); return; }
  }

  cargando(S.hayRed ? 'Guardando y subiendo evidencia…' : 'Guardando en el celular…');

  obtenerGPS().then(function(pos){
    var datos = {
      id:p.id, resultado:c.resultado,
      motivo:c.motivo, comentario:c.comentario,
      foto:c.foto, firma:c.firma,
      lat:pos.lat, lng:pos.lng,
      cliente:p.cliente, direccion:p.direccion, notas:p.notas,
      area:p.area, subarea:p.subarea
    };
    var etiqueta = p.id + ' · ' + c.resultado;

    if(!navigator.onLine) return guardarEnCola('PEDIDO', datos, etiqueta);

    return srv('cerrarPedido', {p: datos}).catch(function(e){
      if(esErrorDeRed(e)) return guardarEnCola('PEDIDO', datos, etiqueta);
      throw e;
    });
  }).then(function(res){
    quitarCargando(); cerrarModal();
    beep();
    var local = res && res.guardadoLocal;
    var msg = c.resultado==='ENTREGADO' ? 'Entrega registrada'
            : c.resultado==='RETORNO'   ? 'Retorno registrado'
            : 'Cancelación registrada';
    flash(true, local ? msg+' · se sube al haber señal' : msg);
    S.pedidos = S.pedidos.filter(function(x){ return x.id!==p.id; });
    pintarPedidos();
  }).catch(function(e){
    quitarCargando(); beep('malo'); toast(e.message,'err');
  });
}


/* ---------- Cámara ---------- */
function tomarFoto(){
  preservarCierre();
  var inp=$('inputCamara');
  inp.value='';
  inp.onchange=function(){
    var f=inp.files && inp.files[0];
    if(!f) return;
    cargando('Procesando foto…');
    comprimirImagen(f, function(dataUrl){
      quitarCargando();
      if(S.cierre){ S.cierre.foto=dataUrl;
        if(S.cierre.tipo==='TRASPASO') pintarCierreTraspaso(); else pintarCierrePedido();
      }
      beep();
    });
  };
  inp.click();
}

function comprimirImagen(file, cb){
  var fr=new FileReader();
  fr.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var max=1280, w=img.width, h=img.height;
      if(w>h && w>max){ h=Math.round(h*max/w); w=max; }
      else if(h>=w && h>max){ w=Math.round(w*max/h); h=max; }
      var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      cb(cv.toDataURL('image/jpeg',0.72));
    };
    img.onerror=function(){ quitarCargando(); toast('No pude leer la imagen.','err'); };
    img.src=e.target.result;
  };
  fr.readAsDataURL(file);
}


/* ---------- Firma ---------- */
var firmaCtx=null, firmando=false, hayFirma=false;
function prepararFirma(){
  var cv=$('firmaCanvas'); if(!cv) return;
  var rect=cv.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  cv.width=rect.width*dpr; cv.height=rect.height*dpr;
  firmaCtx=cv.getContext('2d');
  firmaCtx.scale(dpr,dpr);
  firmaCtx.fillStyle='#fff'; firmaCtx.fillRect(0,0,rect.width,rect.height);
  firmaCtx.strokeStyle='#111'; firmaCtx.lineWidth=2.6;
  firmaCtx.lineCap='round'; firmaCtx.lineJoin='round';
  hayFirma=false;

  if(S.cierre && S.cierre.firma){
    var prev=new Image();
    prev.onload=function(){ firmaCtx.drawImage(prev,0,0,rect.width,rect.height); hayFirma=true; };
    prev.src=S.cierre.firma;
  }

  function xy(ev){
    var r=cv.getBoundingClientRect();
    var t=ev.touches?ev.touches[0]:ev;
    return {x:t.clientX-r.left, y:t.clientY-r.top};
  }
  function ini(ev){ ev.preventDefault(); firmando=true; hayFirma=true;
    var p=xy(ev); firmaCtx.beginPath(); firmaCtx.moveTo(p.x,p.y); }
  function mov(ev){ if(!firmando) return; ev.preventDefault();
    var p=xy(ev); firmaCtx.lineTo(p.x,p.y); firmaCtx.stroke(); }
  function fin(ev){ if(ev) ev.preventDefault(); firmando=false; }

  cv.addEventListener('touchstart',ini,{passive:false});
  cv.addEventListener('touchmove', mov,{passive:false});
  cv.addEventListener('touchend',  fin,{passive:false});
  cv.addEventListener('mousedown', ini);
  cv.addEventListener('mousemove', mov);
  cv.addEventListener('mouseup',   fin);
  cv.addEventListener('mouseleave',fin);
}
function limpiarFirma(){
  var cv=$('firmaCanvas'); if(!cv||!firmaCtx) return;
  var r=cv.getBoundingClientRect();
  firmaCtx.fillStyle='#fff'; firmaCtx.fillRect(0,0,r.width,r.height);
  hayFirma=false;
  if(S.cierre) S.cierre.firma=null;
}
function leerFirma(){
  var cv=$('firmaCanvas');
  if(!cv || !hayFirma) return null;
  return cv.toDataURL('image/png');
}


/* ---------- GPS ---------- */
function obtenerGPS(){
  return new Promise(function(res){
    var reglas=(S.estado&&S.estado.reglas)||{};
    if(reglas.pedirGPS===false || !navigator.geolocation) return res({lat:'',lng:''});
    var listo=false;
    var t=setTimeout(function(){ if(!listo){ listo=true; res({lat:'',lng:''}); } }, 6000);
    navigator.geolocation.getCurrentPosition(function(p){
      if(listo) return; listo=true; clearTimeout(t);
      res({ lat:p.coords.latitude.toFixed(6), lng:p.coords.longitude.toFixed(6) });
    }, function(){
      if(listo) return; listo=true; clearTimeout(t); res({lat:'',lng:''});
    }, {enableHighAccuracy:true, timeout:5500, maximumAge:30000});
  });
}


/* ===================================================================
 *  PANTALLA 5 — TRASPASOS
 * =================================================================== */
function vistaTraspasos(tab){
  S.vista='traspasos';
  S.tabTras = tab || S.tabTras || 'recolectar';
  cargando('Cargando…');

  srv('traspasosPendientes').then(function(lista){
    quitarCargando();
    S.traspasos=lista; S.desdeCache=false;
    sinFallar(DB.set('traspasos', lista), null);
    pintarTraspasos();
  }).catch(function(e){
    quitarCargando();
    if(!esErrorDeRed(e)){ toast(e.message,'err'); return; }
    sinFallar(DB.get('traspasos'), []).then(function(l){
      S.traspasos=l||[]; S.desdeCache=true; pintarTraspasos();
    });
  });
}

function pintarTraspasos(){
  var esRec = S.tabTras==='recolectar';
  var html=
  '<div class="barra">'+
    '<button class="volver" onclick="salirTraspasos()">←</button>'+
    '<div class="titulo"><h1>Traspasos</h1><small>'+esc(S.vehiculo)+'</small></div>'+
    '<button class="accion" onclick="vistaTraspasos()">↻</button>'+
  '</div><div class="cuerpo">'+
  '<div class="tabs">'+
    '<button class="'+(esRec?'act':'')+'" onclick="cambiarTab(\'recolectar\')">📥 Recolectar</button>'+
    '<button class="'+(esRec?'':'act')+'" onclick="cambiarTab(\'entregar\')">📤 Entregar ('+S.traspasos.length+')</button>'+
  '</div><div id="contTras"></div></div>';
  $('app').innerHTML=html;
  if(esRec) pintarRecolectar(); else pintarEntregar();
  pintarBarraRed();
}

function cambiarTab(t){ pararScanner(); S.tabTras=t; pintarTraspasos(); }
function salirTraspasos(){ pararScanner(); vistaMenu(); }


/* ---------- Recolectar en ráfaga ---------- */
function pintarRecolectar(){
  $('contTras').innerHTML=
  '<div class="contador-scan"><b id="contScan">'+S.contadorScan+'</b>'+
    '<span>recolectados en esta sesión</span></div>'+
  '<div class="bloque"><h3>📷 Escaneo continuo</h3>'+
    '<p class="pequeno mb">Apunta al código de barras. Cada lectura correcta suena y muestra una palomita.</p>'+
    '<div id="lector"></div>'+
    '<div class="fila-btn mt">'+
      '<button class="btn verde chico" id="btnIniScan" onclick="iniciarRafaga()">▶ Iniciar escaneo</button>'+
      '<button class="btn gris chico oculto" id="btnParaScan" onclick="pararScanner()">■ Detener</button>'+
    '</div>'+
  '</div>'+
  '<div class="bloque"><h3>⌨️ Capturar folio a mano</h3>'+
    '<input class="campo mb" id="inFolio" placeholder="Teclea el folio" autocomplete="off" '+
      'onkeydown="if(event.key===\'Enter\')recolectarManual()">'+
    '<button class="btn chico" onclick="recolectarManual()">Recolectar</button>'+
  '</div>'+
  '<div id="listaScan" class="lista-scan"></div>';
  pintarListaScan();
}

function iniciarRafaga(){
  if(!window.Html5Qrcode){ toast('El lector no cargó. Conéctate una vez para descargarlo.','err'); return; }
  beep();
  $('btnIniScan').classList.add('oculto');
  $('btnParaScan').classList.remove('oculto');

  S.scanner = new Html5Qrcode('lector', {formatsToSupport: formatosCodigo(), verbose:false});
  S.scanner.start(
    {facingMode:'environment'},
    {fps:15, qrbox:{width:260,height:150}, aspectRatio:1.4, disableFlip:true},
    function(texto){ alLeerRafaga(texto); },
    function(){}
  ).catch(function(e){
    toast('No pude abrir la cámara: '+e,'err');
    $('btnIniScan').classList.remove('oculto');
    $('btnParaScan').classList.add('oculto');
  });
}

function formatosCodigo(){
  if(!window.Html5QrcodeSupportedFormats) return undefined;
  var F=Html5QrcodeSupportedFormats;
  return [F.CODE_128,F.CODE_39,F.CODE_93,F.EAN_13,F.EAN_8,F.ITF,F.CODABAR,F.UPC_A,F.QR_CODE];
}

function pararScanner(){
  if(!S.scanner) return;
  try{ S.scanner.stop().then(function(){ try{S.scanner.clear();}catch(e){} S.scanner=null; }); }
  catch(e){ S.scanner=null; }
  if($('btnIniScan')) $('btnIniScan').classList.remove('oculto');
  if($('btnParaScan')) $('btnParaScan').classList.add('oculto');
}

function alLeerRafaga(texto){
  var folio=String(texto||'').trim();
  if(!folio) return;
  var ahora=Date.now();
  if(S.vistosScan[folio] && (ahora-S.vistosScan[folio])<2500) return;
  S.vistosScan[folio]=ahora;

  beep(); flash(true);
  S.contadorScan++;
  if($('contScan')) $('contScan').textContent=S.contadorScan;

  S.colaScan.push({folio:folio, estado:'enviando', msg:'Guardando…'});
  pintarListaScan();

  clearTimeout(S._flush);
  S._flush = setTimeout(vaciarColaScan, 700);
  if(S.colaScan.filter(function(x){return x.estado==='enviando';}).length>=8){
    clearTimeout(S._flush); vaciarColaScan();
  }
}

function vaciarColaScan(){
  var pendientes = S.colaScan.filter(function(x){ return x.estado==='enviando'; });
  if(!pendientes.length) return;
  var folios = pendientes.map(function(x){ return x.folio; });

  if(!navigator.onLine){
    guardarEnCola('RECOLECCION', {folios:folios}, folios.length+' folio(s) recolectados');
    pendientes.forEach(function(x){ x.estado='ok'; x.msg='Guardado sin señal'; });
    pintarListaScan();
    return;
  }

  srv('recolectarTraspasos', {folios: folios}).then(function(d){
    (d.resultados||[]).forEach(function(r){
      for(var i=0;i<S.colaScan.length;i++){
        if(S.colaScan[i].folio===r.folio && S.colaScan[i].estado==='enviando'){
          S.colaScan[i].estado = r.ok?'ok':'no';
          S.colaScan[i].msg = r.msg + (r.destino?(' · '+r.destino):'');
          if(!r.ok){ S.contadorScan=Math.max(0,S.contadorScan-1); beep('malo'); }
          break;
        }
      }
    });
    if($('contScan')) $('contScan').textContent=S.contadorScan;
    pintarListaScan();
  }).catch(function(e){
    if(esErrorDeRed(e)){
      guardarEnCola('RECOLECCION', {folios:folios}, folios.length+' folio(s) recolectados');
      pendientes.forEach(function(x){ x.estado='ok'; x.msg='Guardado sin señal'; });
    } else {
      pendientes.forEach(function(x){ x.estado='no'; x.msg='Error: '+e.message; });
      beep('malo');
    }
    pintarListaScan();
  });
}

function pintarListaScan(){
  var d=$('listaScan'); if(!d) return;
  if(!S.colaScan.length){ d.innerHTML=''; return; }
  d.innerHTML = S.colaScan.slice().reverse().slice(0,40).map(function(x){
    var ic = x.estado==='ok'?'<span class="ok">✓</span>'
           : x.estado==='no'?'<span class="no">✕</span>'
           : '<span style="color:#5F6368">⏳</span>';
    return '<div class="it">'+ic+'<span class="f">'+esc(x.folio)+'</span>'+
           '<small>'+esc(x.msg)+'</small></div>';
  }).join('');
}

function recolectarManual(){
  var inp=$('inFolio'); if(!inp) return;
  var folio=inp.value.trim();
  if(!folio){ toast('Escribe un folio.','err'); return; }
  inp.value=''; inp.focus();
  S.vistosScan[folio]=Date.now();
  S.contadorScan++;
  if($('contScan')) $('contScan').textContent=S.contadorScan;
  S.colaScan.push({folio:folio, estado:'enviando', msg:'Guardando…'});
  beep(); flash(true);
  pintarListaScan();
  clearTimeout(S._flush);
  S._flush=setTimeout(vaciarColaScan, 300);
}


/* ---------- Entregar traspasos ---------- */
function pintarEntregar(){
  var html='';
  if(S.desdeCache){
    html+='<div class="aviso warn">Sin señal: lista de la última descarga.</div>';
  }
  if(!S.traspasos.length){
    html+='<div class="vacio"><span class="ic">📤</span><b>Nada por entregar</b>'+
         '<p>Los traspasos que recolectes aparecerán aquí.</p></div>';
  }
  S.traspasos.forEach(function(t,i){
    var suc = S.sucursales.filter(function(s){ return norm(s.nombre)===norm(t.destino); })[0];
    html+=
    '<div class="tarjeta'+(i===0?' abierta':'')+'" id="tt'+i+'">'+
      '<div class="cab" onclick="togglear(\'tt'+i+'\')">'+
        '<span class="n">'+(i+1)+'</span>'+
        '<span class="id">Folio '+esc(t.folio)+'</span>'+
        '<span class="flecha">▼</span>'+
      '</div>'+
      '<div class="cont">'+
        campo('Origen', t.origen||'—')+
        '<div class="dato"><div class="et">Destino</div><div class="va">'+
          (t.destino?esc(t.destino):'<span style="color:#C62828">Falta elegir sucursal</span>')+'</div>'+
          (suc && suc.maps ? '<a class="mapa-link" target="_blank" rel="noopener" href="'+esc(suc.maps)+'">📍 Abrir en Google Maps</a>' : '')+
          (suc ? '<div class="pequeno" style="margin-top:4px">'+esc(suc.direccion)+'</div>':'')+
        '</div>'+
        (t.area?campo('Área', t.area):'')+
        campo('Contenido', t.contenido||'—')+
        campo('Lo entrega', t.gestor)+
        campo('Recolectado', t.fecha)+
        '<div class="acciones"><div class="et">Seleccionar acción</div>'+
          '<div class="fila-btn">'+
            '<button class="btn verde chico" onclick="abrirCierreTraspaso('+i+',true)">✓ ENTREGAR</button>'+
            '<button class="btn rojo chico" onclick="abrirCierreTraspaso('+i+',false)">✕ NO ENTREGAR</button>'+
          '</div>'+
          '<button class="btn linea chico mt" onclick="editarTraspaso('+i+')">✎ Completar datos</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  });
  $('contTras').innerHTML=html;
}

function editarTraspaso(i){
  var t=S.traspasos[i];
  var html='<div class="modal" id="modal"><div class="hoja"><div class="agarre"></div>'+
    '<h2>Datos del traspaso</h2><p class="sub">Folio <b>'+esc(t.folio)+'</b></p>'+
    '<div class="bloque">'+
      '<div class="grupo"><label>Origen</label>'+
        '<input class="campo" id="edOrigen" value="'+esc(t.origen)+'" placeholder="De dónde salió"></div>'+
      '<div class="grupo"><label>Destino</label><select class="campo" id="edDestino">'+
        '<option value="">— Selecciona sucursal —</option>'+
        S.sucursales.map(function(s){
          return '<option value="'+esc(s.nombre)+'"'+(norm(s.nombre)===norm(t.destino)?' selected':'')+'>'+esc(s.nombre)+'</option>';
        }).join('')+
      '</select></div>'+
      '<div class="grupo"><label>Área</label><input class="campo" id="edArea" value="'+esc(t.area)+'"></div>'+
      '<div class="grupo"><label>Contenido</label>'+
        '<textarea class="campo" id="edCont" rows="2">'+esc(t.contenido)+'</textarea></div>'+
    '</div>'+
    '<div class="fila-btn"><button class="btn gris" onclick="cerrarModal()">Cancelar</button>'+
    '<button class="btn" onclick="guardarEdicionTraspaso('+i+')">Guardar</button></div>'+
  '</div></div>';
  var m=$('modal'); if(m) m.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function guardarEdicionTraspaso(i){
  var t=S.traspasos[i];
  var p={ folio:t.folio, origen:$('edOrigen').value, destino:$('edDestino').value,
          area:$('edArea').value, contenido:$('edCont').value };
  cargando('Guardando…');
  srv('actualizarTraspaso', {p:p}).then(function(){
    quitarCargando(); cerrarModal();
    t.origen=p.origen; t.destino=p.destino; t.area=p.area; t.contenido=p.contenido;
    beep(); toast('Datos guardados','ok'); pintarEntregar();
  }).catch(function(e){ quitarCargando(); toast(e.message,'err'); });
}

function abrirCierreTraspaso(i, entregado){
  var t=S.traspasos[i];
  S.cierre={ tipo:'TRASPASO', p:t, entregado:entregado, foto:null,
             motivo:'', comentario:'', destino:t.destino||'' };
  pintarCierreTraspaso();
}

function pintarCierreTraspaso(){
  var c=S.cierre, t=c.p, r=(S.estado&&S.estado.reglas)||{};
  var html='<div class="modal" id="modal"><div class="hoja"><div class="agarre"></div>'+
    '<h2>'+(c.entregado?'✓ Entregar traspaso':'✕ No entregado')+'</h2>'+
    '<p class="sub">Folio <b>'+esc(t.folio)+'</b></p>';

  if(!S.hayRed){
    html+='<div class="aviso warn">Sin señal: se guarda en tu celular y sube solo.</div>';
  }

  if(c.entregado){
    html+='<div class="bloque"><h3>🏬 Sucursal destino <span class="req">obligatorio</span></h3>'+
      '<select class="campo" id="selDestino" onchange="S.cierre.destino=this.value">'+
      '<option value="">— Selecciona —</option>'+
      S.sucursales.map(function(s){
        return '<option value="'+esc(s.nombre)+'"'+(norm(s.nombre)===norm(c.destino)?' selected':'')+'>'+esc(s.nombre)+'</option>';
      }).join('')+'</select></div>';
  }else{
    var lt = S.motivos.TRASPASO || [];
    html+='<div class="bloque"><h3>¿Qué pasó? <span class="req">obligatorio</span>'+
          (c.motivo?'<span class="listo">✓</span>':'')+'</h3><div class="opciones">';
    lt.forEach(function(m,i){
      html+='<button class="opcion'+(c.motivo===m.motivo?' sel':'')+'" onclick="elegirMotivoTras('+i+')">'+
            '<span class="radio"></span><span>'+esc(m.motivo)+'</span></button>';
    });
    html+='</div><div class="mt"><label for="inComent">Redacta qué pasó'+
          (norm(c.motivo)==='otro'?' <span style="color:#C62828">(obligatorio)</span>':' (opcional)')+'</label>'+
          '<textarea class="campo" id="inComent" rows="3">'+esc(c.comentario)+'</textarea></div></div>';
  }

  var pideFoto = c.entregado ? (r.exigirFotoTraspaso!==false) : false;
  html+='<div class="bloque"><h3>📷 Fotografía '+
        (pideFoto?'<span class="req">obligatorio</span>':'<span class="pequeno">opcional</span>')+
        (c.foto?'<span class="listo">✓ Lista</span>':'')+'</h3>';
  if(c.foto){
    html+='<div class="previa"><img src="'+c.foto+'" alt="">'+
          '<button class="quitar" onclick="quitarFotoTras()">Cambiar</button></div>';
  }else{
    html+='<button class="zona-foto" style="width:100%" onclick="tomarFoto()">'+
          '<span class="ic">📸</span><b>Tomar foto</b><small>Dónde y cómo se entregó</small></button>';
  }
  html+='</div>';

  html+='<div class="fila-btn mt">'+
          '<button class="btn gris" onclick="cerrarModal()">Cancelar</button>'+
          '<button class="btn '+(c.entregado?'verde':'rojo')+'" onclick="enviarCierreTraspaso()">'+
            (c.entregado?'Confirmar entrega':'NO ENTREGADO')+'</button>'+
        '</div></div></div>';

  var m=$('modal'); if(m) m.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function elegirMotivoTras(i){
  preservarCierre();
  var lt=S.motivos.TRASPASO||[]; if(lt[i]) S.cierre.motivo=lt[i].motivo;
  pintarCierreTraspaso();
}
function quitarFotoTras(){ preservarCierre(); S.cierre.foto=null; pintarCierreTraspaso(); }

function enviarCierreTraspaso(){
  var c=S.cierre, t=c.p, r=(S.estado&&S.estado.reglas)||{};
  if($('inComent')) c.comentario=$('inComent').value;
  if($('selDestino')) c.destino=$('selDestino').value;

  if(c.entregado){
    if(!c.destino){ toast('Selecciona la sucursal destino.','err'); beep('malo'); return; }
    if(r.exigirFotoTraspaso!==false && !c.foto){ toast('Falta la foto.','err'); beep('malo'); return; }
  }else{
    if(!c.motivo){ toast('Selecciona el motivo.','err'); beep('malo'); return; }
    if(norm(c.motivo)==='otro' && !String(c.comentario||'').trim()){
      toast('Escribe qué pasó.','err'); beep('malo'); return;
    }
  }

  cargando(S.hayRed ? 'Guardando…' : 'Guardando en el celular…');
  obtenerGPS().then(function(pos){
    var datos = {
      folio:t.folio, resultado:c.entregado?'ENTREGADO':'NO_ENTREGADO',
      motivo:c.motivo, comentario:c.comentario, foto:c.foto,
      destino:c.destino, lat:pos.lat, lng:pos.lng
    };
    var etiqueta = 'Traspaso '+t.folio+' · '+(c.entregado?'ENTREGADO':'NO ENTREGADO');
    if(!navigator.onLine) return guardarEnCola('TRASPASO', datos, etiqueta);
    return srv('cerrarTraspaso', {p:datos}).catch(function(e){
      if(esErrorDeRed(e)) return guardarEnCola('TRASPASO', datos, etiqueta);
      throw e;
    });
  }).then(function(res){
    quitarCargando(); cerrarModal();
    beep();
    var local = res && res.guardadoLocal;
    flash(true, (c.entregado?'Traspaso entregado':'Registrado como no entregado')+
                (local?' · se sube al haber señal':''));
    S.traspasos = S.traspasos.filter(function(x){ return x.folio!==t.folio; });
    pintarTraspasos();
  }).catch(function(e){ quitarCargando(); beep('malo'); toast(e.message,'err'); });
}


/* ===================================================================
 *  PANTALLA 6 — HISTORIAL
 * =================================================================== */
function vistaHistorial(tipo){
  S.vista='historial';
  S.tipoHist = tipo || S.tipoHist || 'PEDIDOS';
  $('app').innerHTML=
  '<div class="barra">'+
    '<button class="volver" onclick="vistaMenu()">←</button>'+
    '<div class="titulo"><h1>Historial</h1><small>'+esc(S.gestor)+'</small></div>'+
  '</div><div class="cuerpo">'+
  '<div class="tabs">'+
    '<button class="'+(S.tipoHist==='PEDIDOS'?'act':'')+'" onclick="vistaHistorial(\'PEDIDOS\')">🏠 Pedidos a domicilio</button>'+
    '<button class="'+(S.tipoHist==='TRASPASOS'?'act':'')+'" onclick="vistaHistorial(\'TRASPASOS\')">🔄 Traspasos</button>'+
  '</div>'+
  '<div class="busca"><span class="lupa">🔎</span>'+
    '<input class="campo" id="inBusca" placeholder="Busca por ID, folio, cliente, dirección…" oninput="buscarHistDebounce()"></div>'+
  '<div id="listaHist"><div class="vacio"><span class="ic">⏳</span><b>Cargando…</b></div></div>'+
  '</div>';
  cargarHistorial('');
  pintarBarraRed();
}

var _tb=null;
function buscarHistDebounce(){
  clearTimeout(_tb);
  _tb=setTimeout(function(){ cargarHistorial($('inBusca').value.trim()); }, 320);
}

function cargarHistorial(q){
  srv('historial', {tipo:S.tipoHist, q:q, soloMios:true, limite:200}).then(function(lista){
    pintarHistorial(lista, q);
  }).catch(function(e){
    var d=$('listaHist'); if(!d) return;
    d.innerHTML='<div class="vacio"><span class="ic">📡</span><b>'+
      (esErrorDeRed(e)?'Sin conexión':'Error')+'</b><p>'+
      (esErrorDeRed(e)?'El historial necesita señal para consultarse.':esc(e.message))+'</p></div>';
  });
}

function pintarHistorial(lista, q){
  var d=$('listaHist'); if(!d) return;
  if(!lista.length){
    d.innerHTML='<div class="vacio"><span class="ic">📭</span><b>Sin resultados</b>'+
      '<p>'+(q?'No encontré nada con «'+esc(q)+'».':'Aquí aparecerá todo lo que cierres.')+'</p></div>';
    return;
  }
  d.innerHTML='<p class="pequeno mb">'+lista.length+' registro(s)</p>'+lista.map(function(h){
    var ok = norm(h.resultado)==='entregado';
    var lineas = S.tipoHist==='TRASPASOS'
      ? [ (h.origen||h.destino)?('De '+(h.origen||'—')+' a '+(h.destino||'—')):'', h.contenido, h.motivo, h.comentario ]
      : [ h.cliente, h.direccion, h.motivo, h.comentario ];
    return '<div class="hist'+(ok?'':' malo')+'">'+
      '<div class="top"><b>'+esc(h.id)+'</b><small>'+esc(h.fechaHora)+'</small></div>'+
      lineas.filter(Boolean).map(function(l){ return '<div class="l">'+esc(l)+'</div>'; }).join('')+
      '<span class="et '+(ok?'ok':'no')+'">'+esc(h.resultado||h.evento||'')+'</span>'+
      ' <span class="pequeno">· 🚗 '+esc(h.vehiculo||'')+'</span>'+
      ((h.foto||h.firma)?'<div class="ev">'+
        (h.foto&&String(h.foto).indexOf('http')===0?'<a href="'+esc(h.foto)+'" target="_blank" rel="noopener">📷 Foto</a>':'')+
        (h.firma&&String(h.firma).indexOf('http')===0?'<a href="'+esc(h.firma)+'" target="_blank" rel="noopener">✍️ Firma</a>':'')+
      '</div>':'')+
    '</div>';
  }).join('');
}


/* ===================================================================
 *  PANTALLA 7 — USO DE VEHÍCULOS
 * =================================================================== */
function vistaUsoVehiculos(){
  S.vista='usoveh';
  cargando('Cargando…');
  srv('usoVehiculos').then(function(d){
    quitarCargando();
    var res=d.resumenHoy||{}, claves=Object.keys(res);
    var html=
    '<div class="barra">'+
      '<button class="volver" onclick="vistaMenu()">←</button>'+
      '<div class="titulo"><h1>Uso de vehículos</h1><small>'+esc(S.gestor)+'</small></div>'+
    '</div><div class="cuerpo">'+
    '<div class="aviso info"><b>Vehículo actual:</b> '+esc(d.actual||'—')+'</div>'+
    '<button class="btn mb" onclick="vistaVehiculo(false)">🚗 Cambiar de vehículo</button>'+
    '<div class="bloque"><h3>Actividad de hoy</h3>'+
      (claves.length
        ? '<div class="scroll-x"><table class="tb"><tr><th>Vehículo</th><th>Pedidos</th><th>Traspasos</th></tr>'+
          claves.map(function(k){
            return '<tr><td><b>'+esc(k)+'</b></td><td>'+res[k].pedidos+'</td><td>'+res[k].traspasos+'</td></tr>';
          }).join('')+'</table></div>'
        : '<p class="pequeno">Todavía no cierras nada hoy.</p>')+
    '</div>'+
    '<div class="bloque"><h3>Historial de cambios</h3>'+
      (d.cambios.length
        ? d.cambios.map(function(c){
            return '<div class="hist" style="border-left-color:#F9A825">'+
              '<div class="top"><b>'+esc(c.anterior)+' → '+esc(c.nuevo)+'</b>'+
              '<small>'+esc(c.fechaHora)+'</small></div>'+
              (c.motivo?'<div class="l">'+esc(c.motivo)+'</div>':'')+'</div>';
          }).join('')
        : '<p class="pequeno">Sin cambios registrados.</p>')+
    '</div></div>';
    $('app').innerHTML=html;
    pintarBarraRed();
  }).catch(function(e){ quitarCargando(); toast(e.message,'err'); });
}


/* ===================================================================
 *  PUERTA TRASERA
 * =================================================================== */
function pedirClaveAdmin(){
  var html='<div class="modal" id="modal"><div class="hoja"><div class="agarre"></div>'+
    '<h2>🔐 Acceso de administrador</h2><p class="sub">Solo para el responsable del sistema.</p>'+
    '<div class="bloque"><input class="campo" id="inClave" type="password" '+
      'placeholder="Clave de administrador" onkeydown="if(event.key===\'Enter\')entrarAdmin()"></div>'+
    '<div class="fila-btn"><button class="btn gris" onclick="cerrarModal()">Cancelar</button>'+
    '<button class="btn" onclick="entrarAdmin()">Entrar</button></div></div></div>';
  var m=$('modal'); if(m) m.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(function(){ if($('inClave')) $('inClave').focus(); },200);
}

function entrarAdmin(){
  var clave=$('inClave').value;
  cargando('Verificando…');
  S.adminClave=clave;
  adm('resumen').then(function(d){
    quitarCargando(); cerrarModal(); beep();
    vistaAdmin('resumen', d);
  }).catch(function(e){
    quitarCargando(); S.adminClave=null; toast(e.message,'err'); beep('malo');
  });
}

function adm(accionAdmin, datos){
  return srv('admin', {clave:S.adminClave, accionAdmin:accionAdmin, datos:datos||{}});
}

function vistaAdmin(seccion, datos){
  S.vista='admin'; S.seccionAdmin=seccion||'resumen';
  $('app').innerHTML=
  '<div class="barra" style="background:linear-gradient(135deg,#37474F,#546E7A)">'+
    '<button class="volver" onclick="salirAdmin()">←</button>'+
    '<div class="titulo"><h1>🔐 Administración</h1><small>Puerta trasera · solo tú</small></div>'+
  '</div><div class="cuerpo">'+
  '<div class="tabs" style="flex-wrap:wrap">'+
    botonAdmin('resumen','Tablero')+ botonAdmin('modulos','Módulos')+
    botonAdmin('catalogos','Catálogos')+ botonAdmin('reglas','Reglas')+
    botonAdmin('sesiones','Sesiones')+ botonAdmin('bitacora','Bitácora')+
  '</div><div id="contAdmin"><div class="vacio"><span class="ic">⏳</span><b>Cargando…</b></div></div></div>';
  if(seccion==='resumen' && datos) return pintarAdminResumen(datos);
  cargarSeccionAdmin(S.seccionAdmin);
}

function botonAdmin(id,txt){
  return '<button class="'+(S.seccionAdmin===id?'act':'')+'" style="flex:0 0 auto;padding:9px 13px;font-size:13px" '+
         'onclick="cargarSeccionAdmin(\''+id+'\')">'+txt+'</button>';
}

function salirAdmin(){ S.adminClave=null; if(S.token) vistaMenu(); else vistaLogin(); }

function cargarSeccionAdmin(sec){
  S.seccionAdmin=sec;
  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'),function(b){
    b.classList.toggle('act', (b.getAttribute('onclick')||'').indexOf("'"+sec+"'")>=0);
  });
  var d=$('contAdmin');
  if(d) d.innerHTML='<div class="vacio"><span class="ic">⏳</span><b>Cargando…</b></div>';

  if(sec==='resumen')   return adm('resumen').then(pintarAdminResumen).catch(errAdmin);
  if(sec==='modulos')   return adm('modulos').then(pintarAdminModulos).catch(errAdmin);
  if(sec==='sesiones')  return adm('sesiones').then(pintarAdminSesiones).catch(errAdmin);
  if(sec==='bitacora')  return adm('bitacora',{limite:200}).then(pintarAdminBitacora).catch(errAdmin);
  if(sec==='reglas')    return adm('leerTabla',{tabla:'CONFIG'}).then(function(t){ pintarAdminTabla('CONFIG',t,'Reglas del sistema'); }).catch(errAdmin);
  if(sec==='catalogos') return pintarAdminCatalogos();
}
function errAdmin(e){ var d=$('contAdmin'); if(d) d.innerHTML='<div class="aviso err">'+esc(e.message)+'</div>'; }

function pintarAdminResumen(r){
  $('contAdmin').innerHTML=
  '<div class="bloque"><h3>Hoy · '+esc(r.fecha)+'</h3><div class="scroll-x"><table class="tb">'+
    '<tr><th>Indicador</th><th>Total</th></tr>'+
    '<tr><td>Pedidos entregados</td><td><b>'+r.entregados+'</b></td></tr>'+
    '<tr><td>Pedidos no entregados</td><td><b>'+r.noEntregados+'</b></td></tr>'+
    '<tr><td>Traspasos recolectados</td><td><b>'+r.traspasosRecolectados+'</b></td></tr>'+
    '<tr><td>Traspasos entregados</td><td><b>'+r.traspasosEntregados+'</b></td></tr>'+
    '<tr><td>Traspasos en ruta</td><td><b>'+r.traspasosEnRuta+'</b></td></tr>'+
    '<tr><td>Gestores con sesión activa</td><td><b>'+r.gestoresActivos+'</b></td></tr>'+
  '</table></div></div>'+
  '<div class="bloque"><h3>Por gestor (hoy)</h3><div class="scroll-x"><table class="tb">'+
    '<tr><th>Gestor</th><th>Entreg.</th><th>No entr.</th><th>Trasp.</th></tr>'+
    (Object.keys(r.porGestor).length
      ? Object.keys(r.porGestor).map(function(g){
          var x=r.porGestor[g];
          return '<tr><td><b>'+esc(g)+'</b></td><td>'+x.entregados+'</td><td>'+x.noEntregados+'</td><td>'+x.traspasos+'</td></tr>';
        }).join('')
      : '<tr><td colspan="4">Sin movimientos hoy.</td></tr>')+
  '</table></div></div>'+
  '<div class="bloque"><h3>Acciones rápidas</h3>'+
    '<button class="btn ambar chico mb" onclick="accionAdmin(\'liberarCandado\',{},\'Candados liberados\')">🔓 Liberar candados de vehículo</button>'+
    '<button class="btn gris chico mb" onclick="accionAdmin(\'sincronizar\',{},\'Sincronizado\')">🔄 Sincronizar catálogos</button>'+
    '<button class="btn gris chico mb" onclick="accionAdmin(\'instalar\',{},\'Hojas verificadas\')">🛠 Instalar / reparar hojas</button>'+
    '<button class="btn '+(r.appBloqueada?'verde':'rojo')+' chico mb" '+
      'onclick="accionAdmin(\'bloquearApp\',{valor:'+(!r.appBloqueada)+'},\''+(r.appBloqueada?'App liberada':'App bloqueada')+'\')">'+
      (r.appBloqueada?'▶ Liberar la app':'⛔ Bloquear la app')+'</button>'+
    '<div class="fila-btn mt">'+
      '<input class="campo" id="inReabrir" placeholder="ID de pedido a reabrir">'+
      '<button class="btn chico" style="flex:0 0 110px" onclick="reabrir()">Reabrir</button>'+
    '</div>'+
  '</div>';
}

function accionAdmin(accion, datos, msgOk){
  cargando('Ejecutando…');
  adm(accion, datos).then(function(){
    quitarCargando(); beep(); toast(msgOk||'Listo','ok');
    cargarSeccionAdmin(S.seccionAdmin);
  }).catch(function(e){ quitarCargando(); toast(e.message,'err'); });
}

function reabrir(){
  var id=$('inReabrir').value.trim();
  if(!id){ toast('Escribe el ID.','err'); return; }
  accionAdmin('reabrirPedido',{id:id},'Pedido '+id+' devuelto a pendientes');
}

function pintarAdminModulos(mods){
  S.modsAdmin=mods;
  $('contAdmin').innerHTML=
  '<div class="aviso info">Prende o apaga los iconos del menú.</div>'+
  '<div class="bloque">'+mods.map(function(m,i){
    return '<label class="opcion" style="cursor:pointer;margin-bottom:8px">'+
      '<input type="checkbox" '+(m.activo?'checked':'')+' style="width:22px;height:22px" '+
      'onchange="S.modsAdmin['+i+'].activo=this.checked">'+
      '<span>'+m.icono+' <b>'+esc(m.titulo)+'</b><br><small class="pequeno">'+esc(m.id)+'</small></span></label>';
  }).join('')+'</div>'+
  '<button class="btn verde" onclick="guardarModulosAdmin()">Guardar módulos</button>';
}

function guardarModulosAdmin(){
  cargando('Guardando…');
  adm('guardarModulos',{modulos:S.modsAdmin}).then(function(){
    quitarCargando(); beep(); toast('Módulos actualizados','ok');
  }).catch(function(e){ quitarCargando(); toast(e.message,'err'); });
}

function pintarAdminCatalogos(){
  $('contAdmin').innerHTML=
  '<div class="aviso info">Se guarda directo en Google Sheets.</div>'+
  '<div class="bloque"><h3>Elige qué editar</h3>'+
  ['USUARIOS','VEHICULOS','SUCURSALES','MOTIVOS','CAT_TRAS'].map(function(t){
    var nombres={USUARIOS:'👤 Gestores y credenciales',VEHICULOS:'🚗 Vehículos',
                 SUCURSALES:'🏬 Sucursales destino',MOTIVOS:'📝 Motivos',
                 CAT_TRAS:'📦 Catálogo de traspasos'};
    return '<button class="btn linea chico mb" onclick="abrirTablaAdmin(\''+t+'\')">'+nombres[t]+'</button>';
  }).join('')+'</div><div id="tablaAdmin"></div>';
}

function abrirTablaAdmin(tabla){
  cargando('Cargando…');
  adm('leerTabla',{tabla:tabla}).then(function(t){
    quitarCargando(); pintarAdminTabla(tabla,t,null,'tablaAdmin');
  }).catch(function(e){ quitarCargando(); toast(e.message,'err'); });
}

function pintarAdminTabla(tabla, t, titulo, destino){
  S.tablaAdmin={ tabla:tabla, enc:t.encabezados, filas:t.filas };
  $(destino||'contAdmin').innerHTML=
  '<div class="bloque"><h3>'+esc(titulo||t.hoja)+'</h3>'+
    '<div class="scroll-x" style="max-height:420px"><table class="tb">'+
    '<tr>'+t.encabezados.map(function(h){ return '<th>'+esc(h)+'</th>'; }).join('')+'<th></th></tr>'+
    t.filas.map(function(f,i){
      return '<tr>'+t.encabezados.map(function(h,j){
        return '<td><input value="'+esc(f[j]==null?'':f[j])+'" data-i="'+i+'" data-j="'+j+'" onchange="editarCelda(this)"></td>';
      }).join('')+'<td><button class="btn rojo chico" style="padding:5px 8px" onclick="borrarFilaAdmin('+i+')">✕</button></td></tr>';
    }).join('')+
    '</table></div>'+
    '<div class="fila-btn mt">'+
      '<button class="btn gris chico" onclick="agregarFilaAdmin()">+ Agregar fila</button>'+
      '<button class="btn verde chico" onclick="guardarTablaAdmin()">Guardar cambios</button>'+
    '</div></div>';
}

function editarCelda(inp){
  var i=+inp.getAttribute('data-i'), j=+inp.getAttribute('data-j');
  S.tablaAdmin.filas[i][j]=inp.value;
}
function agregarFilaAdmin(){
  S.tablaAdmin.filas.push(S.tablaAdmin.enc.map(function(){ return ''; }));
  pintarAdminTabla(S.tablaAdmin.tabla,{hoja:S.tablaAdmin.tabla,encabezados:S.tablaAdmin.enc,filas:S.tablaAdmin.filas},
                   null, S.seccionAdmin==='catalogos'?'tablaAdmin':'contAdmin');
}
function borrarFilaAdmin(i){
  if(!confirm('¿Borrar esta fila?')) return;
  S.tablaAdmin.filas.splice(i,1);
  pintarAdminTabla(S.tablaAdmin.tabla,{hoja:S.tablaAdmin.tabla,encabezados:S.tablaAdmin.enc,filas:S.tablaAdmin.filas},
                   null, S.seccionAdmin==='catalogos'?'tablaAdmin':'contAdmin');
}
function guardarTablaAdmin(){
  cargando('Guardando en la hoja…');
  adm('guardarTabla',{tabla:S.tablaAdmin.tabla, filas:S.tablaAdmin.filas}).then(function(){
    quitarCargando(); beep(); toast('Guardado en Google Sheets','ok');
  }).catch(function(e){ quitarCargando(); toast(e.message,'err'); });
}

function pintarAdminSesiones(lista){
  $('contAdmin').innerHTML=
  '<div class="bloque"><h3>Sesiones</h3>'+
    '<button class="btn rojo chico mb" onclick="accionAdmin(\'cerrarSesiones\',{},\'Sesiones cerradas\')">Cerrar todas las sesiones</button>'+
    '<div class="scroll-x" style="max-height:440px"><table class="tb">'+
    '<tr><th>Gestor</th><th>Vehículo</th><th>Inicio</th><th>Activa</th></tr>'+
    (lista.length?lista.map(function(s){
      return '<tr><td><b>'+esc(s.gestor)+'</b></td><td>'+esc(s.vehiculo)+'</td>'+
             '<td>'+esc(String(s.inicio).replace('T',' ').substring(0,16))+'</td>'+
             '<td>'+(s.activa?'✅':'—')+'</td></tr>';
    }).join(''):'<tr><td colspan="4">Sin sesiones.</td></tr>')+
    '</table></div></div>';
}

function pintarAdminBitacora(lista){
  $('contAdmin').innerHTML=
  '<div class="bloque"><h3>Bitácora (últimos 200 eventos)</h3>'+
  '<div class="scroll-x" style="max-height:520px"><table class="tb">'+
  '<tr><th>Fecha</th><th>Gestor</th><th>Acción</th><th>Detalle</th></tr>'+
  (lista.length?lista.map(function(l){
    return '<tr><td>'+esc(l.fechaHora)+'</td><td>'+esc(l.gestor)+'</td>'+
           '<td><b>'+esc(l.accion)+'</b></td><td>'+esc(l.detalle)+'</td></tr>';
  }).join(''):'<tr><td colspan="4">Sin eventos.</td></tr>')+
  '</table></div></div>';
}


/* ===================================================================
 *  ESCÁNER DE UNA SOLA LECTURA (login)
 * =================================================================== */
function abrirScannerSimple(titulo, alLeer){
  var html='<div class="modal" id="modalScan"><div class="hoja">'+
    '<div class="agarre"></div><h2>'+esc(titulo)+'</h2>'+
    '<p class="sub">Acerca el código de barras hasta que suene.</p>'+
    '<div id="lectorSimple"></div>'+
    '<button class="btn gris mt" onclick="cerrarScannerSimple()">Cancelar</button>'+
  '</div></div>';
  var m=$('modalScan'); if(m) m.remove();
  document.body.insertAdjacentHTML('beforeend', html);

  if(!window.Html5Qrcode){ toast('El lector no cargó. Teclea el código a mano.','err'); return; }
  S.scannerSimple = new Html5Qrcode('lectorSimple', {formatsToSupport: formatosCodigo(), verbose:false});
  S.scannerSimple.start({facingMode:'environment'},
    {fps:12, qrbox:{width:250,height:140}, aspectRatio:1.4},
    function(texto){ cerrarScannerSimple(); alLeer(String(texto).trim()); },
    function(){}
  ).catch(function(e){ toast('No pude abrir la cámara: '+e,'err'); });
}

function cerrarScannerSimple(){
  if(S.scannerSimple){
    try{ S.scannerSimple.stop().then(function(){ try{S.scannerSimple.clear();}catch(e){} S.scannerSimple=null; }); }
    catch(e){ S.scannerSimple=null; }
  }
  var m=$('modalScan'); if(m) m.remove();
}


/* ===================================================================
 *  INSTALACIÓN EN EL CELULAR
 * =================================================================== */
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  S.promptInstalar = e;
  if(!leer('no_instalar')) setTimeout(mostrarBotonInstalar, 2500);
});

function mostrarBotonInstalar(){
  if($('barraInstalar') || !S.promptInstalar) return;
  var d=document.createElement('div');
  d.id='barraInstalar'; d.className='instalar';
  d.innerHTML=
    '<img src="iconos/icono-192.png" alt="">'+
    '<div class="txt"><b>Instalar Logística</b><span>Ábrela desde tu pantalla de inicio</span></div>'+
    '<button onclick="instalarApp()">Instalar</button>'+
    '<button class="cerrar" onclick="ocultarBotonInstalar(true)">✕</button>';
  document.body.appendChild(d);
}
function ocultarBotonInstalar(recordar){
  var d=$('barraInstalar'); if(d) d.remove();
  if(recordar) guardar('no_instalar','1');
}
function instalarApp(){
  if(!S.promptInstalar) return;
  S.promptInstalar.prompt();
  S.promptInstalar.userChoice.then(function(){ S.promptInstalar=null; ocultarBotonInstalar(false); });
}

/** iPhone: Safari no tiene botón de instalar, hay que explicarlo. */
function esIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
         (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
}
function yaInstalada(){
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
}
function avisarInstalacionIOS(){
  if(!esIOS() || yaInstalada() || leer('no_instalar')) return;
  var html='<div class="modal" id="modalIOS"><div class="hoja"><div class="agarre"></div>'+
    '<h2>Instala Logística en tu iPhone</h2>'+
    '<p class="sub">Así la abres como app, sin la barra del navegador.</p>'+
    '<div class="bloque"><ol class="pasos-ios">'+
      '<li>Toca el botón <b>Compartir</b> (el cuadrito con la flecha hacia arriba), abajo en Safari.</li>'+
      '<li>Desliza y elige <b>Agregar a inicio</b>.</li>'+
      '<li>Toca <b>Agregar</b> arriba a la derecha.</li>'+
      '<li>Ábrela desde el icono azul del camión.</li>'+
    '</ol></div>'+
    '<button class="btn" onclick="cerrarIOS(false)">Entendido</button>'+
    '<button class="btn linea mt" onclick="cerrarIOS(true)">No volver a mostrar</button>'+
  '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}
function cerrarIOS(recordar){
  var m=$('modalIOS'); if(m) m.remove();
  if(recordar) guardar('no_instalar','1');
}


/* ===================================================================
 *  ARRANQUE
 * =================================================================== */
function arrancar(){
  if(API.indexOf('exec') < 0){
    $('app').innerHTML='<div class="cuerpo"><div class="aviso err">'+
      '<b>Falta configurar la app.</b><br>Abre el archivo <b>app.js</b> y pega en la primera línea '+
      'la URL de tu aplicación web de Apps Script (la que termina en /exec).</div></div>';
    return;
  }

  refrescarCola();

  var t=leer('token');
  if(!t){ vistaLogin(); setTimeout(avisarInstalacionIOS, 3000); return; }

  S.token=t; S.gestor=leer('nombre')||'';
  cargando('Recuperando tu sesión…');

  srv('estado').then(function(st){
    quitarCargando();
    S.estado=st; S.gestor=st.gestor; S.vehiculo=st.vehiculo||'';
    sinFallar(DB.set('estado', st), null);
    if(!S.vehiculo) vistaVehiculo(true);
    else { pintarMenu(); iniciarPoll(); subirCola(); }
    setTimeout(avisarInstalacionIOS, 3000);
  }).catch(function(e){
    quitarCargando();
    if(esErrorDeRed(e)){
      sinFallar(DB.get('estado'), null).then(function(st){
        if(st){ S.estado=st; S.vehiculo=st.vehiculo||''; S.desdeCache=true; pintarMenu(); }
        else { toast('Sin conexión. Conéctate una vez para empezar.','err'); vistaLogin(); }
      });
      return;
    }
    borrar('token'); S.token=null; vistaLogin();
  });
}

/* Service worker: lo que hace que abra sin señal */
if('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').then(function(reg){
      reg.addEventListener('updatefound', function(){
        var nuevo = reg.installing;
        if(!nuevo) return;
        nuevo.addEventListener('statechange', function(){
          if(nuevo.state==='installed' && navigator.serviceWorker.controller){
            toast('Hay una versión nueva. Cierra y vuelve a abrir la app.','ok');
          }
        });
      });
    }).catch(function(e){ console.warn('sw:', e); });

    navigator.serviceWorker.addEventListener('message', function(e){
      if(e.data==='SUBIR_COLA') subirCola();
    });
  });
}

window.addEventListener('beforeunload', function(){ pararScanner(); });
document.addEventListener('visibilitychange', function(){
  if(!document.hidden && S.token){ refrescarCola().then(function(){ subirCola(); }); }
});

arrancar();
