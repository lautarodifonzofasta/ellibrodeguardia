# Desarrollo

Guía paso a paso para editar el contenido de la app, aunque no tengas experiencia programando. Para la descripción de la app en sí, ver [README.md](./README.md).

Si en algún paso te trabás, no hay drama: guardá tu pregunta y pedile una mano a quien te ayudó a armar esto. Nada de lo que hagas acá rompe la app para siempre — todo se puede deshacer.

---

## 1. Preparar tu compu (una sola vez)

Necesitás dos cosas instaladas. Si ya las tenés, saltá al paso 2.

### a) Un editor de texto para código: Visual Studio Code

Es gratis. Descargalo de [code.visualstudio.com](https://code.visualstudio.com/) e instalalo como cualquier programa (Siguiente → Siguiente → Instalar).

No uses Word ni el Bloc de notas de Windows para editar estos archivos — VS Code entiende el formato de los archivos (HTML, JSON) y te avisa con subrayado rojo si algo quedó mal escrito, antes de que sea un problema.

### b) Node.js (para poder "previsualizar" la app en tu compu)

Descargalo de [nodejs.org](https://nodejs.org/) — elegí la versión que dice **"LTS"** (es la recomendada, no la más nueva). Instalalo igual que cualquier programa.

Para confirmar que quedó instalado: abrí VS Code, andá al menú **Terminal → New Terminal** (se abre un panel abajo con fondo oscuro), escribí `node --version` y apretá Enter. Si te devuelve algo como `v20.17.0`, quedó listo.

---

## 2. Abrir el proyecto

1. Abrí VS Code.
2. Menú **File → Open Folder...** (o **Archivo → Abrir Carpeta...**) y elegí la carpeta `ellibrodeguardia` (la que tiene adentro `index.html`, `content`, `css`, etc.).
3. A la izquierda vas a ver el árbol de archivos del proyecto.

---

## 3. Ver tus cambios mientras trabajás

Cada vez que quieras ver cómo queda la app con lo que estás editando:

1. En VS Code: **Terminal → New Terminal**.
2. Escribí exactamente esto y apretá Enter:
   ```
   node tools/dev-server.mjs
   ```
3. Va a aparecer una línea como `Dev server: http://localhost:8080/`. Dejá esa terminal abierta (no la cierres) y no toques nada ahí.
4. Abrí tu navegador (Chrome, Edge, lo que uses) y andá a **http://localhost:8080** — ahí vas a ver la app corriendo con tus cambios.

Cada vez que edites un archivo y lo guardes (Ctrl+S), volvé al navegador y **recargá la página** (F5) para ver el cambio. La app no se actualiza sola.

Cuando termines por el día: volvé a la terminal y apretá Ctrl+C para apagar el servidor (o simplemente cerrá VS Code).

> ¿Por qué hace falta este paso y no alcanza con abrir `index.html` haciendo doble clic? Porque la app carga cada módulo como un archivo separado a pedido, y los navegadores no dejan hacer eso si abrís el archivo directo desde el disco (por seguridad). El servidor local resuelve eso — no instala nada raro, ni te conecta a internet, ni sube nada a ningún lado.

---

## 4. Editar un módulo clínico que ya existe

Ejemplo: vamos a editar el módulo de **Cólico renal**.

1. En el panel de archivos de VS Code, abrí la carpeta `content` → `modules` → hacé clic en `colico-renal.html`.
2. Vas a ver el texto del módulo mezclado con algunas etiquetas entre `< >` (esas etiquetas son las que le dan el formato — cajas de color, títulos, etc.).
3. Buscá con Ctrl+F el texto que querés cambiar (por ejemplo una dosis o una frase) y editalo directamente, sin tocar las partes entre `< >`.
4. Guardá con Ctrl+S.
5. Recargá `http://localhost:8080` en el navegador, navegá al módulo y confirmá que quedó como querías.

**Regla de oro:** si tenés que borrar texto, borrá solo palabras/frases, nunca un `<algo>` o `</algo>` completo (esas marcas siempre vienen de a pares — una que abre y otra que cierra). Si por error borrás una, VS Code suele subrayar en rojo la zona afectada.

**¿Cómo sé qué módulo es cuál?** El nombre del archivo es el mismo que aparece en la barra de direcciones cuando navegás a ese módulo en la app (por ejemplo, `#colico-renal`). También podés fijarte en `content/meta.json` (ver paso 5) para ver el título en español de cada uno.

---

## 5. Agregar un módulo clínico nuevo

Hacen falta dos pasos — si olvidás alguno, el módulo no va a aparecer en el menú o no se va a poder buscar.

### a) Crear el archivo de contenido

En `content/modules/`, creá un archivo nuevo con un nombre corto sin espacios ni tildes (ej: `crisis-asmatica.html`). Un punto de partida simple para copiar y pegar:

```html
<div class="cl cl-b"><div class="cl-ico">ℹ️</div><div class="cl-body"><span class="cl-title">Título breve</span>Una frase de introducción.</div></div>
<div class="card"><div class="card-body">
  <div class="sec-hd"><div class="sec-hd-lbl">Sección</div><div class="sec-hd-line"></div></div>
  <p>Acá va el contenido de esta sección.</p>
  <ul class="bullets">
    <li>Primer punto</li>
    <li>Segundo punto</li>
  </ul>
</div></div>
```

Reemplazá los textos de ejemplo por el contenido real. Si querés reproducir cajas de alerta roja/amarilla o pasos numerados como en otros módulos, lo más fácil es abrir un módulo parecido (por ejemplo `colico-renal.html`) y copiar el bloque que necesites.

### b) Registrarlo en `content/meta.json`

Abrí `content/meta.json`. Es una lista de entradas, una por módulo. Buscá una categoría parecida a la tuya (por ejemplo `"🫁 Respiratorio"`) y agregá una entrada nueva junto a las de esa categoría, copiando el formato exacto:

```json
"crisis-asmatica": {
  "title": "Crisis asmática",
  "category": "🫁 Respiratorio",
  "icon": "🌬️",
  "sub": "Texto corto opcional debajo del título"
},
```

Puntos importantes de JSON (así se llama este formato) para no romperlo:
- El texto va siempre entre comillas dobles `"así"`.
- Cada línea, salvo la última del bloque, termina con una coma `,`.
- Los `{` y `}` tienen que quedar en pares — VS Code los resalta si hacés clic al lado de uno.
- `"sub"` y `"badge"` son opcionales — podés borrar esa línea entera si no la necesitás (pero no dejes una coma de más al final del bloque).

Guardá, recargá el navegador, y el módulo nuevo debería aparecer en la categoría correspondiente del menú lateral y en el buscador (Ctrl/Cmd+K).

Esto lo deja disponible en español. Si además querés que se pueda leer en Português desde el día uno, agregalo también a `content/meta.pt-BR.json` (mismo formato) — si no lo hacés, no pasa nada: en Português va a mostrar el contenido en español con el aviso de "no traducido todavía" hasta que alguien lo traduzca (ver paso 8).

---

## 6. Editar una calculadora

Las calculadoras (`content/calculators/*.json`) también son JSON. Es seguro editar textos (el título, la explicación, las etiquetas de las opciones) — es más delicado tocar los números de puntaje, porque de eso depende el resultado que ve el médico. Si necesitás cambiar el puntaje o los umbrales de una calculadora, mejor pedile ayuda a alguien que pueda revisar los tests (`node --test tests/` debe seguir devolviendo "pass" para todas).

---

## 7. Editar la referencia de fármacos

Está en `content/drugs/` — un archivo JSON por categoría (`cardio.json`, `neuro.json`, etc.). Cada fármaco es un bloque así:

```json
{
  "name": "Nombre del fármaco (Marca)",
  "indication": "Para qué se usa",
  "dose": "Dosis y vía",
  "caution": "Qué tener en cuenta"
}
```

Para editar una dosis o agregar un fármaco nuevo, copiá el formato de uno existente en el mismo archivo y cambiá los textos, respetando las comas entre bloques.

---

## 8. Traducciones (Português y futuros idiomas)

La app hoy está en **Español** (idioma original, siempre completo) y **Português (Brasil)** (traducción). El botón ES/PT de la barra lateral cambia el idioma guardando la preferencia en el dispositivo.

### a) Cómo funciona, en criollo

Cada archivo de contenido en español tiene un "hermano" en portugués con el mismo nombre + `.pt-BR` antes de la extensión:

```
content/modules/colico-renal.html         ← español (siempre existe)
content/modules/colico-renal.pt-BR.html   ← português (opcional)
```

Si el archivo `.pt-BR` no existe todavía, la app **no se rompe ni queda en blanco**: muestra el contenido en español con un aviso arriba ("Este contenido todavía no está traducido"). Por eso no hace falta traducir todo de una — se puede ir módulo por módulo con calma.

### b) Traducir un módulo que ya existe

1. Abrí el archivo en español, por ejemplo `content/modules/colico-renal.html`.
2. Creá un archivo nuevo al lado con el mismo nombre + `.pt-BR` antes de `.html` — en este ejemplo, `content/modules/colico-renal.pt-BR.html`.
3. Copiá **todo** el contenido del archivo en español y pegalo en el nuevo archivo.
4. Traducí únicamente el texto visible. **No toques**:
   - Nada entre `< >` (nombres de etiquetas, `class="..."`, `id="..."`, `onclick="..."`) — son instrucciones para la app, no texto para el lector.
   - Números de dosis, unidades (mg, ml, mEq) y nombres de fármacos, salvo que sepas que en Brasil se usa un nombre distinto.
5. Guardá, recargá la app con el idioma en Português, y confirmá que se ve bien.

**Regla de oro:** si algo es específico de Argentina (una ley, una línea telefónica, el nombre comercial de un remedio), no lo traduzcas como si fuera universal — dejalo aclarado como argentino, o buscá el equivalente brasileño solo si estás seguro. Ante la duda, es mejor omitir un dato específico que inventar uno.

### c) Traducir una calculadora o los fármacos

Mismo mecanismo, pero son archivos JSON en vez de HTML:

- `content/calculators/calc-gcs.json` → `content/calculators/calc-gcs.pt-BR.json`
- `content/drugs/cardio.json` → `content/drugs/cardio.pt-BR.json`

Copiá el archivo entero y traducí solo los valores de texto (`"title"`, `"label"`, `"detail"`, `"indication"`, etc.) — nunca las claves (la palabra antes de los dos puntos `:`) ni los números de puntaje/dosis.

### d) Agregar la entrada en `meta.pt-BR.json`

Los títulos que aparecen en el menú lateral y el buscador salen de `content/meta.json` (español) y `content/meta.pt-BR.json` (português). Si traducís un módulo nuevo, agregá también su entrada en `content/meta.pt-BR.json`, copiando el formato de una entrada vecina y traduciendo solo `"title"` y `"sub"` (el resto — `category`, `icon`, `badge` — queda igual que en el español).

### e) Verificar que no se perdió nada

Si tenés Node instalado (ver paso 1b), podés correr un chequeo automático que compara la traducción contra el original y avisa si falta contenido:

```
node tools/migrate/verify-modules-i18n.mjs pt-BR
```

Si dice `OK` o no menciona tu archivo, está bien. Si marca una diferencia, revisá que no se haya borrado sin querer un párrafo o una fila de tabla al traducir.

### f) Agregar un idioma nuevo (no solo traducir a uno que ya existe)

Esto es un paso más técnico — pedile una mano a quien programó esto si no te sentís cómodo. En criollo, hacen falta tres cosas:

1. Agregar el idioma a la lista en `js/i18n.js` (la constante `LANGUAGES` al principio del archivo).
2. Crear `content/strings.<código>.json` y `content/meta.<código>.json` (copiando los `.json` en español y traduciendo los valores).
3. Ir traduciendo módulos/calculadoras/fármacos de a poco, igual que en (b) y (c) — no hace falta traducir todo antes de mostrar el idioma nuevo, gracias al aviso de "no traducido todavía".

---

## 9. Guardar tus cambios para siempre (GitHub)

Todo lo anterior edita los archivos en tu compu — todavía no quedó guardado en GitHub (que es donde vive la versión "oficial" que después se publica). Para eso, lo más simple para alguien sin experiencia en la terminal es **GitHub Desktop**:

1. Descargalo de [desktop.github.com](https://desktop.github.com/) e instalalo.
2. Abrilo e iniciá sesión con tu cuenta de GitHub.
3. **File → Add Local Repository** y elegí la carpeta `ellibrodeguardia`.
4. Vas a ver la lista de archivos que cambiaste. Escribí una frase corta describiendo qué hiciste (por ejemplo: "Corregí dosis de furosemida") y hacé clic en **Commit to modernize-buildless** (o la rama en la que estés).
5. Hacé clic en **Push origin** (arriba a la derecha) para subir el cambio a GitHub.

Si en algún momento la app deja de andar bien después de un cambio, en GitHub Desktop podés hacer clic derecho sobre ese cambio en el historial y elegir **Revert** para deshacerlo — nada se pierde para siempre.

---

## 10. Si algo se rompe

- La página se ve en blanco o no navega: abrí las herramientas de desarrollador del navegador (F12), pestaña **Console**, y fijate si hay un mensaje en rojo. Casi siempre indica qué archivo tiene el problema.
- Un módulo o calculadora no carga: lo más común es un error de JSON (falta una coma, comillas, o `{`/`}` sin cerrar) — VS Code suele subrayarlo en rojo apenas lo abrís.
- Agregaste un módulo nuevo pero no aparece en el menú ni en el buscador: revisá que lo hayas agregado también en `content/meta.json` (paso 5b).
- Traduciste un módulo pero en Português sigue apareciendo en español sin el aviso de "no traducido": revisá que el nombre del archivo `.pt-BR` sea exactamente igual al original (mismas mayúsculas/minúsculas, mismo nombre) y que esté en la misma carpeta.
- Cambiaste o agregaste archivos y querés que el modo offline los incluya: corré `node tools/generate-sw.mjs` y guardá el archivo `sw.js` que genera.

---

## Referencia técnica rápida

Estructura del proyecto, para quien ya tenga más experiencia:

- `index.html` — shell de la app (sidebar, barra superior, buscador)
- `css/` — estilos (tokens de tema, layout, componentes, responsive)
- `content/` — el contenido real: un archivo por módulo clínico (`content/modules/`), por calculadora (`content/calculators/`) y por categoría de fármacos (`content/drugs/`), más `meta.json` con título/categoría/ícono de cada uno. Los archivos `*.pt-BR.*` son las traducciones al português (ver paso 8) — mismo nombre, mismo formato, solo el texto cambia.
- `js/` — router, buscador, motor de calculadoras y demás lógica; `js/i18n.js` maneja el idioma actual y la lógica de "traducido / no traducido todavía"
- `manifest.json` / `sw.js` — instalación como app y funcionamiento offline
- `tools/` — scripts de desarrollo (servidor local, generación del service worker, verificación de traducciones en `tools/migrate/verify-*-i18n.mjs`)

No hay build ni dependencias: lo que está en el repo es exactamente lo que sirve GitHub Pages.
