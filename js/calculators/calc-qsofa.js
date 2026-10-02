// qSOFA (embedded in the Sepsis module, Diagnóstico tab). Each criterion is
// answered No (0) / Sí (1); content/calculators/calc-qsofa.json sets
// "requireAll", so interpret() only runs once all 3 are answered.
// Texts: the author's spec (Sepsis-3, Seymour 2016 · SSC 2021).

/** @typedef {{severity: 'red'|'amber', label: string, detail: string, detailHtml: string}} Interpretation */

const POSITIVE = [
  'La mortalidad intrahospitalaria es 3 a 14 veces mayor que con qSOFA &lt; 2.',
  'Buscar disfunción orgánica: <strong>SOFA y lactato</strong>.',
  'Si hay hipoperfusión, iniciar los 3 pilares sin esperar resultados: fluidos, ATB en la 1.ª hora y control del foco.',
];
const NEGATIVE = [
  'Es poco sensible. Si la sospecha clínica persiste, calcular SOFA, pedir lactato y reevaluar.',
  'No demorar ATB en un paciente con sospecha de sepsis por un qSOFA bajo.',
];

const plain = lines => lines.join(' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<');

/** @param {number} score 0–3 @returns {Interpretation} */
export function interpret(score) {
  if (score >= 2) {
    return { severity: 'red', label: 'qSOFA positivo: alto riesgo de mala evolución', detail: plain(POSITIVE), detailHtml: POSITIVE.join('<br>') };
  }
  return { severity: 'amber', label: 'qSOFA negativo: no descarta sepsis', detail: plain(NEGATIVE), detailHtml: NEGATIVE.join('<br>') };
}
