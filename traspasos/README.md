# Traspasos FADERMEX: propuesta

Sistema para registrar, etiquetar, mover y recibir traspasos entre sucursales, áreas y subáreas.

- `prototipo.html`: prototipo navegable. Ábrelo en el navegador (no guarda datos).
- `Traspasos_FADERMEX_BD.xlsx`: estructura de la base de datos en Google Sheets. Súbelo a Drive y ábrelo con Google Sheets.

## Decisiones tomadas

- **Lugares:** Oficinas (Dirección, Logística, Compras, Medicina Magistral, Encargada de PV, Gerente General, Contabilidad, Facturación, Recursos Humanos y más), Nueva Roma, Vertiz, Doctores, Coapa, Ecatepec y Morelia (cada sucursal con PV y Rebotica), y Botican como área propia.
- **Cuentas y equipos:** PV y Rebotica comparten la cuenta de su sucursal, pero cada computadora queda fija a su área. PV no da entrada ni salida a lo de Rebotica, ni al revés.
- **Folio por área:** `NR-0001`, `NR-RB-0001`, `CONT-0001`, etc. Hay una etiqueta por bulto con código Code 128, y la reimpresión queda registrada.
- **Al recibir o entregar:** basta escanear o teclear solo el folio.
- **Estatus:** Nuevo, Recolectado por gestoría, En Logística, Enviado por paquetería, Entregado, Recibido con incidencia, El traspaso está en…, Extraviado, Eliminación solicitada.
- **Morelia:** siempre pasa por Logística y paquetería, con número de guía.
- **Administradores:** jaraujo@fadermex.com (dueño), Oramirez@fadermex.com y sistemasfed@fadermex.com, con control total. Los demás usuarios solo pueden solicitar la eliminación de un traspaso.
- **Sesión:** se cierra a las 12 h en las computadoras de sucursales y áreas.
- **Avisos:** cada área recibe aviso de traspasos nuevos para ella y de los que van en camino.
- **Backend:** Google Apps Script + Google Sheets, el mismo que usa la app de gestores.

## Pendientes

- Imagen o logo de la empresa.
- Modelo de las etiquetadoras Brother y tamaño de etiqueta.
- Correos de cada cuenta y listado de personal y credenciales.
