# Prompt para el portal de rastreo BOTICAN · "Gestor entregó a sucursal"

Copia todo lo de abajo (desde "Contexto") y pégalo en una sesión nueva con el repositorio
**Logisitica-Araujo/BOTICAN-portal-rastreo**.

---

**Contexto.** Trabajamos SOLO en el repositorio `BOTICAN-portal-rastreo` (Apps Script del portal de rastreo BOTICAN: `Code.gs`, `Config.gs`, `Index.html`, `Recorrido.gs`, `Plazos.gs`, `Tablero.gs`…). No toques ningún otro repositorio. Responde en español. Antes de programar, muéstrame una **vista previa** de cada pantalla que cambie y espera mi visto bueno. Desarrolla en una rama, sin crear PR. Nunca pongas modelos de IA en los commits.

**Qué cambió en la hoja (ya está hecho, no lo modifiques).** En "LOGISTICA BOTICAN 2026" → pestaña **Envios**, renglón 2 de títulos, se agregaron **6 columnas al final**. Las llena el robot de la **App de Gestores**; el portal solo las LEE:

| Col | Nº | Título exacto (renglón 2) | Contenido |
|---|---|---|---|
| AD | 30 | App · Recolectó (fecha y hora) | Fecha y hora en que el gestor escaneó (recolectó) el pedido, texto `dd/MM/yyyy HH:mm:ss` |
| AE | 31 | App · Recolectó (gestor) | Nombre del gestor |
| AF | 32 | App · Entregó en sucursal (fecha y hora) | Fecha y hora en que el gestor DEJÓ el pedido en la sucursal, `dd/MM/yyyy HH:mm:ss` |
| AG | 33 | App · Sucursal (recibió) | `Roma` o `Roma · recibió Lalo` |
| AH | 34 | App · Gestor que entregó en sucursal | Nombre del gestor |
| AI | 35 | App · Foto entrega en sucursal | Enlace de Google Drive a la foto |

AF–AI solo se llenan en pedidos cuya Dirección (E) es "Sucursal …" (el cliente pasa a recoger).

**Estatus (columna A).** Ahora existe un estatus nuevo: **`🏪 GESTOR ENTREGÓ A SUCURSAL`**. Sale cuando AF tiene fecha y la sucursal todavía no confirma la llegada (Q vacía). Cuando la sucursal confirma (Q con fecha), cambia sola a `🏢 Disponible en sucursal`, como antes. Orden de prioridad de la fórmula: ENTREGADO › CANCELADO › RETORNADO › Disponible en sucursal (Q) › EXISTE UN PROBLEMA (R) › **GESTOR ENTREGÓ A SUCURSAL (AF)** › En ruta… (K) › Recibido en logística (H) › Recolección de gestor (AB o AD) › Botican entregó a gestoría (AC) › Elaborado › En elaboración.

**Lo que hay que hacer en el portal:**
1. `Config.gs` → `COL`: agrega `APP_REC_FECHA: 30, APP_REC_GESTOR: 31, APP_SUC_FECHA: 32, APP_SUC_DONDE: 33, APP_SUC_GESTOR: 34, APP_SUC_FOTO: 35`. Mejor: búscalas por su **título** del renglón 2, para que no se rompa si alguien mueve columnas. Asegúrate de que la lectura de Envios (`leerEnvios_`) lea hasta la columna AI (35).
2. `Code.gs` → `resumen_()`:
   - Agrega `p.entregaSucursal = { ms, sucursal, recibio, gestor, foto }` leyendo AF–AI. AF viene como texto `dd/MM/yyyy HH:mm:ss` o como fecha; conviértelo a ms.
   - Si no hay recolección de la app de gestores (`ctx.recs`) ni H, usa AD/AE como recolección (`fuenteRecoleccion: 'App de gestores'`).
   - **Plazo de Logística:** el plazo se cumple cuando el gestor deja el pedido en la sucursal. `finLogistica = salida || entregaSucursal.ms || llegadaSucursal`. Con eso `cumplePlazo` y el semáforo dejan de correr al entregarlo en sucursal.
   - `enSucursal` sigue dependiendo de Q / "Disponible en sucursal". Agrega `p.entregadoEnSucursal = !!AF && !enSucursal`.
3. `Index.html` → detalle del pedido (los `pasos`, alrededor de la línea 838): para pedidos de sucursal, el paso 4 queda:
   - si `p.enSucursal` → "Disponible en sucursal" (como hoy);
   - si no, pero hay `p.entregaSucursal` → **"Entregado en sucursal <nombre>"** con fecha y hora, gestor, "recibió …" y un enlace **"ver foto"**. **La foto solo para personal interno:** no se muestra si `esVendedor()` ni en la página del cliente;
   - si no → "Enviado a sucursal" (como hoy).
4. `Index.html` → **Recorrido completo** (`pintarRecorrido`, alrededor de la línea 1205): agrega el evento "Entregado en sucursal <nombre>" con el gestor, quién recibió y la foto (solo interno), en su lugar cronológico entre "Recolectado por gestor" y "Disponible en sucursal".
5. **Panel, filtros e indicadores:** el estatus nuevo cuenta como **activo** (no entregado). Que aparezca bien en el filtro "En sucursal" y en los indicadores donde hoy se cuentan "Disponible en sucursal" / "Recolección de gestor". Revisa `Tablero.gs`, `esActivo_`/`esActivo` y cualquier regex que compare textos de estatus.
6. **WhatsApp al cliente** (alrededor de la línea 961): si el estatus es "GESTOR ENTREGÓ A SUCURSAL", el mensaje dice que su pedido **ya fue entregado en la sucursal <nombre>** y que en breve estará disponible para recoger.
7. **Manual del portal** (sección de estatus / recorrido en `Index.html`): agrega el estatus nuevo y qué significa.
8. Pruebas: con un pedido de prueba con E = "Sucursal Roma", AF con fecha y Q vacía, el detalle, el recorrido, el panel y el WhatsApp muestran lo de arriba. Con Q llena, todo vuelve a "Disponible en sucursal".

**Al terminar:** dime qué archivos cambiaron, qué probaste y los pasos para publicarlo: pegar los archivos en el Apps Script del portal y hacer la versión nueva de su implementación.
