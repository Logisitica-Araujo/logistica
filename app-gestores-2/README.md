# App Gestores 2

La app nueva de los gestores. Vive en **su propio archivo de Google Sheets** ("App Gestores · Datos") para no cargar "Logística FED 2026". Habla con Operaciones **solo** a través de la API de OPERACIONES y con el Sistema de Traspasos a través de su propia lógica.

> **Estado:** etapa 1 lista para probar (archivo de la app e inicio de sesión) → [INSTALAR_ETAPA_1.md](INSTALAR_ETAPA_1.md). La app actual (raíz del repositorio) sigue funcionando mientras tanto.
>
> Contrato de datos: [CONTRATO.md](CONTRATO.md) · Cambios: [CAMBIOS.md](CAMBIOS.md) · Pruebas: `cd pruebas && node pruebas.js`

## Etapas
| # | Qué | Estado |
|---|---|---|
| 1 | Archivo de la app, pestañas, usuarios e inicio de sesión | **Lista para probar** |
| 2 | Cambios a la API de OPERACIONES + robot + inicio, cierres y recolecciones | Siguiente |
| 3 | Pantallas del celular (según la vista previa aprobada) | — |
| 4 | Avisos con sonido, piloto con un gestor | — |
| 5 | Cambio de todos los gestores y limpieza de "Logística FED 2026" | — |

## Documentación
| Documento | Para quién |
|---|---|
| [docs/MANUAL_GESTOR.md](docs/MANUAL_GESTOR.md) | Gestores: instalar, entrar, recolectar, entregar, sin señal |
| [docs/MANUAL_ADMINISTRADOR.md](docs/MANUAL_ADMINISTRADOR.md) | Administradora: usuarios, ajustes, rutina, actualizar, seguridad |
| [docs/ERRORES_Y_SOLUCIONES.md](docs/ERRORES_Y_SOLUCIONES.md) | Administradora: cada error posible, dónde recae y qué hacer |

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
