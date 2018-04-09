/** @module hooks */
/** for typedoc */
import { noop } from '../common/common';
import { Transition } from '../transition/transition';
import { ResolveContext } from '../resolve/resolveContext';
import { TransitionStateHookFn, TransitionHookFn } from '../transition/interface';
import { TransitionService } from '../transition/transitionService';
import { val } from '../common/hof';
import { StateDeclaration } from '../state/interface';

export const RESOLVE_HOOK_PRIORITY = 1000;

/**
 * A [[TransitionHookFn]] which resolves all EAGER Resolvables in the To Path
 *
 * Registered using `transitionService.onStart({}, eagerResolvePath, { priority: 1000 });`
 *
 * When a Transition starts, this hook resolves all the EAGER Resolvables, which the transition then waits for.
 *
 * See [[StateDeclaration.resolve]]
 */
const eagerResolvePath: TransitionHookFn = (trans: Transition) =>
  new ResolveContext(trans.treeChanges().to).resolvePath('EAGER', trans).then(noop);

export const registerEagerResolvePath = (transitionService: TransitionService) =>
  transitionService.onStart({}, eagerResolvePath, { priority: RESOLVE_HOOK_PRIORITY });

/**
 * A [[TransitionHookFn]] which resolves all LAZY Resolvables for the state (and all its ancestors) in the To Path
 *
 * Registered using `transitionService.onEnter({ entering: () => true }, lazyResolveState, { priority: 1000 });`
 *
 * When a State is being entered, this hook resolves all the Resolvables for this state, which the transition then waits for.
 *
 * See [[StateDeclaration.resolve]]
 */
const lazyResolveState: TransitionStateHookFn = (trans: Transition, state: StateDeclaration) =>
  new ResolveContext(trans.treeChanges().to)
    .subContext(state.$$state())
    .resolvePath('LAZY', trans)
    .then(noop);

export const registerLazyResolveState = (transitionService: TransitionService) =>
  transitionService.onEnter({ entering: val(true) }, lazyResolveState, { priority: RESOLVE_HOOK_PRIORITY });

/**
 * A [[TransitionHookFn]] which resolves any dynamically added (LAZY or EAGER) Resolvables.
 *
 * Registered using `transitionService.onFinish({}, eagerResolvePath, { priority: 1000 });`
 *
 * After all entering states have been entered, this hook resolves any remaining Resolvables.
 * These are typically dynamic resolves which were added by some Transition Hook using [[Transition.addResolvable]].
 *
 * See [[StateDeclaration.resolve]]
 */
const resolveRemaining: TransitionHookFn = (trans: Transition) =>
  new ResolveContext(trans.treeChanges().to).resolvePath('LAZY', trans).then(noop);

export const registerResolveRemaining = (transitionService: TransitionService) =>
  transitionService.onFinish({}, resolveRemaining, { priority: RESOLVE_HOOK_PRIORITY });
