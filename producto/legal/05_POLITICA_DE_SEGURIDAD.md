# Política de Seguridad de la Información — [PRODUCTO]

*Última actualización: [FECHA]*

## 1. Principios
- **Los datos son del cliente** y viven en su propia cuenta de Google Workspace.
- **Mínimo necesario:** solo se piden los datos indispensables para identificar a las personas.
- **Todo deja huella:** cada movimiento queda registrado con quién, cuándo y dónde.

## 2. Controles
| Área | Control |
|---|---|
| Identificación | Credencial, No. empleado + NIP o cuenta; bloqueo tras 5 intentos fallidos |
| Credenciales | Se guardan cifradas de forma irreversible (hash con sal); nunca en texto |
| Sesiones | Firmadas digitalmente, con vencimiento y cierre remoto |
| Permisos | Por rol, validados en el servidor |
| Integridad | Bitácora encadenada que detecta alteraciones; los registros no se borran, se cancelan con motivo |
| Equipos fijos | Kiosco amarrado con PIN de equipo |
| Respaldos | Copia semanal automática en Drive del cliente (últimas 8) |
| Retención | Configurable (5 años por defecto) |
| Soporte | El proveedor solo entra con autorización del cliente, con caducidad y registro |
| Cambios | Toda actualización se prueba antes en un entorno de demostración |

## 3. Incidentes de seguridad
1. **Detección:** por alerta del sistema, reporte del cliente o del proveedor.
2. **Contención:** revocar credenciales, cerrar sesiones, rotar el secreto del sistema.
3. **Aviso:** el proveedor avisará al cliente en un máximo de **72 horas** desde que tenga conocimiento, con lo que se sepa en ese momento.
4. **Análisis y corrección**, y **reporte por escrito** al cliente.
5. El cliente, como responsable, decide y realiza las notificaciones que la ley le exija frente a los titulares.

## 4. Responsabilidades del cliente
- Dar de baja a tiempo a personas que dejan la empresa.
- Proteger las cuentas de Google con verificación en dos pasos.
- No compartir el archivo de datos fuera de su organización.

## 5. Contacto
**[CORREO_SOPORTE]**
