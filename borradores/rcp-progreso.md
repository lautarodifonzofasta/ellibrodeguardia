# RCP interactiva (Code Assist) — registro de progreso

Rama: `rcp-interactiva`, creada desde `main` en 3f5767f (con abdomen agudo, Politrauma y TEC ya publicados).
Pedido completo: `borradores/prompt-rcp.md`. Fuente clínica única: `borradores/rcp-aha2025.md`.

| Fase | Estado |
|---|---|
| 0 · Inspección y plan | ✅ Cerrada (2026-09-27) |
| 1 · Perfil, motor, sesión, persistencia y tests | ✅ Cerrada (2026-09-27) |
| 2 · Pantallas del flujo completo + registro en meta.json y sw.js | ✅ Cerrada (2026-09-27) |
| 3 · Audio, vibración, Wake Lock, causas reversibles, vía aérea, capnografía, métricas de pausas | ⏳ Esperando OK del autor |

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
26. **Nota clínica** (plantilla del .md §10): "Por cada droga:", "Cierre con ROSC:" y "Cierre sin ROSC:" son instrucciones y no se escriben. Una droga dada en dosis distintas lleva una frase por dosis. El detalle del motivo de finalización se agrega si fue registrado. Los plurales quedan como en la plantilla ("1 descargas"). *Pregunta abierta: ¿ajustar el singular?*
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

Verificación de la Fase 2: `npm test` pasa 81/81. En Edge headless a 380 px, el recorrido del criterio de aceptación pasa 40/40 (con los relojes circulares): Iniciar, Box 1 sin cronómetro, FV, doble toque en "Descarga realizada" (se registra una sola), preaviso y aviso de fin de ciclo, recarga en plena RCP con "¿Continuar?", adrenalina indicada y registrada con su ventana, IV, 3ª descarga, lidocaína con rango por peso, panel de descargas, ida y vuelta a otro módulo, ROSC con confirmación, resumen, post-ROSC reservado, nota, edición auditada, copiar, offline, "RCP anterior", contraste y sin errores de consola.

### Diferencias entre `pcr.html` y el perfil AHA 2025 (para el autor; no se tocó `pcr.html`)

| Tema | `pcr.html` hoy | Perfil AHA 2025 (.md) |
|---|---|---|
| Momento del antiarrítmico | Amiodarona dentro de "Drogas (desde 2ª descarga)" | 1ª dosis en el Box 8, después de la 3ª descarga |
| Alternativa | Solo amiodarona | Amiodarona **o lidocaína** |
| Energía bifásica | "200 J bifásico" | La recomendada por el fabricante (por ejemplo, 120–200 J); si se desconoce, la máxima |
| Profundidad | "5–6 cm" | "al menos 5 cm" |
| EtCO₂ como signo de RCE | "↑ bruscamente (>40 mmHg)" | Aumento brusco, sin valor de corte absoluto |
| Vía de la adrenalina | "1 mg IV" (IO si la IV es difícil) | "1 mg IV/IO" |

## Para la Fase 3

- Audio de asistencia (voz con speechSynthesis en español más un beep con Web Audio) activado en el primer toque, con los textos `voice` del perfil, solo en las transiciones y nunca en bucle. Vibración donde exista. Ajustes ON/OFF guardados.
- Wake Lock mientras haya una RCP activa, pedido de nuevo al volver a la app.
- Panel de causas reversibles (checklist) y recordatorio en los Box 8 y 11.
- Eventos de vía aérea avanzada, capnografía y EtCO₂ (con el texto de referencia del .md §7, sin alertas automáticas).
- Métricas de pausas (duración de cada una, máxima y acumulada) en la pantalla y el resumen.
- Correr el criterio de aceptación completo de la sección 12.

## Para retomar en una conversación nueva

Leer este archivo, `borradores/prompt-rcp.md` y `borradores/rcp-aha2025.md`. Correr `npm test` y `node tools/rcp-demo.mjs`.
