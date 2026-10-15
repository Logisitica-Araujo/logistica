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
| Secuencia de comandos | `07_Recepcion` | `07_Recepcion.gs` |
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
5. **Tamaño de etiqueta:** todas las sucursales usan el mismo rollo de **50 × 20 mm** (5 cm × 2 cm), que ya es el tamaño general en **CFG_Ajustes** (`etiqueta_ancho_mm` = 50, `etiqueta_alto_mm` = 20). Con ese tamaño la etiqueta sale en **formato mini**: folio, bulto, código de barras y destino. **CAT_Impresoras** solo se llena si algún área llega a usar un rollo distinto. En el driver de cada etiquetadora (por ejemplo Argox OS-2140), crea un tamaño de página de **50 × 20 mm** con tipo **"Etiquetas con separación"**.

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
2. **Registrar el envío** en tu hoja **Operaciones**:
   - **Columna A:** `CJ-0001`. Si mandas un traspaso suelto, su folio (por ejemplo `LOG-0005`). Puedes poner varios en la misma celda, separados por coma.
   - **Columna K:** la paquetería.
   - **Columna M:** el número de guía.
3. **Automático:** en cuanto escribes en A, K o M, los traspasos pasan solos a **Enviado por paquetería**, con paquetería, guía y fecha prometida (ETA). Morelia recibe su aviso.
   - Además, cada 10 minutos se revisa todo, por si algo se escapó.
   - Si quieres forzarlo, usa **"Revisar Operaciones ahora"**: te dice qué folios **no** pudo actualizar y por qué.
   - Funciona aunque el traspaso siga en **"Nuevo"**, por ejemplo si lo creaste tú en Logística y no pasó por otra área. Sólo se necesita la guía.
   - ¿Tus columnas son otras? Cámbialas en **CFG_Ajustes**: `ops_columna_folio`, `ops_columna_paqueteria` y `ops_columna_guia` (letra de la columna).
4. **Morelia** escanea la etiqueta de la caja **una sola vez** y se reciben todos los traspasos que trae.

¿Armaste mal una caja? Usa **"Deshacer caja"**, siempre que todavía no tenga guía.

Lo que va de Morelia hacia acá lo sigue capturando Morelia en su pestaña Paquetería (paquetería y guía).

---

## Recepción Oficinas (computadora del patio)

1. Corre **`instalar`**. Agrega el área **REC (Recepción Oficinas)** con tu correo, el estatus **"En Recepción Oficinas"** y las columnas **Usuario**, **NIP** y **PIN de entrada**.
2. **Protege tu cuenta en esa computadora** (está abierta con jaraujo):
   - **CAT_Areas → "PIN de entrada"** de **LOG**: pon un PIN. Así, en la computadora del patio solo se puede entrar libre a Recepción; Logística pide PIN.
   - **CFG_Ajustes → pin_administrador**: pon un PIN para el Modo administrador.
   - Ponla en **modo kiosco** paso a paso con **[MODO_KIOSCO.md](MODO_KIOSCO.md)**: usuario de Windows aparte, Chrome bloqueado para que solo abra Traspasos (`recepcion_kiosco_chrome.reg`) y pantalla completa al arrancar. En Recepción ya no aparece "Salir". Para cambiar el área, abre la URL con `?cambiar=1`.
3. En esa computadora entra como **Recepción Oficinas**. La sesión no se cierra sola si `sesion_horas_sucursal` = 0.

**Cómo se usa:**
Recepción es un **centro de pausa**: los traspasos esperan ahí, pero nunca es su destino final. No se puede elegir como destino al crear un traspaso.

- **📥 Dejar:** **cualquier persona registrada** (gestor o empleado) se identifica, escanea los traspasos y confirma. Quedan **En Recepción Oficinas** y al destino le llega su aviso. Se aceptan aunque se haya saltado un paso, por ejemplo si nadie registró la recolección.
- **📤 Recoger:** quien recoge se identifica.
  - Si es **gestor**, puede llevarse cualquiera y queda *Recolectado por gestoría*.
  - Si es **persona de Oficinas**, solo se lleva lo de su área (según "Área (prefijo)" en CAT_Personas) y queda *Entregado*.
- **En resguardo:** lo que hay en el stand, por destino y con cuánto tiempo lleva.

## Usuario y NIP (sin credencial)

En **CAT_Personas** y **CAT_Gestores** llena **Usuario** (por ejemplo `sofia`) y **NIP** (por ejemplo `123TAB`; no importan mayúsculas o minúsculas). En cualquier lugar donde se escanea credencial está **"¿Sin credencial? Teclea usuario y NIP"**. En CAT_Personas también sirve el **No. de empleado** como usuario. Si alguien se equivoca 5 veces de NIP, ese usuario se bloquea 15 minutos.


---

## Credenciales: cuándo se piden

