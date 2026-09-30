# RCP interactiva (Code Assist) — registro de progreso

Rama: `rcp-interactiva`, creada desde `main` en 3f5767f (con abdomen agudo, Politrauma y TEC ya publicados).
Pedido completo: `borradores/prompt-rcp.md`. Fuente clínica única: `borradores/rcp-aha2025.md`.

| Fase | Estado |
|---|---|
| 0 · Inspección y plan | ✅ Cerrada (2026-09-27) |
| 1 · Perfil, motor, sesión, persistencia y tests | ✅ Cerrada (2026-09-27) |
| 2 · Pantallas del flujo completo + registro en meta.json y sw.js | ✅ Cerrada (2026-09-27) |
| 3 · Audio, vibración, Wake Lock, causas reversibles, vía aérea, capnografía, métricas de pausas | ✅ Cerrada (2026-09-27) |

## Validación clínica

- **"Validado por":** Lautaro Di Fonzo (autor), 2026-09-27. Completado a pedido del autor en `borradores/rcp-aha2025.md` y copiado a `validatedBy` en `content/rcp/aha-2025-adulto.json`. Cualquier cambio futuro del .md tiene que pasar al JSON. Si alguno de los dos vuelve a tener `[REVISAR]`, el código rechaza el perfil (`assertProfileUsable`).

## Decisiones tomadas

Fase 0:
1. **Rama base:** `main`, no la rama local `modulo-abdomen-agudo` (tiene el portugués sin publicar).
2. **Ubicación:** vista nueva "Asistente de RCP" (`rcp-asistente`) en 🚨 Emergencias críticas, más un botón "Abrir asistente de RCP" arriba del módulo PCR / RCP (único cambio en `pcr.html`).
3. **`borradores/` es público**, porque GitHub Pages publica el repo entero, pero no entra al precache offline.
4. **`pcr.html` tiene su propio algoritmo con dosis:** en la Fase 2 se compara con el perfil AHA 2025 y se le marcan las diferencias al autor.

Fase 1:
5. **Salida del Box 8** (D → Box 5, ND → Box 12) y **2ª dosis de antiarrítmico** (siguiente pase por el Box 8): el autor aceptó las propuestas del .md el 2026-09-27. Se registró en el .md.
6. **Evento nuevo `VASCULAR_ACCESS`** (IV o IO), agregado con OK del autor, para que "Acceso IV/IO" se pueda registrar y deje de mostrarse.
7. **El algoritmo por Box entró en la Fase 1** con OK del autor. El perfil sintético de prueba se eliminó; los tests usan el perfil AHA real tal como lo carga la app.
8. **Estado agregado `POST_SHOCK`:** después de "Descarga realizada" y antes de reiniciar compresiones. Evita registrar dos descargas con un doble toque y mantiene la pausa abierta hasta que se reanudan las compresiones.
9. **Reanudar sin descarga** desde SHOCKABLE (por ejemplo, desfibrilador no listo) se permite, queda registrado como `withoutShock` y vuelve al Box donde se evaluó el ritmo: el algoritmo no avanza sin una descarga confirmada. *El .md no lo define; el autor puede cambiarlo.*
10. **"Considerar vía aérea avanzada y capnografía"** deja de mostrarse cuando están registradas las dos cosas (vía aérea y capnografía). *Interpretación de "una vez registradas"; el autor puede cambiarla.*
11. Los números de descarga y de dosis **se derivan** del orden cronológico de los eventos no anulados, no se guardan. Anular (`voided`) es una edición auditada.
12. **Pausas:** empiezan en "Evaluar ritmo" y terminan al reanudar. Una pausa cerrada por ROSC o por finalizar se lista, pero no suma a la máxima ni a la acumulada.
13. **Editar un evento** nunca cambia la historia de la máquina (estado, ciclo, Box). El valor anterior de un campo que no existía se guarda como `null` (o `false` para `voided`), así el historial sobrevive a una recarga.
14. **Sesiones guardadas ilegibles** se mueven a `elg-rcp-session-<modo>-corrupta` (hasta 5 copias, sin pisar las anteriores) en lugar de borrarse.
15. **Router:** las vistas pueden devolver una función de limpieza (repintado, listeners, Wake Lock), que el router llama al salir. Una navegación vieja que termina tarde o falla no toca la vista actual.
16. **Pases por Box:** la sesión cuenta cuántas veces el algoritmo entró a cada Box (`boxPasses`). Volver al Box sin descarga (punto 9) no cuenta como pase nuevo. Así la 2ª dosis de antiarrítmico no se sugiere antes de tiempo (error encontrado en la revisión y corregido).
17. **Antiarrítmico dado antes de llegar al Box 8** (fuera de secuencia): esa dosis corresponde al pase siguiente por el Box 8, y la 2ª se sugiere recién en el pase posterior. *Interpretación conservadora, porque nunca sugiere antes de lo que dice el .md; el autor puede cambiarla.*
18. **Box 2 ("FV / TV sin pulso")** se muestra junto con el Box de descarga cuando el camino pasa por él.
19. **Límite del grupo de antiarrítmicos:** después de 2 dosis del grupo, las dos drogas quedan marcadas `groupExhausted` (no se sugieren más), pero registrarlas sigue permitido.

