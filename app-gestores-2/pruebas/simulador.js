// Simulador mínimo de Google Apps Script para probar el servidor en Node.
// (Copia del de APP GESTORES/pruebas, con lo que necesita App Gestores 2: firmas HMAC, base64 web, archivo activo.)
const vm = require('vm');
const fs = require('fs');
const crypto = require('crypto');

function crearEntorno(opciones) {
  opciones = opciones || {};
  const reloj = { ahora: Date.parse(opciones.inicio || '2026-10-20T14:00:00Z') };
  const stats = { openById: 0, escrituras: {}, lecturas: {} };
  const libros = {};
  let sigId = 1;

  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(reloj.ahora); else super(...a); }
    static now() { return reloj.ahora; }
  }

  function marcaEsc(libro, hoja) { const k = libro + '/' + hoja; stats.escrituras[k] = (stats.escrituras[k] || 0) + 1; }

  class Rango {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const fila = this.sh.datos[this.r - 1 + i] || [];
        const o = [];
        for (let j = 0; j < this.nc; j++) { const v = fila[this.c - 1 + j]; o.push(v === undefined ? '' : v); }
        out.push(o);
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    getFormulas() { return this.getValues().map(f => f.map(() => '')); }
    setValues(v) {
      if (v.length !== this.nr || v[0].length !== this.nc) throw new Error('setValues: tamaño no coincide ' + v.length + 'x' + v[0].length + ' vs ' + this.nr + 'x' + this.nc);
      for (let i = 0; i < this.nr; i++) {
        while (this.sh.datos.length < this.r + i) this.sh.datos.push([]);
        const fila = this.sh.datos[this.r - 1 + i];
        for (let j = 0; j < this.nc; j++) fila[this.c - 1 + j] = v[i][j];
      }
      marcaEsc(this.sh.libro.nombre, this.sh.nombre); return this;
    }
    setValue(v) { const m = []; for (let i = 0; i < this.nr; i++) { m.push(new Array(this.nc).fill(v)); } return this.setValues(m); }
    clearContent() { return this.setValue(''); }
    setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
    insertCheckboxes() { return this; }
  }

  class Hoja {
    constructor(libro, nombre, datos) { this.libro = libro; this.nombre = nombre; this.datos = datos || []; }
    getName() { return this.nombre; }
    setName(n) { this.nombre = n; return this; }
    getLastRow() { for (let i = this.datos.length - 1; i >= 0; i--) { if ((this.datos[i] || []).some(v => v !== '' && v != null)) return i + 1; } return 0; }
    getLastColumn() { let m = 0; this.datos.forEach(f => { for (let j = (f || []).length - 1; j >= 0; j--) if (f[j] !== '' && f[j] != null) { m = Math.max(m, j + 1); break; } }); return m; }
    getRange(r, c, nr, nc) { if (typeof r === 'string') throw new Error('A1 no soportado'); return new Rango(this, r, c, nr || 1, nc || 1); }
    getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
    appendRow(f) { this.datos.length = this.getLastRow(); this.datos.push(f.slice()); marcaEsc(this.libro.nombre, this.nombre); }
    deleteRow(r) { this.datos.splice(r - 1, 1); marcaEsc(this.libro.nombre, this.nombre); }
    setFrozenRows() {} setColumnWidth() {} autoResizeColumns() {}
    getProtections() { return []; } protect() { return { setDescription() { return this; }, setWarningOnly() { return this; } }; }
    copyTo(libro) { const h = new Hoja(libro, 'Copia de ' + this.nombre, JSON.parse(JSON.stringify(this.datos))); libro.hojas.push(h); return h; }
  }

  class Libro {
    constructor(nombre, id) { this.nombre = nombre; this.id = id; this.hojas = []; }
    getName() { return this.nombre; } getId() { return this.id; }
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
    getSheetByName(n) { return this.hojas.find(h => h.nombre === n) || null; }
    getSheets() { return this.hojas.slice(); }
    insertSheet(n) { const h = new Hoja(this, n, []); this.hojas.push(h); return h; }
    deleteSheet(h) { this.hojas = this.hojas.filter(x => x !== h); }
  }

  function libroNuevo(nombre, id) { const l = new Libro(nombre, id || ('LIBRO' + (sigId++))); libros[l.id] = l; return l; }

  // ---- Cache con caducidad sobre el reloj falso ----
  const cacheMem = {};
  const cache = {
    get(k) { const e = cacheMem[k]; if (!e) return null; if (e.hasta <= reloj.ahora) { delete cacheMem[k]; return null; } return e.v; },
    put(k, v, seg) { if (String(v).length > 100000) throw new Error('Argument too large'); cacheMem[k] = { v: String(v), hasta: reloj.ahora + (seg || 600) * 1000 }; },
    remove(k) { delete cacheMem[k]; },
    removeAll(ks) { ks.forEach(k => delete cacheMem[k]); }
  };

  const propsMem = {};
  const props = {
    getProperty(k) { return Object.prototype.hasOwnProperty.call(propsMem, k) ? propsMem[k] : null; },
    setProperty(k, v) { propsMem[k] = String(v); },
    deleteProperty(k) { delete propsMem[k]; }
  };

  let candado = false;
  const lock = { tryLock() { if (candado) return false; candado = true; return true; },
                 waitLock() { if (candado) throw new Error('Lock timeout'); candado = true; },
                 releaseLock() { candado = false; } };

  // ---- Drive ----
  const archivos = [];
  function carpeta(id, nombre) {
    return {
      id, getName() { return nombre || ('Carpeta ' + id); }, getId() { return id; },
      getFilesByName(n) { const l = archivos.filter(a => a.carpeta === id && a.nombre === n && !a.papelera); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
      createFile(blob) { const a = { carpeta: id, nombre: blob.nombre, bytes: blob.bytes.length, papelera: false,
        setTrashed(v) { this.papelera = v; }, setDescription() {}, getUrl() { return 'https://drive/' + this.nombre; } };
        archivos.push(a); return a; },
      getFoldersByName(n) { let dado = false; return { hasNext: () => !dado && false, next: () => null }; },
      createFolder(n) { return carpeta(id + '/' + n, n); }
    };
  }

  const triggers = [];
  const activo = { libro: null };

  function fmt(fecha, tz, patron) {
    const p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(fecha).forEach(x => { p[x.type] = x.value; });
    if (p.hour === '24') p.hour = '00';
    return patron.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
      .replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second)
      .replace(/^H$/, String(Number(p.hour)));
  }

  const ctx = {
    Date: FakeDate, Math, JSON, String, Number, Object, Array, RegExp, Error, isNaN, parseInt, parseFloat,
    console: { log() {} },
    Logger: { log() {} },
    SpreadsheetApp: {
      openById(id) { stats.openById++; if (!libros[id]) throw new Error('No existe libro ' + id); return libros[id]; },
      getActiveSpreadsheet() { if (!activo.libro) throw new Error('sin libro activo'); return activo.libro; },
      ProtectionType: { SHEET: 'SHEET' },
      create(n) { return libroNuevo(n); },
      getUi() { throw new Error('sin UI'); }
    },
    CacheService: { getScriptCache: () => cache },
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => lock },
    Utilities: {
      formatDate: fmt,
      getUuid: () => crypto.randomUUID(),
      base64Decode: s => Buffer.from(s, 'base64'),
      base64Encode: b => Buffer.from(b).toString('base64'),
      newBlob: (bytes, mime, nombre) => ({ bytes, mime, nombre, getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
      computeDigest: (alg, s) => Array.from(crypto.createHash('md5').update(s).digest()),
      DigestAlgorithm: { MD5: 'MD5' },
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', String(k)).update(String(v)).digest()),
      base64EncodeWebSafe: b => Buffer.from(typeof b === 'string' ? Buffer.from(b) : Buffer.from(b.map(x => x & 255))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => Array.from(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'))
    },
    DriveApp: {
      getFolderById: id => carpeta(id),
      getFileById: id => ({ getParents: () => ({ hasNext: () => false }), moveTo() {} })
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: fn => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { const t = { getHandlerFunction: () => fn }; triggers.push(t); return t; } }) }) })
    },
    Session: { getScriptTimeZone: () => 'America/Mexico_City' },
    ContentService: { createTextOutput: s => ({ texto: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    HtmlService: {}, MailApp: {},
    // De archivos que no tocamos
    apiAdmin: () => ({ ok: true, datos: {} }),
    doGetRastreo: () => 'rastreo'
  };
  vm.createContext(ctx);

  return { ctx, reloj, activar(l) { activo.libro = l; }, stats, libros, libroNuevo, archivos, triggers, cache, props, lock: () => candado,
    cargar(rutas) { const codigo = rutas.map(r => fs.readFileSync(r, 'utf8')).join('\n;\n'); vm.runInContext(codigo, ctx, { filename: 'servidor.gs' }); },
    // Simula una consulta HTTP nueva: las variables de memoria por ejecución se reinician
    post(cuerpo) {
      vm.runInContext('if (typeof __APPG_LIBRO !== "undefined") __APPG_LIBRO = null;', ctx);
      const r = ctx.doPost({ postData: { contents: JSON.stringify(cuerpo) } });
      return JSON.parse(r.texto);
    },
    correr(fn) { vm.runInContext('if (typeof __APPG_LIBRO !== "undefined") __APPG_LIBRO = null;', ctx); return ctx[fn].apply(null, [].slice.call(arguments, 1)); },
    avanzar(horas) { reloj.ahora += horas * 3600000; }
  };
}

module.exports = { crearEntorno };
