
import { trace } from '../common/trace';
import { Rejection } from '../transition/rejectFactory';
import { TransitionService } from '../transition/transitionService';
import { Transition } from '../transition/transition';

/**
 * A [[TransitionHookFn]] that skips a transition if it should be ignored
 *
 * This hook is invoked at the end of the onBefore phase.
 *
 * If the transition should be ignored (because no parameter or states changed)
 * then the transition is ignored and not processed.
 */
function ignoredHook(trans: Transition) {
  if (trans.ignored()) {
    trace.traceTransitionIgnored(this);
    return Rejection.ignored().toPromise();
  }
}

export const registerIgnoredTransitionHook = (transitionService: TransitionService) =>
    transitionService.onBefore({}, ignoredHook, { priority: -9999 });
