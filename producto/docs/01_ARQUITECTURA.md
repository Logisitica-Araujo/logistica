# 01 · Arquitectura del producto

## 1. La idea en una frase
Un **traslado** es algo que sale de una **ubicación** y llega a otra, pasando por las manos de **personas identificadas**. Cada cambio de manos queda registrado y firmado.

## 2. Conceptos (vocabulario universal)
La app actual usa palabras de FADERMEX. En el producto se usan estas, y **cada cliente puede renombrarlas** (ver `04_CONFIGURACION.md`).

| Producto | Antes (FADERMEX) | Qué es |
|---|---|---|
| **Traslado** | Traspaso | Lo que se envía: folio, origen, destino, descripción, piezas |
| **Ubicación** | Sucursal / Área | Lugar que envía o recibe (sucursal, oficina, almacén, área, planta…) |
| **Grupo de ubicaciones** | "Oficinas", "Sucursal" | Agrupa ubicaciones del mismo edificio o tipo (ej. "Corporativo") |
| **Pieza** | Bulto | Cada paquete físico; una etiqueta por pieza |
| **Persona identificada** | Persona / empleado | Alguien registrado que puede entregar o recibir |
| **Portador** | Gestor | Persona identificada que **transporta**. Solo un papel, no una app |
| **Punto de resguardo** | Recepción Oficinas | Lugar intermedio donde se deja y se recoge (módulo) |
| **Envío externo** | Paquetería (Morelia) | Traslado que viaja con un tercero y una guía (módulo) |
| **Consolidado** | Caja | Varios traslados en un solo envío externo (módulo) |

## 3. Tres niveles

