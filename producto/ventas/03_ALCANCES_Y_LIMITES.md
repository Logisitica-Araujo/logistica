# 03 · Alcances, límites y márgenes de error

Decirlo claro desde el inicio evita reclamos. Esta información va en la presentación (versión corta) y en el contrato.

## 1. Lo que el sistema SÍ garantiza
- Que cada movimiento registrado tiene **quién, cuándo, dónde y desde qué equipo**.
- Que una persona solo puede identificarse con **su** credencial o NIP (salvo que la preste).
- Que un registro no se puede borrar sin dejar rastro (cancelación con motivo; bitácora que detecta alteraciones).
- Que el mismo folio no se puede tomar dos veces al mismo tiempo.

## 2. Lo que NO puede garantizar (y cómo se reduce)
| Límite | Por qué | Cómo se reduce |
|---|---|---|
| Que el **contenido** del paquete sea lo que dice la descripción | El sistema registra lo que la persona declara | Descripción obligatoria; foto de evidencia (módulo); incidencia al recibir |
| Que se escanee **cada pieza** | La etiqueta trae el folio; una lectura registra todas las piezas | Al recibir se confirma el número de piezas; incidencia "incompleto" con cuántas llegaron |
| Que nadie **preste** su credencial | Es conducta de las personas | Política de uso, NIP adicional en ubicaciones sensibles, reportes por persona |
| Que algo se mueva **sin escanear** | Si nadie lo registra, el sistema no lo sabe | Alertas por tiempo: avisan lo que lleva X horas sin moverse |
| Funcionar **sin internet** | Es una página web | Se puede crear el traslado al regresar la conexión; etiquetas se reimprimen |

## 3. Márgenes técnicos (etapa Google)
| Concepto | Valor esperado |
|---|---|
| Disponibilidad | La de Google Workspace (históricamente > 99.9 %). El proveedor no controla caídas de Google |
| Tiempo de guardado | 1–4 segundos normalmente; hasta 10 s en horas de mucho uso |
| Personas guardando al mismo tiempo | Hasta ~30 simultáneas sin espera notable; arriba, aparece "sistema ocupado, reintenta" y **no se guarda nada a medias** |
| Avisos en pantalla | Llegan en ≤ 1 minuto |
| Lectura de etiquetas | Depende del lector y de la impresora; con etiqueta térmica en buen estado, > 99 % a la primera |
| Capacidad | ~5,000 traslados / mes cómodamente; archivo anual automático |
| Respaldo | Semanal; en el peor caso se pierde la configuración de hasta 7 días, **nunca** los movimientos (viven en el archivo principal) |

## 4. Errores humanos más comunes y su solución dentro del sistema
| Error | Solución |
|---|---|
| Se equivocó de destino | Solicitud "cambiar destino" → la aprueba un administrador |
| Se creó dos veces | Solicitud de cancelación con motivo |
| Error en descripción o piezas | Edición única (piezas solo antes de salir) |
| Recibió algo que no era para él | Aviso inmediato; no deja recibir lo de otra ubicación |
| Perdió su credencial | El administrador la revoca y emite otra |
