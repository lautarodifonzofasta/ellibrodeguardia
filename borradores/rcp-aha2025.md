# Perfil clínico RCP: AHA 2025 · Paro cardíaco del adulto

Fuentes:
- AHA 2025 Adult Cardiac Arrest Algorithm (VF/pVT/Asystole/PEA), versión oficial en texto (cpr.heart.org).
- 2025 AHA Guidelines for CPR and ECC, Part 9: Adult Advanced Life Support.

Revisión: 2026-09. Validado por: Lautaro Di Fonzo (autor), 2026-09-27

---

## Para Claude Code

- Este archivo es la única fuente del contenido clínico del módulo RCP (ver `prompt-rcp.md`, sección 3).
- Lo marcado como "Parámetro de interfaz" es una decisión de diseño, no de la guía.
- Los números de Box son los del algoritmo oficial: usalos como identificadores de estado del perfil.
- Si aparece [REVISAR], no implementes esa parte y avisame.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| id | `aha-2025-adulto` |
| Nombre visible | AHA Adulto |
| Versión | 2025 |
| Fuente visible | 2025 AHA Guidelines for CPR and ECC · Adult Cardiac Arrest Algorithm |

## 2. Tiempos

| Parámetro | Valor | Origen |
|---|---|---|
| Duración de cada ciclo de RCP | 2 min | Guía |
| Primer control de ritmo | Apenas está conectado el monitor/desfibrilador; no espera 2 min | Guía (Box 1) |
| Intervalo de adrenalina | Cada 3–5 min | Guía |
| Cambio de compresor | Cada 2 min, o antes si hay fatiga: recordatorio en cada control de ritmo | Guía |
| Preaviso de fin de ciclo | 15 s | Parámetro de interfaz |

Estado de la ventana de adrenalina, contado desde la última dosis registrada:
- Menos de 3 min: "Próxima en mm:ss"
- Entre 3 y 5 min: "Ventana abierta"
- Más de 5 min: "Ventana superada"

Nota de la guía: operativamente, dar adrenalina cada 2 ciclos de RCP después de la dosis inicial cumple la recomendación de 3–5 min.

## 3. Algoritmo

### 3.1 Cajas

D = desfibrilable (FV / TV sin pulso). ND = no desfibrilable (AESP / asistolia).

| Box | Pantalla (acciones) | Siguiente |
|---|---|---|
| 1 | Iniciar RCP · Ventilación con bolsa-máscara y O₂ · Conectar monitor/desfibrilador | Evaluar ritmo → D: Box 2 · ND: Box 9 |
| 2 | FV / TV sin pulso | Box 3 |
| 3 | Descarga | Box 4 |
| 4 | RCP 2 min · Acceso IV/IO | Evaluar ritmo → D: Box 5 · ND: Box 12 |
| 5 | Descarga | Box 6 |
| 6 | RCP 2 min · Adrenalina cada 3–5 min · Considerar vía aérea avanzada y capnografía | Evaluar ritmo → D: Box 7 · ND: Box 12 |
| 7 | Descarga | Box 8 |
| 8 | RCP 2 min · Amiodarona o lidocaína · Tratar causas reversibles | Evaluar ritmo → D: Box 5 · ND: Box 12 |
| 9 | Asistolia / AESP · Adrenalina lo antes posible | Box 10 |
| 10 | RCP 2 min · Acceso IV/IO · Adrenalina cada 3–5 min · Considerar vía aérea avanzada y capnografía | Evaluar ritmo → D: Box 5 · ND: Box 11 |
| 11 | RCP 2 min · Tratar causas reversibles | Evaluar ritmo → D: Box 5 · ND: Box 12 |
| 12 | ¿Signos de ROSC? · Considerar si corresponde continuar la reanimación | Sin ROSC: Box 10 · ROSC: cuidados post-paro |

Salida del Box 8: la versión oficial en texto no dice adónde va el Box 8. Se adopta la propuesta: igual que el Box 11 (evaluar ritmo → D: Box 5; ND: Box 12). Así, la rama desfibrilable alterna Box 5-6 (adrenalina) y Box 7-8 (antiarrítmico). Confirmado por el autor el 2026-09-27.

### 3.2 Reglas para el motor

