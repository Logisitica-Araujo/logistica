# Logística FADERMEX / BOTICAN

Aquí viven varios proyectos distintos. Esta página dice cuál es cuál y dónde está cada uno.

## Los proyectos

| Proyecto | Qué es | Se instala en | Dónde está el código |
|---|---|---|---|
| **APP GESTORES** | La app del celular de los gestores: pedidos a domicilio, traspasos, vehículos, escáner. Incluye su servidor (Apps Script). | Celulares (GitHub Pages) + Apps Script de **"Logística Operaciones"** | Carpeta [`APP GESTORES/`](APP%20GESTORES/) y los archivos de la raíz. Guía: [`APP GESTORES/README.md`](APP%20GESTORES/README.md) |
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
