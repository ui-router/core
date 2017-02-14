/**
 * @coreapi
 * @module transition
 */
/** for typedoc */
import {
  IHookRegistry, TransitionOptions, TransitionHookScope, TransitionHookPhase, TransitionCreateHookFn, HookMatchCriteria,
  HookRegOptions, PathTypes, PathType, RegisteredHooks, TransitionHookFn, TransitionStateHookFn
} from "./interface";
import { Transition } from "./transition";
import { makeEvent, RegisteredHook } from "./hookRegistry";
import { TargetState } from "../state/targetState";
import { PathNode } from "../path/node";
import { ViewService } from "../view/view";
import { UIRouter } from "../router";
import { registerAddCoreResolvables } from "../hooks/coreResolvables";
import { registerRedirectToHook } from "../hooks/redirectTo";
import { registerOnExitHook, registerOnRetainHook, registerOnEnterHook } from "../hooks/onEnterExitRetain";
import { registerEagerResolvePath, registerLazyResolveState } from "../hooks/resolve";
import { registerLoadEnteringViews, registerActivateViews } from "../hooks/views";
import { registerUpdateGlobalState } from "../hooks/updateGlobals";
import { registerUpdateUrl } from "../hooks/url";
import { registerLazyLoadHook } from "../hooks/lazyLoad";
import { TransitionEventType } from "./transitionEventType";
import { TransitionHook, GetResultHandler, GetErrorHandler } from "./transitionHook";
import { isDefined } from "../common/predicates";
import { removeFrom, values, createProxyFunctions } from "../common/common";
import { Disposable } from "../interface"; // has or is using
import { val } from "../common/hof";
import { registerIgnoredTransitionHook } from '../hooks/ignoredTransition';
import { registerInvalidTransitionHook } from '../hooks/invalidTransition';

/**
 * The default [[Transition]] options.
 *
 * Include this object when applying custom defaults:
 * let reloadOpts = { reload: true, notify: true }
 * let options = defaults(theirOpts, customDefaults, defaultOptions);
 */
export let defaultTransOpts: TransitionOptions = {
  location    : true,
  relative    : null,
  inherit     : false,
  notify      : true,
  reload      : false,
  custom      : {},
  current     : () => null,
  source      : "unknown"
};


/**
 * Plugin API for Transition Service
 * @internalapi
 */
export interface TransitionServicePluginAPI {
  /**
   * Adds a Path to be used as a criterion against a TreeChanges path
   *
   * For example: the `exiting` path in [[HookMatchCriteria]] is a STATE scoped path.
   * It was defined by calling `defineTreeChangesCriterion('exiting', TransitionHookScope.STATE)`
   * Each state in the exiting path is checked against the criteria and returned as part of the match.
   *
   * Another example: the `to` path in [[HookMatchCriteria]] is a TRANSITION scoped path.
   * It was defined by calling `defineTreeChangesCriterion('to', TransitionHookScope.TRANSITION)`
   * Only the tail of the `to` path is checked against the criteria and returned as part of the match.
   */
  _definePathType(name: string, hookScope: TransitionHookScope);

  /**
   * Gets a Path definition used as a criterion against a TreeChanges path
   */
  _getPathTypes(): PathTypes;

  /**
   * Defines a transition hook type and returns a transition hook registration
   * function (which can then be used to register hooks of this type).
   */
  _defineEvent(name: string,
               hookPhase: TransitionHookPhase,
               hookOrder: number,
               criteriaMatchPath: PathType,
               reverseSort?: boolean,
               getResultHandler?: GetResultHandler,
               getErrorHandler?: GetErrorHandler,
               rejectIfSuperseded?: boolean);

  /**
   * Returns the known event types, such as `onBefore`
   * If a phase argument is provided, returns only events for the given phase.
   */
  _getEvents(phase?: TransitionHookPhase): TransitionEventType[];

  /** Returns the hooks registered for the given hook name */
  getHooks(hookName: string): RegisteredHook[];
}

/**
 * This class provides services related to Transitions.
 *
 * - Most importantly, it allows global Transition Hooks to be registered.
 * - It allows the default transition error handler to be set.
 * - It also has a factory function for creating new [[Transition]] objects, (used internally by the [[StateService]]).
 *
 * At bootstrap, [[UIRouter]] creates a single instance (singleton) of this class.
 */
export class TransitionService implements IHookRegistry, Disposable {
  /** @hidden */
  _transitionCount = 0;

