# Pendientes para mañana

## 1. ✅ HECHO: botón "🧹 Limpiar para lanzamiento" (solo ese)
Va en el menú de la hoja **🔄 Traspasos**. Es para empezar de cero al lanzar la página. Hace esto:
- Pide escribir **BORRAR** para confirmar.
- Guarda una **copia completa del archivo en Drive** antes de borrar.
- Vacía los traspasos de prueba y su historial: RES_Traspasos, RES_Movimientos, RES_Escaneos, RES_Etiquetas, RES_Solicitudes, RES_Avisos, RES_Cajas e IMP_Recolecciones.
- Regresa **todos los folios a 0001**.
- Marca hasta qué fila de "Operaciones" hay datos viejos, para que un folio viejo no se confunda con uno nuevo.
- **No toca** catálogos, personas, impresoras ni ajustes. Solo lo puede usar un administrador.

El código ya existe en el commit `7ff2060`, que se revirtió. Hay que traer **solo** la limpieza; lo demás de ese commit no se usa.

## 2. Cuatro filas nuevas en CFG_Ajustes, cada una con su PDF

| # | Fila | PDF | Tono |
|---|---|---|---|
| 1 | Cómo usar la página en **Sucursales** | Manual de usuario | Claro, paso a paso, con imágenes |
| 2 | Cómo usar la página en **Oficinas y Recepción** | Manual de usuario | Claro, paso a paso, con imágenes |
| 3 | Cómo usar la página para **Administradores** | Manual de administrador | Claro, paso a paso, con imágenes |
| 4 | **Proceso implementado**: actualización / implementación en los procesos de la empresa | Documento de proceso | **Profesional, para certificaciones oficiales** |

Cada PDF explica cómo funciona y qué se hace, con las reglas actuales de la página.

El PDF 4 lleva formato de procedimiento documentado:
- objetivo, alcance, responsables, definiciones
- descripción del proceso y diagrama de flujo
- registros que genera (hojas RES_)
- controles y seguridad
- indicadores
- control de cambios y revisiones

### Preguntas para resolver antes de hacerlos
- [ ] ¿Las 4 filas solo guardan el link al PDF, o también quieres un botón **"Ayuda / Manuales"** en la página que abra el PDF de cada quien?
- [ ] ¿Dónde se guardan los PDF? Por ejemplo, una carpeta de Drive compartida con @fadermex.com.
- [ ] PDF 4: ¿la empresa tiene un formato oficial de procedimientos (código del documento, número de revisión, quién elabora, revisa y aprueba, logo)? ¿Para qué certificación es (ISO 9001, COFEPRIS, otra)?

## 3. Lunes: "Recolección pedidos BOTICAN" (vista previa aprobada)
Vista previa: `traspasos/VISTA_PREVIA_RECOLECCION_BOTICAN.html` (artifact https://claude.ai/artifact/Nczr2wfgq6M1fgPor9wkrs).

- **Nombre de la pestaña y del título:** **"Recolección pedidos BOTICAN"**. Es el único cambio que pidió; todo lo demás se queda igual.
- Pestaña nueva solo en la computadora de BOTICAN.
- **El gestor escanea su credencial**, que funciona como firma: solo se muestra su nombre.
- La lista sale de la hoja **Cat** del archivo de Operaciones, con los pedidos en estatus **ELABORADO**:
  - Columnas: Identificador, Contacto entrega, Dirección y "Pedido listo para recolección".
  - "EN ELABORACIÓN" se muestra en gris y no se puede marcar.
- Se marcan con casillas o tecleando el número. El escaneo en ráfaga llega cuando la etiqueta tenga código de barras.
- **Confirmar** genera el acuse digital **RB-0001** (gestor, fecha y hora, lista) en una hoja nueva `RES_RecoleccionesBotican` del archivo de Traspasos.
- Cada pedido aparece en la línea de tiempo con la etiqueta **BOTICAN**: "Recolectado en BOTICAN".
- Lo recolectado desaparece de la lista para que no se marque dos veces.
- La hoja **Cat** solo se lee.

**Decisiones (17 oct):**
- ✅ **Foráneos también se recolectan.** Logística define después la forma de envío.
- ✅ **Se marca en Cat al recolectar.** En la lista solo aparece lo ELABORADO (lo EN ELABORACIÓN, en gris). Lo recolectado ya no aparece.
- ✅ **Dos formas de recolectar con el mismo resultado:**
  - Computadora de Botican con la credencial del gestor.
  - **App de gestores en el celular**, con escaneo en ráfaga. Es otro conector para la app, como `09_TRASPASOS_NUEVOS.gs`.
- Recomendación: **columna nueva "Recolectado"** en Cat (gestor · fecha y hora), en lugar de escribir sobre "Estatus". Flujo: ELABORADO → RECOLECTADO → ENTREGADO.

**Preguntas que siguen abiertas:**
- [ ] ¿Cómo se llena hoy la columna **Estatus** de Cat: a mano, con un script, o con fórmula/IMPORTRANGE? Si es fórmula, **no** se escribe encima: se usa solo la columna "Recolectado".
- [ ] Código de barras en la etiqueta de Botican: la imprimen desde un Sheets propio al que Logística no tiene acceso. Hay que darle la fórmula a quien lo administre. Mientras tanto: casillas o tecleando el número.
