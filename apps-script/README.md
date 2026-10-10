# Apps Script — hoja "Logística FED 2026"

| Archivo | Qué es |
|---|---|
| `Operaciones.gs` | Script principal (v6.0): onEdit, fórmulas de autocompletado, WhatsApp, TAREA. |
| `Diseno_Atajos.gs` | Presentación: diseño, menú ⚡ Atajos, filas compactas, auditoría. |

## Instalación de v6 (una sola vez)

1. En **Extensiones → Apps Script**, reemplaza el contenido de tus archivos por estos dos
   (si tenías "Diseno", "Atajos" y "Compactar" por separado, bórralos y deja solo `Diseno_Atajos.gs`).
2. Corre, en este orden, desde el editor:
   1. `OPS_quitarTriggerDuplicadoOnEdit` — quita el activador que hacía correr onEdit 2 veces.
   2. `OPS_instalarFormulasAutocompletado` — crea la hoja oculta `OpsIdx` y reescribe C, D, E, Y, Z.
   3. `OPS_configurarFormatoCondicionalDuplicados`
   4. `aplicarDisenoOperaciones` (limpia reglas de formato acumuladas).
3. Opcional: `OPS_diagnosticoTamanoHojas` para revisar filas/columnas sobrantes, reglas de formato
   y fórmulas volátiles (`NOW`, `TODAY`, `INDIRECT`, `OFFSET`…).

> No escribas a mano en la hoja `OpsIdx` ni debajo de `Y4` (la fórmula de Y se extiende sola).

## Mapa de columnas de Operaciones

| Col | Campo | Cómo se llena |
|---|---|---|
| A | ID | Manual. `TAREA` se autonumera (`TAREA # 0001`). |
| B | Área | Desplegable (Datos!I). Al elegirla se marca F y se preparan C/D/E/Z. |
| C | SubÁrea | Fórmula (busca en OpsIdx). En COLIMA/IMSS: desplegable manual (Datos!J). |
| D | Nombre | Fórmula (OpsIdx). |
| E | Dirección | Fórmula (OpsIdx). De aquí se saca el teléfono para WhatsApp. |
| F | Fecha | Script: fecha/hora al elegir Área. |
| G | Zona | Desplegable (Datos!X). |
| H | Método de envío | Desplegable (Datos!P). Activa desplegables y "NO APLICA" en I:N. |
| I | Gestor | Desplegable (Datos!A) — Logística Interna. |
| J | Vehículo | Desplegable (Datos!E) — Logística Interna. |
| K | Paquetería | Desplegable (Datos!AJ) — Paquetería Externa. |
| L | Plataforma | Desplegable (Datos!AF) — UBER. |
| M | Guía | Manual — Paquetería Externa. |
| N | Costo | Manual. |
| O | ETA | Script: fecha/hora cuando el pedido sale (y se genera el link de WhatsApp). |
| P | Estatus | Fórmula. |
| R / S | Retornado (fecha / casilla) | Script marca R al marcar S. |
| T / U | Cancelado (fecha / casilla) | Script marca T al marcar U. |
| V / W | Entregado (fecha / casilla) | Script marca V al marcar W. |
| X | Días de atraso | Fórmula. |
| Y | Duplicado | Una sola fórmula en Y4 (ID + Área repetidos). |
| Z | Nota Cat | Fórmula (OpsIdx; hoy solo BOTICAN, Cat!HZ). |
| AE | Link WhatsApp | Script. |
| AF | ¿WhatsApp enviado? | Casilla manual. |

### Cuándo "sale" un pedido (marca O + link de WhatsApp)

| Método | Bloquea ("NO APLICA") | Sale cuando… |
|---|---|---|
| Logística Interna | K:N | hay Gestor (I) y Vehículo (J) |
| Paquetería Externa | I:J | hay Guía (M) |
| UBER | I:K | hay Plataforma (L) |
| En ruta por otro método | — | al elegir el método |
