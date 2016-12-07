/** @coreapi @module transition */ /** for typedoc */
import {
    IHookRegistry, TransitionOptions, TransitionHookScope, TransitionHookPhase,
    TransitionCreateHookFn
} from "./interface";

import {
  HookMatchCriteria, HookRegOptions, TransitionStateHookFn, TransitionHookFn
} from "./interface"; // has or is using

import {Transition} from "./transition";
import {RegisteredHooks, makeEvent, RegisteredHook} from "./hookRegistry";
import {TargetState} from "../state/targetState";
import {PathNode} from "../path/node";
import {ViewService} from "../view/view";
import {UIRouter} from "../router";

import {registerEagerResolvePath, registerLazyResolveState} from "../hooks/resolve";
import {registerLoadEnteringViews, registerActivateViews} from "../hooks/views";
import {registerUpdateUrl} from "../hooks/url";
import {registerRedirectToHook} from "../hooks/redirectTo";
import {registerOnExitHook, registerOnRetainHook, registerOnEnterHook} from "../hooks/onEnterExitRetain";
import {registerLazyLoadHook} from "../hooks/lazyLoad";
import {TransitionEventType} from "./transitionEventType";
import { TransitionHook, GetResultHandler, GetErrorHandler } from "./transitionHook";
import {isDefined} from "../common/predicates";
import { removeFrom, values, bindFunctions } from "../common/common";
import { Disposable } from "../interface";

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
   * `onBefore` hooks are invoked *while a transition is being constructed*.
   *
   * ### Return value
   *
   * The hook's return value is ignored
   *
   * @internalapi
   * @param matchCriteria defines which Transitions the Hook should be invoked for.
   * @param callback the hook function which will be invoked.
   * @returns a function which deregisters the hook.
   */
  onCreate: (criteria: HookMatchCriteria, callback: TransitionCreateHookFn, options?: HookRegOptions) => Function;
  /** @inheritdoc */
  onBefore;
  /** @inheritdoc */
  onStart;
  /** @inheritdoc */
  onExit;
  /** @inheritdoc */
  onRetain;
  /** @inheritdoc */
  onEnter;
  /** @inheritdoc */
  onFinish;
  /** @inheritdoc */
  onSuccess;
  /** @inheritdoc */
  onError;

  /** @hidden */
  public $view: ViewService;

  /** @hidden The transition hook types, such as `onEnter`, `onStart`, etc */
  private _eventTypes: TransitionEventType[] = [];
  /** @hidden The registered transition hooks */
  _registeredHooks: RegisteredHooks = { };

  /**
   * This object has hook de-registration functions for the built-in hooks.
   * This can be used by third parties libraries that wish to customize the behaviors
   *
   * @hidden
   */
  _deregisterHookFns: {
    redirectTo: Function;
    onExit: Function;
    onRetain: Function;
    onEnter: Function;
    eagerResolve: Function;
    lazyResolve: Function;
    loadViews: Function;
    activateViews: Function;
    updateUrl: Function;
    lazyLoad: Function;
  };

  constructor(private _router: UIRouter) {
    this.$view = _router.viewService;
    this._deregisterHookFns = <any> {};
    this.registerTransitionHookTypes();
    this.registerTransitionHooks();
  }

  /** @internalapi */
  dispose(router: UIRouter) {
    delete router.globals.transition;

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
  private registerTransitionHookTypes() {
    const Scope = TransitionHookScope;
    const Phase = TransitionHookPhase;
    const TH = TransitionHook;

    this.defineEvent("onCreate",  Phase.CREATE,  Scope.TRANSITION,  0,  "to", false, TH.IGNORE_RESULT, TH.THROW_ERROR, false);

    this.defineEvent("onBefore",  Phase.BEFORE,  Scope.TRANSITION,  0,  "to", false, TH.HANDLE_RESULT);

    this.defineEvent("onStart",   Phase.ASYNC,   Scope.TRANSITION,  0,  "to");
    this.defineEvent("onExit",    Phase.ASYNC,   Scope.STATE,       100, "exiting", true);
    this.defineEvent("onRetain",  Phase.ASYNC,   Scope.STATE,       200, "retained");
    this.defineEvent("onEnter",   Phase.ASYNC,   Scope.STATE,       300, "entering");
    this.defineEvent("onFinish",  Phase.ASYNC,   Scope.TRANSITION,  400, "to");

    this.defineEvent("onSuccess", Phase.SUCCESS, Scope.TRANSITION,  0,  "to", false, TH.IGNORE_RESULT, TH.LOG_ERROR, false);
    this.defineEvent("onError",   Phase.ERROR,   Scope.TRANSITION,  0,  "to", false, TH.IGNORE_RESULT, TH.LOG_ERROR, false);
  }

  _pluginapi = <TransitionServicePluginAPI> bindFunctions(this, {}, this, [
      'registerTransitionHookType',
      'getTransitionEventTypes',
      'getHooks',
  ]);

  /**
   * Defines a transition hook type and returns a transition hook registration
   * function (which can then be used to register hooks of this type).
   * @internalapi
   */
  defineEvent(name: string,
              hookPhase: TransitionHookPhase,
              hookScope: TransitionHookScope,
              hookOrder: number,
              criteriaMatchPath: string,
              reverseSort: boolean = false,
              getResultHandler: GetResultHandler = TransitionHook.HANDLE_RESULT,
              getErrorHandler: GetErrorHandler = TransitionHook.REJECT_ERROR,
              rejectIfSuperseded: boolean = true)
  {
    let eventType = new TransitionEventType(name, hookPhase,  hookScope, hookOrder, criteriaMatchPath, reverseSort, getResultHandler, getErrorHandler, rejectIfSuperseded);

    this._eventTypes.push(eventType);
    makeEvent(this, this, eventType);
  };


  /**
   * @hidden
   * Returns the known event types, such as `onBefore`
   * If a phase argument is provided, returns only events for the given phase.
   */
  private getTransitionEventTypes(phase?: TransitionHookPhase): TransitionEventType[] {
    let transitionHookTypes = isDefined(phase) ?
        this._eventTypes.filter(type => type.hookPhase === phase) :
        this._eventTypes.slice();

    return transitionHookTypes.sort((l, r) => {
      let cmpByPhase = l.hookPhase - r.hookPhase;
      return cmpByPhase === 0 ? l.hookOrder - r.hookOrder : cmpByPhase;
    })
  }

  /** @hidden */
  public getHooks(hookName: string): RegisteredHook[] {
    return this._registeredHooks[hookName];
  }

  /** @hidden */
  private registerTransitionHooks() {
    let fns = this._deregisterHookFns;

    // Wire up redirectTo hook
    fns.redirectTo    = registerRedirectToHook(this);
    
    // Wire up onExit/Retain/Enter state hooks
    fns.onExit        = registerOnExitHook(this);
    fns.onRetain      = registerOnRetainHook(this);
    fns.onEnter       = registerOnEnterHook(this);

    // Wire up Resolve hooks
    fns.eagerResolve  = registerEagerResolvePath(this);
    fns.lazyResolve   = registerLazyResolveState(this);

    // Wire up the View management hooks
    fns.loadViews     = registerLoadEnteringViews(this);
    fns.activateViews = registerActivateViews(this);

    // After globals.current is updated at priority: 10000
    fns.updateUrl     = registerUpdateUrl(this);

    // Lazy load state trees
    fns.lazyLoad      = registerLazyLoadHook(this);
  }
}

export interface TransitionServicePluginAPI {
  registerTransitionHookType(hookType: TransitionEventType): void;
  getTransitionEventTypes(phase?: TransitionHookPhase): TransitionEventType[];
  getHooks(hookName: string): RegisteredHook[];
}