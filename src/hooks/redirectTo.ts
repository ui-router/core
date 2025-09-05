import { isString, isFunction } from '../common/predicates.js';
import { Transition } from '../transition/transition.js';
import { services } from '../common/coreservices.js';
import { TargetState } from '../state/targetState.js';
import { TransitionService } from '../transition/transitionService.js';
import { TransitionHookFn } from '../transition/interface.js';

/**
 * A [[TransitionHookFn]] that redirects to a different state or params
 *
 * Registered using `transitionService.onStart({ to: (state) => !!state.redirectTo }, redirectHook);`
 *
 * See [[StateDeclaration.redirectTo]]
 */
const redirectToHook: TransitionHookFn = (trans: Transition) => {
  const redirect = trans.to().redirectTo;
  if (!redirect) return;

  const $state = trans.router.stateService;

  function handleResult(result: any) {
    if (!result) return;
    if (result instanceof TargetState) return result;
    if (isString(result)) return $state.target(<any>result, trans.params(), trans.options());
    if (result['state'] || result['params'])
      return $state.target(result['state'] || trans.to(), result['params'] || trans.params(), trans.options());
  }

  if (isFunction(redirect)) {
    return services.$q.when(redirect(trans)).then(handleResult);
  }
  return handleResult(redirect);
};

export const registerRedirectToHook = (transitionService: TransitionService) =>
  transitionService.onStart({ to: (state) => !!state.redirectTo }, redirectToHook);