Respuestas del autor al cierre de la Fase 1 (2026-09-27):

20. **Recordatorio "Amiodarona o lidocaína" del Box 8:** se oculta una vez completadas las 2 dosis del grupo. Está registrado en el .md §3.2 y en el perfil como `hideWhenGroupExhausted`.
21. **Texto para la 2ª dosis de la droga elegida:** "AMIODARONA 150 mg IV/IO" / "Considerar segunda dosis de amiodarona." y "LIDOCAÍNA 0,5–0,75 mg/kg IV/IO" / "Considerar segunda dosis de lidocaína.". Es una propuesta aprobada por el autor, agregada al .md §9 y al perfil como `chosenMessages`.
22. **Reanudar sin descarga** abre un ciclo nuevo de 2 min, que cuenta en el total. Confirmado.

## Verificación de la Fase 1

- `npm test`: 75/75 (22 de la app + 53 del motor de RCP, sobre el perfil AHA real).
- Dos revisiones adversariales con verificación: cumplimiento del pedido y fidelidad caja por caja al .md. La transcripción resultó literal y el comportamiento coincide con las reglas 3.2. Se corrigieron todos los hallazgos confirmados.
- Fuzzer de invariantes guiado: unas 150.000 acciones sobre todos los Boxes (hasta 7 pases por el Box 8), con recorrido de la tabla, estado coherente con el Box, indicaciones, restauración idéntica y errores tipados. Sin fallos.

## Arquitectura (Fase 1)

- `content/rcp/aha-2025-adulto.json`: perfil clínico, transcripción literal del .md (Boxes, drogas, textos de pantalla y voz, referencias, causas reversibles, plantilla de nota).
- `js/rcp/constants.js`: estados, tipos de evento, ritmos, motivos de finalización, modos.
- `js/rcp/profile.js`: valida el perfil completo y bloquea cualquier `[REVISAR]` (sin distinguir mayúsculas), datos faltantes o un grafo de Boxes inconsistente. `assertSameProfile` impide continuar una sesión con otro perfil o versión.
- `js/rcp/engine.js`: `createEngine(profile)` devuelve las acciones de la máquina de estados, puras, con `now` inyectado. Cada acción devuelve una sesión nueva. `session.box` y `session.boxEntry` guardan la posición en el algoritmo.
- `js/rcp/status.js`: `getStatus(session, profile, now)` calcula todo desde los timestamps: relojes, avisos de fin de ciclo, texto de pantalla y voz, recordatorios del Box, ventilación, ventanas e indicaciones de drogas, descargas, pausas. También `summarize`, `chronology` y `pauseStats`.
- `js/rcp/storage.js`: una clave de localStorage por modo, todo con try/catch y validación estricta al cargar.
- `js/rcp/types.js`: typedefs JSDoc.
- `js/router.js`: limpieza de vistas.
- `tools/rcp-demo.mjs`: demo en la terminal del recorrido del criterio de aceptación.
- Tests: `tests/rcp/*.test.mjs`, que corren con `npm test`.

