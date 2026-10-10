# Apps Script — hoja "Logística FED 2026"

| Archivo | Qué es |
|---|---|
| `Operaciones.gs` | Script principal (v6.0): onEdit, fórmulas de autocompletado, WhatsApp, TAREA. |
| `Diseno_Atajos.gs` | Presentación: diseño, menú ⚡ Atajos, filas compactas, auditoría. **Opcional** — no hace falta reemplazar el que ya tienes. |

## Instalación de v6 (una sola vez)

1. Abre la hoja → menú **Extensiones** → **Apps Script**.
2. A la izquierda, abre el archivo que empieza con `OPERACIONES v5.4`. Borra todo su contenido
   y pega `Operaciones.gs`. Guarda (icono de disquete o Ctrl+S).
3. **No toques** el archivo de diseño / ⚡ Atajos: tu presentación se queda igual.
4. Arriba, en la lista de funciones, elige `OPS_INSTALAR_TODO` y da clic en **Ejecutar**.
   Si Google pide permisos: *Revisar permisos* → tu cuenta → *Configuración avanzada* →
   *Ir a … (no seguro)* → *Permitir*.
5. En la hoja aparece "✅ TODO INSTALADO". Listo.

> No escribas a mano en la hoja oculta `OpsIdx` ni debajo de `Y4`.

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
