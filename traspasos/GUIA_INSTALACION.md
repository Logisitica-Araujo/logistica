# Guía de instalación: Traspasos FADERMEX

Hay **dos partes**:

- **A. El sistema de traspasos (nuevo).** Es la página que usan sucursales, áreas y administradores. Vive dentro del archivo **Traspasos_FADERMEX_BD**.
- **B. La conexión con la app de gestores.** Es un archivo que se agrega, más 3 líneas que se cambian en la app que ya tienes.

Haz primero la parte **A** y después la **B**.

---

## Cómo se entra (sin contraseñas nuevas)

- **La llave es la cuenta de Google de la empresa (@fadermex.com).** No hay usuario ni contraseña aparte. Cada computadora tiene Chrome abierto con la cuenta de su área (la de la sucursal, la de Botican, la de cada área de Oficinas). Google ya protege esa cuenta con su contraseña y, si lo activan, con verificación en dos pasos.
- **La primera vez** que se abre la página en una computadora, se elige el área (PV, Rebotica, Contabilidad…).
- **Cada 12 horas** la página pide volver a elegir el área: es un solo clic, sin contraseña. Sirve para que una computadora no quede trabajando días enteros con una sesión vieja. Las horas se cambian en `CFG_Ajustes` (`sesion_horas_sucursal`, `sesion_horas_admin`).
- **Quién hizo cada cosa** se sabe por la credencial que se escanea al crear o reimprimir, no por la sesión.
- **Administradores** (jaraujo, Oramirez, sistemasfed): entran como **usuarios de su área** para el trabajo diario. Cuando hay que arreglar algo, usan el botón dorado **"Modo administrador"** y, al terminar, **"← Volver a mi área"**. Como usuarios no tienen poderes de administrador, así no se edita nada por accidente.
- **Recomendación:** activen la **verificación en dos pasos** de Google en las 3 cuentas de administrador y en las cuentas de sucursal.

---

## A. Sistema de traspasos

### A1. Crear el proyecto de Apps Script
1. Abre el archivo **Traspasos_FADERMEX_BD** en Google Sheets con **jaraujo@fadermex.com**.
2. Menú **Extensiones → Apps Script**.
3. Arriba a la izquierda, cambia el nombre del proyecto a **Traspasos FADERMEX**.
4. Borra el contenido del archivo `Código.gs` que viene de ejemplo. Después renómbralo a `01_Config` (en los tres puntitos → Cambiar nombre).

### A2. Pegar los archivos
Están en GitHub, en la carpeta `traspasos/apps-script/`. Para cada uno, crea un archivo con **+ → Secuencia de comandos** (o **+ → HTML**), ponle el nombre exacto y pega su contenido:

| Tipo | Nombre en Apps Script | Archivo en GitHub |
|---|---|---|
| Secuencia de comandos | `01_Config` | `01_Config.gs` |
| Secuencia de comandos | `02_Reglas` | `02_Reglas.gs` |
| Secuencia de comandos | `03_Datos` | `03_Datos.gs` |
| Secuencia de comandos | `04_Api` | `04_Api.gs` |
| Secuencia de comandos | `05_Instalar` | `05_Instalar.gs` |
| Secuencia de comandos | `06_Cajas` | `06_Cajas.gs` |
| HTML | `Index` | `Index.html` |
| HTML | `Estilos` | `Estilos.html` |
| HTML | `App` | `App.html` |

Los HTML se llaman **sin** `.html` (Apps Script lo agrega solo). Al final, guarda con 💾.

### A3. Instalar (una sola vez)
1. En la barra de arriba elige la función **`instalar`** y presiona **Ejecutar**.
2. Google pedirá permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a Traspasos FADERMEX → Permitir**.
3. Vuelve a la hoja y recárgala. Aparece el menú **🔄 Traspasos**.

`instalar` agrega el estatus *"Entregado por gestor, falta confirmar"* y los contadores de folio de cada área. Puedes correrlo las veces que quieras: nunca borra nada.

### A4. Llenar los catálogos (en la hoja)
- **CAT_Areas → "Correo de la cuenta":** el correo con el que entra cada área.
  - PV y Rebotica de una sucursal llevan **el mismo correo**.
  - Puedes poner varios correos separados por coma.
  - **Sin correo, nadie puede entrar como esa área.**
- **CAT_Personas:** el personal con su **código de credencial** (lo que lee la pistola), con *Tiene credencial = SI* y *Activo = SI*.
- **CAT_Gestores:** los gestores con el **mismo código de credencial** que usan en su app (hoja `APP_Usuarios` del archivo de Operaciones).
- **CAT_Administradores:** revisa que estén los 3 correos.
- Menú **🔄 Traspasos → Revisar configuración** te dice qué falta.

### A5. Publicar la página
1. En Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. **Ejecutar como:** *Yo (jaraujo@fadermex.com)*.
4. **Quién tiene acceso:** *Cualquier usuario de fadermex.com*.
5. **Implementar** y copia la **URL** (termina en `/exec`). Esa es la dirección de la página.

