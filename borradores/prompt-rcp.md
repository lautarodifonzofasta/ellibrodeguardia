Módulo nuevo: RCP interactiva (Code Assist)

Este archivo es el pedido completo. Trabajamos por fases (sección 11): hacé solo la fase que te pida en cada conversación.

1. Contexto y reglas de trabajo
Trabajás sobre El Libro de Guardia (ver CLAUDE.md). La app ya funciona: no la reconstruyas ni toques otros módulos, salvo lo mínimo para registrar este.
Stack real: HTML, CSS y JS vanilla, sin build, sin TypeScript y sin frameworks. No agregues librerías; si en algún punto creés que hace falta una, preguntame antes.
Creá una rama nueva, rcp-interactiva, desde la rama actual, y hacé un commit al cerrar cada fase.
Si algo de este pedido choca con lo que encontrás en el código, avisame antes de decidir.
Llevá un registro en borradores/rcp-progreso.md: qué se hizo, qué falta y las decisiones tomadas. Actualizalo al cerrar cada fase, para que una conversación nueva pueda retomar desde ahí.
2. Qué es este módulo

Un asistente cognitivo y registrador para el paro cardíaco del adulto: guía paso a paso, cronometra los ciclos, avisa cuándo evaluar el ritmo, registra cada intervención y arma el resumen al final.

No decide, no interpreta el ECG y no controla ningún equipo.

Filosofía de uso: una pantalla → una acción → una decisión → siguiente paso. Durante la RCP, el usuario casi no tiene que leer.

3. Seguridad clínica (no negociable)
Todo el contenido clínico sale solo de borradores/rcp-aha2025.md: secuencia del algoritmo, en qué momento corresponde cada droga, drogas, dosis, vías, intervalos, duración del ciclo, causas reversibles y todo texto de pantalla o de voz que indique una conducta.
Si ese archivo no existe, falta un dato o aparece [REVISAR]: frená y avisame. Nunca completes nada de memoria.
Un perfil por guía, versionado (hoy: AHA 2025 adulto; más adelante ERC u otros). Nunca mezclar perfiles.
La lógica clínica vive en el perfil y en el motor, nunca en la interfaz.
Nada se registra como hecho si el usuario no lo confirmó. Una descarga existe solo si tocó "Descarga realizada", aunque el algoritmo la indique.
Sin inferencias clínicas automáticas a partir de datos incompletos.
Mostrar siempre el nombre y la versión del perfil activo (hoy: AHA Adulto · 2025).
4. Arquitectura

Capas separadas: perfil clínico (datos) → motor (máquina de estados) → sesión y registro de eventos → persistencia → interfaz.

