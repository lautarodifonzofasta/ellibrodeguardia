// TWIST — Testicular Workup for Ischemia and Suspected Torsion (Barbosa et al.,
// J Urol 2013; validated in adults, Int Urol Nephrol 2021). Embedded in
// content/modules/escroto-agudo.html; content/calculators/calc-twist.json holds
// the five findings (swelling 2, hard testis 2, absent cremasteric reflex 1,
// nausea/vomiting 1, high-riding testis 1) and sets "requireAll".
// Bands (Barbosa): 0–2 low · 3–4 intermediate · 5–7 high.

/** @param {number} score 0–7 @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score >= 5) {
    return {
      severity: 'red',
      label: 'Riesgo alto',
      detail: 'Con menos de 48 h de dolor: cirugía o urología de inmediato, sin esperar la ecografía. Con 48 h o más: consulta quirúrgica urgente y eco Doppler.',
    };
  }
  if (score >= 3) {
    return {
      severity: 'amber',
      label: 'Riesgo intermedio',
      detail: 'Eco Doppler urgente y aviso a cirugía al mismo tiempo. Sin ecografía inmediata, o con resultado dudoso: exploración quirúrgica.',
    };
  }
  return {
    severity: 'green',
    label: 'Riesgo bajo',
    // Pooled data from Qin & Qu (J Urol 2022), as tabulated in Am Fam Physician
    // 2022;106(6): torsion in 15/691 low-risk patients (2.2%).
    detail: 'Torsión poco probable (alrededor de 2%; un puntaje bajo no la descarta). Si persiste la sospecha clínica, consulta quirúrgica como en riesgo alto. Un eco Doppler normal no descarta la torsión.',
  };
}