  /**
   * Registers a [[TransitionHookFn]], called *while a transition is being constructed*.
   *
   * Registers a transition lifecycle hook, which is invoked during transition construction.
   *
   * This low level hook should only be used by plugins.
   * This can be a useful time for plugins to add resolves or mutate the transition as needed.
   * The Sticky States plugin uses this hook to modify the treechanges.
   *
   * ### Lifecycle
   *
   * `onCreate` hooks are invoked *while a transition is being constructed*.
   *
   * ### Return value
   *
   * The hook's return value is ignored
   *
   * @internalapi
   * @param criteria defines which Transitions the Hook should be invoked for.
   * @param callback the hook function which will be invoked.
   * @param options the registration options
   * @returns a function which deregisters the hook.
   */
  onCreate(criteria: HookMatchCriteria, callback: TransitionCreateHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onBefore(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onStart(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onExit(criteria: HookMatchCriteria, callback: TransitionStateHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onRetain(criteria: HookMatchCriteria, callback: TransitionStateHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onEnter(criteria: HookMatchCriteria, callback: TransitionStateHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onFinish(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onSuccess(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return }
  /** @inheritdoc */
  onError(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return }

  /** @hidden */
  public $view: ViewService;

  /** @hidden The transition hook types, such as `onEnter`, `onStart`, etc */
  private _eventTypes: TransitionEventType[] = [];
  /** @hidden The registered transition hooks */
  _registeredHooks = { } as RegisteredHooks;
  /** @hidden The  paths on a criteria object */
  private _criteriaPaths = { } as PathTypes;
  /** @hidden */
  private _router: UIRouter;

  /** @internalapi */
  _pluginapi: TransitionServicePluginAPI;

  /**
   * This object has hook de-registration functions for the built-in hooks.
   * This can be used by third parties libraries that wish to customize the behaviors
   *
   * @hidden
   */
  _deregisterHookFns: {
    addCoreResolves: Function;
    ignored: Function;
    invalid: Function;
    redirectTo: Function;
    onExit: Function;
    onRetain: Function;
    onEnter: Function;
    eagerResolve: Function;
    lazyResolve: Function;
    loadViews: Function;
    activateViews: Function;
    updateGlobals: Function;
    updateUrl: Function;
    lazyLoad: Function;
  };

  /** @hidden */
  constructor(_router: UIRouter) {
    this._router = _router;
    this.$view = _router.viewService;
    this._deregisterHookFns = <any> {};
    this._pluginapi = <TransitionServicePluginAPI> createProxyFunctions(val(this), {}, val(this), [
      '_definePathType',
      '_defineEvent',
      '_getPathTypes',
      '_getEvents',
      'getHooks',
    ]);

    this._defineCorePaths();
    this._defineCoreEvents();
    this._registerCoreTransitionHooks();
  }

  /**
   * dispose
   * @internalapi
   */
  dispose(router: UIRouter) {
    values(this._registeredHooks).forEach((hooksArray: RegisteredHook[]) => hooksArray.forEach(hook => {
      hook._deregistered = true;
      removeFrom(hooksArray, hook);
    }));
  }

  /**
   * Creates a new [[Transition]] object
   *
   * This is a factory function for creating new Transition objects.
   * It is used internally by the [[StateService]] and should generally not be called by application code.
   *
   * @param fromPath the path to the current state (the from state)
   * @param targetState the target state (destination)
   * @returns a Transition
   */
  create(fromPath: PathNode[], targetState: TargetState): Transition {
    return new Transition(fromPath, targetState, this._router);
  }

  /** @hidden */
  private _defineCoreEvents() {
    const Phase = TransitionHookPhase;
    const TH = TransitionHook;
    const paths = this._criteriaPaths;
    const NORMAL_SORT = false, REVERSE_SORT = true;
    const ASYNCHRONOUS = false, SYNCHRONOUS = true;

    this._defineEvent("onCreate",  Phase.CREATE,  0,   paths.to, NORMAL_SORT, TH.LOG_REJECTED_RESULT, TH.THROW_ERROR, SYNCHRONOUS);

    this._defineEvent("onBefore",  Phase.BEFORE,  0,   paths.to);

    this._defineEvent("onStart",   Phase.RUN,     0,   paths.to);
    this._defineEvent("onExit",    Phase.RUN,     100, paths.exiting, REVERSE_SORT);
    this._defineEvent("onRetain",  Phase.RUN,     200, paths.retained);
    this._defineEvent("onEnter",   Phase.RUN,     300, paths.entering);
    this._defineEvent("onFinish",  Phase.RUN,     400, paths.to);

    this._defineEvent("onSuccess", Phase.SUCCESS, 0,   paths.to, NORMAL_SORT, TH.LOG_REJECTED_RESULT, TH.LOG_ERROR, SYNCHRONOUS);
    this._defineEvent("onError",   Phase.ERROR,   0,   paths.to, NORMAL_SORT, TH.LOG_REJECTED_RESULT, TH.LOG_ERROR, SYNCHRONOUS);
  }

  /** @hidden */
  private _defineCorePaths() {
    const { STATE, TRANSITION } = TransitionHookScope;

    this._definePathType("to", TRANSITION);
    this._definePathType("from", TRANSITION);
    this._definePathType("exiting", STATE);
    this._definePathType("retained", STATE);
    this._definePathType("entering", STATE);
  }

  /** @hidden */
  _defineEvent(name: string,
               hookPhase: TransitionHookPhase,
               hookOrder: number,
               criteriaMatchPath: PathType,
               reverseSort: boolean = false,
               getResultHandler: GetResultHandler = TransitionHook.HANDLE_RESULT,
               getErrorHandler: GetErrorHandler = TransitionHook.REJECT_ERROR,
               synchronous: boolean = false)
  {
    let eventType = new TransitionEventType(name, hookPhase, hookOrder, criteriaMatchPath, reverseSort, getResultHandler, getErrorHandler, synchronous);

    this._eventTypes.push(eventType);
    makeEvent(this, this, eventType);
  };

  /** @hidden */
  private _getEvents(phase?: TransitionHookPhase): TransitionEventType[] {
    let transitionHookTypes = isDefined(phase) ?
        this._eventTypes.filter(type => type.hookPhase === phase) :
        this._eventTypes.slice();

    return transitionHookTypes.sort((l, r) => {
      let cmpByPhase = l.hookPhase - r.hookPhase;
      return cmpByPhase === 0 ? l.hookOrder - r.hookOrder : cmpByPhase;
    })
  }

  /**
   * Adds a Path to be used as a criterion against a TreeChanges path
   *
   * For example: the `exiting` path in [[HookMatchCriteria]] is a STATE scoped path.
   * It was defined by calling `defineTreeChangesCriterion('exiting', TransitionHookScope.STATE)`
   * Each state in the exiting path is checked against the criteria and returned as part of the match.
   *
   * Another example: the `to` path in [[HookMatchCriteria]] is a TRANSITION scoped path.
   * It was defined by calling `defineTreeChangesCriterion('to', TransitionHookScope.TRANSITION)`
   * Only the tail of the `to` path is checked against the criteria and returned as part of the match.
   *
   * @hidden
   */
  private _definePathType(name: string, hookScope: TransitionHookScope) {
    this._criteriaPaths[name] = { name, scope: hookScope };
  }

  /** * @hidden */
  private _getPathTypes(): PathTypes {
    return this._criteriaPaths;
  }

  /** @hidden */
  public getHooks(hookName: string): RegisteredHook[] {
    return this._registeredHooks[hookName];
  }

  /** @hidden */
  private _registerCoreTransitionHooks() {
    let fns = this._deregisterHookFns;

    fns.addCoreResolves = registerAddCoreResolvables(this);
    fns.ignored         = registerIgnoredTransitionHook(this);
    fns.invalid         = registerInvalidTransitionHook(this);

    // Wire up redirectTo hook
    fns.redirectTo      = registerRedirectToHook(this);
    
    // Wire up onExit/Retain/Enter state hooks
    fns.onExit          = registerOnExitHook(this);
    fns.onRetain        = registerOnRetainHook(this);
    fns.onEnter         = registerOnEnterHook(this);

    // Wire up Resolve hooks
    fns.eagerResolve    = registerEagerResolvePath(this);
    fns.lazyResolve     = registerLazyResolveState(this);
                                 
    // Wire up the View management hooks
    fns.loadViews       = registerLoadEnteringViews(this);
    fns.activateViews   = registerActivateViews(this);

    // Updates global state after a transition
    fns.updateGlobals   = registerUpdateGlobalState(this);

    // After globals.current is updated at priority: 10000
    fns.updateUrl       = registerUpdateUrl(this);

    // Lazy load state trees
    fns.lazyLoad        = registerLazyLoadHook(this);
  }
}
