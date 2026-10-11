# Tablero Logístico FED: cómo instalarlo

Tiempo total: unos 15 minutos. Solo se hace una vez.

Son 3 partes:

1. Actualizar el script de Operaciones (2 min).
2. Crear el tablero (10 min).
3. Activar el correo mensual para Miriam (1 min).

---

## PARTE 1: actualizar el script de Operaciones (v6.1)

**¿Por qué?** Tú escribes en la columna **O** la ETA que te da la paquetería, y eso borraba la hora real en que salió el pedido. Desde ahora el script guarda esa hora en la columna **AE "Salida (auto)"**. El tablero la necesita para medir tus 48 h y 36 h. **No escribas nada en AE.**

1. Abre tu hoja **Logística FED 2026** y entra a **Extensiones → Apps Script**.
2. A la izquierda, abre el archivo de **Operaciones** (el que dice `OPERACIONES v6.0` en la primera línea).
3. Selecciona todo el texto (**Ctrl + A**) y bórralo.
4. Abre este enlace, selecciona todo (**Ctrl + A**), cópialo (**Ctrl + C**) y pégalo (**Ctrl + V**):
   https://raw.githubusercontent.com/Logisitica-Araujo/logistica/claude/operaciones-performance-11uds1/apps-script/Operaciones.gs
5. Guarda con el icono de **disquete**.
6. Arriba, en la lista de funciones, elige **OPS_INSTALAR_TODO** y da clic en **▶ Ejecutar**.
7. En tu hoja aparece **"✅ TODO INSTALADO"**. La columna AE ahora se llama **"Salida (auto)"**.

---

## PARTE 2: crear el tablero

El tablero es un archivo **aparte**, así que no le pone peso a tu hoja de Operaciones.

### 2.1 Crear el proyecto
1. Abre https://script.google.com con tu cuenta de **@fadermex.com**.
2. Da clic en **"+ Nuevo proyecto"**, arriba a la izquierda.
3. Arriba, donde dice **"Proyecto sin título"**, da clic y escribe **Tablero Logístico FED**.

### 2.2 Pegar el código (archivo 1 de 2)
1. Ya está abierto un archivo llamado **Código.gs**. Borra todo lo que tiene (**Ctrl + A**, luego **Suprimir**).
2. Abre este enlace, cópialo todo y pégalo ahí:
   https://raw.githubusercontent.com/Logisitica-Araujo/logistica/claude/operaciones-performance-11uds1/apps-script/tablero/Codigo.gs
3. Guarda con el icono de **disquete**.

### 2.3 Pegar el diseño (archivo 2 de 2)
1. A la izquierda, junto a **"Archivos"**, da clic en el **+** y elige **HTML**.
2. Escribe exactamente **Tablero** (con T mayúscula; no escribas ".html") y presiona **Enter**.
3. Borra lo que trae, abre este enlace, cópialo todo y pégalo:
   https://raw.githubusercontent.com/Logisitica-Araujo/logistica/claude/operaciones-performance-11uds1/apps-script/tablero/Tablero.html
4. Guarda con el icono de **disquete**.

### 2.4 Poner la hora de México
1. A la izquierda, da clic en el **engrane ⚙️ "Configuración del proyecto"**.
2. En **Zona horaria**, elige **"(GMT-06:00) Hora central - Ciudad de México"**.
3. Regresa al código con el icono **< >** (Editor).

### 2.5 Probar que lee tu hoja
1. Arriba, en la lista de funciones, elige **TABLERO_PROBAR** y da clic en **▶ Ejecutar**.
2. Google te pedirá permisos. Da clic en **Revisar permisos** → elige tu cuenta → **Configuración avanzada** → **Ir a Tablero Logístico FED (no seguro)** → **Permitir**.
   - El aviso de "no seguro" es normal: aparece porque el script lo hiciste tú y no Google.
3. Abajo, en el **Registro de ejecución**, debe aparecer algo como:
   `✅ Leí 1,234 pedidos de Operaciones en 3.1 s.`

### 2.6 Publicarlo como página web
1. Arriba a la derecha: botón azul **Implementar** → **Nueva implementación**.
2. Junto a "Seleccionar tipo", da clic en el **engrane ⚙️** y elige **Aplicación web**.
3. Llena así:
   - **Descripción:** Tablero v1
   - **Ejecutar como:** **Yo** (tu correo)
   - **Quién tiene acceso:** **Cualquier usuario de fadermex.com**
