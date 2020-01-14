/** @packageDocumentation @publicapi @module params */
import { extend, ancestors, Obj } from '../common/common';
import { StateObject } from '../state/stateObject';

/** @internalapi */
export class StateParams {
  [key: string]: any;

  constructor(params: Obj = {}) {
    extend(this, params);
  }

  /**
   * Merges a set of parameters with all parameters inherited between the common parents of the
   * current state and a given destination state.
   *
   * @param {Object} newParams The set of parameters which will be composited with inherited params.
   * @param {Object} $current Internal definition of object representing the current state.
   * @param {Object} $to Internal definition of object representing state to transition to.
   */
  $inherit(newParams: Obj, $current: StateObject, $to: StateObject) {
    let parentParams: string[];
    const parents = ancestors($current, $to),
      inherited: Obj = {},
      inheritList: string[] = [];

    for (const i in parents) {
      if (!parents[i] || !parents[i].params) continue;
      parentParams = Object.keys(parents[i].params);
      if (!parentParams.length) continue;

      for (const j in parentParams) {
        if (inheritList.indexOf(parentParams[j]) >= 0) continue;
        inheritList.push(parentParams[j]);
        inherited[parentParams[j]] = this[parentParams[j]];
      }
    }
    return extend({}, inherited, newParams);
  }
}
