# Contrato de datos · App Gestores 2

Qué pide y qué recibe la app del celular. Aprobado el 29-oct-2026.

## Cómo se llama
- **POST** a la dirección `/exec` de "App Gestores · Datos", con el cuerpo en texto JSON:
  `{ "accion": "...", "token": "...", ...datos }`
- **Respuesta correcta:** `{ "ok": true, ...datos }`
- **Respuesta con error:** `{ "ok": false, "codigo": "CEL-06", "mensaje": "texto para el gestor" }`
  El `codigo` es el de [docs/ERRORES_Y_SOLUCIONES.md](docs/ERRORES_Y_SOLUCIONES.md).
- **Prueba:** `GET /exec?ping=1` → `{ "ok": true, "app": "App Gestores 2", "version": "0.1.0" }`

## Acciones

| Acción | Etapa | Pide | Devuelve |
|---|---|---|---|
| `login` | **1 ✔** | `usuario`, `clave`, `dispositivo` | `token`, `nombre`, `numero`, `debeCambiar` |
| `cambiarClave` | **1 ✔** | `token`, `actual`, `nueva` (mín. 6) | `token`, `debeCambiar:false` |
| `yo` | **1 ✔** | `token` | `numero`, `nombre`, `debeCambiar`, `reglas{exigirFotoEntrega, exigirFirmaEntrega, exigirQuienRecibio, exigirFotoNoEntrega, palabrasExigenFirma[]}`, `versionServidor` |
| `inicio` | 2 | `token` | `gestor`, `vehiculo`, `checklist`, `pedidos[]`, `recolecciones[]`, `avisos[]` |
| `vehiculo` | 2 | `token`, `vehiculo`, `checklist[]` | `ok` |
| `cerrar` | 2 | `token`, `idLocal`, `tipo` (PEDIDO o TRASPASO), `id`, `fila`, `resultado` (ENTREGADO, RETORNO, CANCELADO, PAQUETERIA, NO_ENTREGADO), `motivo`, `comentario`, `recibio`, `foto` (JPEG base64, máx. 1280 px), `firma` (PNG base64, opcional), `lat`, `lng`, `horaCelular` | `idCierre` (si llega dos veces el mismo `idLocal`, devuelve el mismo `idCierre` y no duplica) |
| `recolectar` | 2 | `token`, `codigos[]` | `resultados[]{codigo, tipo (PEDIDO, TRASPASO u OTRO), ok, origen, destino, contenido, mensaje}` |
| `problema` | 2 | `token`, `id`, `tipo`, `solucion` | `ok` |
| `documentos` | 2 | `token` | `documentos[]` |

Hasta su etapa, las acciones 2 responden `codigo: "APP-09"` ("llega en la siguiente versión").

## Reglas
- **El celular nunca habla con Logística FED 2026 ni con el Sistema de Traspasos.** Solo con este archivo.
- **La sesión no caduca.** Se cierra con:
  - "Cerrar sesión" en el celular,
  - `Activo = NO` (baja), o
  - "Restablecer contraseña" (sube `VersionSesion`).
- **Contraseñas cifradas** (HMAC-SHA256 con sal secreta, 300 vueltas). La sal vive en Propiedades del script, no en el código.
- **5 intentos fallidos** bloquean ese usuario 15 minutos. Mismo mensaje si el usuario no existe o la contraseña está mal.
- **Quién decide si algo terminó:**
  - Pedido: columna P de Operaciones (la lee el robot por la API de OPERACIONES).
  - Traspaso: columna M de `RES_Traspasos` (la lee el robot directo, por ID).

## Pestañas del archivo
Ver `APPG.ENC` en [apps-script/00_CONFIG.gs](apps-script/00_CONFIG.gs). El código busca las columnas por **nombre**: se pueden reordenar, pero no renombrar.

## Cambios aprobados a la API de OPERACIONES (etapa 2)
1. `estado`: el Gestor puede marcar también retornado y cancelado (con motivo), **solo en renglones con su nombre en la columna I**.
2. `cierreGestor` (nueva): anota el cierre en `APP_Entregas` para que las fórmulas Q y V de Operaciones sigan funcionando.
3. `recoleccion` (nueva): anota el evento en `APP_Traspasos_Hist` para que ESTATUS diga "RECOLECTADO POR GESTOR".
4. Rol **App**: usuario de servicio que actúa a nombre del gestor y lo anota en `OPS_Log`.
5. Caché de 60 s en `miRuta` y `enTransito`.
