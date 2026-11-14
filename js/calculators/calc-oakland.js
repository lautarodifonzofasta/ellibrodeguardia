// Oakland score for acute lower GI bleeding (Oakland et al., Lancet
// Gastroenterol Hepatol 2017). A total of 8 or less identifies patients who can
// be discharged for outpatient work-up (ACG 2023). Range 0–35.

/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score <= 8) {
    return {
      severity: 'green',
      label: 'Bajo riesgo: alta posible',
      detail: 'Alta con estudio ambulatorio, si no hay otra razón para internar. El puntaje acompaña al criterio clínico, no lo reemplaza.',
    };
  }
  return {
    severity: 'red',
    label: 'Internar',
    detail: 'Internación y colonoscopía durante la internación. Con inestabilidad o sangrado activo importante: angio-TC primero.',
  };
}
