/***********************************************************************
 * TRASPASOS FADERMEX — 01_Config.gs
 * ---------------------------------------------------------------------
 * Ajustes generales y utilidades. Este proyecto vive DENTRO del archivo
 * de Google Sheets "Traspasos_FADERMEX_BD" (Extensiones → Apps Script).
 *
 * Todo lo que cambia seguido (áreas, personas, gestores, colores,
 * tiempos de sesión…) se edita en las hojas CAT_ y CFG_, no aquí.
 ***********************************************************************/

const TR = {
  // ID del archivo Traspasos_FADERMEX_BD. Si lo copias a otro archivo,
  // cambia este ID (o déjalo vacío para usar el archivo que contiene el script).
  ID_ARCHIVO: '1Fn5VKZZ-gUS_QRYIbos1WwCFzXpnIF_g7ofApN5vIxg',

  NOMBRE_APP: 'Traspasos FADERMEX',
  ZONA: 'America/Mexico_City',

  // En todas las hojas: fila 1 = descripción, fila 2 = encabezados.
  FILA_ENC: 2,

  H: {
    ESTATUS:     'CAT_Estatus',
    SUCURSALES:  'CAT_Sucursales',
    AREAS:       'CAT_Areas',
    PERSONAS:    'CAT_Personas',
    GESTORES:    'CAT_Gestores',
    ADMINS:      'CAT_Administradores',
    PAQ:         'CAT_Paqueterias',
    MOTIVOS:     'CAT_Motivos',
    AJUSTES:     'CFG_Ajustes',
    TRASPASOS:   'RES_Traspasos',
    MOV:         'RES_Movimientos',
    ESCANEOS:    'RES_Escaneos',
    ETIQUETAS:   'RES_Etiquetas',
    SOLICITUDES: 'RES_Solicitudes',
    ADMINLOG:    'RES_Administracion',
    SESIONES:    'RES_Sesiones',
    AVISOS:      'RES_Avisos',
    FOLIOS:      'SYS_Folios',
    IMPRESORAS:  'CAT_Impresoras',
    CAJAS:       'RES_Cajas',
    BOTICAN:     'RES_RecoleccionesBotican',
    DOMICILIO:   'RES_RecoleccionesDomicilio',
    RUTAS:       'CAT_RutasRecoleccion'
  },

  // Archivo de la app de gestores, donde está la hoja "Operaciones".
  // De ahí se jalan solas las guías de paquetería (columna "ID Pedido / Tarea" = folio de la caja o del traspaso).
  OPS: {
    ID_ARCHIVO: '1cPHTH2JwM92iD2wSxf4JauYLk9VBLv6T2fHhtxP-kmc',
    HOJA: 'Operaciones',
    FILA_ENC: 2,
    MAX_FILAS: 2500,          // solo revisa las últimas N filas (las más recientes)
    CADA_MIN: 10              // cada cuántos minutos se revisa
  },

  // Área especial para entrar como administrador (vista de todo).
  AREA_ADMIN: 'ADMIN'
};


/* ======================= UTILIDADES ======================= */

var __LIBRO = null;
function _libro() {
  if (__LIBRO) return __LIBRO;
  __LIBRO = TR.ID_ARCHIVO ? SpreadsheetApp.openById(TR.ID_ARCHIVO)
                          : SpreadsheetApp.getActiveSpreadsheet();
  return __LIBRO;
}