```
┌──────────────────────────────────────────────────────────────┐
│  EXCEPCIONES A LA MEDIDA (por cliente, se cobran aparte)       │
│  ej. integración con lista de pedidos (tipo Botican), ERP,     │
│  reglas propias ("todo lo foráneo pasa por Logística")         │
├──────────────────────────────────────────────────────────────┤
│  MÓDULOS (ya programados, se prenden/apagan en configuración)  │
│  Punto de resguardo · Envío externo · Consolidados ·           │
│  Piezas parciales · Alertas por tiempo · Evidencia · Reportes+ │
├──────────────────────────────────────────────────────────────┤
│  NÚCLEO (todos los clientes)                                   │
│  Ubicaciones · Personas · Identificación · Traslados · Folios  │
│  Etiquetas · Entregar/Recibir · Bitácora · Incidencias ·       │
│  Avisos · Búsqueda · Solicitudes · Administración · Reportes   │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Núcleo
1. **Ubicaciones y grupos**, con folio propio por ubicación (prefijo configurable).
2. **Personas identificadas** y método de identificación (credencial, No. empleado + NIP, cuenta).
3. **Crear traslado**: destino, descripción, piezas → folio + etiquetas.
4. **Entregar a portador** (escaneo + identificación del portador).
5. **Recibir** (escaneo + identificación de quien recibe; una etiqueta basta).
6. **Incidencias al recibir**: dañado, incompleto (cuántas piezas llegaron), con explicación.
7. **Bitácora** de todos los movimientos, que no se puede editar (ver seguridad).
8. **Avisos** en pantalla (nuevo, en camino, recibido, incidencia) con sonido.
9. **Búsqueda** de folio y detalle con historial completo.
10. **Solicitudes** que aprueba un administrador: cancelar, cambiar destino; edición única del contenido.
11. **Administración**: catálogos, personas, permisos, ajustes, bitácora de administración.
12. **Reportes básicos**: traslados por estado, tiempos de entrega, incidencias por ubicación.

### 3.2 Módulos
| Módulo | Para quién | Qué agrega |
|---|---|---|
| **Punto de resguardo** | Empresas con recepción, caseta, ventanilla o almacén central | Dejar / recoger en un punto intermedio; modo kiosco; centro de impresión |
| **Envío externo** | Ubicaciones en otras ciudades | Capturar paquetería y guía; estado "en paquetería"; recibir en destino |
| **Consolidados** | Quien junta varios traslados en una caja | Armar caja, etiqueta de caja, guía para todos |
| **Piezas parciales** | Envíos grandes | El portador se lleva k de N; las demás quedan pendientes con motivo |
| **Alertas por tiempo** | Todos (recomendado) | Aviso cuando algo lleva X horas sin moverse |
| **Evidencia** | Quien necesita prueba | Foto o firma en pantalla al recibir / en incidencias |
| **Reportes avanzados** | Dirección | Tablero, exportación, comparativos por periodo |

### 3.3 Excepciones a la medida ("enchufes")
El núcleo avisa en puntos fijos y una excepción se "enchufa" sin modificarlo:

| Enchufe | Cuándo se llama | Ejemplo |
|---|---|---|
| `alCrear(traslado)` | Al crear | Asignar ruta especial ("si va a Morelia, pasa por Logística") |
| `validarSalida / validarRecepcion` | Antes de mover | Regla propia de un cliente |
| `alCambiarEstado(traslado, antes, despues)` | Después de mover | Avisar a otro sistema |
| `fuentesExternas()` | Al cargar pantallas | Lista de pedidos de otro sistema (tipo Botican) |
| `sincronizar()` | Cada X minutos | Leer guías de otro sistema (tipo hoja Operaciones) |

Cada cliente tiene un archivo `Cliente_<nombre>.gs` con solo sus enchufes. Si no tiene, no hay archivo. **Lo que un cliente pide y sirve a otros se sube a módulo.**

### 3.4 Integración con la app de gestores (producto aparte)
No forma parte de este producto. Si un cliente tiene ambos, se conectan por los enchufes `alCambiarEstado` y `sincronizar()` o por un *webhook*, y ninguno depende del otro.

## 4. Estados del traslado (universal)
| Clave | En pantalla | Módulo |
|---|---|---|
| `CREADO` | Creado | núcleo |
| `CON_PORTADOR` | En camino (lo lleva …) | núcleo |
| `EN_RESGUARDO` | En punto de resguardo | Punto de resguardo |
| `ENVIO_EXTERNO` | Enviado por paquetería | Envío externo |
| `RECIBIDO_PARCIAL` | Recibido parcial | Piezas parciales |
| `RECIBIDO` | Recibido | núcleo |
| `CON_INCIDENCIA` | Recibido con incidencia | núcleo |
| `CANCELADO` | Cancelado | núcleo |

Los nombres en pantalla son configurables; las claves no.

## 5. Roles
| Rol | Qué puede |
|---|---|
| **Administrador** | Todo: configuración, catálogos, aprobar solicitudes, reportes, bitácoras |
| **Supervisor** | Ver todo y reportes; no configura ni aprueba |
| **Cuenta de ubicación** | Crear, entregar y recibir lo de su ubicación |
| **Punto de resguardo** | Pantalla de dejar / recoger (kiosco) |
| **Persona identificada** | Se identifica para entregar o recibir; no entra a la página |
| **Portador** | Persona identificada que transporta |
| **Soporte del proveedor** | Solo con permiso del cliente, con tiempo límite y registrado en bitácora |

## 6. Decisión técnica
- **Etapa pilotos:** se mantiene **Google Apps Script + Google Sheets**, instalado en el Google Workspace **del cliente**. Así los datos viven en su cuenta, cuesta casi cero operarlo y ya está probado.
- **Etapa crecimiento** (más de ~10 clientes, o clientes con más de ~50 ubicaciones): migrar a una aplicación web propia con base de datos (multi-empresa). El diseño de núcleo, módulos y enchufes se conserva para que la migración sea de "motor", no de producto.
- **Límites conocidos de la etapa piloto:** 30 usuarios guardando al mismo tiempo, Sheets lento después de ~50 mil filas (se archiva por año), sin app nativa (página instalable en el celular).

## 7. Estructura de archivos (versión producto)
```
producto/app/
  00_Producto.gs      nombre, versión, módulos disponibles
  01_Base.gs          utilidades, tablas, candado, respuesta estándar
  02_Reglas.gs        reglas de movimiento (compartidas con la página)
  03_Datos.gs         lectura y escritura de datos
  04_Seguridad.gs     identificación, hashes, sesiones, permisos, bloqueos
  05_Api.gs           funciones que llama la página
  06_Instalar.gs      creación de hojas, asistente de configuración, respaldos
  10_ModResguardo.gs  módulo Punto de resguardo
  11_ModExterno.gs    módulo Envío externo + Consolidados
  12_ModAlertas.gs    módulo Alertas por tiempo
  13_ModReportes.gs   reportes
  Cliente_Ejemplo.gs  plantilla vacía de enchufes
  App.html / Estilos.html / Index.html / Asistente.html
```
