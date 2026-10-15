# Modo kiosco: computadora de Recepción Oficinas

**Objetivo:** que la computadora del patio abra **solo** la página de Traspasos, en Recepción Oficinas, y que nadie pueda:
- salirse al navegador,
- entrar a tu Gmail o Drive,
- cambiarse a otra cuenta o a otra área.

Tu cuenta (jaraujo) queda abierta **solo dentro de Chrome** de esa computadora, y Chrome queda bloqueado para que únicamente abra la página.

Son 4 capas. Con las 4 juntas queda bien cerrado. Tiempo: unos 30 minutos, una sola vez.

---

## Capa 1: un usuario de Windows sólo para Recepción

Así nadie usa tu usuario de Windows ni ve tus archivos.

1. **Inicio → Configuración → Cuentas → Otros usuarios → Agregar cuenta.**
2. Elige **"No tengo los datos de inicio de sesión de esta persona"** y luego **"Agregar un usuario sin cuenta Microsoft"**.
3. Nombre: `Recepcion`. Ponle una contraseña que solo tú sepas.
4. Déjalo como **Usuario estándar**, NO administrador.
5. **Para que entre solo al prender:**
   1. Presiona `Windows + R`, escribe `netplwiz` y da Enter.
   2. Quita la palomita de *"Los usuarios deben escribir su nombre y contraseña"*. Si no aparece esa opción: Configuración → Cuentas → Opciones de inicio de sesión → apaga *"Solo permitir el inicio de sesión de Windows Hello"*.
   3. Elige `Recepcion` y escribe su contraseña.

## Capa 2: entrar una vez con tu cuenta y fijar Recepción

Hazlo **dentro del usuario Recepcion de Windows**, **antes** de la capa 3.

1. Abre Chrome **sin iniciar sesión en Chrome**. Si te ofrece "Activar sincronización", di que no.
2. Abre la URL de la página (la que termina en `/exec`). Google te pide entrar: usa **jaraujo@fadermex.com** y marca que recuerde el equipo.
3. En la página elige **Recepción Oficinas**. Queda guardado en esa computadora.
4. **Protege el resto de tu cuenta dentro de la página:**
   - **CAT_Areas → "PIN de entrada":** pon PIN a **TODAS** tus áreas menos REC (LOG y las demás que tengan tu correo).
   - **CFG_Ajustes → pin_administrador:** pon un PIN.
   - **CFG_Ajustes → sesion_horas_sucursal = 0:** la sesión no se cierra sola.

En Recepción **ya no aparece "Salir"**: dice 🔒 *equipo fijo*.

## Capa 3: bloquear Chrome (solo abre Traspasos)

1. Abre `recepcion_kiosco_chrome.reg` (está en esta carpeta) con el Bloc de notas.
2. En la última línea cambia `https://script.google.com/.../PEGA-AQUI-TU-ID/exec` por **tu URL real** y guarda.
3. **Doble clic** al archivo → **Sí**. Pide contraseña de administrador de Windows.
4. Cierra Chrome por completo y vuelve a abrirlo. Escribe `chrome://policy` y verás las reglas aplicadas.

**Qué queda bloqueado:**
- Gmail, Drive, YouTube y cualquier otra página.
- El modo incógnito y el modo invitado.
- Agregar otra persona o cuenta.
- Las herramientas de desarrollador.
- Las descargas.
- Guardar contraseñas.

**Qué sigue funcionando:** la página de Traspasos, el inicio de sesión de Google (por si un día pide reconfirmar) y la impresión de etiquetas.

> ⚠ Esto aplica a **todo Chrome de esa computadora**. Úsalo solo en la del patio. Para quitarlo: doble clic a `recepcion_kiosco_QUITAR.reg`.

## Capa 4: pantalla completa, sin barra, y que arranque sola

1. En el escritorio del usuario Recepcion: clic derecho → **Nuevo → Acceso directo**.
2. En "ubicación" pega esto (con **tu** URL):

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk "https://script.google.com/a/macros/fadermex.com/s/TU-ID/exec" --kiosk-printing --no-first-run --disable-pinch --overscroll-history-navigation=0
   ```

   | Opción | Qué hace |
   |---|---|
   | `--kiosk` | Pantalla completa: sin barra de direcciones, sin pestañas, sin menú. |
   | `--kiosk-printing` | Imprime las etiquetas directo, sin preguntar. |
   | `--overscroll-history-navigation=0` | Evita que un deslizamiento "regrese" de página. |

3. Nombre: `Traspasos`.
4. Presiona `Windows + R`, escribe `shell:startup` y da Enter. **Copia** ahí el acceso directo. Así, al prender la computadora, se abre solo.
5. **La etiquetadora** debe ser la **impresora predeterminada** de ese usuario de Windows, con el tamaño de etiqueta configurado en su driver.

## Si alguien la cierra (Alt + F4)

- Queda el escritorio del usuario Recepcion, que no tiene tus archivos.
- Si abre Chrome, solo carga Traspasos: Gmail y lo demás están bloqueados.
- Edge no tiene tu sesión, así que pediría tu contraseña.

Para volver a la página: doble clic al acceso directo **Traspasos**, o reiniciar.

## Cuando TÚ necesites cambiar el área de esa computadora

1. Cierra la pantalla completa con **Alt + F4**.
2. Abre Chrome normal y en la barra de direcciones escribe la dirección de la página con **/SALIR** al final:

   `https://script.google.com/a/macros/fadermex.com/s/AKfycbyEe93gdE_Sa18T8paJD182ocQ8IAUwJzVCG1MRX7uPBf-ObHvvkfHPAAQ7GRf4H1gl0Q/exec/SALIR`

3. Te lleva a la pantalla para elegir área. Escoge la que quieras; las que tienen PIN te lo piden.

Para regresarla a Recepción, abre la dirección normal (sin /SALIR) y elige **Recepción Oficinas**.

> Tip: guarda esa dirección con /SALIR como **marcador** en tu propio celular o computadora, para no tener que recordarla.

## Resumen de seguridad

| Riesgo | Cómo queda cubierto |
|---|---|
| Entrar a tu Gmail o Drive | Chrome bloqueado (capa 3) + sin barra de direcciones (capa 4) |
| Entrar como Logística u otra área | PIN de entrada por área (capa 2) |
| Entrar al Modo administrador | PIN de administrador; en Recepción ni siquiera aparece el botón |
| Cambiar de cuenta de Google | Sin agregar personas ni invitados (capa 3) |
| Ver tus archivos de Windows | Usuario estándar `Recepcion` (capa 1) |
| Que se cierre la sesión | `sesion_horas_sucursal = 0` |
