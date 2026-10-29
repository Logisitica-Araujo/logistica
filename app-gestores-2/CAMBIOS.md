# Registro de cambios · App Gestores 2

## 0.1.0 · 29-oct-2026 · Etapa 1: el archivo de la app y el inicio de sesión
- **Archivos nuevos** (proyecto de Apps Script de "App Gestores · Datos"): `00_CONFIG.gs`, `01_INSTALAR.gs`, `02_SESION.gs`, `03_API.gs`, `09_PRUEBAS.gs`.
- `INSTALAR()` crea las 11 pestañas `APP_*` con sus encabezados, configuración inicial (foto obligatoria; firma y quién recibió opcionales; palabras Efectivo/Factura/Cortes exigen firma) y los 11 motivos de la app actual. Se puede correr de nuevo para reparar: nunca borra ni duplica.
- Menú **⚙ App Gestores**: Instalar / reparar, Nuevo gestor (número G-01…, contraseña temporal), Restablecer contraseña, Dar de baja, Probar etapa 1.
- Inicio de sesión con usuario y contraseña:
  - contraseñas cifradas;
  - sesión sin caducidad;
  - baja inmediata;
  - restablecer cierra las sesiones abiertas;
  - bloqueo de 15 minutos tras 5 intentos;
  - modo mantenimiento (`APP_BLOQUEADA`).
- Acciones `login`, `cambiarClave` y `yo` del contrato. Las demás responden `APP-09` hasta la etapa 2.
- Errores con los códigos de la guía (`APP-01`, `APP-02`, `APP-07`, `APP-09`, `CEL-06`, `CAP-01`).
- Pruebas: `pruebas/pruebas.js` (45/45 en el simulador). `PRUEBA_ETAPA1()` repite lo principal dentro de tu archivo.
- **No toca** Logística FED 2026, el Sistema de Traspasos ni la app actual.