- **Descargas (Box 3, 5 y 7):** se registran solo cuando el usuario toca "Descarga realizada", y recién ahí arranca el ciclo siguiente. Estrategia de descarga única: después de cada descarga, compresiones de inmediato.
- **Acciones de cada Box:** son recordatorios; cuentan como hechas solo cuando el usuario las registra. "Acceso IV/IO" y "Considerar vía aérea avanzada y capnografía" dejan de mostrarse una vez registradas.
- **Ventilación:** 30:2 hasta que se registre la vía aérea avanzada; desde ahí, compresiones continuas con 1 ventilación cada 6 s (10/min).
- **Adrenalina:**
  - Rama no desfibrilable: lo antes posible (Box 9), después cada 3–5 min.
  - Si se entra a la rama no desfibrilable sin ninguna dosis previa (por ejemplo, Box 12 → Box 10), corresponde lo antes posible.
  - Rama desfibrilable: primera indicación en el Box 6 (después de la 2ª descarga), después cada 3–5 min.
  - Al cambiar de rama, el intervalo sigue contando desde la última dosis registrada; no se reinicia.
- **Antiarrítmico (amiodarona o lidocaína):**
  - Primera dosis: Box 8 (después de la 3ª descarga).
  - Segunda dosis: el algoritmo da la dosis pero no el momento. Se adopta: en el siguiente pase por el Box 8 (confirmado por el autor el 2026-09-27).
  - Una vez elegida una de las dos, las indicaciones siguientes sugieren la misma. Registrar la otra no se bloquea.
  - El algoritmo define solo primera y segunda dosis: después de la segunda, no sugerir más.
  - Después de la segunda dosis, el recordatorio "Amiodarona o lidocaína" del Box 8 deja de mostrarse (confirmado por el autor el 2026-09-27).
- **Causas reversibles:** en los Box 8 y 11 se muestra el recordatorio; el panel está disponible siempre.
- **Box 12:** pregunta "¿Signos de ROSC?" con dos botones: "Sí → Confirmar ROSC" y "No → Box 10". El botón ROSC general sigue disponible en todo momento.

## 4. Drogas

| id | Nombre | Dosis | Vía | Cuándo | Repetición |
|---|---|---|---|---|---|
| `adrenalina` | Adrenalina | 1 mg | IV/IO | ND: lo antes posible (Box 9). D: desde el Box 6 | Cada 3–5 min |
| `amiodarona` | Amiodarona | 1ª: 300 mg en bolo · 2ª: 150 mg | IV/IO | Box 8 | 2ª dosis: ver 3.2 |
| `lidocaina` | Lidocaína | 1ª: 1–1,5 mg/kg · 2ª: 0,5–0,75 mg/kg | IV/IO | Box 8, como alternativa a amiodarona | 2ª dosis: ver 3.2 |
| `otra` | Otra | La ingresa el usuario | La ingresa el usuario | — | — |

- Al registrar, la dosis aparece precargada y es editable: se guarda lo que realmente se administró.
- Lidocaína: pedir la dosis administrada en mg. Si el usuario ingresa un peso estimado, mostrar el rango en mg (cálculo directo, sin redondeos).
- Acceso vascular: IV primero; IO si la IV no resulta o no es factible. La app registra la vía que elija el usuario.
- No se ofrecen como opción, según AHA 2025: vasopresina, adrenalina en dosis altas y calcio, bicarbonato o magnesio de rutina. Se pueden registrar igual como "Otra".

## 5. Descarga (texto de referencia en la pantalla de descarga)

- Bifásico: energía recomendada por el fabricante (por ejemplo, dosis inicial de 120–200 J); si se desconoce, la máxima disponible. Las siguientes, equivalentes; pueden considerarse dosis mayores.
- Monofásico: 360 J.
- No se incluyen el cambio de vector ni la doble desfibrilación secuencial: su utilidad no está establecida.

## 6. RCP de alta calidad (panel de referencia)

- Compresiones de al menos 5 cm, a 100–120/min, con reexpansión completa del tórax.
- Minimizar las interrupciones de las compresiones.
- Evitar la ventilación excesiva.
- Cambiar de compresor cada 2 min, o antes si hay fatiga.
- Sin vía aérea avanzada: 30:2.
- Con vía aérea avanzada: 1 ventilación cada 6 s (10/min) con compresiones continuas.
- Capnografía de onda continua: si la EtCO₂ es baja o está descendiendo, reevaluar la calidad de la RCP.

