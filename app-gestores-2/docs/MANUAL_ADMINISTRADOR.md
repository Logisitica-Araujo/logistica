# Manual de la administradora · App Gestores 2

> **Versión preliminar.** Describe cómo funcionará la app nueva. Cada etapa construida actualiza este manual.
> Si algo falla, la guía es [ERRORES_Y_SOLUCIONES.md](ERRORES_Y_SOLUCIONES.md).

---

## 1. Qué es cada cosa

| Pieza | Qué es | Dónde está | Quién la toca |
|---|---|---|---|
| **App del celular** | Lo que usan los gestores | `logisitica-araujo.github.io/logistica/v2/` | Nadie (se actualiza sola) |
| **App Gestores · Datos** | Archivo de Google Sheets de la app: usuarios, catálogos, cierres, bitácora | Drive › Logística › App Gestores | Tú, solo en las pestañas marcadas como editables |
| **Robot** | Código que corre cada minuto dentro de App Gestores · Datos | Extensiones › Apps Script de ese archivo | Nadie (solo se instala) |
| **API OPERACIONES** | La única que escribe en Operaciones | Proyecto "OPERACIONES · Backend" | Solo al actualizar código |
| **Logística FED 2026** | Archivo madre de la oficina (Operaciones, Datos) | Drive | La oficina, como siempre |
| **Traspasos_FADERMEX_BD** | Sistema de Traspasos | Drive | Las sucursales, desde su página |
| **Centro de control** | El mapa: inventario, enlaces, problemas, manuales | Drive › Logística › 00 Centro de control | Tú |

**La regla de oro:**
- Un **pedido** termina cuando la columna **P** de Operaciones dice ENTREGADO, PEDIDO CANCELADO o PEDIDO RETORNADO.
- Un **traspaso** termina cuando la columna **M** de `RES_Traspasos` dice ENTREGADO o ELIMINADO.

La app solo obedece a esos dos lugares. **Si algo está mal en la app, se corrige en su hoja de origen.**

---

## 2. Pestañas de App Gestores · Datos

| Pestaña | Para qué | ¿La editas a mano? |
|---|---|---|
| `APP_Config` | Reglas y textos (foto obligatoria, mensajes de WhatsApp, horario del robot) | **Sí**, solo la columna "Valor" |
| `APP_Usuarios` | Gestores y sus accesos | **Sí**, o desde Administración en la app |
| `APP_Vehiculos` | Vehículos y su tipo (moto o auto) | **Sí** |
| `APP_Motivos` | Motivos de retorno, cancelación y traspaso | **Sí**. Deben ser idénticos a la lista de "Datos" |
| `APP_Documentos` | Protocolos y PDFs del Manual | **Sí** |
| `APP_Pedidos` | Copia de pendientes que hace el robot | No |
| `APP_Cierres` | Cada entrega o no entrega y su estado | No (solo filtrar y consultar) |
| `APP_Recolecciones` | Lo escaneado | No |
| `APP_Sesiones` | Quién entró y desde qué celular | No |
| `APP_Log` | Bitácora técnica | No |
| `APP_Problemas` | Lo que el robot detecta raro (nombres desconocidos, remisiones viejas, fotos en respaldo) | Solo marcar "Resuelto" |

Las pestañas que dicen **No** están protegidas: si alguien intenta editarlas, Google avisa.

---

## 3. Gestores

### Dar de alta a un gestor
1. **Administración → Usuarios → Nuevo**, o un renglón nuevo en `APP_Usuarios`.
2. Llena:
   - **Número:** G-01, G-02… Nunca se repite ni se reutiliza.
   - **Nombre** para mostrar.
   - **Nombre en Operaciones:** **idéntico** al de la columna A de "Datos". Es lo que aparece en la columna I de Operaciones.
   - **Usuario:** corto, sin espacios. Ejemplo: `joseluis`.
   - **Rol:** Gestor.
   - **Activo:** SI.
3. **Asignar contraseña:** la app genera una temporal. Dásela **en persona**. Al entrar por primera vez, el gestor la cambia.

### Restablecer una contraseña
**Administración → Usuarios → el gestor → Restablecer contraseña.** Las contraseñas se guardan **cifradas**: nadie, ni tú, puede leerlas. Solo se pueden cambiar.

### Dar de baja
Pon **Activo = NO**. En menos de 5 minutos su app se cierra y ya no puede entrar. **No borres el renglón:** su historial depende de él.

### Celular perdido o robado
1. Activo = NO, de inmediato.
2. Restablecer contraseña.
3. Cuando tenga otro celular, Activo = SI y entra con la contraseña nueva.

---

## 4. Vehículos, motivos y documentos

- **Vehículo nuevo:** renglón en `APP_Vehiculos` con nombre, tipo (MOTO o AUTO) y placa. Debe existir también en la columna E de "Datos".
- **Checklist:** `APP_Config` → `CHECK_MOTO` y `CHECK_AUTO`, con los elementos separados por `|`.
- **Motivo nuevo:** primero en la lista de "Datos" (desde la página OPERACIONES), después igual en `APP_Motivos`. Si no coinciden, la API lo rechaza (`API-05`).
- **Documento nuevo en el Manual:** renglón en `APP_Documentos`: categoría, título, tipo (texto o enlace) y contenido o enlace al PDF.

---

## 5. Ajustes principales (`APP_Config`)

