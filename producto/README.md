# [PRODUCTO] — Control de traslados con identificación

> Nombre comercial provisional: **[PRODUCTO]**. Se reemplaza en todos los documentos cuando se registre la marca.

Plataforma web para registrar y dar trazabilidad al **traslado de cualquier cosa** (documentos, insumos, mercancía, equipo, efectivo en sobre, etc.) entre las ubicaciones de una empresa, con **identificación de cada persona** que entrega, transporta o recibe.

Cada movimiento queda firmado por alguien identificado (credencial, número de empleado + NIP o cuenta), con fecha, hora y lugar. Así la empresa siempre sabe **qué se mandó, quién lo tiene y quién lo recibió**.

Nace de la app interna "Traspasos" de FADERMEX (uso autorizado por la empresa). Esta carpeta es la **versión producto**: genérica, configurable y separada. La app de FADERMEX (`/traspasos`) no se modifica desde aquí.

## Qué NO es
- **No es la app de gestores / mensajeros** (rutas, tareas, navegación, evidencias en ruta). Esa es un producto **independiente**. Aquí el que transporta es solo una **persona identificada** con el papel de *portador*. Si algún cliente usa ambos productos, se conectan por un "enchufe" de integración (ver `docs/01_ARQUITECTURA.md`).
- No es un sistema de paqueterías ni de inventarios.

## Contenido de esta carpeta
| Ruta | Qué es |
|---|---|
| `docs/01_ARQUITECTURA.md` | Núcleo, módulos y excepciones; conceptos; roles; enchufes |
| `docs/02_INVENTARIO.md` | Cada pieza de la app actual y a dónde va (núcleo, módulo, excepción o se quita) |
| `docs/03_SEGURIDAD.md` | Controles de seguridad del producto |
| `docs/04_CONFIGURACION.md` | Todo lo que el cliente configura sin programar |
| `docs/05_FASES.md` | Plan de trabajo por fases con avance |
| `legal/` | Borradores: aviso de privacidad, términos, políticas, contrato y anexos, cotización, confidencialidad, propiedad intelectual |
| `ventas/` | Kit comercial: planes y precios, casos, límites, costos, guion, videos, publicación, presentación PDF, página web, imágenes |
| `prototipos/` | Vistas previas (HTML) para aprobar antes de programar |

## Estado
Fase 1 (diseño y documentos) en curso. Ver `docs/05_FASES.md`.

> ⚠ Los documentos de `legal/` son **borradores de trabajo**. Deben revisarse por un abogado en México antes de usarse con clientes.
