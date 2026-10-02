// Registry mapping a calculator's view id (matches content/calculators/<id>.json
// and content/meta.json) to its pure scoring-interpretation function.
// A calculator can also live only inside a content module, with no meta.json
// entry of its own: calc-tac-craneo is embedded in content/modules/tec.html
// via <div data-calculator="calc-tac-craneo"> (mounted by js/router.js), and
// calc-qsofa in content/modules/sepsis.html.
import { interpret as gcs } from './calc-gcs.js';
import { interpret as sofa } from './calc-sofa.js';
import { interpret as wellsTep } from './calc-wells-tep.js';
import { interpret as curb65 } from './calc-curb65.js';
import { interpret as heart } from './calc-heart.js';
import { interpret as chads } from './calc-chads.js';
import { interpret as wellsTvp } from './calc-wells-tvp.js';
import { interpret as blatchford } from './calc-blatchford.js';
import { interpret as tacCraneo } from './calc-tac-craneo.js';
import { interpret as qsofa } from './calc-qsofa.js';

export const SCORED_CALCULATORS = {
  'calc-gcs': gcs,
  'calc-sofa': sofa,
  'calc-wells-tep': wellsTep,
  'calc-curb65': curb65,
  'calc-heart': heart,
  'calc-chads': chads,
  'calc-wells-tvp': wellsTvp,
  'calc-blatchford': blatchford,
  'calc-tac-craneo': tacCraneo,
  'calc-qsofa': qsofa,
};