## Máquina de estados

| Estado | Significa | Transiciones |
|---|---|---|
| IDLE | Sin sesión | iniciar → CPR_ACTIVE (Box 1) |
| CPR_ACTIVE | Compresiones en un Box de RCP | evaluar ritmo → RHYTHM_CHECK (empieza la pausa) |
| RHYTHM_CHECK | Pausa, eligiendo ritmo | D → SHOCKABLE (Box de descarga) · ND → NON_SHOCKABLE · cancelar → CPR_ACTIVE (mismo ciclo y Box) |
| SHOCKABLE | Preparar descarga | "Descarga realizada" → POST_SHOCK · reanudar sin descarga → CPR_ACTIVE (Box previo) |
| POST_SHOCK | Descarga registrada | reiniciar compresiones → CPR_ACTIVE (siguiente Box, ciclo nuevo) |
| NON_SHOCKABLE | Box 9 / 11, o la pregunta del Box 12 | continuar / "No" → CPR_ACTIVE (Box 10 u 11, ciclo nuevo) · "Sí" → ROSC |
| ROSC | Reloj detenido, resumen | — |
| ENDED | Finalizada con motivo | — |

Desde cualquier estado activo: confirmar ROSC → ROSC; finalizar con motivo → ENDED. Los eventos que no cambian el estado son: droga, acceso IV/IO, vía aérea, capnografía, EtCO₂, causa reversible y otro.

## Fase 2 (cerrada)

Archivos: `js/rcp/ui.js` (pantallas), `js/rcp/note.js` (nota clínica), bloque "MÓDULO: RCP INTERACTIVA" en `css/components.css`, vista `rcp-asistente` (tipo `rcp`) en `content/meta.json`, botón "Abrir asistente de RCP" en `pcr.html`, router, contador de módulos (67) en la portada y el README, y `sw.js` regenerado.

Decisiones de la Fase 2:
23. **Botón "Descarga"** durante las compresiones: abre el panel de descargas (lista numerada con hora y el texto de energía del .md §5). Las descargas se registran solo en el flujo del ritmo. *Decidido por el autor.*
24. **La app no se oculta** durante la RCP. Si el usuario sale a otro módulo, al volver ve "RCP en curso · ¿Continuar?". *Decidido por el autor.*
25. **RCP anterior:** al iniciar una RCP nueva, la terminada se guarda aparte (`elg-rcp-session-real-anterior`) y se puede ver desde el inicio, así no se pierde un registro por un toque.
26. **Nota clínica** (plantilla del .md §10): "Por cada droga:", "Cierre con ROSC:" y "Cierre sin ROSC:" son instrucciones y no se escriben. Una droga dada en dosis distintas lleva una frase por dosis. El detalle del motivo de finalización se agrega si fue registrado. El singular se resolvió en el punto 31.
27. **Indicación de grupo** (amiodarona o lidocaína): "Registrar" abre la lista para elegir, salvo que ya haya una droga elegida.
28. **Botones de color:** el texto usa el color del fondo de la página, con contraste medido ≥ 4,5 en los dos temas.
29. **Lidocaína:** la dosis se registra en mg. El peso es opcional y muestra el rango con una multiplicación directa, sin redondeos (70 kg → 70–105 mg).
30. **Rediseño con dos relojes circulares**, pedido por el autor con una referencia visual. Reemplaza el "reloj total dominante" del pedido; la duración total queda arriba, junto a ROSC y Finalizar.
    - **Anillo de compresiones:** se llena en el ciclo de 2 min, con una marca en el preaviso. Azul en curso, ámbar en el preaviso o en pausa (muestra el tiempo de pausa), rojo al vencer (muestra "+mm:ss"). A su lado van "Evaluar ritmo", "Descarga" y los contadores de ciclos y descargas.
    - **Anillo de la droga con intervalo en el perfil (adrenalina):** cuenta desde la última dosis hasta el máximo (5 min), con una marca en el mínimo (3 min). Azul antes, verde con la ventana abierta, rojo con la ventana superada, con los textos del .md. A su lado van "Adrenalina", "Otras drogas" y el contador de dosis.
    - Las decisiones de cada estado (ritmo, descarga, reiniciar) aparecen arriba de los anillos.
    - De la referencia **no** se tomó lo que no está en el pedido (metrónomo, fracción de compresión, gestos de doble toque): queda para decidir con el autor.
