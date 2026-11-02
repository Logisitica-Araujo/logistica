# Miércoles: poner en marcha App Gestores 2

Tiempo: unos 45 minutos. Necesitas a tus superiores **solo** en los pasos marcados 👔 (implementar con acceso "Cualquier persona").
Si algo falla, busca el código en [docs/ERRORES_Y_SOLUCIONES.md](docs/ERRORES_Y_SOLUCIONES.md) o mándame una captura.

> **Antes de empezar, avísame.** Reviso que los archivos de OPERACIONES estén al día con lo último de ese proyecto, para que al pegarlos no se pierda ningún cambio reciente.

---

## Parte A · OPERACIONES · Backend (15 min)
Proyecto de Apps Script **"OPERACIONES · Backend"**. Los archivos están en GitHub: repositorio `OPERACIONES`, rama `claude/practical-shannon-8koohs`, carpeta `apps-script/`.

1. Pega cada archivo con Copy raw file → Ctrl+A → pegar → Ctrl+S:

| Archivo | Qué hacer |
|---|---|
| `01_Backend_Lectura.gs` | Reemplazar |
| `02_Backend_Escritura.gs` | Reemplazar |
| `03_Backend_Extras.gs` | Reemplazar |
| `04_Backend_App.gs` | **Nuevo**: botón + → Secuencia de comandos → nómbralo `04_Backend_App` |

2. 👔 **Implementar → Gestionar implementaciones → lápiz → Versión nueva → Implementar.** El acceso queda como está. Copia la dirección **/exec**: la usas en la parte B.
3. Abre la página OPERACIONES → **Administración → Usuarios → Nuevo**:
   - Usuario: `app.gestores`
   - Nombre: `App Gestores`
   - Rol: **App**
   - PIN: uno de al menos 6 caracteres. Anótalo; lo usas en la parte B y no se vuelve a mostrar.

## Parte B · App Gestores · Datos (20 min)
Tu archivo **App Gestores · Datos** → Extensiones → Apps Script. Los archivos están en GitHub: repositorio `logistica`, rama `claude/practical-shannon-8koohs`, carpeta `app-gestores-2/apps-script/`.

1. Pega:

| Archivo | Qué hacer |
|---|---|
| `00_CONFIG.gs` | Reemplazar |
| `01_INSTALAR.gs` | Reemplazar (trae el botón "Dar de alta varios gestores") |
| `02_SESION.gs` | No cambia |
| `03_API.gs` | Reemplazar |
| `04_OPERACIONES.gs` | **Nuevo** |
| `05_TRASPASOS.gs` | **Nuevo** |
| `06_GESTOR.gs` | **Nuevo** |
| `07_ROBOT.gs` | **Nuevo** |
| `09_PRUEBAS.gs` | Reemplazar |

2. Ejecuta **`INSTALAR`** (▷ Ejecutar). Agrega lo nuevo sin borrar nada. Google pedirá permisos nuevos (conectarse a otros servicios y Drive): **Permitir**.
3. En la hoja: **⚙ App Gestores → Conectar con OPERACIONES**. Pega la dirección /exec de la parte A, el usuario `app.gestores` y su PIN. Debe decir "Conectado. OPERACIONES tiene N pedidos abiertos…".
4. Revisa la pestaña **APP_Vehiculos**: columna **Tipo** = MOTO, AUTO o NINGUNO. La app lo adivinó por el nombre. Revisa sobre todo "FED 2 14KGC4".
5. **⚙ App Gestores → Nuevo gestor**, una vez por gestor (y uno de prueba para ti). En "Nombre en Operaciones" escribe el nombre **idéntico** al de la columna I de Operaciones (lista de gestores de "Datos"). Anota cada contraseña temporal.
6. **⚙ App Gestores → Instalar robot.** Debe decir "Robot instalado" y su primera vuelta sin errores.
7. 👔 **Implementar → Nueva implementación** → engrane → **Aplicación web**:
   - Descripción: `App Gestores 2`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**

   → Implementar → copia la dirección **/exec**.
8. Prueba: abre esa dirección con `?ping=1` al final. Debe decir `"version":"0.2.0"`.

## Parte C · La app del celular (5 min)
1. **Mándame la dirección /exec del paso B.7.** Yo la pongo en la app y la publico en `logisitica-araujo.github.io/logistica/v2/`. **No toca la app actual**: esa sigue en su dirección de siempre.
2. Cuando te avise, abre esa dirección en tu celular, entra con tu usuario de prueba y haz una entrega de prueba con un pedido real tuyo o uno de prueba.
3. En **APP_Cierres** debe aparecer el cierre. En menos de 2 minutos debe decir **ENVIADO**, y en Operaciones el pedido debe quedar ENTREGADO.

## Parte D · Piloto con Jose Luis (miércoles en la tarde)
- Que la instale: Chrome → la dirección → ⋮ → **Agregar a pantalla principal**.
- Le das su usuario y contraseña temporal en persona.
- Al terminar su ruta, revisa `APP_Cierres` (que nada esté en ERROR) y `APP_Problemas`.

## Jueves
Si el piloto salió bien, todos instalan la app nueva con el [manual del gestor](docs/MANUAL_GESTOR.md). La app vieja sigue funcionando por si acaso.
