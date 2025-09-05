import { noop } from '../common/common.js';
import { services } from '../common/coreservices.js';
import { Transition } from '../transition/transition.js';
import { ViewService } from '../view/view.js';
import { ViewConfig } from '../view/interface.js';
import { TransitionHookFn } from '../transition/interface.js';
import { TransitionService } from '../transition/transitionService.js';

/**
 * A [[TransitionHookFn]] which waits for the views to load
 *
 * Registered using `transitionService.onStart({}, loadEnteringViews);`
 *
 * Allows the views to do async work in [[ViewConfig.load]] before the transition continues.
 * In angular 1, this includes loading the templates.
 */
const loadEnteringViews: TransitionHookFn = (transition: Transition) => {
  const $q = services.$q;
  const enteringViews = transition.views('entering');
  if (!enteringViews.length) return;
  return $q.all(enteringViews.map((view) => $q.when(view.load()))).then(noop);
};

export const registerLoadEnteringViews = (transitionService: TransitionService) =>
  transitionService.onFinish({}, loadEnteringViews);

/**
 * A [[TransitionHookFn]] which activates the new views when a transition is successful.
 *
 * Registered using `transitionService.onSuccess({}, activateViews);`
 *
 * After a transition is complete, this hook deactivates the old views from the previous state,
 * and activates the new views from the destination state.
 *
 * See [[ViewService]]
 */
const activateViews: TransitionHookFn = (transition: Transition) => {
  const enteringViews = transition.views('entering');
  const exitingViews = transition.views('exiting');
  if (!enteringViews.length && !exitingViews.length) return;

  const $view: ViewService = transition.router.viewService;

  exitingViews.forEach((vc: ViewConfig) => $view.deactivateViewConfig(vc));
  enteringViews.forEach((vc: ViewConfig) => $view.activateViewConfig(vc));

  $view.sync();
};

export const registerActivateViews = (transitionService: TransitionService) =>
  transitionService.onSuccess({}, activateViews);
