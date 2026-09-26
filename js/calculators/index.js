// Registry mapping a calculator's view id (matches content/calculators/<id>.json
// and content/meta.json) to its pure scoring-interpretation function.
import { interpret as gcs } from './calc-gcs.js';
import { interpret as sofa } from './calc-sofa.js';
import { interpret as wellsTep } from './calc-wells-tep.js';
import { interpret as curb65 } from './calc-curb65.js';
import { interpret as heart } from './calc-heart.js';
import { interpret as chads } from './calc-chads.js';
import { interpret as wellsTvp } from './calc-wells-tvp.js';
import { interpret as blatchford } from './calc-blatchford.js';

export const SCORED_CALCULATORS = {
  'calc-gcs': gcs,
  'calc-sofa': sofa,
  'calc-wells-tep': wellsTep,
  'calc-curb65': curb65,
  'calc-heart': heart,
  'calc-chads': chads,
  'calc-wells-tvp': wellsTvp,
  'calc-blatchford': blatchford,
};