| Dónde | Crear traspaso | Recibir | Entregar a gestor | Reimprimir |
|---|---|---|---|---|
| **Oficinas** | No: usa la cuenta abierta | No: usa la cuenta abierta | Credencial de quien se lo lleva | **Nunca** |
| **Sucursales** (PV, Rebotica, Botican, Morelia) | Sí | **Sí**: queda quién recibió | Credencial de quien se lo lleva | **Nunca** |
| **Recepción Oficinas** | — | — | — | — |

- En Recepción Oficinas, quien deja o recoge siempre se identifica.
- **El código de la credencial nunca se ve:** el campo lo muestra como ●●●●. Después de escanearla, en pantalla sólo aparece el **nombre**. El código se guarda únicamente en la hoja, para auditoría.
- **Cualquier persona registrada** en CAT_Personas **o** en CAT_Gestores se puede identificar.
  - Si alguien está en las dos hojas (por ejemplo Juan Antonio), cuenta como **gestor**.
  - Un gestor puede recoger cualquier traspaso. Una persona sólo lo de su área.
- **Opcional:** en Oficinas, si agregas una columna **"Correo"** en CAT_Personas, el traspaso queda a nombre de esa persona en lugar del correo de la cuenta.

## El escáner ya no necesita Enter

La pistola "teclea" muy rápido. La página lo detecta y, al terminar la lectura, agrega el folio o identifica la credencial sola. Si la pistola además manda Enter, no se duplica. Si alguien teclea a mano un folio completo que existe, también se agrega solo al dejar de escribir.

## Si un paso se saltó

Si el paquete llega al destino pero nadie registró la recolección o la salida, **sí se puede recibir**. Sale en amarillo: *"nadie registró la recolección; queda anotado"*. Queda escrito en la línea de tiempo.

## Impresoras por área o sucursal (CAT_Impresoras)

Una fila por área (`NR`), por sucursal (`Nueva Roma`: aplica a PV y Rebotica) o `TODAS`.

| Columna | Qué poner |
|---|---|
| **Ancho / Alto (mm)** | Obligatorios. Ej. Argox de PV Roma: **50 × 20**. |
| **Margen superior / izquierdo (mm)** | Opcional. Para mover la impresión si sale corrida (ej. `1.5`). |
| **Orientación** | `Horizontal` (normal) o `Vertical` (gira la etiqueta 90°). |
| **Formato** | `AUTO` (por tamaño), `MINI`, `CHICA` o `COMPLETA`. |

Si un área no tiene fila con medidas, usa `etiqueta_ancho_mm` / `etiqueta_alto_mm` de CFG_Ajustes. Al correr **instalar**, el mensaje final dice qué áreas quedaron configuradas.

**Hojas en blanco al imprimir:** ya se corrigió. Ahora sale exactamente una hoja por etiqueta. Si aún salen hojas de más, revisa en el driver de la impresora que el tamaño de papel sea el mismo que en CAT_Impresoras y que esté en *"Etiquetas con separación"*.

## Cómo actualizar a esta versión

1. En Apps Script, reemplaza el contenido de: `02_Reglas.gs`, `03_Datos.gs`, `04_Api.gs`, `05_Instalar.gs`, `06_Cajas.gs`, `07_Recepcion.gs`, `App.html` y `Estilos.html`.
2. Guarda y corre **`instalar`** una vez. Te pedirá permiso nuevo, porque ahora "escucha" cuando editas Operaciones: acéptalo.
   - Crea el activador **al editar Operaciones**.
   - Agrega a CFG_Ajustes las columnas de Operaciones (A, K, M).
   - Agrega las columnas opcionales de CAT_Impresoras.
   - Revisa Operaciones de inmediato: tus traspasos de Morelia que ya tienen guía cambian en ese momento.
3. **Implementar → Administrar implementaciones → ✏️ → Nueva versión** (la URL no cambia).
4. En cada computadora, recarga la página (F5).

## 🖨 Centro de Impresión (Recepción Oficinas)

La etiquetadora está conectada solo a la computadora de Recepción. Por eso Recepción tiene la pestaña dorada **🖨 Centro de Impresión**.

1. Elige el **área de Oficinas** en el desplegable. Entre paréntesis sale cuántos traspasos tiene por imprimir.
2. Aparecen **solo** sus traspasos en **Nuevo traspaso**: creados, pero todavía sin recoger. En cuanto un gestor los recoge, salen de la lista.
3. **🖨 Imprimir etiqueta** imprime las etiquetas de ese folio, una por bulto. **Imprimir todas** imprime las de toda el área en un solo envío.
4. Lo ya impreso aquí queda marcado *"ya impreso aquí"* y el botón cambia a **Imprimir otra vez**.

Imprimir no cambia el estatus. Cada impresión queda en RES_Etiquetas (Impresión = RECEPCIÓN) y en la línea de tiempo del traspaso. La etiqueta sale con el tamaño de la fila **REC** de CAT_Impresoras.