function _norm(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Para comparar códigos de credencial: sin espacios ni guiones, y sin ceros a la izquierda si es número. */
function _normCod(v) {
  let s = String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  if (/^\d+$/.test(s)) s = String(Number(s));
  return s;
}

/** SI / NO de las hojas. Vacío cuenta como NO. */
function _si(v) {
  if (v === true) return true;
  const n = _norm(v);
  return n === 'si' || n === 'true' || n === 'x' || n === '1';
}
/** Columna "Activo": vacío cuenta como SÍ (solo NO lo apaga). */
function _activo(v) {
  if (v === false) return false;
  const n = _norm(v);
  return !(n === 'no' || n === 'false' || n === '0');
}

function _hoy()  { return Utilities.formatDate(new Date(), TR.ZONA, 'yyyy-MM-dd'); }
function _hora() { return Utilities.formatDate(new Date(), TR.ZONA, 'HH:mm'); }
function _ahoraTxt() { return Utilities.formatDate(new Date(), TR.ZONA, 'yyyy-MM-dd HH:mm'); }

/** Sheets convierte textos como "2026-10-12" o "09:15" en fechas: aquí se regresan a texto. */
/**
 * Zona horaria del archivo de Sheets. Las fechas se escriben como texto en hora de México
 * ("2026-10-16 15:39") y Sheets las guarda en SU zona. Para leerlas tal como se ven en la hoja
 * hay que usar esa misma zona (si no, salen corridas: ej. "01:00" o una hora de diferencia).
 */
var __TZH = null;
function _tzHoja() {
  if (!__TZH) { try { __TZH = _libro().getSpreadsheetTimeZone() || TR.ZONA; } catch (e) { __TZH = TR.ZONA; } }
  return __TZH;
}

function _txt(v) {
  if (v == null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    const z = _tzHoja();
    if (v.getFullYear() < 1901) return Utilities.formatDate(v, z, 'HH:mm');
    const h = Utilities.formatDate(v, z, 'HH:mm');
    const d = Utilities.formatDate(v, z, 'yyyy-MM-dd');
    return h === '00:00' ? d : d + ' ' + h;
  }
  return String(v);
}

function _id(pref) {
  return (pref || '') + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
}

/** Respuesta estándar para la página: {ok, datos} o {ok:false, error}. */
function _api(fn) {
  try { return { ok: true, datos: fn() }; }
  catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
}

const TR_OCUPADO = 'El sistema está ocupado guardando otro movimiento. Espera unos segundos y vuelve a intentarlo: no se guardó nada.';
function _conCandado(fn, espera) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(espera || 28000)) throw new Error(TR_OCUPADO);
  try { return fn(); }
  finally { try { lock.releaseLock(); } catch (e) { } }
}


/* ======================= TABLAS =======================
 * Lee una hoja por NOMBRE DE ENCABEZADO (fila 2), así no importa si
 * algún día se mueve una columna de lugar. NO cambies el texto de los
 * encabezados: la app los busca por nombre.
 * ======================================================= */

var __TB = {};
/* ---------- Caché de catálogos ----------
 * Los catálogos (áreas, sucursales, administradores, ajustes, personas…) casi no cambian, pero se
 * consultan en CADA clic. Se guardan 10 min en la memoria del servidor. Se renuevan solos cuando:
 * la página escribe en ellos, alguien edita una hoja CAT_ / CFG_ (onEdit) o se corre Instalar / reparar. */
const TB_CACHE = ['CAT_Areas', 'CAT_Sucursales', 'CAT_Administradores', 'CFG_Ajustes', 'CAT_Estatus', 'CAT_Paqueterias',
  'CAT_Motivos', 'CAT_Impresoras', 'CAT_Personas', 'CAT_Gestores', 'CAT_EnviosOf', 'CAT_RutasRecoleccion'];
var __TBVER = null;
function _tbVer() {
  if (__TBVER) return __TBVER;
  const c = CacheService.getScriptCache();
  __TBVER = c.get('tbver');
  if (!__TBVER) { __TBVER = String(Date.now()); c.put('tbver', __TBVER, 21600); }
  return __TBVER;
}
/** Invalida la caché de catálogos (todas las hojas a la vez). */
function _tbRenovar() { __TBVER = String(Date.now()); try { CacheService.getScriptCache().put('tbver', __TBVER, 21600); } catch (e) { } }

