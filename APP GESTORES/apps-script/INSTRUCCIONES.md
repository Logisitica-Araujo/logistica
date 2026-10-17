# Instalar el servidor 3.0

Se reemplazan 5 archivos y se agrega 1. Los demás no se tocan.

| Archivo | Qué hacer |
|---|---|
| `00_CONFIG.gs` | **Reemplazar.** Luego vuelve a escribir tu `CLAVE_ADMIN`. |
| `01_INSTALADOR.gs` | Reemplazar (cambio pequeño). |
| `02_BACKEND.gs` | Reemplazar. |
| `04_API.gs` | Reemplazar. |
| `08_SYNC.gs` | Reemplazar. |
| `10_LIBRO_APP.gs` | **Nuevo.** Botón **+** → Secuencia de comandos → nómbralo `10_LIBRO_APP` y pega. |
| `03_ADMIN`, `05_PRUEBAS`, `06_VELOCIDAD`, `07_FIRMAS`, `09_TRASPASOS_NUEVOS` | No se tocan. |

## Antes de empezar
- Hazlo cuando nadie esté cerrando pedidos (bastan 5 minutos).
- Ten a la mano tu `CLAVE_ADMIN`.

## Paso 1 — Pegar los archivos
Abre **"Logística Operaciones" → Extensiones → Apps Script**. Para cada archivo de la tabla: ábrelo en GitHub → **Copy raw file** → en Apps Script ábrelo → Ctrl+A → pegar → Ctrl+S.

## Paso 2 — Publicar la versión nueva (sin esto no cambia nada)
Botón azul **Implementar → Gestionar implementaciones → lápiz (editar) → Versión: "Versión nueva" → Implementar**. La dirección `/exec` sigue siendo la misma: no hay que tocar la app.

## Paso 3 — Comprobar
- En el navegador abre `TU-URL/exec?api=ping`. Debe salir `{"ok":true, …}`.
- Entra a la app con un gestor.
- Al día siguiente revisa `APP_Log` filtrando la columna Accion por `LENTO`: ahí queda cada consulta que tardó más de 8 segundos.

## Paso 4 (opcional, el que más acelera) — Libro propio para la app
Una noche o fin de semana, cuando nadie use la app: en la lista junto a **▷ Ejecutar** elige `migrarAppALibroPropio` → **▷ Ejecutar**.

- Copia las hojas `APP_*` a un libro nuevo y ligero, en la misma carpeta.
- **`APP_Entregas` se queda en "Logística Operaciones"**, porque la columna V de "Operaciones" tiene una fórmula que lee la fecha de entrega de esa hoja.
- Las hojas viejas quedan como `OLD_APP_…`. Bórralas cuando todo lleve unos días bien.
- Para deshacer ese mismo día: ejecuta `deshacerMigracionLibroApp`.

## Ajustes nuevos en `APP_Config` (opcionales)
Si no los agregas, valen lo de la derecha.

| Clave | Valor | Qué hace |
|---|---|---|
| `SESION_INACTIVIDAD_HORAS` | 72 | La sesión se cierra tras 72 h sin usar la app. |
| `SESION_MAX_DIAS` | 30 | De todos modos pide login cada 30 días. |
| `SYNC_HORARIO` | 6-22 | Horas en que corre el robot (ahorra la cuota diaria de Google). |
| `CACHE_CATALOGO_SEG` | 300 | Cuántos segundos se recuerdan vehículos y sucursales. |
| `OPERACIONES_EN_SEGUNDO_PLANO` | TRUE | El robot escribe los cierres en Operaciones (FALSE = como antes, al momento). |
