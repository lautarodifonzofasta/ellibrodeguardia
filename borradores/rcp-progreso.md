# RCP interactiva (Code Assist) — registro de progreso

Rama: `rcp-interactiva`, creada desde `main` en 3f5767f (con abdomen agudo, Politrauma y TEC ya publicados).
Pedido completo: `borradores/prompt-rcp.md`. Fuente clínica única: `borradores/rcp-aha2025.md`.

| Fase | Estado |
|---|---|
| 0 · Inspección y plan | ✅ Cerrada (2026-09-27) |
| 1 · Perfil, motor, sesión, persistencia y tests | ✅ Cerrada (2026-09-27) |
| 2 · Pantallas del flujo completo + registro en meta.json y sw.js | ⏳ Esperando OK del autor |
| 3 · Audio, vibración, Wake Lock, causas reversibles, vía aérea, capnografía, métricas de pausas | — |

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

## Para la Fase 2

- Pantallas del flujo completo (secciones 6 y 7 del pedido), con los textos de `profile.messages` y los recordatorios de `status.algorithm.actions`.
- Registro en `content/meta.json` y botón en `pcr.html`. `sw.js` se regenera con `node tools/generate-sw.mjs`.
- Nota clínica con la plantilla del perfil (`noteTemplate`), cronología y edición auditada desde la interfaz.
- Calculadora de rango de lidocaína por peso (`perKg`), sin redondeos.
- Comparar `pcr.html` con el perfil AHA 2025 y marcarle las diferencias al autor.
- Si el perfil no se puede usar (por ejemplo, una `[REVISAR]` nueva), la pantalla de inicio tiene que mostrar el motivo y no permitir iniciar.

## Para retomar en una conversación nueva

Leer este archivo, `borradores/prompt-rcp.md` y `borradores/rcp-aha2025.md`. Correr `npm test` y `node tools/rcp-demo.mjs`.
