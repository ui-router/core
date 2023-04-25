import { extend, ancestors, Obj } from '../common/common';
import { StateObject } from '../state/stateObject';

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
    const parents = ancestors($current, $to),
      inherited: Obj = {},
      inheritList: string[] = [];

    for (const parent of parents) {
      if (!parent.params) continue;
      const parentParams = parent.params;
      const parentParamsKeys = Object.keys(parentParams);
      if (!parentParamsKeys.length) continue;

      for (const parentParamsKey of parentParamsKeys) {
        if (parentParams[parentParamsKey].inherit == false || inheritList.indexOf(parentParamsKey) >= 0)
          continue;
        inheritList.push(parentParamsKey);
        inherited[parentParamsKey] = this[parentParamsKey];
      }
    }
    return extend({}, inherited, newParams);
  }
}