function _tb(nombre) {
  if (__TB[nombre]) return __TB[nombre];
  const sh = _libro().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja "' + nombre + '". Abre el menú 🔄 Traspasos → Instalar / reparar.');
  const enCache = TB_CACHE.indexOf(nombre) >= 0, kc = enCache ? 'tb|' + _tbVer() + '|' + nombre : '';
  let guardado = null;
  if (enCache) { try { const j = CacheService.getScriptCache().get(kc); if (j) guardado = JSON.parse(j); } catch (e) { } }
  const lc = guardado ? guardado.lc : Math.max(1, sh.getLastColumn());
  const enc = guardado ? guardado.enc : sh.getRange(TR.FILA_ENC, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
  const idx = {};
  enc.forEach(function (h, i) { if (h) idx[_norm(h)] = i; });

  // Columnas que agrega "Instalar / reparar": si todavía no existen, se omiten en lugar de fallar.
  const opcional = function (h) { return idx[_norm(h)] == null && ['incidencia', 'lado', 'responsable (area)', 'cuenta', 'editado', 'tipo', 'destino nuevo', 'bultos pendientes', 'pendientes en'].indexOf(_norm(h)) >= 0; };
  const t = {
    sh: sh, enc: enc, _f: null,
    col: function (h) {
      const i = idx[_norm(h)];
      if (i == null) throw new Error('No encuentro la columna "' + h + '" en la hoja ' + nombre + '.');
      return i;
    },
    filas: function () {
      if (this._f) return this._f;
      let v;
      if (guardado && guardado.v) v = guardado.v;
      else {
        const n = sh.getLastRow() - TR.FILA_ENC;
        v = n > 0 ? sh.getRange(TR.FILA_ENC + 1, 1, n, lc).getValues() : [];
        if (enCache) {
          try { const j = JSON.stringify({ lc: lc, enc: enc, v: v }); if (j.length < 95000) CacheService.getScriptCache().put(kc, j, 600); } catch (e) { }
        }
      }
      return (this._f = this._objetos(v, TR.FILA_ENC + 1));
    },
    /** Solo los últimos n renglones (hojas que crecen mucho, ej. avisos). */
    ultimas: function (n) {
      const fin = sh.getLastRow(), ini = Math.max(TR.FILA_ENC + 1, fin - n + 1);
      return fin >= ini ? this._objetos(sh.getRange(ini, 1, fin - ini + 1, lc).getValues(), ini) : [];
    },
    /** Renglones cuya columna h es EXACTAMENTE valor (busca con TextFinder; no lee toda la hoja). */
    donde: function (h, valor) {
      const n = sh.getLastRow() - TR.FILA_ENC, c = this.col(h) + 1, self = this;
      if (n <= 0 || !String(valor || '').trim()) return [];
      const hall = sh.getRange(TR.FILA_ENC + 1, c, n, 1).createTextFinder(String(valor).trim()).matchEntireCell(true).matchCase(false).findAll();
      return hall.map(function (r) { return self._objetos(sh.getRange(r.getRow(), 1, 1, lc).getValues(), r.getRow())[0]; }).filter(Boolean)
        .sort(function (a, b) { return a._fila - b._fila; });
    },
    /** Valores de UNA columna (rápido: no trae las demás). */
    columna: function (h) {
      const n = sh.getLastRow() - TR.FILA_ENC;
      return n > 0 ? sh.getRange(TR.FILA_ENC + 1, this.col(h) + 1, n, 1).getValues().map(function (r) { return r[0]; }) : [];
    },
    _objetos: function (v, primera) {
      const out = [];
      for (let r = 0; r < v.length; r++) {
        let vacia = true;
        const o = { _fila: primera + r };
        for (let j = 0; j < enc.length; j++) {
          if (!enc[j]) continue;
          o[enc[j]] = v[r][j];
          if (String(v[r][j]).trim() !== '') vacia = false;
        }
        if (!vacia) out.push(o);
      }
      return out;
    },
    _fila: function (obj) {
      const self = this;
      Object.keys(obj).forEach(function (k) { if (!opcional(k)) self.col(k); });   // valida nombres
      return enc.map(function (h) { return (h && obj[h] != null) ? obj[h] : ''; });
    },
    agregar: function (obj) { this.agregarVarias([obj]); },
    agregarVarias: function (objs) {
      if (!objs || !objs.length) return;
      const self = this;
      const rows = objs.map(function (o) { return self._fila(o); });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, lc).setValues(rows);
      this._f = null; guardado = null;
      if (enCache) _tbRenovar();
    },
    actualizar: function (fila, obj) {
      const self = this;
      Object.keys(obj).forEach(function (h) {
        if (opcional(h)) return;
        sh.getRange(fila, self.col(h) + 1).setValue(obj[h]);
      });
      this._f = null; guardado = null;
      if (enCache) _tbRenovar();
    }
  };
  __TB[nombre] = t;
  return t;
}


/* ======================= AJUSTES (CFG_Ajustes) ======================= */

var __AJ = null;
function _ajuste(clave, porDefecto) {
  if (!__AJ) {
    __AJ = {};
    try {
      _tb(TR.H.AJUSTES).filas().forEach(function (f) {
        const k = _norm(f['Parámetro']);
        if (k) __AJ[k] = f['Valor'];
      });
    } catch (e) { }
  }
  const v = __AJ[_norm(clave)];
  if (v === '' || v == null || _norm(v) === 'pendiente') return porDefecto;
  return v;
}
