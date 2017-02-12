import { TransitionService } from '../transition/transitionService';
import { Transition } from '../transition/transition';

/**
 * A [[TransitionHookFn]] that rejects the Transition if it is invalid
 *
 * This hook is invoked at the end of the onBefore phase.
 * If the transition is invalid (for example, param values do not validate)
 * then the transition is rejected.
 */
function invalidTransitionHook(trans: Transition) {
  if (!trans.valid()) {
    throw new Error(trans.error());
  }
}

export const registerInvalidTransitionHook = (transitionService: TransitionService) =>
    transitionService.onBefore({}, invalidTransitionHook, { priority: -10000 });