31. **Singular en la nota:** "Se realiza 1 descarga" y "(1 ciclo)". Agregado al .md §10 como regla y al perfil como `noteTemplate.singular`. *Decidido por el autor.*
32. **Extras para la Fase 3**, pedidos por el autor: **metrónomo** (beep a ritmo de compresiones, ON/OFF, con el valor tomado del .md §6: 100–120/min) y **fracción de compresiones** (% del tiempo con compresiones, calculado con las pausas registradas, en el reloj de compresiones). El gesto de doble toque no se agrega.
33. **`pcr.html` se alinea con el perfil AHA 2025 en una rama aparte** (`pcr-aha2025`, desde `main`), para que el autor lo valide antes de publicar. *Decidido por el autor.*

Verificación de la Fase 2: `npm test` pasa 81/81. En Edge headless a 380 px, el recorrido del criterio de aceptación pasa 40/40 (con los relojes circulares): Iniciar, Box 1 sin cronómetro, FV, doble toque en "Descarga realizada" (se registra una sola), preaviso y aviso de fin de ciclo, recarga en plena RCP con "¿Continuar?", adrenalina indicada y registrada con su ventana, IV, 3ª descarga, lidocaína con rango por peso, panel de descargas, ida y vuelta a otro módulo, ROSC con confirmación, resumen, post-ROSC reservado, nota, edición auditada, copiar, offline, "RCP anterior", contraste y sin errores de consola. *(El Box 1 tiene reloj desde el punto 48.)*

### Diferencias entre `pcr.html` y el perfil AHA 2025 (para el autor; no se tocó `pcr.html`)

| Tema | `pcr.html` hoy | Perfil AHA 2025 (.md) |
|---|---|---|
| Momento del antiarrítmico | Amiodarona dentro de "Drogas (desde 2ª descarga)" | 1ª dosis en el Box 8, después de la 3ª descarga |
| Alternativa | Solo amiodarona | Amiodarona **o lidocaína** |
| Energía bifásica | "200 J bifásico" | La recomendada por el fabricante (por ejemplo, 120–200 J); si se desconoce, la máxima |
| Profundidad | "5–6 cm" | "al menos 5 cm" |
| EtCO₂ como signo de RCE | "↑ bruscamente (>40 mmHg)" | Aumento brusco, sin valor de corte absoluto |
| Vía de la adrenalina | "1 mg IV" (IO si la IV es difícil) | "1 mg IV/IO" |

## Fase 3 (cerrada)

Archivos nuevos: `js/rcp/cues.js` (qué avisos corresponden, puro), `js/rcp/assist.js` (voz, beep, metrónomo, vibración, Wake Lock), `js/rcp/settings.js` (ajustes guardados), `tests/rcp/cues.test.mjs`. Se modificaron `js/rcp/ui.js`, `status.js`, `profile.js`, `css/components.css`, el perfil (paneles de los recordatorios, metrónomo, dispositivos de vía aérea) y el .md (metrónomo como parámetro de interfaz).

