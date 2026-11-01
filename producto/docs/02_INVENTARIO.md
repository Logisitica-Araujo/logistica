# 02 · Inventario: de la app de FADERMEX al producto

Revisión de las ~4,800 líneas de `traspasos/apps-script/`. Cada pieza va a uno de cuatro destinos:

- **N** = núcleo · **M** = módulo · **E** = excepción (solo como ejemplo de enchufe) · **✕** = se quita

## 1. Lo exclusivo de FADERMEX (se quita del producto)
| Pieza | Dónde está | Destino |
|---|---|---|
| ID fijo del archivo de Sheets | `01_Config.gs` `TR.ID_ARCHIVO` | ✕ → el archivo que contiene el script |
| Nombre "Traspasos FADERMEX", logo, colores | `01_Config.gs`, `App.html`, `Estilos.html` | ✕ → configuración |
| Hoja **Operaciones** de la app de gestores (guías automáticas) | `TR.OPS`, `06_Cajas.gs` `sincronizarOperaciones` | **E** (ejemplo de enchufe `sincronizar()`) |
| **Botican** (lista de pedidos, pestaña, recolección) | `08_Botican.gs`, `TR.H.BOTICAN`, `App.html` | **E** (ejemplo de enchufe `fuentesExternas()`) |
| Reglas de **Morelia** (todo lo foráneo pasa por Logística, `VIA_LOGISTICA`) | `02_Reglas.gs` `viaLog/pasoLog/paraLog`, área fija `'LOG'` | **E** (ejemplo de `alCrear`) |
| Área fija `'REC'` como Recepción | `R.esPausa`, `07_Recepcion.gs` `AREA_REC` | **M** Punto de resguardo, con cualquier ubicación marcada como resguardo |
| Tipo de área `'OFICINAS'` / `'FORANEA'` | `R.esOf`, `R.esMor` | **N** grupos de ubicaciones + bandera "externa" (M Envío externo) |
| Estatus `EN_LOGISTICA`, `UBICADO`, `EXTRAVIADO`, `ENTREGADO_GESTOR` | `CAT_Estatus`, reglas | ✕ / se fusionan en los 8 estados universales |
| Correos de sucursales, propuesta, kiosco con `.reg` | archivos sueltos en `traspasos/` | ✕ (el kiosco se documenta genérico) |
| Datos reales (personas, credenciales, folios) | hoja de Sheets | ✕ **nunca se copian** |
| Manuales de FADERMEX v1.5 | `traspasos/manuales/` | se reescriben genéricos |

## 2. Lo que pasa al núcleo (se limpia y generaliza)
| Función actual | Destino | Cambios |
|---|---|---|
| `_tb` tablas por encabezado, `_conCandado`, `_api` | N `01_Base.gs` | igual |
| Áreas / sucursales / personas / gestores / administradores | N | Un solo catálogo de **Personas** con papeles (portador, admin…) en lugar de hojas separadas |
| `_identificar`, credencial, NIP, `_validarPin`, bloqueo 5 intentos | N `04_Seguridad.gs` | Guardar **hash** de credencial y NIP, nunca el valor (ver `03_SEGURIDAD.md`) |
| Tokens firmados `_crearToken/_ctx` | N | Agregar versión de sesión para poder cerrar todas las sesiones |
| `apiCrear`, folios por ubicación, etiquetas | N | Prefijo y formato de folio configurables |
| `apiConfirmarLote` (entregar / recibir) | N | Usa estados universales |
| Incidencias (`R.INCIDENCIAS`) | N | Tipos de incidencia configurables |
| Solicitudes: cancelar, cambiar destino, edición única | N | igual, con textos configurables |
| Avisos + sonidos | N | igual |
| Búsqueda y detalle con historial | N | igual |
| `RES_Movimientos` (bitácora) | N | + cadena de hashes (bitácora a prueba de alteraciones) |
| `RES_Escaneos`, `RES_Etiquetas`, `RES_Sesiones`, `RES_Administracion` | N | igual |
| Panel admin (editar, eliminar, resolver) | N | + roles Supervisor y Soporte |
| Etiquetas (sin QR, Code128 con zonas de silencio) | N | Tamaño de etiqueta configurable |
| Sugerencias "por entregar / por recibir" | N | igual |
| Reimpresiones | N | igual |

## 3. Lo que pasa a módulos
| Función actual | Módulo |
|---|---|
| `07_Recepcion.gs` dejar / recoger, kiosco, centro de impresión, alerta 36 h | **Punto de resguardo** (+ Alertas por tiempo) |
| `apiPaqueteria`, `CAT_Paqueterias`, estado PAQUETERIA | **Envío externo** (guía capturada a mano) |
| `06_Cajas.gs` armar / deshacer caja, etiqueta de caja | **Consolidados** |
| `_salidaBultos`, `R.enCamino`, `ENTREGADO_PARCIAL` | **Piezas parciales** |
| `alertarSinSalida` | **Alertas por tiempo** (generalizada a cualquier estado) |

## 4. Nuevo (no existe hoy)
| Pieza | Nivel |
|---|---|
| Asistente de configuración (alta del cliente en minutos) | N |
| Hoja de módulos activos y textos (renombrar "traslado", "pieza", etc.) | N |
| Importar personas y ubicaciones desde Excel/CSV | N |
| Hash de credenciales / NIP, migración de credenciales existentes | N |
| Bitácora encadenada + verificación | N |
| Respaldo automático semanal a carpeta de Drive del cliente | N |
| Retención y archivo por año | N |
| Exportar todo (para cuando el cliente cancela) | N |
| Aviso de privacidad visible en la pantalla de identificación | N |
| Acceso de soporte con permiso y caducidad | N |
| Reportes / tablero | N básico, M avanzado |
| Evidencia (foto / firma) | M |
| Plantilla de enchufes `Cliente_Ejemplo.gs` | E |
| Empresa demo con datos ficticios | herramienta de venta |
