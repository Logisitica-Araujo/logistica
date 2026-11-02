# Instalar la etapa 1 (en una copia de prueba)

Tiempo: unos 15 minutos. **No toca ningún archivo que ya uses.**

## 1. Crear el archivo de prueba
1. En Drive: **Nuevo → Hojas de cálculo de Google → Hoja de cálculo en blanco**.
2. Nómbrala **App Gestores · Datos (PRUEBA)**.

## 2. Pegar el código
1. En ese archivo: **Extensiones → Apps Script**.
2. Borra lo que trae el archivo `Código.gs`.
3. Crea 5 archivos (botón **+** → Secuencia de comandos) con estos nombres, y pega en cada uno su contenido de GitHub (`app-gestores-2/apps-script/` → el archivo → **Copy raw file**):

| Nombre en Apps Script | Archivo en GitHub |
|---|---|
| `00_CONFIG` | `00_CONFIG.gs` |
| `01_INSTALAR` | `01_INSTALAR.gs` |
| `02_SESION` | `02_SESION.gs` |
| `03_API` | `03_API.gs` |
| `09_PRUEBAS` | `09_PRUEBAS.gs` |

4. Puedes borrar `Código.gs` o dejarlo vacío. **Ctrl+S**.

## 3. Instalar
1. En la lista junto a **▷ Ejecutar** elige `INSTALAR` → **▷ Ejecutar**.
2. Google pide permisos la primera vez: **Revisar permisos** → tu cuenta → **Configuración avanzada** → **Ir a … (no seguro)** → **Permitir**. Sale "no seguro" porque el código es tuyo y Google no lo ha revisado; es normal.
3. Regresa al archivo y recárgalo: ya están las 11 pestañas y el menú **⚙ App Gestores**.

## 4. Probar
1. **⚙ App Gestores → Probar etapa 1.**
2. Debe salir una ventana con **8 palomitas ✔**. El gestor de prueba queda dado de baja al final.

## 5. Dar de alta a un gestor de verdad (opcional en la prueba)
**⚙ App Gestores → Nuevo gestor.** Te pide:
1. Nombre para mostrar.
2. Nombre **exacto** como aparece en la columna I de Operaciones.
3. Usuario.

Al final te muestra la **contraseña temporal una sola vez**. Anótala y dásela en persona.

## Qué revisar
- [ ] Salieron las 8 palomitas.
- [ ] En `APP_Usuarios` la columna **ClaveCifrada** tiene un texto raro (no la contraseña).
- [ ] En **Configuración del proyecto → Propiedades del script** existen `SAL` e `ID_ARCHIVO`. **No los borres ni los compartas.**

Si algo falla: copia el mensaje y mándamelo. También queda anotado en `APP_Log`.

> Todavía **no** se publica como aplicación web: eso va en la etapa 2, junto con la pantalla del celular.
