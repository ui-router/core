/** @module hooks */ /** */
import {Transition} from "../transition/transition";
import {TransitionService} from "../transition/transitionService";
import {TransitionHookFn} from "../transition/interface";
import {StateDeclaration, LazyLoadResult} from "../state/interface";
import {State} from "../state/stateObject";
import {services} from "../common/coreservices";
import { StateRule } from "../url/interface";

/**
 * A [[TransitionHookFn]] that performs lazy loading
 *
 * When entering a state "abc" which has a `lazyLoad` function defined:
 * - Invoke the `lazyLoad` function (unless it is already in process)
 *   - Flag the hook function as "in process"
 *   - The function should return a promise (that resolves when lazy loading is complete)
 * - Wait for the promise to settle
 *   - If the promise resolves to a [[LazyLoadResult]], then register those states
 *   - Flag the hook function as "not in process"
 * - If the hook was successful
 *   - Remove the `lazyLoad` function from the state declaration
 * - If all the hooks were successful
 *   - Retry the transition (by returning a TargetState)
 *
 * ```
 * .state('abc', {
 *   component: 'fooComponent',
 *   lazyLoad: () => System.import('./fooComponent')
 *   });
 * ```
 *
 * See [[StateDeclaration.lazyLoad]]
 */
const lazyLoadHook: TransitionHookFn = (transition: Transition) => {
  const transitionSource = (trans: Transition) =>
      trans.redirectedFrom() ? transitionSource(trans.redirectedFrom()) : trans.options().source;
  let router = transition.router;

  function retryOriginalTransition() {
    if (transitionSource(transition) !== 'url') {
      // The original transition was not triggered via url sync
      // The lazy state should be loaded now, so re-try the original transition
      let orig = transition.targetState();
      return router.stateService.target(orig.identifier(), orig.params(), orig.options());
    }

    // The original transition was triggered via url sync
    // Run the URL rules and find the best match
    let $url = router.urlService;
    let result = $url.match($url.parts());
    let rule = result && result.rule;

    // If the best match is a state, redirect the transition (instead
    // of calling sync() which supersedes the current transition)
    if (rule && rule.type === "STATE") {
      let state = (rule as StateRule).state;
      let params = result.match;
      return router.stateService.target(state, params, transition.options());
    }

    // No matching state found, so let .sync() choose the best non-state match/otherwise
    router.urlRouter.sync();
  }

  let promises = transition.entering()
      .filter(state => !!state.lazyLoad)
      .map(state => lazyLoadState(transition, state));

  return services.$q.all(promises).then(retryOriginalTransition);
};

export const registerLazyLoadHook = (transitionService: TransitionService) =>
    transitionService.onBefore({ entering: (state) => !!state.lazyLoad }, lazyLoadHook);


/**
 * Invokes a state's lazy load function
 *
 * @param transition a Transition context
 * @param state the state to lazy load
 * @returns A promise for the lazy load result
 */
export function lazyLoadState(transition: Transition, state: StateDeclaration): Promise<LazyLoadResult> {
  let lazyLoadFn = state.lazyLoad;

  // Store/get the lazy load promise on/from the hookfn so it doesn't get re-invoked
  let promise = lazyLoadFn['_promise'];
  if (!promise) {
    const success = (result) => {
      delete state.lazyLoad;
      delete state.$$state().lazyLoad;
      delete lazyLoadFn['_promise'];
      return result;
    };

    const error = (err) => {
      delete lazyLoadFn['_promise'];
      return services.$q.reject(err);
    };

    promise = lazyLoadFn['_promise'] =
        services.$q.when(lazyLoadFn(transition, state))
            .then(updateStateRegistry)
            .then(success, error);
  }

  /** Register any lazy loaded state definitions */
  function updateStateRegistry(result: LazyLoadResult) {
    if (result && Array.isArray(result.states)) {
      result.states.forEach(state => transition.router.stateRegistry.register(state));
    }
    return result;
  }

  return promise;
}
