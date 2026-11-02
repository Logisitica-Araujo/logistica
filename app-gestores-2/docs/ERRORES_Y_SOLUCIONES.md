# Errores y soluciones · App Gestores 2

**Para quién:** para ti, la administradora. Es una guía para el día en que algo falle.
**Cómo se usa:** busca el **código** que muestra la app (por ejemplo `CEL-03`) con Ctrl+F. Si no hay código, empieza por **"Primeros 2 minutos"**.

> **Estado:** versión preliminar, escrita antes de construir la app. Cada etapa construida actualiza esta guía. Los códigos de error se programarán tal como están aquí para que el mensaje del celular te lleve directo a la solución.

---

## Contenido
1. [Primeros 2 minutos: ¿dónde está el problema?](#1-primeros-2-minutos-dónde-está-el-problema)
2. [El mapa: las 7 piezas y qué puede fallar en cada una](#2-el-mapa-las-7-piezas)
3. [Errores del celular (CEL)](#3-errores-del-celular-cel)
4. [Errores del archivo de la app (APP)](#4-errores-del-archivo-de-la-app-app)
5. [Errores del robot (ROB)](#5-errores-del-robot-rob)
6. [Errores de la API de OPERACIONES (API)](#6-errores-de-la-api-de-operaciones-api)
7. [Errores en la hoja Operaciones (OPS)](#7-errores-en-la-hoja-operaciones-ops)
8. [Errores del Sistema de Traspasos (TRA)](#8-errores-del-sistema-de-traspasos-tra)
9. [Errores de Drive: fotos y firmas (DRV)](#9-errores-de-drive-fotos-y-firmas-drv)
10. [Límites de Google (GOO)](#10-límites-de-google-goo)
11. [Errores de captura: los cometen personas (CAP)](#11-errores-de-captura-cap)
12. [Errores de diseño o de proceso (DIS)](#12-errores-de-diseño-o-de-proceso-dis)
13. [Errores al actualizar el código (COD)](#13-errores-al-actualizar-el-código-cod)
14. [Cómo reportarme un problema](#14-cómo-reportarme-un-problema)
15. [Revisión de rutina (5 minutos a la semana)](#15-revisión-de-rutina)

---

## 1. Primeros 2 minutos: ¿dónde está el problema?

Contesta estas preguntas en orden. La primera que diga "sí" te manda a la sección correcta.

| Pregunta | Si la respuesta es sí… |
|---|---|
| ¿La app muestra un código como `CEL-03` o `API-02`? | Búscalo en esta guía con Ctrl+F. |
| ¿Le pasa a **un solo** gestor? | Casi siempre es su **celular** o su **captura** → secciones 3 y 11. |
| ¿Le pasa a **todos** los gestores a la vez? | Es una pieza central: el archivo de la app, el robot o la API → secciones 4, 5 y 6. |
| ¿La app funciona pero **Operaciones no se actualiza**? | Es el **robot** o la **API** → secciones 5 y 6. Revisa primero la pestaña `APP_Cierres`. |
| ¿Algo **no desaparece** de la lista del gestor? | Es la regla de "quién decide si terminó" → `ROB-04`, `TRA-02`, `OPS-03`. |
| ¿Faltan **fotos o firmas** en Drive? | Sección 9. |
| ¿Empezó justo después de **pegar código nuevo**? | Sección 13: regresa a la versión anterior. |
| ¿Es de **madrugada o fin de mes** y todo se detuvo? | Límites de Google → sección 10. |

**Regla de oro:** el gestor **nunca pierde** lo que capturó. Todo queda primero en su celular y después en `APP_Cierres`. Si algo falla en medio, se reintenta solo. Antes de pedir que se vuelva a capturar algo, revisa esas dos partes.

---

## 2. El mapa: las 7 piezas

```
 [1] Celular ──► [2] Archivo de la app ◄──► [3] Robot ──► [4] API OPERACIONES ──► [5] Operaciones
                       │                     │
                       ▼                     └──────────► [6] Sistema de Traspasos
                  [7] Drive (fotos)
```

| # | Pieza | Qué hace | Si falla, se nota en… | Código |
|---|---|---|---|---|
| 1 | Celular del gestor | Muestra la lista, toma fotos, guarda todo aunque no haya señal | Un solo gestor | `CEL` |
| 2 | Archivo **App Gestores · Datos** | Recibe los cierres en 1–2 s y guarda usuarios, catálogos y bitácora | Todos los gestores | `APP` |
| 3 | Robot (cada minuto) | Trae pedidos nuevos y lleva cierres; quita lo que ya terminó | Operaciones no se actualiza; la lista no se limpia | `ROB` |
| 4 | API OPERACIONES | Única que escribe en Operaciones; valida reglas | `APP_Cierres` se queda en "ERROR" | `API` |
| 5 | Hoja Operaciones | Decide si un **pedido** terminó (columna P) | ESTATUS incorrecto | `OPS` |
| 6 | Sistema de Traspasos | Decide si un **traspaso** terminó (columna M de RES_Traspasos) | Traspasos que no desaparecen | `TRA` |
| 7 | Drive | Guarda fotos y firmas | Faltan evidencias | `DRV` |

---

## 3. Errores del celular (CEL)

### CEL-01 · La app no abre o se queda en blanco
- **Qué ves:** pantalla blanca o el logo sin avanzar.
- **Dónde recae:** el navegador del celular guardó una versión dañada.
- **Qué hago:**
  1. Cerrar la app por completo (quitarla de las apps recientes) y abrirla otra vez.
  2. Si sigue igual: Chrome → ⋮ → Configuración → Configuración de sitios → busca `logisitica-araujo.github.io` → **Borrar datos**. Ojo: borra lo que no se haya subido. Antes revisa que el aviso diga "Al día".
  3. Volver a entrar con usuario y contraseña.
- **Arreglo de fondo:** si pasa en varios celulares después de una actualización, es `COD-02`.

### CEL-02 · "Sin señal · todo se guarda en tu celular"
- **No es un error.** La app sigue funcionando y sube todo cuando regresa la señal.
- **Qué hago:** nada. Si después de 30 minutos con buena señal sigue diciendo "por subir", ve a `CEL-05`.

### CEL-03 · No abre la cámara
- **Qué ves:** "No pude abrir la cámara" o la pantalla de cámara en negro.
- **Dónde recae:** permiso de cámara negado, u otra app (WhatsApp, cámara normal) la tiene ocupada.
- **Qué hago:**
  1. Cerrar las otras apps que usan cámara.
  2. Chrome → ⋮ → Configuración → Configuración de sitios → Cámara → permitir para la app.
  3. Mientras tanto: botón **"Usar la cámara del celular o la galería"**.
- **Arreglo de fondo:** si pasa en un modelo de celular específico, avísame el modelo (`CEL-09`).

### CEL-04 · "Memoria insuficiente" o la app se cierra sola
- **Dónde recae:** el celular tiene poca memoria y Android cierra apps en segundo plano. **No lo controla la app.**
- **Qué hago:**
  1. Volver a abrir la app: regresa a la misma pantalla con lo capturado (foto, firma, quién recibió).
  2. Cerrar apps que no use (juegos, redes sociales).
  3. Si pasa varias veces al día: reiniciar el celular al empezar la jornada.
- **Arreglo de fondo:** si un celular lo sufre todos los días, conviene cambiarlo o liberar espacio (debe tener al menos 1 GB libre).

### CEL-05 · Se queda "X por subir" aunque hay señal
- **Dónde recae:** el archivo de la app no contestó (`APP-01`) o la sesión está cerrada (`CEL-06`).
- **Qué hago:**
  1. Abrir la app y tocar el aviso "por subir" → **Subir ahora**.
  2. Si dice un código, sigue ese código.
  3. **No borrar los datos del sitio** mientras haya algo por subir.
- **Arreglo de fondo:** revisa la pestaña `APP_Log` buscando el nombre del gestor.

### CEL-06 · Pide usuario y contraseña otra vez
- **Dónde recae:**
  - Lo diste de baja o cambiaste su contraseña en `APP_Usuarios`, o
  - borró los datos del navegador, o
  - instaló la app en otro navegador.
- **Qué hago:** volver a entrar. Si no recuerda la contraseña: `CAP-01`.
- **Arreglo de fondo:** la sesión **no caduca sola**. Si le pasa seguido a alguien que no hizo nada de lo anterior, avísame: es un error de código.

### CEL-07 · No suena ni vibra cuando llega una tarea
- **Dónde recae:**
  - Notificaciones bloqueadas, o
  - modo "No molestar", o
  - ahorro de batería que duerme la app, o
  - un iPhone sin la app instalada en la pantalla de inicio.
- **Qué hago:**
  1. Ajustes → Apps → Chrome → Notificaciones → permitir.
  2. Ajustes → Batería → Chrome (o la app) → **Sin restricciones**.
  3. iPhone: abrir en Safari → Compartir → **Agregar a pantalla de inicio**, y entrar desde ese ícono.
- **Arreglo de fondo:** si el aviso llega pero sin sonido, revisa el volumen de notificaciones del celular.

### CEL-08 · El escáner no lee un código
- **Dónde recae:**
  - Etiqueta arrugada, borrosa, con reflejo o muy pequeña, o
  - poca luz, o
  - un tipo de código no reconocido.
- **Qué hago:**
  1. Alinear el código con la **línea roja**, a 15–20 cm.
  2. Prender la **luz**.
  3. **"No lo lee: tomar foto del código"**.
  4. Último recurso: **Teclear**, revisando dos veces el folio.
- **Arreglo de fondo:** si un tipo de etiqueta nunca se lee, mándame una foto de la etiqueta para revisar su formato.

### CEL-09 · Se ve mal en un celular (botones cortados, letras encimadas)
- **Dónde recae:** el diseño en ese tamaño de pantalla o en ese navegador.
- **Qué hago:** tomar captura de pantalla y anotar el modelo de celular.
- **Arreglo de fondo:** lo corrijo en el diseño (`DIS-05`).

### CEL-10 · Hora o GPS equivocados en el cierre
- **Dónde recae:** el celular tiene la hora manual o el GPS apagado.
- **Qué hago:**
  - Ajustes → Fecha y hora → **Automática**.
  - GPS encendido en "Alta precisión".
- **Arreglo de fondo:** la app guarda también la hora del servidor. Si las dos difieren más de 10 minutos, se marca en `APP_Problemas`.

---

## 4. Errores del archivo de la app (APP)

### APP-01 · "El servidor de la app no contestó"
- **Le pasa a:** todos.
- **Dónde recae:** el Apps Script del archivo **App Gestores · Datos**.
- **Cómo confirmo:** abro la dirección de la app con `?ping=1` al final. Debe responder `{"ok":true}`.
- **Qué hago:**
  1. Esperar 5 minutos: Google a veces tiene caídas cortas. Los celulares guardan todo mientras tanto.
  2. Si sigue: Apps Script → **Ejecuciones** y busca errores en rojo.
  3. Si empezó después de pegar código: `COD-01`.
- **Arreglo de fondo:** si es una caída de Google, no hay nada que arreglar. Si es un error del código, mándame la captura de la ejecución en rojo.

### APP-02 · "Usuario o contraseña incorrectos" para alguien que sí la escribe bien
- **Dónde recae:** `APP_Usuarios`. El usuario está inactivo, tiene espacios de más, o la contraseña se cambió.
- **Qué hago:** Administración → Usuarios → revisar que esté **Activo** → **Restablecer contraseña**.
- **Nota:** tras 5 intentos fallidos la cuenta se bloquea 15 minutos (protección contra robo). Hay que esperar o restablecer.

### APP-03 · "No tienes permiso" (código PERMISO)
- **Dónde recae:** el rol del usuario en `APP_Usuarios` no permite esa acción.
- **Qué hago:** revisar su rol. Un gestor solo cierra **sus** pedidos.

### APP-04 · Un cierre aparece dos veces en `APP_Cierres`
- **Dónde recae:** el gestor tocó "Finalizar" dos veces con mala señal.
- **Qué hago:** nada. Cada cierre lleva un número único y el robot manda **solo uno** a Operaciones; el repetido se marca `DUPLICADO`.
- **Arreglo de fondo:** si llegan a Operaciones dos cierres del mismo pedido, es un error de código: avísame con el ID.

### APP-05 · El archivo App Gestores · Datos se pone lento
- **Dónde recae:** `APP_Log` o `APP_Cierres` crecieron mucho (más de 50,000 renglones).
- **Qué hago:** menú ⚙ **App Gestores → Archivar historial**. Mueve lo de más de 90 días a un archivo "Histórico".
- **Prevención:** revisión mensual (sección 15).

### APP-06 · Alguien editó a mano una pestaña `APP_*` y algo dejó de funcionar
- **Dónde recae:** columnas movidas, encabezados cambiados o renglones borrados.
- **Qué hago:** Archivo → **Historial de versiones** → regresar a la versión anterior al cambio.
- **Prevención:**
  - Solo se editan a mano `APP_Usuarios`, `APP_Vehiculos`, `APP_Motivos`, `APP_Config` y `APP_Documentos`, y solo en sus columnas.
  - Las demás están protegidas.

---

## 5. Errores del robot (ROB)

### ROB-01 · Pedidos nuevos no le llegan a los gestores
- **Le pasa a:** todos. Operaciones tiene el pedido, pero la app no.
- **Dónde recae:** el robot no corre, o la API no le contesta.
- **Cómo confirmo:** pestaña `APP_Config` → celda **"Última vuelta del robot"**. Si tiene más de 5 minutos, el robot está detenido.
- **Qué hago:**
  1. Apps Script → **Activadores**: debe existir `robot` cada 1 minuto.
  2. Si no está: menú ⚙ **App Gestores → Instalar robot**.
  3. Si está pero falla: **Ejecuciones** → abre la última en rojo y mándame la captura.
- **Ojo:** fuera del horario (`ROBOT_HORARIO`, por defecto de 6 a 22) el robot **no corre a propósito**.

### ROB-02 · Pedido asignado a un gestor que no lo ve
- **Dónde recae:** el nombre en la columna I de Operaciones **no coincide** con el de `APP_Usuarios` (columna "Nombre en Operaciones").
- **Ejemplo real:** "Jose Luis" contra "José Luis Sánchez".
- **Qué hago:** corregir el nombre en `APP_Usuarios` para que sea idéntico al de la lista de gestores de "Datos" (columna A).
- **Prevención:** el robot anota en `APP_Problemas` cada nombre de gestor que no reconoce.

### ROB-03 · Cierres atorados en `APP_Cierres` como PENDIENTE
- **Dónde recae:** el robot no los ha podido mandar a la API.
- **Qué hago:**
  1. Ver la columna **"Último error"** de ese renglón: dice el código (`API-xx`).
  2. Seguir ese código.
  3. Cuando se arregle, el robot los manda solo. **No hay que volver a capturar.**

### ROB-04 · Algo que ya se entregó sigue en la lista del gestor
- **Dónde recae:** el lugar que "decide si terminó" todavía no lo dice:
  - **Pedido:** la columna P de Operaciones no dice ENTREGADO, CANCELADO ni RETORNADO.
  - **Traspaso:** la columna M de RES_Traspasos no dice ENTREGADO ni ELIMINADO.
  - **Remisión vieja** (VREM-, NRREM-…): no tiene sistema que la cierre (`DIS-02`).
- **Qué hago:** buscar el folio en su hoja y corregir **ahí**. En el siguiente minuto desaparece solo.
- **Nunca:** borrar el renglón en `APP_Recolecciones` a mano.

### ROB-05 · Algo desapareció de la lista y no se había entregado
- **Dónde recae:** alguien marcó la casilla de entregado en Operaciones o dio entrada en el Sistema de Traspasos por error.
- **Qué hago:**
  1. Corregir la casilla o el estatus en su hoja.
  2. El robot lo regresa al gestor en el siguiente minuto.
- **Para pedidos retornados:** usar **"Reenviar este pedido"** en la página OPERACIONES (`OPS-04`).

### ROB-06 · "Tiempo de ejecución excedido"
- **Dónde recae:** una vuelta del robot tardó más de 6 minutos. Normalmente es porque el archivo madre está lento.
- **Qué hago:** nada de inmediato; la siguiente vuelta sigue donde se quedó. Si pasa más de 3 veces en un día: `GOO-01`.

---

## 6. Errores de la API de OPERACIONES (API)

### API-01 · "Tu sesión venció" (SESION) en el robot
- **Dónde recae:** el usuario de servicio de la app en `OPS_Usuarios` (Logística FED 2026) está inactivo o su token caducó (30 días).
- **Qué hago:**
  1. Revisar que el usuario **"App Gestores"** esté activo en `OPS_Usuarios`.
  2. El robot pide un token nuevo solo. Si no puede, corre ⚙ **App Gestores → Reconectar con OPERACIONES**.

### API-02 · "Tu rol no puede hacer esto" (PERMISO)
- **Dónde recae:** el usuario de servicio no tiene el rol **App**, o un gestor intenta cerrar un pedido que no está a su nombre.
- **Qué hago:**
  - Revisar el rol en `OPS_Usuarios`.
  - Si el pedido estaba asignado a otro gestor: corregir la columna I en Operaciones.

### API-03 · "La fila ya no corresponde a #xxxx" (FILA)
- **Dónde recae:** alguien insertó o borró renglones en Operaciones y el pedido cambió de lugar.
- **Qué hago:** nada. El robot vuelve a buscar el pedido por su ID y reintenta solo.
- **Prevención:** en Operaciones **no se borran ni se insertan renglones en medio**; solo se agregan al final.

### API-04 · "El sistema está ocupado" (OCUPADO)
- **Dónde recae:** varias personas escribiendo en Operaciones al mismo tiempo; el candado esperó 20 s.
- **Qué hago:** nada; el robot reintenta. Si dura más de 30 minutos, revisa que nadie tenga una macro trabada en el archivo madre.

### API-05 · "El valor no está en la lista de Datos" (LISTA)
- **Dónde recae:** un motivo, gestor o vehículo de la app no existe en las listas de la hoja "Datos".
- **Qué hago:** dar de alta el valor en "Datos" (desde Administración de la página OPERACIONES) o corregirlo en `APP_Motivos`.
- **Prevención:** `APP_Motivos` debe tener exactamente los mismos textos que la lista de "Datos".

### API-06 · "Escribe el motivo antes de marcar" (MOTIVO)
- **Dónde recae:** un retorno o una cancelación llegó sin motivo, lo que no debería pasar porque la app lo exige.
- **Qué hago:** completar el motivo en la columna AC de Operaciones. Avísame: es un error de código.

### API-07 · La API contesta una página de Google en vez de datos
- **Dónde recae:**
  - La implementación de OPERACIONES · Backend no está con acceso "Cualquier persona", o
  - se publicó una versión nueva sin el código completo.
- **Qué hago:** revisar Implementar → Gestionar implementaciones (lo hacen tus superiores si tu cuenta no puede elegir "Cualquier persona").

---

## 7. Errores en la hoja Operaciones (OPS)

### OPS-01 · ESTATUS (columna P) dice algo raro o está vacío
- **Dónde recae:** la fórmula de la columna P depende de V, T, R, Q y de `APP_Traspasos_Hist`. Si alguien la borró o la pegó encima, se rompe.
- **Qué hago:** Historial de versiones del archivo → recuperar la fórmula. **No** escribir el estatus a mano.

### OPS-02 · La fecha de entrega (V) no aparece
- **Dónde recae:** la columna V tiene una fórmula que lee `APP_Entregas`. Si la API no anotó el cierre ahí, V se queda vacía.
- **Qué hago:** revisar en `APP_Cierres` que el cierre diga ENVIADO. Si dice ENVIADO pero V está vacía, avísame con el ID.

### OPS-03 · Pedido con ID duplicado ("⚠ Duplicado" en la columna Y)
- **Dónde recae:** captura en la oficina. El mismo pedido se capturó dos veces.
- **Qué hago:** dejar un solo renglón. Mientras haya dos, el robot usa **el más reciente** y lo anota en `APP_Problemas`.

### OPS-04 · Un pedido RETORNADO hay que mandarlo otra vez
- **No es un error:** se usa **"🔁 Reenviar este pedido"** en la página OPERACIONES.
- **Nunca:** capturar un renglón nuevo con el mismo ID (crea un duplicado, `OPS-03`).

### OPS-05 · Variantes del mismo ID (`#D15979` contra `#15979`)
- **Dónde recae:** captura. `#D` es una cotización que se convirtió en pedido.
- **Qué hago:** usar **"Cambiar ID"** en la página OPERACIONES para dejar el ID real.

---

## 8. Errores del Sistema de Traspasos (TRA)

### TRA-01 · "Ese folio no existe en el Sistema de Traspasos"
- **Dónde recae:**
  - Lo tecleó mal (`CAP-03`), o
  - es una remisión del sistema viejo, o
  - el traspaso todavía no se crea.
- **Qué hago:** la app pide **origen y destino** a mano y lo guarda como "Otro". Queda para revisar en `APP_Problemas`.

### TRA-02 · Traspaso entregado que no desaparece
- **Dónde recae:** la sucursal destino **no le dio entrada** en el Sistema de Traspasos.
- **Qué hago:** pedir a la sucursal que le dé entrada. En el siguiente minuto se quita solo.
- **Si el gestor sí lo entregó:** que toque **Entregar** en su app con foto; queda la evidencia aunque la sucursal no haya dado entrada.

### TRA-03 · El rastreo no dice "Recolectado por gestoría"
- **Dónde recae:** el robot no pudo escribir en `RES_Traspasos`. Puede ser un permiso del archivo de Traspasos o que el robot esté detenido (`ROB-01`).
- **Qué hago:** revisar que tu cuenta siga siendo **editora** de `Traspasos_FADERMEX_BD`.

### TRA-04 · Cambiaron columnas en RES_Traspasos
- **Dónde recae:** el robot busca las columnas por su **nombre** ("Folio", "Estatus", "Gestor"…). Si les cambian el nombre, deja de encontrarlas.
- **Qué hago:** regresar el nombre del encabezado como estaba. El robot anota en `APP_Log` "Falta columna X".

---

## 9. Errores de Drive: fotos y firmas (DRV)

### DRV-01 · "Acceso denegado" al guardar fotos o firmas
- **Dónde recae:** la cuenta que corre el código no es **Editor** de la carpeta.
- **Caso real:** la carpeta **Firmas** (`153U2PjEDCaNvkIxoIfuz2nYLGrEixM7q`).
- **Qué hago:** pedir al dueño de la carpeta que te comparta como **Editor**.
- **Mientras tanto:** la app guarda la foto en una carpeta de respaldo y la anota en `APP_Problemas`. No se pierde.

### DRV-02 · La foto no aparece en Drive pero el cierre sí llegó
- **Dónde recae:** la foto se sube **después** del cierre para no hacer esperar al gestor.
- **Qué hago:** esperar 5 minutos. Si no aparece, revisar `APP_Cierres` → columna "Foto".

### DRV-03 · Se llenó el espacio de Drive
- **Dónde recae:** la cuenta dueña de las carpetas se quedó sin espacio.
- **Qué hago:** liberar espacio o mover fotos de más de un año a una cuenta de archivo.
- **Prevención:** las fotos se guardan a 1280 px y comprimidas (unos 150 KB cada una); 10,000 fotos ocupan alrededor de 1.5 GB.

---

## 10. Límites de Google (GOO)

Google pone límites diarios a Apps Script. La app está calculada para quedar lejos de ellos, pero esto es lo que pasa si se alcanzan.

### GOO-01 · "Service invoked too many times" o "tiempo total de activadores excedido"
- **Dónde recae:** el límite diario de tiempo de los activadores. En cuentas de empresa es de unas 6 horas al día; un robot de 10 s cada minuto, de 6 a 22, usa cerca de 2.7 horas.
- **Qué hago:**
  1. Subir el intervalo del robot a 2 minutos en `APP_Config` (`ROBOT_CADA_MIN`).
  2. Revisar que no haya **dos robots** instalados (Activadores).
- **Se reinicia solo** al día siguiente.

### GOO-02 · "Too many simultaneous invocations"
- **Dónde recae:** más de 30 consultas al mismo tiempo, por ejemplo todos los gestores abriendo la app a las 8:00.
- **Qué hago:** nada; los celulares reintentan solos en segundos.

### GOO-03 · Caída general de Google
- **Cómo confirmo:** [Google Workspace Status Dashboard](https://www.google.com/appsstatus).
- **Qué hago:** esperar. Los celulares guardan todo.

---

## 11. Errores de captura (CAP)

Errores que cometen personas. No son fallas del sistema, pero el sistema ayuda a detectarlos.

### CAP-01 · El gestor olvidó su contraseña
- **Qué hago:** Administración → Usuarios → **Restablecer contraseña**. Se la das en persona o por mensaje privado, **nunca** en un grupo.

### CAP-02 · Cerró el pedido equivocado
- **Qué hago:**
  1. En la página OPERACIONES (rol Administrador o Editor), quitar la casilla de entregado del pedido equivocado. El robot se lo regresa al gestor.
  2. El gestor cierra el pedido correcto.
- **Evidencia:** la foto quedó con el ID equivocado. Renómbrala en Drive.
- **Prevención:** la pantalla de entregar muestra el **ID y el cliente en grande** antes de Finalizar.

### CAP-03 · Tecleó mal un folio
- **Qué ves:** `TRA-01` o un "pedido no encontrado".
- **Qué hago:** el gestor lo borra de su lista de leídos y lo vuelve a escanear.
- **Prevención:** usar el escáner; teclear solo como último recurso.

### CAP-04 · Foto equivocada o sin evidencia útil (borrosa, de otra casa)
- **Qué hago:** desde Administración → Cierres → **Pedir otra foto**. Al gestor le aparece el aviso.
- **Prevención:** el manual del gestor explica qué debe salir en la foto.

### CAP-05 · Eligió el motivo equivocado (Retorno contra Cancelado)
- **Qué hago:** corregir el motivo en la columna AC de Operaciones desde la página OPERACIONES. Para pasar de Cancelado a Retornado, cambiar las casillas.
- **Recuerda:** un **Retorno** regresa a Logística y se puede reenviar; un **Cancelado** ya no se entrega.

### CAP-06 · Eligió el vehículo equivocado en la mañana
- **Qué hago:** el gestor toca el vehículo en Inicio → **Cambiar**. El cambio queda anotado con la hora.

### CAP-07 · Recolectó algo que no era para él
- **Qué hago:** en su lista, **Devolver**, con motivo. El folio regresa a "sin recolectar" en el Sistema de Traspasos.

### CAP-08 · Efectivo sin quién recibió
- **Caso real:** C-PV-0009 ($3,287) y C-PV-0017 ($3,798) se entregaron sin nombre de quién recibió.
- **Prevención:** si el contenido dice "Efectivo", la app **exige** quién recibió y firma (`DIS-04`).

---

## 12. Errores de diseño o de proceso (DIS)

Son errores en **cómo está pensado** el trabajo. Se arreglan cambiando una regla, no un dato.

### DIS-01 · Tres tipos de cosas en una sola lista
- **Caso real:** 62 de 97 pendientes ya estaban cerrados en su sistema.
- **Cómo lo resuelve la app 2:** al escanear clasifica:
  - `#…` es **pedido**.
  - Un prefijo de sucursal es **traspaso**.
  - Otro código es **otro** y pide destino.
  - Cada tipo se cierra en su propia fuente.

### DIS-02 · Remisiones del sistema viejo (VREM-, NRREM-, V-13xx)
- **Problema:** no hay ninguna hoja que diga si ya se entregaron.
- **Regla:** si llevan **3 días** sin moverse, pasan a `APP_Problemas` y te llega un aviso. Tú decides si se cierran.
- **Solución de fondo:** que esas remisiones se den de alta en el Sistema de Traspasos.

### DIS-03 · Pedidos que se van por paquetería
- **Problema:** el gestor los lleva a la paquetería, pero Operaciones los mantiene "ENVIADO POR PAQUETERÍA" hasta que la paquetería entrega, y se quedaban en su lista.
- **Regla:** botón **"Entregado a paquetería"**, con foto de la guía, que lo saca de su lista.

### DIS-04 · Efectivo y documentos delicados
- **Regla:** contenido con "Efectivo", "Factura" o "Cortes" exige **quién recibió y firma**.
- **Dónde se ajusta:** `APP_Config` → `PALABRAS_EXIGEN_FIRMA`.

### DIS-05 · Algo de la pantalla confunde a los gestores
- **Qué hago:** anótalo en `APP_Problemas` con captura y lo ajusto en la siguiente versión. Antes de cambiar cualquier pantalla te enseño la vista previa.

### DIS-06 · Nombres distintos para la misma persona
- **Regla:** cada gestor tiene un **número fijo** (G-01, G-02…) y un "Nombre en Operaciones" idéntico al de "Datos". El robot usa el número; el nombre solo se muestra.

---

## 13. Errores al actualizar el código (COD)

### COD-01 · Después de pegar código nuevo, nada funciona
- **Qué hago (5 minutos):**
  1. Apps Script → Implementar → **Gestionar implementaciones** → lápiz → en "Versión" elige **la anterior** → Implementar.
  2. Listo: la app vuelve a funcionar con la versión anterior.
  3. Avísame qué archivo pegaste.
- **Prevención:** cada actualización trae en `CAMBIOS.md` la lista exacta de archivos, y primero se prueba en la copia.

### COD-02 · Los celulares no reciben la versión nueva de la app
- **Dónde recae:** el celular guardó la versión anterior.
- **Qué hago:** cerrar la app por completo y abrirla dos veces. Si sigue, `CEL-01`.
- **Cómo confirmo:** Inicio → Yo → abajo dice la **versión**.

### COD-03 · Pegué un archivo en el proyecto equivocado
- **Dónde recae:** hay tres proyectos de Apps Script distintos: **App Gestores · Datos** (la app nueva), **OPERACIONES · Backend** y **Logística Operaciones** (la app vieja, Rastreo, Shopify).
- **Qué hago:** borrar el archivo del proyecto equivocado y pegarlo en el correcto. La primera línea de cada archivo dice a qué proyecto pertenece.

### COD-04 · "Falta autorizar"
- **Dónde recae:** el código nuevo usa un permiso de Google que antes no usaba (Drive, correo…).
- **Qué hago:** en Apps Script, ejecutar una vez la función `AUTORIZAR` y aceptar los permisos con tu cuenta.

---

## 14. Cómo reportarme un problema

Mándame esto y lo resuelvo más rápido:

```
Código: (el que salió en la app, por ejemplo CEL-05)
Quién:  (gestor o "todos")
Cuándo: (fecha y hora aproximada)
Qué:    (ID del pedido o folio del traspaso)
Qué hizo antes de que fallara:
Captura de pantalla: (si se puede)
```

Y anótalo en la pestaña **Problemas** del Centro de control con su número (P-005, P-006…).

---

## 15. Revisión de rutina

**Cada lunes (5 minutos):**
- [ ] `APP_Config` → "Última vuelta del robot" es de hace menos de 5 minutos.
- [ ] `APP_Cierres` → filtrar estado **ERROR** o **PENDIENTE de más de 1 hora**. Debe estar vacío.
- [ ] `APP_Problemas` → revisar lo nuevo (nombres desconocidos, remisiones viejas, fotos en respaldo).
- [ ] Carpeta de fotos de respaldo → vacía.

**Cada mes:**
- [ ] ⚙ App Gestores → **Archivar historial** (si `APP_Log` pasa de 50,000 renglones).
- [ ] Revisar en `APP_Usuarios` que los gestores que ya no trabajan estén **inactivos**.
- [ ] Revisar el espacio de Drive.