Máquina de estados real, con transiciones explícitas; no una sucesión de pantallas sueltas. Estados mínimos: IDLE, CPR_ACTIVE, RHYTHM_CHECK, SHOCKABLE, NON_SHOCKABLE, ROSC, ENDED. Agregá los que necesites, justificándolos.
Motor en JS puro: sin DOM, y recibe la hora (now) como parámetro. Así se testea en Node sin simular timers.
Tipos documentados con JSDoc: ResuscitationSession, ResuscitationEvent, GuidelineProfile, MedicationDefinition, MedicationAdministration, ShockEvent, RhythmCheck.
La sesión incluye mode: "real" | "simulacion" y se guarda por separado según el modo. La simulación queda para más adelante, pero el campo va desde ahora.
Ubicación de archivos: seguí la estructura real del repo y proponela en la Fase 0.
5. Tiempo, persistencia y offline (crítico)
La fuente de verdad son los timestamps: tiempo transcurrido = now − hora del evento. setInterval o requestAnimationFrame sirven solo para repintar la pantalla.
Guardá la sesión en localStorage en cada evento, con try/catch.
Si al abrir el módulo hay una sesión activa, mostrá "RCP en curso · ¿Continuar?" con los tiempos recalculados.
Mantené la pantalla encendida con Wake Lock mientras haya una RCP activa, y volvé a pedirlo al regresar a la app. Si el navegador no lo soporta, seguí sin error.
Con la pantalla bloqueada o la app en segundo plano, el navegador frena los avisos. Al volver, recalculá todo y mostrá cualquier aviso que haya vencido.
Offline total: el módulo no hace ninguna petición de red. Agregá los archivos nuevos al precache de sw.js y subí su versión de caché; si no, el módulo no funciona sin conexión.
6. Flujo
Inicio: "Paro cardiorrespiratorio · Adulto · AHA 2025", botón grande INICIAR RCP y una sola línea de advertencia: "Herramienta de apoyo cognitivo. No reemplaza entrenamiento ni criterio clínico."
Al iniciar: crear la sesión, registrar CPR_STARTED y arrancar el reloj total y el ciclo 1.
RCP activa (la pantalla más importante):
Reloj total dominante.
Ciclo N, con mm:ss / duración del ciclo.
Próximo evento ("Evaluar ritmo en 00:23") y ventana de medicación.
Botones grandes: Evaluar ritmo · Administrar droga · Descarga · Otro evento.
ROSC y Finalizar, siempre accesibles.
Métricas discretas: ciclo, descargas, dosis de cada droga, pausa actual.
Fin de ciclo: preaviso "Prepararse para evaluar ritmo" y, al llegar, "DETENER COMPRESIONES · EVALUAR RITMO", con aviso visual más sonido, voz y vibración si están activados.
Evaluar ritmo: dos botones enormes: ⚡ Desfibrilable (FV / TV sin pulso) y 🔵 No desfibrilable (AESP / asistolia). Registrar RHYTHM_CHECK con ritmo, hora y ciclo.
Rama desfibrilable: "Preparar descarga" → botón DESCARGA REALIZADA → SHOCK_DELIVERED (hora, ciclo, número de descarga) → "Reiniciar compresiones" → ciclo nuevo. Lo que corresponda en cada punto, según el perfil.
Rama no desfibrilable: la conducta que indique el perfil → "Continuar RCP" → ciclo nuevo.
Medicación: botón permanente con las drogas del perfil más "Otra". Cada administración registra droga, dosis, vía, número de dosis, ciclo y hora. Por droga, mostrar las dosis dadas con su hora, el tiempo desde la última y la próxima ventana según el intervalo del perfil. El usuario nunca tiene que contar dosis.
Descargas: lista numerada con la hora de cada una.
Causas reversibles: panel con la lista del perfil como checklist rápida. Registra REVERSIBLE_CAUSE_IDENTIFIED y no bloquea el flujo.
Eventos opcionales: vía aérea avanzada, capnografía, valor de EtCO₂ y "Otro" (texto breve más hora). Ninguno es obligatorio.
ROSC: disponible siempre, con confirmación ("Confirmar retorno de circulación espontánea": Cancelar / Confirmar). Registra ROSC_CONFIRMED, detiene el reloj y muestra el resumen. Incluye una sección "Cuidados post-ROSC" como espacio reservado, claramente marcado y sin contenido clínico.
Finalizar sin ROSC: pedir motivo (Decisión clínica, Derivación, Fallecimiento, Otro). Fallecimiento pide confirmación. Registra CPR_STOPPED.
7. Registro, cronología y nota
Tipos de evento explícitos: CPR_STARTED, CPR_PAUSED, CPR_RESUMED, RHYTHM_CHECK, SHOCK_DELIVERED, MEDICATION_GIVEN, AIRWAY_PLACED, CAPNOGRAPHY_STARTED, ETCO2_VALUE, REVERSIBLE_CAUSE_IDENTIFIED, ROSC_CONFIRMED, CPR_STOPPED, OTHER.
Pausas: empiezan al evaluar el ritmo y terminan al reiniciar las compresiones. Calcular la duración de cada una, la máxima y la acumulada.
Cronología al finalizar: hora real más tiempo desde el inicio de cada evento.
Edición: se puede corregir la hora o el dato de un evento, pero nunca en silencio. Guardar editedAt y el valor anterior, y marcar el evento como editado.
Resumen: duración total, ciclos, descargas, dosis por droga, ROSC sí/no y su hora.
Nota clínica: texto editable armado con una plantilla a partir de los eventos registrados, sin IA y sin agregar nada que no esté en el registro. Con botón para copiar.
8. Audio y vibración
Ajustes guardados: Audio de asistencia (ON/OFF) y Vibración de asistencia (ON/OFF).
Voz con speechSynthesis en español, más un beep de respaldo con Web Audio. Activá el audio en el primer toque (INICIAR RCP): en iPhone no suena si no hubo interacción previa.
Mensajes cortos, solo en las transiciones y nunca en bucle.
Vibración con navigator.vibrate cuando exista; si el navegador no la soporta (por ejemplo, Safari en iPhone), seguir sin error.
9. Diseño
Usá el sistema visual existente (tokens y componentes); que no parezca otra app.
Modo RCP: alto contraste, tipografía grande, botones grandes y fáciles de tocar con guantes, mínima navegación. Sin animaciones ni decoración.
Lo secundario, discreto: nada que compita con el reloj y la acción actual.
Verificá que todo entre en un celular de 380 px de ancho.
10. Tests

Con node --test, sin dependencias, sobre el motor y con now inyectado. Cubrir como mínimo:

inicio · fin de ciclo y aviso · evaluación de ritmo · rama desfibrilable · descarga y reinicio · rama no desfibrilable · drogas y su repetición según el perfil · varios ciclos · pausas · ROSC · finalización con motivo · restauración de la sesión (serializar y recuperar) · edición de evento con historial · orden cronológico.

11. Fases
Fase 0 · Inspección y plan, sin escribir código. Contame cómo se cargan los JS, cómo están hechos los módulos y las calculadoras, cómo funciona sw.js y qué se puede reutilizar. Proponé la lista de archivos a crear y modificar, y la máquina de estados (estados y transiciones).
Fase 1 · Perfil, motor, sesión, persistencia y tests. Sin interfaz, salvo lo mínimo para probar.
Fase 2 · Pantallas del flujo completo (secciones 6 y 7), más el registro en meta.json y en el service worker.
Fase 3 · Audio, vibración, Wake Lock, causas reversibles, vía aérea y capnografía, y métricas de pausas.
Fuera de esta versión (dejar solo preparado): modo simulación, cuidados post-ROSC, otros perfiles (ERC) y pediatría.

Al cerrar cada fase: actualizá borradores/rcp-progreso.md, hacé el commit, pasame el informe (sección 13) y esperá mi OK antes de seguir.

12. Criterio de aceptación (al terminar la Fase 3)

Abrir RCP → Iniciar → ver el reloj → esperar el fin del ciclo → aviso → evaluar ritmo → FV → descarga → reiniciar → siguiente ciclo → adrenalina → otra descarga → ROSC → resumen → cronología → nota.

Todo sin salir del módulo, funcionando sin conexión (DevTools > Network > Offline) y sin perder nada si se recarga la página en plena RCP.

13. Informe al cerrar cada fase
Archivos creados
Archivos modificados
Qué funciona
Tests: cómo correrlos y resultado
Cómo probarlo en localhost
Pendientes para la fase siguiente
