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

## 3. ✅ "Recolección pedidos BOTICAN" — CONSTRUIDO (17 oct)
Código en `apps-script/08_Botican.gs` + pestaña en `App.html`. Instrucciones en la GUIA_INSTALACION ("📦 Recolección pedidos BOTICAN").
- Lee y escribe en **LOGISTICA BOTICAN 2026 → Envios** (la hoja Cat de Operaciones solo la importa).
- Al confirmar escribe el nombre del gestor en **"Recolección de Gestor" (AB)** → la fórmula de Estatus pone "🧍 RECOLECCIÓN DE GESTOR" sola.
- Acuse RB-0001 en `RES_RecoleccionesBotican` + línea de tiempo con etiqueta BOTICAN (Buscador: #15975).
- Foráneos también se recolectan.

**Siguiente:**
- [ ] App de gestores en el celular: mismo resultado (otro conector, como `09_TRASPASOS_NUEVOS.gs`).
- [ ] Código de barras en la etiqueta de Botican: la imprimen desde un Sheets propio al que Logística no tiene acceso. Hay que darle la fórmula a quien lo administre. Mientras tanto: casillas o tecleando el número.
