// Blood gas reading for the COPD exacerbation: is there respiratory acidosis
// (the NIV indication: PaCO₂ >45 and pH ≤7,35, as in epoc.html), is the
// hypercapnia acute or chronic, and is there hypoxaemia. Expected bicarbonate
// for a given PaCO₂:
//   acute   24 + 0.1  × (PaCO₂ − 40)
//   chronic 24 + 0.35 × (PaCO₂ − 40)
// A measured bicarbonate more than 3 mEq/L above the acute value means there
// was chronic retention before this episode; more than 3 below it means a
// metabolic acidosis on top.
// Acidosis without hypercapnia (pH <7,35, PaCO₂ ≤45) is metabolic. With no
// measured bicarbonate it is estimated with Henderson–Hasselbalch,
// 0.03 × PaCO₂ × 10^(pH − 6.1), and Winter's formula gives the PaCO₂ expected
// from respiratory compensation, 1.5 × HCO₃ + 8 (±2). A PaCO₂ above that range
// means an associated respiratory acidosis (the patient is tiring).

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

  if (ph <= 7.35 && pco2 > 45) {
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
    if (hco3 > 0) {
      const acute = 24 + 0.1 * (pco2 - 40);
      if (hco3 > acute + 3) {
        lines.push(`HCO₃ ${hco3} mEq/L, por encima del esperado para un cuadro agudo (${acute.toFixed(0)}): retenedor crónico agudizado.`);
      } else if (hco3 < acute - 3) {
        lines.push(`HCO₃ ${hco3} mEq/L, por debajo del esperado para un cuadro agudo (${acute.toFixed(0)}): acidosis metabólica asociada. Buscar lactato, cetonas, función renal.`);
      } else {
        lines.push(`HCO₃ ${hco3} mEq/L, acorde a un cuadro agudo (esperado ${acute.toFixed(0)}).`);
      }
    }
  } else if (ph < 7.35) {
    const estimated = !(hco3 > 0);
    const bicarb = estimated ? 0.03 * pco2 * 10 ** (ph - 6.1) : hco3;
    const winter = 1.5 * bicarb + 8;
    if (pco2 > winter + 2) {
      severity = 'red';
      kind = 'metabolic-acidosis-resp';
      label = 'Acidosis metabólica con compensación respiratoria insuficiente';
      lines.push(`PaCO₂ por encima de la esperada para compensar (Winter: ${winter.toFixed(0)} ± 2${estimated ? ', HCO₃ estimado' : ''}): hay una acidosis respiratoria asociada. Vigilar el agotamiento.`);
      lines.push('Buscar la causa metabólica: lactato, cetonas, función renal, tóxicos.');
    } else {
      severity = 'amber';
      kind = 'metabolic-acidosis';
      label = 'Acidosis metabólica';
      lines.push('Buscar la causa: lactato, cetonas, función renal, tóxicos.');
    }
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
