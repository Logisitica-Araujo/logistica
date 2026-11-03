# App Gestores 2

| Carpeta | Qué hay |
|---|---|
| **[1-SCRIPTS-PARA-PEGAR/](1-SCRIPTS-PARA-PEGAR/)** | Los archivos `.gs` que van en *App Gestores · Datos* → Extensiones → Apps Script. Un archivo de GitHub = un archivo de Apps Script con el mismo nombre. |
| **[2-MANUALES/](2-MANUALES/)** | Manual del gestor, de la administradora, errores y soluciones, puesta en marcha. |
| [3-PRUEBAS/](3-PRUEBAS/) | Pruebas automáticas (no se pegan en ningún lado). |
| [CAMBIOS.md](CAMBIOS.md) · [CONTRATO.md](CONTRATO.md) | Qué cambió en cada versión · cómo hablan el celular y el servidor. |

La app nueva de los gestores. Vive en **su propio archivo de Google Sheets** ("App Gestores · Datos") para no cargar "Logística FED 2026". Habla con Operaciones **solo** a través de la API de OPERACIONES y con el Sistema de Traspasos a través de su propia lógica.

> **Estado:** versión 0.4.0 (perfiles Gestoría, Facturación y Administrador; sonidos nuevos). Puesta en marcha: **[2-MANUALES/PUESTA_EN_MARCHA.md](2-MANUALES/PUESTA_EN_MARCHA.md)**. La app del celular está en `v2/` (raíz del repositorio). La app actual (raíz del repositorio) sigue funcionando mientras tanto.
>
> Contrato de datos: [CONTRATO.md](CONTRATO.md) · Cambios: [CAMBIOS.md](CAMBIOS.md) · Pruebas: `cd 3-PRUEBAS && node pruebas.js && node prueba-integrada.js && node prueba-perfiles.js`

## Etapas
| # | Qué | Estado |
|---|---|---|
| 1 | Archivo de la app, pestañas, usuarios e inicio de sesión | **Instalada** |
| 2 | Cambios a la API de OPERACIONES + robot + inicio, cierres y recolecciones | **Lista** (se pega el miércoles) |
| 3 | Pantallas del celular (según la vista previa aprobada) | **Lista** (`v2/`) |
| 4 | Piloto con Jose Luis; avisos con el celular bloqueado (Firebase, gratis) | Miércoles / siguiente semana |
| 5 | Cambio de todos los gestores y limpieza de "Logística FED 2026" | — |

## Documentación
| Documento | Para quién |
|---|---|
| [2-MANUALES/MANUAL_GESTOR.md](2-MANUALES/MANUAL_GESTOR.md) | Gestores: instalar, entrar, recolectar, entregar, sin señal |
| [2-MANUALES/MANUAL_ADMINISTRADOR.md](2-MANUALES/MANUAL_ADMINISTRADOR.md) | Administradora: usuarios, ajustes, rutina, actualizar, seguridad |
| [2-MANUALES/ERRORES_Y_SOLUCIONES.md](2-MANUALES/ERRORES_Y_SOLUCIONES.md) | Administradora: cada error posible, dónde recae y qué hacer |

## Las piezas
```
Celular ──► App Gestores · Datos ◄──► Robot (cada minuto) ──► API OPERACIONES ──► Logística FED 2026 (Operaciones)
                  │                         └───────────────► Traspasos_FADERMEX_BD (RES_Traspasos)
                  └──► Drive (fotos y firmas)
```

## Quién decide si algo terminó
- **Pedido:** columna P (ESTATUS) de Operaciones.
- **Traspaso:** columna M de `RES_Traspasos`.

## Vistas previas
- Pantallas de la app: https://claude.ai/artifact/TTrLxccoGtRuuV9KVyFZZW
- Sala de control (simulador): https://claude.ai/artifact/LdRmKaPcnmrNA7qv2ourqq
- Plan maestro: https://claude.ai/artifact/Acx4ZjjndmuUP5Lsg4Eu7M
