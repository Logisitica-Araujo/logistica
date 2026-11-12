# Registro de cambios · App Gestores 2

## 0.5.1 · 12-nov-2026 · Pedidos que no salían
- **Pedido recolectado y después asignado no salía** (#16165 de José Luis): la recolección en BOTICAN quedaba como cierre "LOCAL" y escondía el pedido para siempre. Ahora una RECOLECCIÓN ya no esconde el pedido de "Pedidos a domicilio" ni del resumen de Administración (`06_GESTOR`, `08_ADMIN`). Prueba nueva en `prueba-integrada.js`.
- **Gestor escrito distinto en Operaciones** ("antonio" en vez de 'Antonio "A"'): el robot lo reconoce por su NombreEnOperaciones, ese nombre sin la letra entre comillas o su Usuario (`07_ROBOT`, `11_PENDIENTES`).

## 0.5.0 · 11-nov-2026 · Reglas de Logística del 7-nov, pendientes, rutas y avisos
- **Nuevo `10_BOTICAN.gs`:** lee "LOGISTICA BOTICAN 2026" (APP_Config → `ID_BOTICAN`): Envios, Feriados y Rutas. Horarios y feriados NO están en el código.
- **Fecha compromiso** igual que el portal: G + 2 días hábiles a la misma hora (3 si G es antes del 9-nov); sin sábados, domingos ni Feriados; inhábil → desde el siguiente hábil 9:00; Coapa (lun/mié/vie) y Ecatepec (mar/jue) desde la visita 9:00 (mismo día si G antes de 13:00).
- **Semáforo** verde/amarillo/rojo/gris y texto "Vence: mié 11 nov, 10:20". Lista "Por recolectar · BOTICAN" ordenada por fecha compromiso.
- **Ruta del momento** en el inicio (pestaña Rutas; hasta 15 min después de su hora), con Coapa lun/mié/vie y Ecatepec mar/jue.
- **Duplicados:** al escanear un pedido ya recolectado por alguien → aviso con quién y cuándo ("No registrar" / "Es otro bulto"). Si no existe en Envios ni en Operaciones → aviso y número parecido. Avisos `DIS-04` y `DIS-05`. Sin señal se registra y el servidor avisa.
- **Envios columna H:** al registrar la recolección de un pedido BOTICAN, el robot escribe la hora SOLO si H está vacía y sin fórmula (`BOT_ESCRIBIR_H`).
- **APP_Recolecciones:** columna nueva **Nota** al final (A–N sin cambios).
- **Más rápido:** al abrir/actualizar la app el servidor trae lo nuevo de Operaciones (máx. cada 20 s); OPERACIONES guarda su memoria 20 s (antes 60).
- **Pendientes por recoger** (nuevo `11_PENDIENTES.gs`, pestaña nueva **APP_Apartados**): una sola lista por lugar con pedidos BOTICAN listos, pedidos FADERMEX "PENDIENTE PARA RECOLECTAR" (acción nueva `porRecolectar` de OPERACIONES) y traspasos NUEVO/EN_LOGISTICA. Lo que alguien ya lleva no sale.
- **"Lo recojo yo"** (apartar): los demás lo ven "Va Fulano · desde 10:40"; se libera solo a las `APARTADO_HORAS` (2) o al soltarlo. Apartar NO registra: eso solo al escanear. Si otro escanea algo apartado: aviso "lo apartó X" con "Ya lo traigo yo" (queda anotado y a X le aparece "Lo recogió…").
- **"¿Es este?"** al teclear un folio a mano (evita el error de dedo).
- **Rutas (aviso visual):** pestaña Rutas con columnas opcionales C Hasta (ventana), D Ruta, E Realiza, F Qué lleva (A y B no cambian). La ruta del momento es la que está pasando (hasta 15 min después de su hora o ventana) o la siguiente. Pantalla "Rutas de hoy" con el recorrido en orden, quién la realiza, si entrega en Oficinas, visitas a Coapa/Ecatepec y la nota del viernes (lo de 16:00–17:00 sale el lunes). No cambian plazos ni quién puede recoger.
- **Avisos** (nuevo `12_AVISOS.gs`, pestaña **APP_Avisos**): la administradora los manda desde Administración → Avisos (o escribiéndolos en la pestaña). Para todos, Gestoría, Facturación o una persona; con vigencia; "Importante" sale en rojo, suena y pide "Enterado". Se ve quién ya lo leyó.
- App 2.6.0 (service worker `gestores2-v12`). Pruebas: `prueba-botican.js` 91/91 (nueva), `pruebas.js` 60/60, `prueba-integrada.js` 65/65, `prueba-perfiles.js` 109/109, `prueba-celular.js` 32/32.

## 0.4.4 · 6-nov-2026 · Si usan "Registrar entrega" para un pedido suyo, se arregla solo
- **Robot (paso nuevo `ligarLibres`):** si en una "entrega sin asignar" escribieron el número de un pedido o TAREA abierto a su nombre, la pasa sola a ese pedido (foto, quién recibió, ubicación, hora real) y Operaciones queda marcado. La "sin asignar" queda ANULADA con nota. Revisa los últimos 3 días.
- **App 2.3.1:** en "+ Registrar entrega" avisa "¿Es un pedido que te asignaron? Entrégalo desde Pedidos (tienes N)" y, si escriben el número de uno de sus pedidos, ofrece "Entregarlo como pedido" con la foto y quién recibió ya puestos.
- Caso del 6-nov corregido: #16139 pasado a Operaciones.

## 0.4.3 · 5-nov-2026 · Nombre del gestor sin importar espacios
- **Robot:** reconoce al gestor aunque en Operaciones esté escrito distinto ("JoseLuis" / "Jose Luis", acentos, comillas) y manda a Operaciones el nombre tal como está en la columna I.
- **Aviso DIS-03:** si alguien registra como "entrega sin asignar" algo con número de pedido o TAREA, llega a Administración → Por revisar.
- Caso del 4–5 nov corregido a mano: #16112, #16113, #16114 y TAREA # 15247 pasados a Operaciones con su evidencia.

## 0.4.2 · 3-nov-2026 · WhatsApp en todo y traspasos que ya recibió la sucursal
- **WhatsApp** con la información (y foto, o "Agregar una foto") al terminar de **recolectar** (de dónde → a dónde, qué, quién lo lleva), al **entregar** traspasos y recolecciones, en **retorno, cancelado y no entregué** (con el motivo), en cada folio leído del escáner y en cada tarjeta de "Lo que llevo". Para todos los perfiles.
- **Robot:** si un traspaso que recolectó el gestor cambia en el Sistema de Traspasos a otro estatus (ej. EN_RECEPCION), sale de "Lo que llevo" (Estado `YA NO LO TRAE (…)`).
- **La app se actualiza sola:** busca versión nueva al abrirla y cada 30 min, y se recarga cuando no estás capturando.
- App 2.3.0 (service worker `gestores2-v8`). Pruebas: `prueba-celular.js` 32/32, `prueba-perfiles.js` 103/103.

## 0.4.1 · 3-nov-2026 · Entregas sin asignar y WhatsApp en Facturación
- **"+ Registrar entrega"** (perfil Facturación): lo que entregan sin que esté en su ruta. Qué (Medicamento, Facturas, Documentos, Efectivo con monto opcional, Insumos, Otro), dónde (IMSS unidad y área, sucursal u otro lugar), foto, quién recibió, matrícula, quién lo pidió. Folio `E-MMDD-` + iniciales + número (ej. E-1103-A1), funciona sin señal.
- Se guarda **solo en la app**: APP_Cierres con Tipo `LIBRE` y Estado `LOCAL` (no va a Operaciones). Se ve en Administración → Hoy y Buscar. Ajuste nuevo `CARPETA_LIBRES` para sus fotos (vacío = la de traspasos).
- **WhatsApp** al terminar cualquier entrega de Facturación (parada con varios, efectivo, IMSS, sin asignar), con lo capturado y la foto.
- **Vehículos:** "Sin vehículo", "A pie", etc. siempre los pueden elegir varios a la vez.
- **También para Gestoría** (app 2.2.1): "+ Registrar entrega" en su inicio, con su lista "Registrado por ti hoy". No cambia ningún script.
- App 2.2.1 (service worker `gestores2-v7`). Pruebas: `prueba-perfiles.js` 99/99.

## 0.4.0 · 3-nov-2026 · Perfiles: Gestoría, Facturación (traslados) y Administrador
- **APP_Usuarios:** columnas nuevas **Area** (Gestoría / Facturación, con lista) y **VehiculoNota**; Rol con lista (Gestor / Administrador). INSTALAR deja en Gestoría a quien no tenga área.
- **Facturación (app verde):** ruta por parada, entregar varios con una foto (`cerrarVarios`), efectivo con monto opcional y aviso si no cuadra (`CAP-09`), IMSS con área, foto del acuse (obligatoria, `EXIGIR_ACUSE_IMSS`) y matrícula, "por recoger" en cada sucursal (lo calcula el robot).
- **Administrador (app oscura):** acción `admin` con Hoy, Un gestor, Buscar, Corregir, Reasignar, Por revisar, Equipo, Vehículos y Ajustes. Nuevo `08_ADMIN.gs`. Puede cerrar a nombre de un gestor y entrar en mantenimiento.
- **Vehículos:** motivo al cambiar a medio día; columna **EnTaller** en APP_Vehiculos.
- **APP_Cierres:** columnas Monto, Clase y Corregido. Estados nuevos ANULADO y CORREGIDO.
- **Robot:** ahora pasa las recolecciones ANTES que los cierres (si alguien recoge y entrega en el mismo minuto, el traspaso ya está RECOLECTADO).
- **OPERACIONES `04_Backend_App.gs`:** acciones `reasignarGestor` (columna I) y `corregirCierre` (quita la casilla vieja, pone la nueva, el renglón viejo de APP_Entregas queda "(CORREGIDO)").
- **App 2.1.0:** `v2/perfiles.js` nuevo; service worker `gestores2-v5`.
- **Sonidos nuevos** (elegidos el 3-nov): tarea nueva = tres notas que suben · traspaso por recoger = doble marimba · escaneo correcto = doble bip · no se pudo escanear = toc-toc · entrega = ta-da · error = tres notas bajan · retorno/no entregué = dos notas iguales · volvió la señal = whoosh. Cada uno con su vibración.
- **Pruebas:** `pruebas.js` 60/60, `prueba-integrada.js` 65/65, `prueba-celular.js` 29/29, `prueba-perfiles.js` 85/85 (nuevo).

## 0.2.0 · 2-nov-2026 · Etapas 2 y 3: robot, conexión y la app del celular
- **Servidor (App Gestores · Datos):** nuevos `04_OPERACIONES.gs` (habla con la API), `05_TRASPASOS.gs` (Sistema de Traspasos), `06_GESTOR.gs` (inicio, vehículo, cerrar, recolectar, problema, documentos) y `07_ROBOT.gs` (cada minuto: pedidos, cierres, recolecciones y limpieza de lo ya entregado). Cambian `00_CONFIG`, `01_INSTALAR`, `03_API` y `09_PRUEBAS`.
- **Fotos** a las carpetas de siempre; si una carpeta no acepta (Firmas), van a "App Gestores · Respaldo fotos" y queda en APP_Problemas (`DRV-01`).
- **Efectivo, Factura, Cortes** en el contenido: exigen quién recibió y firma.
- **API de OPERACIONES** (repositorio OPERACIONES, misma rama): `04_Backend_App.gs` nuevo, rol App, el Gestor solo cierra sus pedidos, memoria de 60 s.
- **App del celular** en `v2/`: entrar una vez, vehículo y revisión, inicio con avisos y sonido, pedidos, entregar con cámara dentro de la app, firma, no entregué, paquetería, WhatsApp, escáner para recolectar y entregar, lo que llevo, manual, fila sin señal y borrador si se cierra la app.
- **Pruebas:** `pruebas.js` 45/45, `prueba-integrada.js` 61/61 (código real de OPERACIONES), `prueba-celular.js` 23/23 (navegador real).
- Puesta en marcha: [PUESTA_EN_MARCHA.md](2-MANUALES/PUESTA_EN_MARCHA.md).

## 0.1.0 · 29-oct-2026 · Etapa 1: el archivo de la app y el inicio de sesión
- **Archivos nuevos** (proyecto de Apps Script de "App Gestores · Datos"): `00_CONFIG.gs`, `01_INSTALAR.gs`, `02_SESION.gs`, `03_API.gs`, `09_PRUEBAS.gs`.
- `INSTALAR()` crea las 11 pestañas `APP_*` con sus encabezados, configuración inicial (foto obligatoria; firma y quién recibió opcionales; palabras Efectivo/Factura/Cortes exigen firma) y los 11 motivos de la app actual. Se puede correr de nuevo para reparar: nunca borra ni duplica.
- Menú **⚙ App Gestores**: Instalar / reparar, Nuevo gestor (número G-01…, contraseña temporal), Restablecer contraseña, Dar de baja, Probar etapa 1.
- Inicio de sesión con usuario y contraseña:
  - contraseñas cifradas;
  - sesión sin caducidad;
  - baja inmediata;
  - restablecer cierra las sesiones abiertas;
  - bloqueo de 15 minutos tras 5 intentos;
  - modo mantenimiento (`APP_BLOQUEADA`).
- Acciones `login`, `cambiarClave` y `yo` del contrato. Las demás responden `APP-09` hasta la etapa 2.
- Errores con los códigos de la guía (`APP-01`, `APP-02`, `APP-07`, `APP-09`, `CEL-06`, `CAP-01`).
- Pruebas: `pruebas/pruebas.js` (45/45 en el simulador). `PRUEBA_ETAPA1()` repite lo principal dentro de tu archivo.
- **No toca** Logística FED 2026, el Sistema de Traspasos ni la app actual.
