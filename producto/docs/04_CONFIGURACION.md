# 04 · Configuración (lo que el cliente ajusta sin programar)

Todo se captura en el **Asistente de configuración** (primera vez) y después en **Administración → Configuración**. Vista previa: `prototipos/asistente.html`.

## Paso 1 · Empresa
- Nombre, logo, color principal, zona horaria.
- Palabras: cómo le dicen a un *traslado* (traspaso, envío, valija…), a una *pieza* (bulto, caja, sobre…), a un *portador* (gestor, mensajero, chofer…), a una *ubicación* (sucursal, tienda, clínica…).

## Paso 2 · Ubicaciones
- Nombre, prefijo de folio (2–5 letras), grupo (ej. "Corporativo", "Sucursales Norte"), activa sí/no.
- Banderas: **punto de resguardo** (módulo), **externa / foránea** (módulo envío externo).
- Importar desde Excel/CSV.

## Paso 3 · Personas e identificación
- Método(s): credencial, No. empleado + NIP, cuenta de Google.
- Importar personas (nombre, No. empleado, ubicación, puesto, ¿portador?, ¿administrador?).
- Al importar, las credenciales y NIP se convierten en hash y la columna original se vacía.

## Paso 4 · Módulos
Interruptores: Punto de resguardo · Envío externo · Consolidados · Piezas parciales · Alertas por tiempo · Evidencia · Reportes avanzados.

## Paso 5 · Reglas
- ¿Quién puede recibir? Solo la ubicación destino / cualquier ubicación del mismo grupo.
- ¿Se puede entregar en mano dentro del mismo grupo sin portador? sí/no.
- Tipos de incidencia y motivos de piezas que se quedan.
- Horas para alerta "sin moverse" (por defecto 36 h).
- Solicitudes: quién puede pedir cancelar o cambiar destino; si requieren aprobación.

## Paso 6 · Seguridad
- Vencimiento de sesión (cuentas de ubicación / administradores).
- NIP obligatorio además de credencial: nunca / siempre / solo ciertas ubicaciones.
- Intentos fallidos antes de bloqueo y minutos de bloqueo.
- Retención de datos (años) y respaldo semanal (carpeta).
- Enlace al aviso de privacidad del cliente.

## Paso 7 · Etiquetas e impresión
- Tamaño (50×25, 62×29, 100×50 mm), con o sin logo, texto grande del destino.
- Impresoras por ubicación / equipo de resguardo.

## Paso 8 · Listo
- Resumen, prueba de impresión, ligas para cada ubicación, manual PDF generado con sus palabras.

## Dónde se guarda
| Hoja | Contenido |
|---|---|
| `CFG_Empresa` | nombre, logo, colores, zona, palabras |
| `CFG_Modulos` | módulo → activo sí/no |
| `CFG_Reglas` | parámetro → valor |
| `CFG_Seguridad` | parámetro → valor |
| `CAT_Ubicaciones`, `CAT_Grupos`, `CAT_Personas`, `CAT_Incidencias`, `CAT_Motivos`, `CAT_Paqueterias`, `CAT_Impresoras` | catálogos |
