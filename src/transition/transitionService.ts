/** @coreapi @module transition */ /** for typedoc */
import {
    IHookRegistry, TransitionOptions, TransitionHookScope, TransitionHookPhase,
    TransitionCreateHookFn
} from "./interface";

import {
  HookMatchCriteria, HookRegOptions, TransitionStateHookFn, TransitionHookFn
} from "./interface"; // has or is using

import {Transition} from "./transition";
import {RegisteredHooks, makeHookRegistrationFn, RegisteredHook} from "./hookRegistry";
import {TargetState} from "../state/targetState";
import {PathNode} from "../path/node";
import {ViewService} from "../view/view";
import {UIRouter} from "../router";

import {registerEagerResolvePath, registerLazyResolveState} from "../hooks/resolve";
import {registerLoadEnteringViews, registerActivateViews} from "../hooks/views";
import {registerUpdateUrl} from "../hooks/url";
import {registerRedirectToHook} from "../hooks/redirectTo";
import {registerOnExitHook, registerOnRetainHook, registerOnEnterHook} from "../hooks/onEnterExitRetain";
import {registerLazyLoadHook} from "../hooks/lazyLoadStates";
import {TransitionHookType} from "./transitionHookType";
import {TransitionHook} from "./transitionHook";
import {isDefined} from "../common/predicates";

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
export class TransitionService implements IHookRegistry {

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
  private _transitionHookTypes: TransitionHookType[] = [];
  /** @hidden The registered transition hooks */
  private _transitionHooks: RegisteredHooks = { };

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

    const to = (transition: Transition) =>
        transition.treeChanges('to');
    const from = (transition: Transition) =>
        transition.treeChanges('from');

    let hookTypes = [
      new TransitionHookType("onCreate",  Phase.CREATE,  Scope.TRANSITION,  0,  "to",       to,   false, TH.IGNORE_RESULT, TH.THROW_ERROR, false),

      new TransitionHookType("onBefore",  Phase.BEFORE,  Scope.TRANSITION,  0,  "to",       to,   false, TH.HANDLE_RESULT),

      new TransitionHookType("onStart",   Phase.ASYNC,   Scope.TRANSITION,  0,  "to",       to),
      new TransitionHookType("onExit",    Phase.ASYNC,   Scope.STATE,       10, "exiting",  from, true),
      new TransitionHookType("onRetain",  Phase.ASYNC,   Scope.STATE,       20, "retained", to),
      new TransitionHookType("onEnter",   Phase.ASYNC,   Scope.STATE,       30, "entering", to),
      new TransitionHookType("onFinish",  Phase.ASYNC,   Scope.TRANSITION,  40, "to",       to),

      new TransitionHookType("onSuccess", Phase.SUCCESS, Scope.TRANSITION,  0,  "to",       to,   false, TH.IGNORE_RESULT, TH.LOG_ERROR, false),
      new TransitionHookType("onError",   Phase.ERROR,   Scope.TRANSITION,  0,  "to",       to,   false, TH.IGNORE_RESULT, TH.LOG_ERROR, false),
    ];

    hookTypes.forEach(type => this[type.name] = this.registerTransitionHookType(type))
  }

  /**
   * Defines a transition hook type and returns a transition hook registration
   * function (which can then be used to register hooks of this type).
   * @internalapi
   */
  registerTransitionHookType(hookType: TransitionHookType) {
    this._transitionHookTypes.push(hookType);
    return makeHookRegistrationFn(this._transitionHooks, hookType);
  }

  getTransitionHookTypes(phase?: TransitionHookPhase): TransitionHookType[] {
    let transitionHookTypes = isDefined(phase) ?
        this._transitionHookTypes.filter(type => type.hookPhase === phase) :
        this._transitionHookTypes.slice();

    return transitionHookTypes.sort((l, r) => {
      let byphase = l.hookPhase - r.hookPhase;
      return byphase === 0 ? l.hookOrder - r.hookOrder : byphase;
    })
  }

  /** @hidden */
  getHooks(hookName: string): RegisteredHook[] {
    return this._transitionHooks[hookName];
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
