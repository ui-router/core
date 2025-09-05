import { TransitionService } from '../transition/transitionService.js';
import { Transition } from '../transition/transition.js';

/**
 * A [[TransitionHookFn]] that rejects the Transition if it is invalid
 *
 * This hook is invoked at the end of the onBefore phase.
 * If the transition is invalid (for example, param values do not validate)
 * then the transition is rejected.
 */
function invalidTransitionHook(trans: Transition) {
  if (!trans.valid()) {
    throw new Error(trans.error().toString());
  }
}

export const registerInvalidTransitionHook = (transitionService: TransitionService) =>
  transitionService.onBefore({}, invalidTransitionHook, { priority: -10000 });
