/** @coreapi @module transition */ /** for typedoc */
import {IHookRegistry, TransitionOptions, TransitionHookScope, TransitionHookPhase} from "./interface";

import {
  HookMatchCriteria, HookRegOptions, TransitionStateHookFn, TransitionHookFn
} from "./interface"; // has or is using

import {Transition} from "./transition";
import {IEventHooks, makeHookRegistrationFn} from "./hookRegistry";
import {TargetState} from "../state/targetState";
import {PathNode} from "../path/node";
import {IEventHook} from "./interface";
import {ViewService} from "../view/view";
import {UIRouter} from "../router";

import {registerEagerResolvePath, registerLazyResolveState} from "../hooks/resolve";
import {registerLoadEnteringViews, registerActivateViews} from "../hooks/views";
import {registerUpdateUrl} from "../hooks/url";
import {registerRedirectToHook} from "../hooks/redirectTo";
import {registerOnExitHook, registerOnRetainHook, registerOnEnterHook} from "../hooks/onEnterExitRetain";
import {registerLazyLoadHook} from "../hooks/lazyLoadStates";
import {TransitionHookType} from "./transitionHookType";

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
  private _transitionHooks: IEventHooks = { };

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

    let hookTypes = [
      new TransitionHookType("onBefore",  Scope.TRANSITION, Phase.BEFORE,  0,  "to",       t => t.treeChanges("to")),
      new TransitionHookType("onStart",   Scope.TRANSITION, Phase.ASYNC,   0,  "to",       t => t.treeChanges("to")),
      new TransitionHookType("onExit",    Scope.STATE,      Phase.ASYNC,   10, "exiting",  t => t.treeChanges("from"), true),
      new TransitionHookType("onRetain",  Scope.STATE,      Phase.ASYNC,   20, "retained", t => t.treeChanges("to")),
      new TransitionHookType("onEnter",   Scope.STATE,      Phase.ASYNC,   30, "entering", t => t.treeChanges("to")),
      new TransitionHookType("onFinish",  Scope.TRANSITION, Phase.ASYNC,   40, "to",       t => t.treeChanges("to")),
      new TransitionHookType("onSuccess", Scope.TRANSITION, Phase.SUCCESS, 0,  "to",       t => t.treeChanges("to")),
      new TransitionHookType("onError",   Scope.TRANSITION, Phase.ERROR,   0,  "to",       t => t.treeChanges("to")),
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
    return makeHookRegistrationFn(this._transitionHooks, hookType.name);
  }

  getTransitionHookTypes(phase?: TransitionHookPhase): TransitionHookType[] {
    let transitionHookTypes = phase ?
        this._transitionHookTypes.filter(type => type.hookPhase === phase) :
        this._transitionHookTypes.slice();

    return transitionHookTypes.sort((l, r) => {
      let byphase = l.hookPhase - r.hookPhase;
      return byphase === 0 ? l.hookOrder - r.hookOrder : byphase;
    })
  }

  /** @hidden */
  getHooks(hookName: string): IEventHook[] {
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
