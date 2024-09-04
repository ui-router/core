import { StateParams } from './params/stateParams.js';
import { StateDeclaration } from './state/interface.js';
import { StateObject } from './state/stateObject.js';
import { Transition } from './transition/transition.js';
import { Queue } from './common/queue.js';
import { Disposable } from './interface.js';

/**
 * Global router state
 *
 * This is where we hold the global mutable state such as current state, current
 * params, current transition, etc.
 */
export class UIRouterGlobals implements Disposable {
  /**
   * Current parameter values
   *
   * The parameter values from the latest successful transition
   */
  params: StateParams = new StateParams();

  /**
   * Current state
   *
   * The to-state from the latest successful transition
   */
  current: StateDeclaration;

  /**
   * Current state (internal object)
   *
   * The to-state from the latest successful transition
   * @internal
   */
  $current: StateObject;

  /**
   * The current started/running transition.
   * This transition has reached at least the onStart phase, but is not yet complete
   */
  transition: Transition;

  /** @internal */
  lastStartedTransitionId = -1;

  /** @internal */
  transitionHistory = new Queue<Transition>([], 1);

  /** @internal */
  successfulTransitions = new Queue<Transition>([], 1);

  dispose() {
    this.transitionHistory.clear();
    this.successfulTransitions.clear();
    this.transition = null;
  }
}