| Clave | Valor por defecto | Qué hace |
|---|---|---|
| `EXIGIR_FOTO_ENTREGA` | TRUE | Foto obligatoria al entregar |
| `EXIGIR_FIRMA_ENTREGA` | FALSE | Firma obligatoria al entregar |
| `EXIGIR_QUIEN_RECIBIO` | FALSE | Nombre de quien recibe obligatorio |
| `EXIGIR_FOTO_NOENTREGA` | TRUE | Foto obligatoria en retorno o cancelado |
| `PALABRAS_EXIGEN_FIRMA` | Efectivo, Factura, Cortes | Si el contenido trae una de estas palabras, se exigen firma y quién recibió |
| `ROBOT_HORARIO` | 6-22 | Horas en que corre el robot |
| `ROBOT_CADA_MIN` | 1 | Cada cuántos minutos corre |
| `DIAS_PARA_ALERTA` | 3 | Días sin movimiento antes de mandarlo a Problemas |
| `WA_MSG_ENTREGADO` y demás | (textos) | Mensajes de WhatsApp. Usa `{id}`, `{cliente}`, `{recibio}`, `{gestor}`, `{fecha}`, `{hora}` |
| `APP_BLOQUEADA` | FALSE | TRUE = nadie entra (mantenimiento) |

Un cambio en `APP_Config` llega a los celulares en menos de 5 minutos. No hay que publicar nada.

---

## 6. Tu día a día

**En la mañana (2 minutos):**
1. Abre la pantalla **Administración → Hoy** de la app (o `APP_Cierres` filtrado por hoy).
2. Revisa que cada gestor haya elegido vehículo.
3. Revisa **Problemas nuevos**.

**Durante el día:**
- Los pedidos se asignan como siempre, en la página OPERACIONES (método + gestor). En menos de 1 minuto le llegan al gestor con sonido.
- Para mandar otra vez un pedido retornado: **"🔁 Reenviar este pedido"** en OPERACIONES. Nunca captures otro renglón.

**En la tarde:**
- `APP_Cierres` → filtro **ERROR** o **PENDIENTE**. Debe estar vacío. Si no, busca el código en la guía de errores.
- Pedidos que el gestor sigue cargando sin moverse → aparecen en `APP_Problemas` a los 3 días.

---

## 7. Fotos y firmas

| Tipo | Carpeta | Nombre del archivo |
|---|---|---|
| Entregado | Pedidos entregados Logística (`1fGcPo7r…`) | `#16018` |
| Retorno | …Logistica RETORNO (`1aRw_0Xv…`) | `#16018` |
| Cancelado | …Logistica CANCELADO (`1tLoTzGy…`) | `#16018` |
| Firma | Firmas (`153U2PjE…`) | `#16018 FIRMA` |
| Traspaso | TRASPASOS | `C-PV-0019` |
| Respaldo | App Gestores › Respaldo fotos | Las que no se pudieron guardar en su carpeta |

**Pendiente hoy:** la carpeta **Firmas** no acepta escritura. Pide que te compartan esa carpeta como **Editor** (`DRV-01`).

---

## 8. Actualizar la app

Cuando haya una versión nueva te diré **qué archivos cambiaron**; queda escrito en `CAMBIOS.md`.

**Archivos del robot y del archivo de la app (Apps Script):**
1. GitHub → el archivo → **Copy raw file**.
2. App Gestores · Datos → Extensiones → Apps Script → el archivo con el mismo nombre → Ctrl+A → pegar → Ctrl+S.
3. **Implementar → Gestionar implementaciones → lápiz → Versión nueva → Implementar.**
4. Probar: abrir la dirección con `?ping=1`. Debe decir la versión nueva.

**La app del celular:** se actualiza sola al publicarla en GitHub. Los gestores solo cierran y abren la app.

**Si algo sale mal al actualizar:** regresa a la versión anterior (Gestionar implementaciones → Versión → la anterior). Detalles en `COD-01`.

---

## 9. Seguridad

- **Contraseñas:**
  - Las de los gestores van **cifradas** en `APP_Usuarios`.
  - Las de las cuentas de la empresa van en el administrador de contraseñas de Google, con **verificación en dos pasos**.
  - Ninguna contraseña se escribe en una hoja, un chat de grupo o el código.
- **El repositorio de GitHub es público:** nunca pegues ahí claves, PINs ni tokens. Van en **Propiedades del script** (Apps Script → Configuración del proyecto → Propiedades del script).
- **Usuario de servicio "App Gestores"** en `OPS_Usuarios`: es el que usa el robot para hablar con OPERACIONES. Si lo desactivas, el robot deja de mandar cierres (no se pierden; quedan PENDIENTES).
- **Accesos:** los gestores **no** necesitan acceso a ningún archivo de Google. Solo tú (y quien tú decidas) eres editora de los archivos.
- **Baja de personal:** Activo = NO el mismo día.

---

## 10. Dónde buscar cuando algo pasa

| Quiero saber… | Dónde |
|---|---|
| Si el robot está funcionando | `APP_Config` → "Última vuelta del robot" |
| Si un cierre llegó a Operaciones | `APP_Cierres` → columna Estado (ENVIADO ✓) |
| Por qué no llegó | `APP_Cierres` → columna "Último error" → buscar el código en la guía |
| Quién entró y cuándo | `APP_Sesiones` |
| Qué hizo un gestor | `APP_Log` filtrado por su nombre |
| Lo raro que detectó el robot | `APP_Problemas` |
| Historial de un pedido reenviado | Página OPERACIONES → Consultar → "Intentos anteriores" |
| Si Google está caído | google.com/appsstatus |

---

## 11. Documentos relacionados
- [Errores y soluciones](ERRORES_Y_SOLUCIONES.md): qué hacer si pasa esto o aquello.
- [Manual del gestor](MANUAL_GESTOR.md): para imprimir o compartir con cada gestor.
- `CAMBIOS.md`: qué cambió en cada versión.
- Centro de control (Google Sheets): inventario, enlaces y problemas numerados.
