# Traspasos FADERMEX: propuesta

Sistema para registrar, etiquetar, mover y recibir traspasos entre sucursales, áreas y subáreas.

- `prototipo.html`: prototipo navegable. Ábrelo en el navegador (no guarda datos).
- `Traspasos_FADERMEX_BD.xlsx`: estructura de la base de datos (ya está en Google Sheets).
- `apps-script/`: el sistema real (página + servidor) que se pega en Extensiones → Apps Script del archivo.
- `conexion-app-gestores/`: el archivo que conecta la app de gestores con el sistema nuevo.
- **`GUIA_INSTALACION.md`: paso a paso para instalarlo todo.**

## Decisiones tomadas

- **Lugares:** Oficinas (Dirección, Logística, Compras, Medicina Magistral, Encargada de PV, Gerente General, Contabilidad, Facturación, Recursos Humanos y más), Nueva Roma, Vertiz, Doctores, Coapa, Ecatepec y Morelia (cada sucursal con PV y Rebotica), y Botican como área propia.
- **Cuentas y equipos:** PV y Rebotica comparten la cuenta de su sucursal. Las salidas (crear un traspaso y entregarlo a gestor) son por área. Las entradas las puede recibir cualquier computadora de la sucursal, y la app marca en grande PARA PV o PARA REBOTICA.
- **Folio por área:** `NR-0001`, `NR-RB-0001`, `CONT-0001`, etc., sin T. Hay una etiqueta por bulto; el código de barras (Code 128) lleva solo el folio y la etiqueta dice "BULTO 2 DE 3". La reimpresión queda registrada.
- **Foto del gestor:** opcional. Si el gestor marca entregado, queda "Entregado por gestor, falta confirmar" hasta que el destino lo escanea.
- **Letra:** Nunito.
- **Al recibir o entregar:** basta escanear o teclear solo el folio.
- **Estatus:** Nuevo, Recolectado por gestoría, En Logística, Enviado por paquetería, Entregado, Recibido con incidencia, El traspaso está en…, Extraviado, Eliminación solicitada.
- **Morelia:** siempre pasa por Logística y paquetería, con número de guía.
- **Administradores:** jaraujo@fadermex.com (dueño), Oramirez@fadermex.com y sistemasfed@fadermex.com, con control total. Los demás usuarios solo pueden solicitar la eliminación de un traspaso.
- **Sesión:** se cierra a las 12 h en las computadoras de sucursales y áreas.
- **Avisos:** cada área recibe aviso de traspasos nuevos para ella y de los que van en camino.
- **Backend:** Google Apps Script + Google Sheets, en un archivo nuevo e independiente solo para traspasos.
- **Recolecciones:** al escanear, la app de gestores consulta directo el archivo de traspasos (09_TRASPASOS_NUEVOS.gs). Si el folio es un traspaso del sistema, le trae origen, destino y contenido y actualiza el estatus; si no, la app sigue igual que siempre. La hoja IMP_Recolecciones queda como respaldo opcional.

## Pendientes

- Imagen o logo de la empresa.
- Modelo de las etiquetadoras Brother y tamaño de etiqueta.
- Correos de cada cuenta y listado de personal y credenciales.