## 7. Vía aérea avanzada y capnografía

- Intubación endotraqueal o dispositivo supraglótico.
- Capnografía de onda continua o capnometría para confirmar y monitorear la posición del tubo endotraqueal.
- Si colocarla interrumpe las compresiones, diferirla hasta que no haya respuesta a la RCP y a las descargas iniciales, o hasta el ROSC.
- Texto de referencia sobre EtCO₂, solo informativo y sin alertas automáticas: un aumento brusco puede indicar ROSC (no hay un valor de corte absoluto); valores de al menos 10 mmHg, idealmente 20 mmHg o más, pueden indicar compresiones mecánicamente adecuadas.

## 8. Causas reversibles

- Hipovolemia
- Hipoxia
- Hidrogeniones (acidosis)
- Hipo/hiperpotasemia
- Hipotermia
- Neumotórax a tensión
- Taponamiento cardíaco
- Tóxicos
- Trombosis pulmonar
- Trombosis coronaria

## 9. Textos de pantalla y voz

| Momento | Pantalla | Voz |
|---|---|---|
| Inicio (Box 1) | INICIAR COMPRESIONES · Conectar monitor/desfibrilador | "Iniciar compresiones. Conectar el monitor." |
| Preaviso | PREPARARSE PARA EVALUAR RITMO | "Prepararse para evaluar ritmo." |
| Fin de ciclo | DETENER COMPRESIONES · EVALUAR RITMO · Cambiar compresor | "Detener compresiones. Evaluar ritmo." |
| Desfibrilable | ⚡ RITMO DESFIBRILABLE · PREPARAR DESCARGA | "Ritmo desfibrilable. Preparar descarga." |
| Descarga realizada | REINICIAR COMPRESIONES | "Reiniciar compresiones." |
| No desfibrilable | 🔵 RITMO NO DESFIBRILABLE · CONTINUAR RCP | "Ritmo no desfibrilable. Reiniciar compresiones." |
| Adrenalina indicada | ADRENALINA 1 mg IV/IO | "Corresponde adrenalina." |
| Antiarrítmico (Box 8) | AMIODARONA o LIDOCAÍNA | "Considerar amiodarona o lidocaína." |
| 2ª dosis, amiodarona ya elegida | AMIODARONA 150 mg IV/IO | "Considerar segunda dosis de amiodarona." |
| 2ª dosis, lidocaína ya elegida | LIDOCAÍNA 0,5–0,75 mg/kg IV/IO | "Considerar segunda dosis de lidocaína." |
| Box 12 | ¿SIGNOS DE ROSC? | "Evaluar signos de circulación espontánea." |
| ROSC confirmado | ✅ ROSC | "Retorno de circulación espontánea confirmado." |

## 10. Plantilla de nota clínica

Incluir solo las frases cuyos datos estén registrados. Horas en formato HH:MM. No agregar nada que no esté en el registro.
Con una sola unidad, usar el singular: "Se realiza 1 descarga" y "(1 ciclo)" (confirmado por el autor el 2026-09-27).

1. Paciente adulto en paro cardiorrespiratorio. Se inicia RCP a las {hora_inicio}.
2. Ritmo inicial: {desfibrilable (FV/TV sin pulso) | no desfibrilable (AESP/asistolia)}.
3. Se realizan {n} descargas ({horas}).
4. Por cada droga: Se administra {droga} {dosis} {vía} en {n} dosis ({horas}).
5. Se coloca vía aérea avanzada a las {hora}. Se monitorea con capnografía{; EtCO₂ registradas: valor (hora)}.
6. Causas reversibles consideradas: {lista}.
7. Otros eventos: {texto (hora)}.
8. Cierre con ROSC: Se obtiene ROSC a las {hora_rosc}, tras {duración} de RCP ({n} ciclos).
9. Cierre sin ROSC: Se finaliza la RCP a las {hora_fin} ({motivo}), tras {duración} de reanimación.
10. Algoritmo de referencia: AHA 2025, paro cardíaco del adulto.

## 11. Fuera de este perfil

Para versiones futuras, cada uno con su propio contenido validado: cuidados post-paro, paro en situaciones especiales (embarazo, hiperpotasemia, tóxicos), pediatría y reglas de terminación de la reanimación.