4. Da clic en **Implementar**.
5. Copia la **URL de la aplicación web** (empieza con `https://script.google.com/a/macros/fadermex.com/...`).
   **Esa es la liga de tu tablero.** Guárdala en tus favoritos y compártela con tus jefes.

> Solo la pueden abrir personas con cuenta de **@fadermex.com**. No necesitan permiso sobre tu hoja de Operaciones.

---

## PARTE 3: activar lo automático (lectura cada 10 min + correo del día 1)

1. **Primero pruébalo contigo.** En la lista de funciones elige **TABLERO_PROBAR_CORREO** → **▶ Ejecutar**. Te llega a ti el correo del mes pasado, marcado como **[PRUEBA]**.
2. Si te gusta, elige **TABLERO_ACTIVAR_AUTOMATICOS** → **▶ Ejecutar**. Esto deja programadas 2 cosas:
   - Cada **10 minutos** el tablero lee tu hoja por su cuenta, así abre **al instante** para quien lo consulte.
   - Cada **día 1 a las 8 a. m.** le llega a **mcamacho@fadermex.com** el resumen del mes anterior, con un botón para abrir el tablero.
3. Si algún día lo quieres apagar, ejecuta **TABLERO_DESACTIVAR_CORREO_MENSUAL**.

---

## Si algún día te paso una versión nueva del tablero
1. Pega el código nuevo encima, igual que en la Parte 2, y guarda.
2. **Implementar** → **Gestionar implementaciones** → **lápiz ✏️** → en **Versión** elige **Nueva versión** → **Implementar**.
   La liga **no cambia**.

---

## Cómo funciona (para cuando te pregunten)

| Pregunta | Respuesta |
|---|---|
| ¿De dónde salen los números? | De las hojas **Operaciones**, **Cat** y **Datos** de "Logística FED 2026". El tablero solo las lee; nunca escribe en ellas. |
| ¿Está en tiempo real? | Lee tu hoja cada 10 minutos por su cuenta y la página se refresca sola cada 5. Si acabas de capturar algo y quieres verlo ya, el botón **"Actualizar ahora"** lee la hoja en ese momento (tarda unos segundos). |
| ¿Aparecen solos noviembre y diciembre? | Sí. El mes de cada pedido es el de la **columna F**. Los meses, áreas, paqueterías, destinos y vehículos nuevos aparecen solos. En 2027 aparece el filtro **Año**. |
| ¿Cómo cuentan las horas? | Son **horas hábiles**: no cuentan sábados, domingos ni los festivos de **Datos, columna V**. Un pedido listo el viernes a las 4 p. m. y entregado el lunes a las 4 p. m. lleva 24 h. |
| Logística interna, 48 h | Desde **"Pedido listo para recolección"** (bitácoras de Cat; si no está, la fecha de la columna F) hasta **Entregado** (columna V). |
| Guías IMSS Morelia, 36 h | Desde que se registra la solicitud (**F**) hasta que se captura la guía (hora guardada en **AE**). |
| Paquetería, 48 h | Desde **"listo"** (Cat) hasta que **sale con guía** (AE o "Fecha salida" de Cat). El viaje de la paquetería se mide aparte como **"Tránsito"** porque depende de ella (temporada, clima, catástrofes). |
| ¿Llegó en la ETA? | Compara la fecha de **Entregado (V)** con la ETA que escribes en **O**. |
| ¿Qué es una incidencia? | Todo pedido con motivo en la **columna AC** o marcado como **Retornado**. |
| ¿Cuánto se gastó? | Es la suma de la **columna N (Costo)**. |
| ¿Qué es un viaje? | Un vehículo que salió en un día. Dos entregas del mismo vehículo el mismo día cuentan como 1 viaje. |
| ¿Hace lenta mi hoja? | No. Es un archivo aparte que solo lee la hoja; no escribe ni agrega fórmulas. |

### Columnas de Cat que usa
- Pedidos Logística-Fadermex 2026:
  - **FV**: Identificador
  - **GC**: Pedido listo para recolección
  - **GG**: Fecha salida
- LOGÍSTICA BOTICAN 2026:
  - **HD**: Identificador
  - **HI**: Pedido listo para recolección
  - **HL**: Fecha salida

Si algún día mueves esas columnas, cambia los números en `TAB_CAT`, al principio de **Codigo.gs**.

### Datos que se miden desde hoy
Los pedidos anteriores a la Parte 1 no tienen la hora de salida en AE. Por eso, en los meses pasados:
- **Paquetería** usa la "Fecha salida" de Cat.
- **Guías IMSS Morelia** solo se miden si la columna O conserva la hora que puso el script.

Desde hoy, todo queda medido con precisión.