### A6. En cada computadora
1. Abre la URL en **Chrome**, con la cuenta de Google del área.
2. Elige el área de esa computadora (PV, Rebotica, Contabilidad…). La app la recuerda durante 12 horas.
3. Crea un acceso directo: Chrome **⋮ → Transmitir, guardar y compartir → Crear acceso directo** (marca "Abrir como ventana").
4. **Etiquetadora:** ponla como **impresora predeterminada** y elige el tamaño de etiqueta en su configuración. Para que imprima **sin preguntar**, al acceso directo de Chrome agrégale al final `--kiosk-printing` (clic derecho al ícono → Propiedades → Destino).
5. **Tamaño de etiqueta por área:** en la hoja **CAT_Impresoras** (la crea `instalar`) pon, en la fila de cada área, la marca y modelo de su impresora y el **ancho** y **alto** de su etiqueta en milímetros. Si una fila queda vacía, esa área usa el tamaño general de **CFG_Ajustes** (`etiqueta_ancho_mm`, `etiqueta_alto_mm`). Las etiquetas chicas (menos de 50 mm de alto) salen en versión compacta: destino, folio, código y bulto.

### Logo
En **CFG_Ajustes → logo_empresa** pega el link de Drive del logo, tal cual (por ejemplo `https://drive.google.com/file/d/…/view`). La app lo convierte sola en imagen. Después corre **🔄 Traspasos → Instalar / reparar** una vez: la primera vez pide permiso para leer Drive.

### Cuando cambies el código
Si algún día cambias un archivo, ve a **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así la URL **no cambia**.

---

## B. Conexión con la app de gestores

En el proyecto de Apps Script de la app de gestores (el que tiene `00_CONFIG.gs`, `02_BACKEND.gs`…):

### B1. Agregar el archivo nuevo
**+ → Secuencia de comandos**, con el nombre `09_TRASPASOS_NUEVOS`. Pega el contenido de `traspasos/conexion-app-gestores/09_TRASPASOS_NUEVOS.gs`.

### B2. Tres cambios en `02_BACKEND.gs`

**Cambio 1.** En `apiRecolectarTraspasos`, busca esta línea:
```js
const cat = _buscarCatalogoTraspaso(folio) || { origen: '', destino: '', area: '', contenido: '' };
```
y cámbiala por:
```js
const cat = _tnBuscar(folio) || _buscarCatalogoTraspaso(folio) || { origen: '', destino: '', area: '', contenido: '' };
```

**Cambio 2.** En la misma función, busca:
```js
      shH.getRange(shH.getLastRow() + 1, 1, hist.length, 15).setValues(hist);
```
y **justo debajo** agrega:
```js
      try { _tnRecolectados(nuevas.map(function (n) { return n[0]; }), s.gestor, s.vehiculo); } catch (e) { }
```

**Cambio 3.** En `apiCerrarTraspaso`, busca el final del `appendRow` del historial:
```js
      url, p.lat || '', p.lng || ''
    ]);
```
y **justo debajo** agrega:
```js
    try { _tnCierreGestor(p.folio, s.gestor, entregado, url, p.motivo, p.comentario); } catch (e) { }
```

### B3. Foto opcional
En la hoja **APP_Config** del archivo de Operaciones, pon **`EXIGIR_FOTO_TRASPASO` = FALSE**. También se puede desde el panel de administrador de la app.

### B4. Actualizar sin cambiar la URL ⚠️
**Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva versión → Implementar.**
**No** uses "Nueva implementación", porque cambiaría la URL y la app de los celulares dejaría de conectarse.

### Para apagar la conexión
En `09_TRASPASOS_NUEVOS.gs` cambia `ACTIVO: true` por `ACTIVO: false` y vuelve a hacer el paso B4. La app vuelve a funcionar exactamente como antes.

---

## Prueba rápida (5 minutos)
1. En una computadora de sucursal: **Nuevo traspaso** → credencial → destino → bultos → se imprimen las etiquetas.
2. El gestor escanea el folio en su app. En la página, el traspaso pasa a 🟡 **Recolectado** y al destino le llega su 🔔.
3. El gestor lo marca entregado en su app y queda *"Entregado por gestor, falta confirmar"*.
4. En el destino: **Escáner → Recibir** → escanea el folio → **Confirmar recepción** → 🟢 **Entregado**.
5. Como administrador: **Buscador** → escribe el folio → ves toda su línea de tiempo.

---

## Paquetería a Morelia: cajas y guías automáticas

1. **Armar caja** (solo Logística): **Paquetería → Armar caja** → escanea los traspasos que van dentro → **Crear caja e imprimir etiqueta**. Sale un folio `CJ-0001` con su etiqueta, que lleva la lista de traspasos. Las etiquetas de cada traspaso se quedan en sus bultos, dentro de la caja.
2. **Registrar el envío** en tu hoja **Operaciones**, como siempre, poniendo `CJ-0001` en **"ID Pedido / Tarea"**. Si mandas un traspaso suelto, pon su folio (por ejemplo `NR-0003`).
3. **Automático:** cada 10 minutos el sistema revisa Operaciones. Cuando esa fila ya tiene **Nº de Guía**, los traspasos pasan solos a **Enviado por paquetería**, con proveedor (columna "Proveedor"), guía y fecha prometida (ETA). Morelia recibe su aviso. Para no esperar, usa el botón **"Revisar Operaciones ahora"**.
4. **Morelia** escanea la etiqueta de la caja **una sola vez** y se reciben todos los traspasos que trae.

¿Armaste mal una caja? Usa **"Deshacer caja"**, siempre que todavía no tenga guía.

Lo que va de Morelia hacia acá lo sigue capturando Morelia en su pestaña Paquetería (paquetería y guía).
