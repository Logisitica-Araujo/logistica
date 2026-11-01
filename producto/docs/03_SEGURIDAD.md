# 03 · Seguridad del producto

Objetivo: que cualquier cliente pueda confiar en que **nadie puede hacerse pasar por otra persona, nadie puede borrar huellas y sus datos son solo suyos**.

## 1. Lo que hoy falta (app de FADERMEX) y se corrige
| Hallazgo | Riesgo | Corrección en el producto |
|---|---|---|
| Códigos de credencial y NIP guardados **en texto** en las hojas | Quien abre la hoja puede copiarlos y suplantar | Se guarda solo un **hash con sal** (HMAC-SHA256 con secreto del sistema). El valor original no se puede recuperar |
| El código de la credencial se copia al traspaso (columna "Credencial") | Se repite el dato sensible en miles de filas | Se guarda el **nombre** y los **últimos 3 caracteres** (`…5cE`) |
| Cualquiera con permiso de edición en la hoja puede cambiar un movimiento | Se pueden borrar huellas | Bitácora **encadenada**: cada fila guarda el hash de la anterior; una verificación detecta cualquier cambio. Hojas protegidas: solo el script escribe |
| Sesiones de sucursal sin vencimiento (0 = nunca) | Equipo robado / compartido | Vencimiento por defecto 12 h (configurable), cierre remoto de todas las sesiones |
| Un solo secreto sin rotación | Si se filtra, se pueden fabricar sesiones | Botón "rotar secreto" (cierra todas las sesiones) |

## 2. Controles
### Identificación
- Métodos: credencial (código de barras), No. empleado + NIP, cuenta de Google del cliente.
- NIP de 4 a 6 dígitos; **5 intentos fallidos = bloqueo 15 min** (ya existe, se conserva).
- Credencial perdida: el administrador la **revoca** y emite otra; la vieja deja de funcionar al instante.
- Opcional: pedir NIP **además** de la credencial para montos o artículos de valor (por ubicación o por tipo de traslado).

### Permisos
- Rol por persona y por cuenta (ver `01_ARQUITECTURA.md §5`). Todo se valida **en el servidor**, nunca solo en la página.
- Equipos fijos (kiosco / recepción) amarrados con PIN de equipo (ya existe).
- Acceso de **soporte del proveedor**: el administrador lo habilita con fecha de caducidad; cada acción queda en la bitácora de administración.

### Integridad
- Bitácora encadenada + función "Verificar bitácora" para el administrador.
- Ninguna fila de traslados se borra: cancelar = estado `CANCELADO` con motivo y quién.
- Candado de escritura para que dos personas no tomen el mismo folio (ya existe, mejorado).

### Datos y privacidad
- Los datos viven en el **Google Workspace del cliente** (el proveedor no tiene copia).
- Datos personales mínimos: nombre, No. empleado, ubicación, puesto (opcional), correo (opcional). **No** se recaban datos sensibles.
- **Respaldo automático semanal** a una carpeta de Drive del cliente; se conservan las últimas 8 copias.
- **Retención**: traslados y bitácora se conservan 5 años por defecto (configurable); después se archivan en otro archivo.
- **Exportación completa** en Excel cuando el cliente la pida o al terminar el contrato.
- Aviso de privacidad del cliente visible desde la pantalla de identificación (enlace).

### Operación
- Registro de errores del servidor (sin datos personales).
- Procedimiento de **incidentes de seguridad**: detectar → contener (rotar secreto, revocar) → avisar al cliente en máximo 72 h → reporte por escrito (ver `legal/POLITICA_DE_SEGURIDAD.md`).
- Cambios del producto se prueban con la empresa demo antes de llegar a clientes.

## 3. Limitaciones honestas (etapa Google)
- El administrador de Google Workspace del cliente siempre puede abrir las hojas: la protección evita cambios accidentales y la bitácora encadenada **detecta** alteraciones, pero no las impide al 100 %.
- La disponibilidad depende de Google (sin SLA propio del proveedor sobre la infraestructura).
- Estas limitaciones se declaran en el contrato.
