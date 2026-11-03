# APP GESTORES

La app que usan los gestores en el celular para entregar pedidos a domicilio y mover traspasos entre sucursales.

Tiene tres partes:

| Parte | Dónde está | Qué es |
|---|---|---|
| **La app del celular** | Raíz del repositorio: `index.html`, `app.js`, `estilos.css`, `sw.js`, `manifest.json`, `config.js`, `lib/`, `iconos/` | Lo que se instala en el celular. GitHub Pages la publica en `logisitica-araujo.github.io/logistica`. **Se queda en la raíz a propósito:** si se mueve de carpeta cambia la dirección y la app instalada en los celulares deja de funcionar. |
| **El servidor** | [`apps-script/`](apps-script/) | El código de Apps Script que vive en el libro **"Logística Operaciones"** → Extensiones → Apps Script. Recibe los logins, cierres y traspasos y los guarda en las hojas `APP_*`. |
| **Las pruebas** | [`pruebas/`](pruebas/) | Un simulador de Apps Script para probar el servidor antes de pegarlo. Se corre con `node pruebas.js`. |

Los PDFs de pólizas y permiso de la raíz (`poliza-seguro-saveiro.pdf`, `poliza-suzuki-gixxer.pdf`, `permiso-carga-saveiro.pdf`) son los que la app enseña en **Documentación**. También se quedan en la raíz porque `APP_Documentos` los abre con esa dirección. `protocolo-entrega.pdf` no está enlazado: el protocolo que ve el gestor es el texto de `APP_Documentos`.

## El servidor, archivo por archivo

Todos se pegan en el **mismo** proyecto de Apps Script, el de "Logística Operaciones".

| Archivo | Qué hace | Versión |
|---|---|---|
| `00_CONFIG.gs` | Configuración: libro, carpetas de Drive, columnas de Operaciones, reglas. **Lleva tu CLAVE_ADMIN**: al pegarlo, vuelve a escribirla. | 3.0 |
| `01_INSTALADOR.gs` | Menú ⚙ Logística: instalar/reparar hojas, sincronizar catálogos, diagnóstico. | 1.2 |
| `02_BACKEND.gs` | Lo principal: login, sesión, vehículos, pedidos, traspasos, fotos en Drive, historial. | 3.0 |
| `03_ADMIN.gs` | La "puerta trasera" del administrador (5 toques al título del login). | — |
| `04_API.gs` | La puerta de entrada: recibe las consultas de la app (`doPost`) y el Rastreo (`doGet`). | 3.0 |
| `05_PRUEBAS.gs` | Herramienta: `revisionTotal` revisa que todo esté bien instalado. | — |
| `06_VELOCIDAD.gs` | Herramienta: `medirVelocidad` mide cuánto tarda leer Operaciones. | — |
| `07_FIRMAS.gs` | Herramienta: `listarFirmasMalGuardadas` (solo lista, no mueve nada). | — |
| `08_SYNC.gs` | El robot de cada minuto: copia los pendientes a `APP_Pedidos` y pasa los cierres a Operaciones. | 3.0 |
| `10_LIBRO_APP.gs` | Opcional: mueve las hojas `APP_*` a un libro propio y ligero (`APP_Entregas` se queda). | 3.0 |

**Uno más que va en el mismo proyecto pero se mantiene en otro lado:** `09_TRASPASOS_NUEVOS.gs` conecta la app con el **Sistema de Traspasos** (cuando el gestor escanea un folio del sistema nuevo). Vive con ese proyecto: rama `claude/hopeful-hypatia-ooxdrs`, archivo `traspasos/conexion-app-gestores/09_TRASPASOS_NUEVOS.gs`.

En ese proyecto de Apps Script también hay archivos que **no son de la app** (Rastreo, Shopify, macros, Operaciones). No se tocan desde aquí.

## Cómo se actualiza

1. Cuando haya un cambio, lo dejo aquí en GitHub y te digo **qué archivos cambiaron** (también queda escrito en el historial de abajo).
2. En GitHub abres el archivo → botón **Copy raw file** (el de los dos cuadritos, arriba a la derecha del código).
3. En Apps Script abres el archivo con el mismo nombre → Ctrl+A → pegar → Ctrl+S.
4. **Implementar → Gestionar implementaciones → lápiz → Versión nueva → Implementar.** Sin este paso la app sigue usando la versión anterior.

Instrucciones detalladas de la versión actual: [`apps-script/INSTRUCCIONES.md`](apps-script/INSTRUCCIONES.md).

## Historial de versiones

### Servidor 3.0 · App 1.8.0 (octubre 2026)
- **Sesión:** ya no se cierra a las 14 horas. Se cierra tras 72 h sin usar la app o a los 30 días. El vehículo se pide cada mañana (con su checklist).
- **App:** solo cierra la sesión si el servidor dice que expiró. Si el servidor está lento u ocupado lo dice así (no "sin señal") y abre al instante con lo último guardado.
- **Velocidad:** del login al menú, 2 viajes en vez de 4. Las fotos se suben sin bloquear a los demás gestores. "Operaciones" lo escribe el robot en segundo plano. El robot ya no bloquea, solo escribe si algo cambió y no corre de noche. El libro se abre una vez por consulta.
- **Medición:** cada consulta de más de 8 s queda en `APP_Log` como `LENTO`.
- **Escáner:** motor nuevo (lector del celular o zxing-cpp), linterna, zoom, línea roja guía y lectura por foto.
- **Pendientes:** lo que se cierra por otro lado desaparece solo de la lista del gestor.
- **Archivos que cambian:** `00_CONFIG`, `01_INSTALADOR`, `02_BACKEND`, `04_API`, `08_SYNC`; nuevo `10_LIBRO_APP`.