Decisiones de la Fase 3:
34. **Botón RCE:** "Otro evento" se reemplazó por un botón grande "RCE · Retorno de la circulación espontánea", con la misma confirmación de siempre. Arriba hay un RCE compacto en una barra fija, así queda siempre accesible. Las etiquetas de la interfaz dicen "RCE"; los textos del .md ("✅ ROSC", "¿SIGNOS DE ROSC?") no se tocaron. *Pedido por el autor.*
35. **Eventos con nombre propio**, en lugar de "Otro evento": Acceso IV/IO · Vía aérea / CO₂ · Causas reversibles · Nota. Los recordatorios del Box con panel (`panel` en el perfil: access, airway, causes) resaltan su botón, por ejemplo "Causas reversibles" en los Box 8 y 11.
36. **Avisos** (`cues.js`): cada aviso tiene una identidad (mensaje o alerta de fin de ciclo + ciclo + Box, o indicación + dosis) y suena **una sola vez**, nunca en bucle.
    - El preaviso lleva 1 beep y vibración corta.
    - El fin de ciclo lleva 3 beeps y vibración larga.
    - Las demás transiciones van solo con voz, con el texto `voice` del perfil.
    - Al reabrir o recargar a mitad de la RCP no se repite el pasado: solo suena, al tocar "Continuar", el aviso vencido en ese momento.
    - Al volver de segundo plano, suena una vez lo que venció mientras tanto.
37. **Audio:** voz en español (prefiere es-AR) con beep por Web Audio. Se habilita en cada toque, algo necesario en iPhone. Sin soporte, esa parte se omite sin error.
38. **Metrónomo:** 100, 110 o 120/min, dentro del rango de la §6, con 110 por defecto. Suena solo durante las compresiones (se detiene en las pausas), va apagado por defecto y el reloj de Web Audio lo mantiene estable. *110/min por defecto confirmado por el autor el 2026-09-27.*
39. **Fracción de compresiones:** 1 − pausas contadas / tiempo total, en vivo en el reloj de compresiones y en el resumen, sin umbrales ni alertas. *Pedida por el autor.*
40. **Métricas de pausas:** cantidad, máxima y acumulada debajo de los contadores; en el resumen, además, la duración de cada una.
41. **Vía aérea:** los dispositivos salen del .md §7 (intubación endotraqueal o dispositivo supraglótico). Se pueden registrar la capnografía y valores de EtCO₂, y se muestra el texto de referencia "solo informativo, sin alertas automáticas".
42. **Causas reversibles:** checklist de la §8. Una causa marcada queda con su hora y no bloquea el flujo; se corrige desde la cronología.
43. **Ajustes:** audio y vibración activados por defecto y metrónomo apagado, guardados en `elg-rcp-settings`. Se accede desde el inicio y desde el botón 🔊 de la barra fija.
44. **Wake Lock:** se pide mientras haya una RCP activa en pantalla, se vuelve a pedir al volver a la app y se libera al terminar o al salir del asistente.
45. **Borrar y descartar** (pedido por el autor al probar): el resumen tiene "Borrar esta RCP del dispositivo" y "RCP en curso · ¿Continuar?" tiene "Descartar esta RCP". Los dos piden confirmación y avisan que no se puede deshacer (sugieren copiar la nota antes). Borrar la actual no toca "la RCP anterior", y al revés tampoco. Una corrección hecha sobre la RCP anterior se guarda en ese mismo registro.
46. **Confirmación visible al registrar** (el autor probó "Nota → Registrar" y no vio cambios en pantalla): cada evento que no cambia la pantalla (droga, IV/IO, vía aérea, capnografía, EtCO₂, causa, nota) muestra 3 s abajo "✓ Registrado: … · hora", y una corrección muestra "✓ Corrección guardada". La pantalla activa suma "Registro" con los últimos 4 eventos y "Ver registro completo", que se puede corregir durante la RCP.
47. **Ajustes del autor al probar (2026-09-28):**
    - **Metrónomo estable.** Antes lo programaba un temporizador de JavaScript, que se atrasaba o salteaba golpes cuando la página estaba ocupada. Ahora es un sonido de un golpe que se repite en bucle (60/110 s), y el reloj de audio del teléfono lleva el tiempo. El audio se reactiva en cada toque y al volver a la app (incluido el estado "interrumpido" del iPhone tras una llamada o con la pantalla bloqueada).
    - **Interruptores legibles.** Los ajustes muestran el nombre, "Activado" o "Desactivado" y un interruptor, en vez de "MetrónomoON". Se corrigió además el orden del CSS: los estilos base de los botones estaban declarados después de sus variantes y las pisaban (por eso la grilla de 100/110/120 salía 2 + 1).
    - **Sin pantalla "INICIAR RCP".** El asistente abre directo en los dos relojes en cero ("sin iniciar", "sin dosis"), con el texto "Tocá «Iniciar compresiones» una vez evaluados el pulso y la ventilación." y el botón **Iniciar compresiones**. RCE, Finalizar y los eventos aparecen recién al iniciar. El texto está en el .md §9 y en el perfil (`startHint`). "RCP en curso · ¿Continuar?" no cambia.
