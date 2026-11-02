# Custodia by AARX — código de la versión producto

Copia limpia de la app interna de FADERMEX (`/traspasos/apps-script`), **sin datos, IDs ni reglas propias de esa empresa**. La app de FADERMEX no se toca desde aquí.

## Estado: Fase 2 (extracción y limpieza) — avance
| Hecho | Detalle |
|---|---|
| ✅ Sin IDs ni nombre de FADERMEX | `TR.ID_ARCHIVO` vacío (usa el archivo que contiene el script), `NOMBRE_APP: 'Custodia'` |
| ✅ Recepción → **punto de resguardo** configurable | `CFG_Ajustes → ubicacion_resguardo` (antes fijo `'REC'`). En reglas: `R.PAUSA` |
| ✅ Logística → **centro de envíos** configurable | `CFG_Ajustes → ubicacion_centro_envios` (antes fijo `'LOG'`). En reglas: `R.HUB`. Si está vacío, lo foráneo va directo |
| ✅ Botican fuera del núcleo | `ejemplos/Cliente_Ejemplo_Botican.gs.txt` |
| ✅ Hoja "Operaciones" fuera del núcleo | `ejemplos/Cliente_Ejemplo_Operaciones.gs.txt` (enchufe `clienteGuias()`) |
| ✅ Captura manual de guía | Paquetería → "Guardar guía" en cajas y traslados sueltos (`apiCapturarGuia`) |
| ✅ Revisión periódica genérica | Activador `revisionPeriodica()` cada 10 min: alertas por tiempo + `clienteGuias()` si existe |
| ✅ Enchufes | `clienteDetalle(c, folio)`, `clienteInstalar(hechos)`, `clienteGuias()` |
| ✅ Mensajes sin "Morelia / Logística / Recepción Oficinas" | Usan el nombre configurado de cada ubicación |
| ✅ Pruebas | 13 conjuntos de pruebas del servidor pasan + prueba de la página (Paquetería) |

## Pendiente (siguientes pasos)
- **Palabras configurables** en pantallas: "traspaso" → "traslado" o lo que diga el cliente; "gestor" → "portador / mensajero"; "bulto" → "pieza". (Fase 3)
- **Instalación desde cero** (crear todas las hojas en un archivo vacío) + asistente de configuración. (Fase 3)
- **Empresa demo "Grupo Ejemplo"** con datos ficticios para las demos y los videos. (Fase 3)
- Interruptores de módulos (`CFG_Modulos`). (Fase 3)
- Seguridad: hash de credenciales y NIP, bitácora encadenada, respaldos. (Fase 4)
- Colores y tipografías de la marca (hoy conserva los de FADERMEX). (Fase 3)

## Archivos
`01_Config` utilidades y papeles · `02_Reglas` reglas (servidor y página) · `03_Datos` datos e identificación · `04_Api` funciones de la página · `05_Instalar` instalación · `06_Cajas` envío externo, cajas y guías · `07_Recepcion` punto de resguardo y centro de impresión · `App.html` / `Estilos.html` / `Index.html` página.
