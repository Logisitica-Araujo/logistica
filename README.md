# Logística FADERMEX / BOTICAN

Aquí viven varios proyectos distintos. Esta página dice cuál es cuál y dónde está cada uno.

## ¿Qué buscas? (rama `main`)

| Busco… | Está en |
|---|---|
| **Los scripts de la app nueva para pegar** en *App Gestores · Datos* → Apps Script | [`app-gestores-2/1-SCRIPTS-PARA-PEGAR/`](app-gestores-2/1-SCRIPTS-PARA-PEGAR/) |
| **El script de OPERACIONES** (04_Backend_App y los demás) | Repositorio **OPERACIONES** (privado) → carpeta `apps-script/` |
| **Manuales** (gestor, administradora, errores, puesta en marcha) | [`app-gestores-2/2-MANUALES/`](app-gestores-2/2-MANUALES/) |
| **La app del celular nueva** (página que abren los gestores) | [`v2/`](v2/) → https://logisitica-araujo.github.io/logistica/v2/ |
| **Qué cambió en cada versión** | [`app-gestores-2/CAMBIOS.md`](app-gestores-2/CAMBIOS.md) |
| La app vieja (la de antes; sigue funcionando hasta que todos cambien) | Archivos sueltos de la raíz (`index.html`, `app.js`…) y sus scripts en [`APP GESTORES 1 (la vieja)/`](APP%20GESTORES%201%20(la%20vieja)/) |
| Pólizas y protocolo en PDF | Raíz (`poliza-…pdf`, `protocolo-entrega.pdf`) |

> Los archivos sueltos de la raíz, `lib/`, `iconos/` y los PDF **no se mueven**: la app vieja y la nueva los usan desde esa dirección en internet.
>
> Si GitHub te muestra los nombres de carpetas raros ("gestos de la aplicación", "biblioteca"), es el **traductor de Chrome**. Clic derecho → "Mostrar original" o desactiva la traducción para github.com.

## Los proyectos

| Proyecto | Qué es | Se instala en | Dónde está el código |
|---|---|---|---|
| **APP GESTORES 1 (la vieja)** | La app del celular de antes. Se apaga cuando todos usen la nueva. | Celulares (GitHub Pages) + Apps Script de **"Logística Operaciones"** | Carpeta [`APP GESTORES 1 (la vieja)/`](APP%20GESTORES%201%20(la%20vieja)/) y los archivos de la raíz |
| **App Gestores 2** (la nueva) | La app nueva de los gestores, en su propio archivo de Google Sheets, conectada a OPERACIONES y al Sistema de Traspasos. | Celulares (GitHub Pages `/v2/`) + Apps Script de **"App Gestores · Datos"** | Carpeta [`app-gestores-2/`](app-gestores-2/). Scripts en `1-SCRIPTS-PARA-PEGAR/`, manuales en `2-MANUALES/` |
| **Sistema de Traspasos** | Página para que sucursales y oficinas creen, etiqueten, entreguen y reciban traspasos. Incluye manuales y modo kiosco. | Apps Script del libro **"Traspasos_FADERMEX_BD"** | Rama [`claude/hopeful-hypatia-ooxdrs`](https://github.com/Logisitica-Araujo/logistica/tree/claude/hopeful-hypatia-ooxdrs/traspasos), carpeta `traspasos/` |
| **Operaciones y Tablero de KPIs** | Script principal de la hoja "Operaciones" (fórmulas, fechas, TAREA, salida), entregas automáticas por correo (Skydropx/Mienvio) y el tablero de KPIs. | Apps Script de **"Logística Operaciones"** (el tablero es un proyecto aparte) | Rama [`claude/operaciones-performance-11uds1`](https://github.com/Logisitica-Araujo/logistica/tree/claude/operaciones-performance-11uds1/apps-script), carpeta `apps-script/` |
| **Diseño de la bitácora PV** | Diseño visual de las hojas "Envios" y "Busqueda por Sucursal" de la bitácora de sucursales. | Apps Script de **"Pedidos Logistica-Fadermex 2026"** | Rama [`claude/cool-newton-4u2l8h`](https://github.com/Logisitica-Araujo/logistica/tree/claude/cool-newton-4u2l8h/apps-script), carpeta `apps-script/` |

## Cómo se conectan

- **APP GESTORES ↔ Sistema de Traspasos:** el archivo `09_TRASPASOS_NUEVOS.gs` (del Sistema de Traspasos) se pega en el Apps Script de la APP GESTORES. Cuando el gestor escanea un folio del sistema nuevo, la app trae su origen y destino y actualiza su estatus.
- **APP GESTORES ↔ Operaciones:** la app lee los pedidos de la hoja "Operaciones" (a través de `APP_Pedidos`) y escribe ahí la fecha, GPS, foto y motivo de cada cierre. La columna V de "Operaciones" tiene una fórmula que lee `APP_Entregas`.
- **Mismo proyecto de Apps Script:** la APP GESTORES y el script de Operaciones viven en el mismo proyecto de "Logística Operaciones", junto con Rastreo, Shopify y macros. Cada uno en sus propios archivos.

## Ramas

- `main`: lo que está publicado hoy (la app del celular que usan los gestores).
- `claude/…`: trabajo de cada proyecto. Se pasa a `main` cuando se aprueba.
