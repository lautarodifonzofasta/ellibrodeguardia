// Registry mapping a calculator's view id (matches content/calculators/<id>.json
// and content/meta.json) to its pure scoring-interpretation function.
// A calculator can also live only inside a content module, with no meta.json
// entry of its own: calc-tac-craneo is embedded in content/modules/tec.html
// via <div data-calculator="calc-tac-craneo"> (mounted by js/router.js),
// calc-qsofa in content/modules/sepsis.html, and calc-twist in
// content/modules/escroto-agudo.html.
import { interpret as gcs } from './calc-gcs.js';
import { interpret as sofa } from './calc-sofa.js';
import { interpret as wellsTep } from './calc-wells-tep.js';
import { interpret as curb65 } from './calc-curb65.js';
import { interpret as twist } from './calc-twist.js';
import { interpret as heart } from './calc-heart.js';
import { interpret as chads } from './calc-chads.js';
import { interpret as wellsTvp } from './calc-wells-tvp.js';
import { interpret as blatchford } from './calc-blatchford.js';
import { interpret as tacCraneo } from './calc-tac-craneo.js';
import { interpret as qsofa } from './calc-qsofa.js';
import { interpret as nihss } from './calc-nihss.js';
import { interpret as news2 } from './calc-news2.js';
import { interpret as oakland } from './calc-oakland.js';
import { compute as pef } from './calc-pef.js';
import { compute as gases } from './calc-gases.js';

export const SCORED_CALCULATORS = {
  'calc-gcs': gcs,
  'calc-sofa': sofa,
  'calc-wells-tep': wellsTep,
  'calc-curb65': curb65,
  'calc-twist': twist,
  'calc-heart': heart,
  'calc-chads': chads,
  'calc-wells-tvp': wellsTvp,
  'calc-blatchford': blatchford,
  'calc-tac-craneo': tacCraneo,
  'calc-qsofa': qsofa,
  'calc-nihss': nihss,
  'calc-news2': news2,
  'calc-oakland': oakland,
};

// Free-input calculators rendered by js/calculators/form-engine.js: the JSON
// lists the fields ("form": true) and compute(values) returns the verdict.
export const FORM_CALCULATORS = {
  'calc-pef': pef,
  'calc-gases': gases,
};