48. **Preaviso de 15 s** (el autor reportó que no andaba, 2026-09-30). En tiempo real, sin adelantar el reloj, el preaviso sí funcionaba en los ciclos cronometrados: a 1:45 aparecía en ámbar, con 1 beep, voz y vibración. Lo probé en los Box 4 y 10, con y sin metrónomo, y con una ventana abierta. No aparecía en el primer ciclo, porque el Box 1 estaba sin reloj según el .md ("no espera 2 min").
    - **Decisión del autor (2026-09-30):** el Box 1 también tiene reloj de 2 min, con preaviso a 1:45 y alerta a 2:00, como red de seguridad si el monitor tarda. La nota "Primer control de ritmo: apenas está conectado el monitor/desfibrilador; no espera 2 min" sigue visible durante el primer ciclo. Se registró en el .md §2.
    - **Error corregido:** "Reanudar sin descarga" después del primer control volvía al Box 1 con un ciclo sin reloj, contra el punto 22. Ahora todo ciclo que se abre al reanudar tiene reloj.
    - **Error corregido:** si se tocaba "Evaluar ritmo" antes de tiempo y después "Cancelar", la alerta de los 2:00 no sonaba, porque compartía el identificador con el aviso de "Evaluar ritmo". Ahora las alertas de fin de ciclo tienen su propio identificador. Una vez que sonó la alerta de los 2:00, tocar "Evaluar ritmo" no repite la voz.

Verificación de la Fase 3:
- `npm test` pasa 93/93.
- En Edge headless a 380 px pasan dos pruebas: el flujo completo, 40/40, y la **aceptación de la §12**, 35/35 (con los ajustes del punto 47: pantalla inicial con relojes, interruptores y un solo bucle de metrónomo a 60/110 s que se detiene al evaluar el ritmo). Borrar/descartar pasa 13/13 y la confirmación al registrar, 10/10. La de aceptación recorre: abrir, iniciar, reloj, fin de ciclo con aviso, evaluar ritmo, FV, descarga, reiniciar, siguiente ciclo, adrenalina, otra descarga, RCE, resumen, cronología y nota, con recarga en plena RCP y offline. Además verifica:
  - cada voz una sola vez, sin bucle con el ciclo vencido, y solo el aviso vencido después de una recarga;
  - la vibración y el metrónomo (110/min, con pausa en la evaluación del ritmo);
  - el Wake Lock pedido, vuelto a pedir y liberado;
  - los paneles, la ventilación que cambia con la vía aérea, el resaltado en el Box 8 y "audio OFF" sin voz;
  - el resumen con pausas y fracción, sin desbordes y sin errores de consola.

## Pendientes

- **Autor:** revisar el asistente completo antes de publicarlo. La rama `pcr-aha2025` (PCR / RCP alineado con el perfil) fue validada por el autor el 2026-09-27 y se publica por su propio PR.
- **Fuera de esta versión** (según el pedido): modo simulación (el campo `mode` ya existe), cuidados post-RCE, otros perfiles (ERC) y pediatría.

## Para retomar en una conversación nueva

Leer este archivo, `borradores/prompt-rcp.md` y `borradores/rcp-aha2025.md`. Correr `npm test` y `node tools/rcp-demo.mjs`.
