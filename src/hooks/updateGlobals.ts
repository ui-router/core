/** @module hooks */
/** for typedoc */
import { Transition } from '../transition/transition';
import { copy } from '../common/common';
import { TransitionService } from '../transition/transitionService';

/**
 * A [[TransitionHookFn]] which updates global UI-Router state
 *
 * Registered using `transitionService.onBefore({}, updateGlobalState);`
 *
 * Before a [[Transition]] starts, updates the global value of "the current transition" ([[Globals.transition]]).
 * After a successful [[Transition]], updates the global values of "the current state"
 * ([[Globals.current]] and [[Globals.$current]]) and "the current param values" ([[Globals.params]]).
 *
 * See also the deprecated properties:
 * [[StateService.transition]], [[StateService.current]], [[StateService.params]]
 */
const updateGlobalState = (trans: Transition) => {
  let globals = trans.router.globals;

  const transitionSuccessful = () => {
    globals.successfulTransitions.enqueue(trans);
    globals.$current = trans.$to();
    globals.current = globals.$current.self;

    copy(trans.params(), globals.params);
  };

  const clearCurrentTransition = () => {
    // Do not clear globals.transition if a different transition has started in the meantime
    if (globals.transition === trans) globals.transition = null;
  };

  trans.onSuccess({}, transitionSuccessful, { priority: 10000 });
  trans.promise.then(clearCurrentTransition, clearCurrentTransition);
};

export const registerUpdateGlobalState = (transitionService: TransitionService) =>
    transitionService.onCreate({}, updateGlobalState);
