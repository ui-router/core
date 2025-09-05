import { UrlRouter } from '../url/urlRouter.js';
import { StateService } from '../state/stateService.js';
import { Transition } from '../transition/transition.js';
import { TransitionHookFn } from '../transition/interface.js';
import { TransitionService } from '../transition/transitionService.js';

/**
 * A [[TransitionHookFn]] which updates the URL after a successful transition
 *
 * Registered using `transitionService.onSuccess({}, updateUrl);`
 */
const updateUrl: TransitionHookFn = (transition: Transition) => {
  const options = transition.options();
  const $state: StateService = transition.router.stateService;
  const $urlRouter: UrlRouter = transition.router.urlRouter;

  // Dont update the url in these situations:
  // The transition was triggered by a URL sync (options.source === 'url')
  // The user doesn't want the url to update (options.location === false)
  // The destination state, and all parents have no navigable url
  if (options.source !== 'url' && options.location && $state.$current.navigable) {
    const urlOptions = { replace: options.location === 'replace' };
    $urlRouter.push($state.$current.navigable.url, $state.params, urlOptions);
  }

  $urlRouter.update(true);
};

export const registerUpdateUrl = (transitionService: TransitionService) =>
  transitionService.onSuccess({}, updateUrl, { priority: 9999 });
