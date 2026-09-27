# RCP interactiva (Code Assist) — registro de progreso

Rama: `rcp-interactiva` (creada desde `main` en 3f5767f, con abdomen agudo, Politrauma y TEC ya publicados).

| Fase | Estado |
|---|---|
| 0 · Inspección y plan | ✅ Cerrada (2026-09-27) |
| 1 · Perfil, motor, sesión, persistencia y tests | ⏳ Esperando OK del autor |
| 2 · Pantallas del flujo completo + registro en meta.json y sw.js | — |
| 3 · Audio, vibración, Wake Lock, causas reversibles, vía aérea, capnografía, métricas de pausas | — |

## Bloqueante clínico

**Falta `borradores/rcp-aha2025.md`.** Es la única fuente permitida para el contenido clínico del perfil (secuencia, drogas, dosis, vías, intervalos, duración del ciclo, causas reversibles, textos de conducta). Hasta tenerlo, la Fase 1 usa un perfil de prueba **sintético y sin datos clínicos** (por ejemplo, "DROGA_A cada 180 s"), solo para desarrollar y testear el motor. El perfil real se transcribe del .md cuando esté; si le falta un dato o tiene [REVISAR], se frena y se avisa.

## Decisiones tomadas (Fase 0)

1. **Rama base:** `main`, no la rama local `modulo-abdomen-agudo`, que tiene el portugués sin publicar.
2. **Ubicación:** vista nueva "Asistente de RCP" (`rcp-asistente`) en 🚨 Emergencias críticas, más un botón "Abrir asistente de RCP" arriba del módulo PCR / RCP. Es el único cambio en `pcr.html`.
3. **Perfil de prueba sintético** para la Fase 1 mientras falta el .md.
4. **`borradores/` es público:** GitHub Pages publica el repo entero, así que estos .md quedan accesibles por URL. No entran al precache offline, porque el generador solo incluye css/, js/, content/, icons/, index.html y manifest.json.
5. **`pcr.html` tiene su propio algoritmo con dosis.** El asistente usa solo el perfil AHA 2025. Cuando exista el perfil real, se comparan los dos y se le marcan las diferencias al autor.

## Cómo está hecha la app (lo relevante)

- `index.html` carga un solo `js/main.js` (módulo ES). Todo entra por `import`.
- Los módulos clínicos son fragmentos HTML sin scripts. Las pantallas interactivas se dibujan con un renderer según el `type` de `content/meta.json` (`calculator` → `js/calculators/engine.js`; `drugs` → referencia de fármacos). **El asistente será un tipo nuevo, `rcp`.**
- El router (`js/router.js`) navega por `#hash` y reemplaza `#screen`, pero no avisa a la vista saliente. Hace falta un cambio mínimo: el renderer devuelve una función de limpieza (repintado, listeners, Wake Lock) que el router llama al salir.
- Las calculadoras separan datos (JSON en `content/`) de lógica pura (`js/`), con tests `node --test` que leen el JSON. El motor de RCP sigue esa separación.
- `sw.js` lo genera `tools/generate-sw.mjs`. Precachea todo css/, js/, content/, icons/; la versión es un hash del contenido y `npm test` falla si quedó desactualizado. Los archivos nuevos entran offline con solo regenerarlo.
- `localStorage` se usa con try/catch (patrón de `js/theme.js`, clave `elg-theme`).
- Reutilizable: tokens de color claro/oscuro, `.calc-result` (`show-r`/`show-a`/`show-n`), callouts `.cl`, `.card`.
- El análisis (gtag) se carga una sola vez al abrir la app. El módulo no hace peticiones de red propias.
- En la parte inferior hay elementos fijos (`#copyright-notice` y el botón de scroll) que los botones grandes del modo RCP tienen que dejar libres.

## Archivos previstos

Crear:
- `content/rcp/aha-adulto-2025.json`: perfil clínico versionado, transcripto solo del .md (Fase 1, cuando exista el .md).
- `js/rcp/types.js`: typedefs JSDoc (ResuscitationSession, ResuscitationEvent, GuidelineProfile, MedicationDefinition, MedicationAdministration, ShockEvent, RhythmCheck).
- `js/rcp/engine.js`: máquina de estados pura (sin DOM, recibe `now`).
- `js/rcp/status.js`: todo lo derivado de timestamps (relojes, avisos, ventanas de droga, pausas, resumen, cronología).
- `js/rcp/storage.js`: persistencia por modo (`real` / `simulacion`), try/catch, versión de esquema.
- `js/rcp/note.js` (Fase 2): nota clínica por plantilla.
- `js/rcp/ui.js` (Fase 2): pantallas.
- `js/rcp/assist.js` (Fase 3): voz, beep, vibración, Wake Lock.
- `tests/rcp/*.test.mjs` y `tests/rcp/fixtures/perfil-sintetico.json`.

Modificar:
- `js/router.js`: tipo de vista `rcp` y limpieza al salir.
- `content/meta.json`: entrada `rcp-asistente`.
- `css/components.css`: bloque "MÓDULO: RCP INTERACTIVA".
- `sw.js`: regenerado.
- `content/modules/pcr.html`: solo el botón "Abrir asistente de RCP".

## Máquina de estados

| Estado | Significa | Transiciones |
|---|---|---|
| IDLE | Sin sesión | iniciar → CPR_ACTIVE |
| CPR_ACTIVE | Compresiones, ciclo N corriendo | evaluar ritmo → RHYTHM_CHECK (empieza la pausa) |
| RHYTHM_CHECK | Pausa, eligiendo ritmo | desfibrilable → SHOCKABLE · no desfibrilable → NON_SHOCKABLE · cancelar → CPR_ACTIVE |
| SHOCKABLE | Preparar descarga | "Descarga realizada" → POST_SHOCK |
| POST_SHOCK (agregado) | Descarga registrada, esperando reanudar | reiniciar compresiones → CPR_ACTIVE (ciclo N+1, fin de la pausa) |
| NON_SHOCKABLE | Conducta del perfil | continuar RCP → CPR_ACTIVE (ciclo N+1) |
| ROSC | Reloj detenido, resumen | — |
| ENDED | Finalizada con motivo | — |

- Desde cualquier estado activo: confirmar ROSC → ROSC; finalizar con motivo → ENDED.
- Eventos que no cambian el estado: droga, vía aérea, capnografía, EtCO₂, causa reversible, otro.
- POST_SHOCK existe para no registrar dos descargas con un doble toque y para mantener la pausa abierta hasta que se reanudan las compresiones (métricas de pausa exactas).
- Los avisos ("prepararse", "evaluar ritmo ahora", tiempo excedido) no son estados: se derivan de `now − inicio del ciclo`. El ciclo nunca avanza solo.

## Para retomar en una conversación nueva

Leer este archivo y el pedido original. Próximo paso: Fase 1 (esperar OK del autor), con perfil sintético hasta que exista `borradores/rcp-aha2025.md`.
