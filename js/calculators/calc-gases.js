// Blood gas reading for the COPD exacerbation: is there respiratory acidosis
// (the NIV indication), is the hypercapnia acute or chronic, and is there
// hypoxaemia. Expected bicarbonate for a given PaCO₂:
//   acute   24 + 0.1  × (PaCO₂ − 40)
//   chronic 24 + 0.35 × (PaCO₂ − 40)
// A measured bicarbonate more than 3 mEq/L above the acute value means there
// was chronic retention before this episode.

const NIV = 'VNI indicada (PaCO₂ >45 y pH ≤7,35). Repetir gases en 1–2 h.';

/**
 * @param {{ph?: number, pco2?: number, hco3?: number, po2?: number}} v pH, PaCO₂ and PaO₂ in mmHg, HCO₃ in mEq/L
 * @returns {{severity: string, label: string, lines: string[], kind: string} | null}
 */
export function compute({ ph, pco2, hco3, po2 }) {
  if (!(ph >= 6.5 && ph <= 8) || !(pco2 >= 10 && pco2 <= 150)) return null;
  const lines = [];
  let severity;
  let label;
  let kind;

  if (ph < 7.35 && pco2 > 45) {
    severity = 'red';
    if (ph < 7.25) {
      kind = 'resp-acidosis-severe';
      label = 'Acidosis respiratoria grave';
      lines.push('pH <7,25: VNI con umbral bajo para intubar, en UCI. Si empeora o no mejora en 1–2 h, intubar.');
    } else {
      kind = 'resp-acidosis';
      label = 'Acidosis respiratoria';
      lines.push(NIV);
    }
    if (hco3 !== undefined) {
      const acute = 24 + 0.1 * (pco2 - 40);
      lines.push(hco3 > acute + 3
        ? `HCO₃ ${hco3} mEq/L, por encima del esperado para un cuadro agudo (${acute.toFixed(0)}): retenedor crónico agudizado.`
        : `HCO₃ ${hco3} mEq/L, acorde a un cuadro agudo (esperado ${acute.toFixed(0)}).`);
    }
  } else if (ph < 7.35) {
    severity = 'amber';
    kind = 'non-resp-acidosis';
    label = 'Acidosis sin hipercapnia';
    lines.push('No es de causa respiratoria: buscar lactato, cetonas, función renal, tóxicos.');
  } else if (pco2 > 45 && ph <= 7.45) {
    severity = 'amber';
    kind = 'compensated-hypercapnia';
    label = 'Hipercapnia compensada';
    lines.push('Retención crónica sin acidosis: los gases no indican VNI. Oxígeno controlado (SpO₂ 88–92%) y repetir gases a los 30–60 min.');
  } else if (ph > 7.45) {
    severity = 'neutral';
    kind = pco2 < 35 ? 'resp-alkalosis' : 'metabolic-alkalosis';
    label = pco2 < 35 ? 'Alcalosis respiratoria' : 'Alcalosis metabólica';
    lines.push(pco2 < 35
      ? 'Hiperventilación: pensar en TEP, sepsis, dolor o ansiedad.'
      : 'Buscar vómitos, diuréticos o hipokalemia.');
  } else {
    severity = 'green';
    kind = 'normal';
    label = 'Sin acidosis ni hipercapnia';
    lines.push('Los gases no indican soporte ventilatorio. Seguir por clínica.');
  }
  if (po2 !== undefined && po2 < 60) lines.push(`PaO₂ ${po2} mmHg: hipoxemia. Titular oxígeno para SpO₂ 88–92%.`);
  return { severity, label, lines, kind };
}
