import { trace } from '../common/trace.js';
import { Rejection } from '../transition/rejectFactory.js';
import { TransitionService } from '../transition/transitionService.js';
import { Transition } from '../transition/transition.js';

/**
 * A [[TransitionHookFn]] that skips a transition if it should be ignored
 *
 * This hook is invoked at the end of the onBefore phase.
 *
 * If the transition should be ignored (because no parameter or states changed)
 * then the transition is ignored and not processed.
 */
function ignoredHook(trans: Transition) {
  const ignoredReason = trans._ignoredReason();
  if (!ignoredReason) return;

  trace.traceTransitionIgnored(trans);

  const pending = trans.router.globals.transition;

  // The user clicked a link going back to the *current state* ('A')
  // However, there is also a pending transition in flight (to 'B')
  // Abort the transition to 'B' because the user now wants to be back at 'A'.
  if (ignoredReason === 'SameAsCurrent' && pending) {
    pending.abort();
  }

  return Rejection.ignored().toPromise();
}

export const registerIgnoredTransitionHook = (transitionService: TransitionService) =>
  transitionService.onBefore({}, ignoredHook, { priority: -9999 });
