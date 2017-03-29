/**
 * @coreapi
 * @module state
 */
/** */
import { createProxyFunctions, defaults, extend, inArray, noop, removeFrom, silenceUncaughtInPromise, silentRejection } from '../common/common';
import { isDefined, isObject, isString } from '../common/predicates';
import { Queue } from '../common/queue';
import { services } from '../common/coreservices';

import { PathFactory } from '../path/pathFactory';
import { PathNode } from '../path/node';

import { HookResult, TransitionOptions } from '../transition/interface';
import { defaultTransOpts } from '../transition/transitionService';
import { Rejection, RejectType } from '../transition/rejectFactory';
import { Transition } from '../transition/transition';

import { HrefOptions, LazyLoadResult, StateDeclaration, StateOrName, TransitionPromise } from './interface';
import { StateObject } from './stateObject';
import { TargetState } from './targetState';

import { ParamsOrArray, RawParams } from '../params/interface';
import { Param } from '../params/param';
import { Glob } from '../common/glob';
import { UIRouter } from '../router';
import { UIInjector } from '../interface';
import { ResolveContext } from '../resolve/resolveContext';
import { lazyLoadState } from '../hooks/lazyLoad';
import { not, val } from '../common/hof';
import { StateParams } from '../params/stateParams';

export type OnInvalidCallback =
    (toState?: TargetState, fromState?: TargetState, injector?: UIInjector) => HookResult;

/**
 * Provides state related service functions
 *
 * This class provides services related to ui-router states.
 * An instance of this class is located on the global [[UIRouter]] object.
 */
export class StateService {
  /** @internalapi */
  invalidCallbacks: OnInvalidCallback[] = [];

  /**
   * The [[Transition]] currently in progress (or null)
   *
   * This is a passthrough through to [[UIRouterGlobals.transition]]
   */
  get transition() { return this.router.globals.transition; }
  /**
   * The latest successful state parameters
   *
   * This is a passthrough through to [[UIRouterGlobals.params]]
   */
  get params(): StateParams { return this.router.globals.params; }
  /**
   * The current [[StateDeclaration]]
   *
   * This is a passthrough through to [[UIRouterGlobals.current]]
   */
  get current() { return this.router.globals.current; }
  /**
   * The current [[StateObject]]
   *
   * This is a passthrough through to [[UIRouterGlobals.$current]]
   */
  get $current() { return this.router.globals.$current; }

  /** @internalapi */
  constructor(private router: UIRouter) {
    let getters = ['current', '$current', 'params', 'transition'];
    let boundFns = Object.keys(StateService.prototype).filter(not(inArray(getters)));
    createProxyFunctions(val(StateService.prototype), this, val(this), boundFns);
  }

  /** @internalapi */
  dispose() {
    this.defaultErrorHandler(noop);
    this.invalidCallbacks = [];
  }

  /**
   * Handler for when [[transitionTo]] is called with an invalid state.
   *
   * Invokes the [[onInvalid]] callbacks, in natural order.
   * Each callback's return value is checked in sequence until one of them returns an instance of TargetState.
   * The results of the callbacks are wrapped in $q.when(), so the callbacks may return promises.
   *
   * If a callback returns an TargetState, then it is used as arguments to $state.transitionTo() and the result returned.
   *
   * @internalapi
   */
  private _handleInvalidTargetState(fromPath: PathNode[], toState: TargetState) {
    let fromState = PathFactory.makeTargetState(fromPath);
    let globals = this.router.globals;
    const latestThing = () => globals.transitionHistory.peekTail();
    let latest = latestThing();
    let callbackQueue = new Queue<OnInvalidCallback>(this.invalidCallbacks.slice());
    let injector = new ResolveContext(fromPath).injector();

    const checkForRedirect = (result: HookResult) => {
      if (!(result instanceof TargetState)) {
        return;
      }
      let target = <TargetState> result;
      // Recreate the TargetState, in case the state is now defined.
      target = this.target(target.identifier(), target.params(), target.options());

      if (!target.valid()) return Rejection.invalid(target.error()).toPromise();
      if (latestThing() !== latest) return Rejection.superseded().toPromise();

      return this.transitionTo(target.identifier(), target.params(), target.options());
    };

    function invokeNextCallback() {
      let nextCallback = callbackQueue.dequeue();
      if (nextCallback === undefined) return Rejection.invalid(toState.error()).toPromise();

      let callbackResult = services.$q.when(nextCallback(toState, fromState, injector));
      return callbackResult.then(checkForRedirect).then(result => result || invokeNextCallback());
    }

    return invokeNextCallback();
  }

  /**
   * Registers an Invalid State handler
   *
   * Registers a [[OnInvalidCallback]] function to be invoked when [[StateService.transitionTo]]
   * has been called with an invalid state reference parameter
   *
   * Example:
   * ```js
   * stateService.onInvalid(function(to, from, injector) {
   *   if (to.name() === 'foo') {
   *     let lazyLoader = injector.get('LazyLoadService');
   *     return lazyLoader.load('foo')
   *         .then(() => stateService.target('foo'));
   *   }
   * });
   * ```
   *
   * @param {function} callback invoked when the toState is invalid
   *   This function receives the (invalid) toState, the fromState, and an injector.
   *   The function may optionally return a [[TargetState]] or a Promise for a TargetState.
   *   If one is returned, it is treated as a redirect.
   *
   * @returns a function which deregisters the callback
   */
  onInvalid(callback: OnInvalidCallback): Function {
    this.invalidCallbacks.push(callback);
    return function deregisterListener() {
      removeFrom(this.invalidCallbacks)(callback);
    }.bind(this);
  }


  /**
   * Reloads the current state
   *
   * A method that force reloads the current state, or a partial state hierarchy.
   * All resolves are re-resolved, and components reinstantiated.
   *
   * #### Example:
   * ```js
   * let app angular.module('app', ['ui.router']);
   *
   * app.controller('ctrl', function ($scope, $state) {
   *   $scope.reload = function(){
   *     $state.reload();
   *   }
   * });
   * ```
   *
   * Note: `reload()` is just an alias for:
   *
   * ```js
   * $state.transitionTo($state.current, $state.params, {
   *   reload: true, inherit: false
   * });
   * ```
   *
   * @param reloadState A state name or a state object.
   *    If present, this state and all its children will be reloaded, but ancestors will not reload.
   *
   * #### Example:
   * ```js
   * //assuming app application consists of 3 states: 'contacts', 'contacts.detail', 'contacts.detail.item'
   * //and current state is 'contacts.detail.item'
   * let app angular.module('app', ['ui.router']);
   *
   * app.controller('ctrl', function ($scope, $state) {
   *   $scope.reload = function(){
   *     //will reload 'contact.detail' and nested 'contact.detail.item' states
   *     $state.reload('contact.detail');
   *   }
   * });
   * ```
   *
   * @returns A promise representing the state of the new transition. See [[StateService.go]]
   */
  reload(reloadState?: StateOrName): Promise<StateObject> {
    return this.transitionTo(this.current, this.params, {
      reload: isDefined(reloadState) ? reloadState : true,
      inherit: false,
      notify: false,
    });
  };

  /**
   * Transition to a different state and/or parameters
   *
   * Convenience method for transitioning to a new state.
   *
   * `$state.go` calls `$state.transitionTo` internally but automatically sets options to
   * `{ location: true, inherit: true, relative: router.globals.$current, notify: true }`.
   * This allows you to use either an absolute or relative `to` argument (because of `relative: router.globals.$current`).
   * It also allows you to specify * only the parameters you'd like to update, while letting unspecified parameters
   * inherit from the current parameter values (because of `inherit: true`).
   *
   * #### Example:
   * ```js
   * let app = angular.module('app', ['ui.router']);
   *
   * app.controller('ctrl', function ($scope, $state) {
   *   $scope.changeState = function () {
   *     $state.go('contact.detail');
   *   };
   * });
   * ```
   *
   * @param to Absolute state name, state object, or relative state path (relative to current state).
   *
   * Some examples:
   *
   * - `$state.go('contact.detail')` - will go to the `contact.detail` state
   * - `$state.go('^')` - will go to the parent state
   * - `$state.go('^.sibling')` - if current state is `home.child`, will go to the `home.sibling` state
   * - `$state.go('.child.grandchild')` - if current state is home, will go to the `home.child.grandchild` state
   *
   * @param params A map of the parameters that will be sent to the state, will populate $stateParams.
   *
   *    Any parameters that are not specified will be inherited from current parameter values (because of `inherit: true`).
   *    This allows, for example, going to a sibling state that shares parameters defined by a parent state.
   *
   * @param options Transition options
   *
   * @returns {promise} A promise representing the state of the new transition.
   */
  go(to: StateOrName, params?: RawParams, options?: TransitionOptions): TransitionPromise {
    let defautGoOpts = { relative: this.$current, inherit: true };
    let transOpts = defaults(options, defautGoOpts, defaultTransOpts);
    return this.transitionTo(to, params, transOpts);
  };

  /**
   * Creates a [[TargetState]]
   *
   * This is a factory method for creating a TargetState
   *
   * This may be returned from a Transition Hook to redirect a transition, for example.
   */
  target(identifier: StateOrName, params?: ParamsOrArray, options: TransitionOptions = {}): TargetState {
    // If we're reloading, find the state object to reload from
    if (isObject(options.reload) && !(<any>options.reload).name)
      throw new Error('Invalid reload state object');
    let reg = this.router.stateRegistry;
    options.reloadState = options.reload === true ? reg.root() : reg.matcher.find(<any> options.reload, options.relative);

    if (options.reload && !options.reloadState)
      throw new Error(`No such reload state '${(isString(options.reload) ? options.reload : (<any>options.reload).name)}'`);

    let stateDefinition = reg.matcher.find(identifier, options.relative);
    return new TargetState(identifier, stateDefinition, params, options);
  };

  private getCurrentPath(): PathNode[] {
    let globals = this.router.globals;
    let latestSuccess: Transition = globals.successfulTransitions.peekTail();
    const rootPath = () => [ new PathNode(this.router.stateRegistry.root()) ];
    return latestSuccess ? latestSuccess.treeChanges().to : rootPath();
  }

  /**
   * Low-level method for transitioning to a new state.
   *
   * The [[go]] method (which uses `transitionTo` internally) is recommended in most situations.
   *
   * #### Example:
   * ```js
   * let app = angular.module('app', ['ui.router']);
   *
   * app.controller('ctrl', function ($scope, $state) {
   *   $scope.changeState = function () {
   *     $state.transitionTo('contact.detail');
   *   };
   * });
   * ```
   *
   * @param to State name or state object.
   * @param toParams A map of the parameters that will be sent to the state,
   *      will populate $stateParams.
   * @param options Transition options
   *
   * @returns A promise representing the state of the new transition. See [[go]]
   */
  transitionTo(to: StateOrName, toParams: RawParams = {}, options: TransitionOptions = {}): TransitionPromise {
    let router = this.router;
    let globals = router.globals;
    options = defaults(options, defaultTransOpts);
    const getCurrent = () =>
        globals.transition;
    options = extend(options, { current: getCurrent });

    let ref: TargetState = this.target(to, toParams, options);
    let currentPath = this.getCurrentPath();

    if (!ref.exists())
      return this._handleInvalidTargetState(currentPath, ref);

    if (!ref.valid())
      return <TransitionPromise> silentRejection(ref.error());

    /**
     * Special handling for Ignored, Aborted, and Redirected transitions
     *
     * The semantics for the transition.run() promise and the StateService.transitionTo()
     * promise differ. For instance, the run() promise may be rejected because it was
     * IGNORED, but the transitionTo() promise is resolved because from the user perspective
     * no error occurred.  Likewise, the transition.run() promise may be rejected because of
     * a Redirect, but the transitionTo() promise is chained to the new Transition's promise.
     */
    const rejectedTransitionHandler = (transition: Transition) => (error: any): Promise<any> => {
      if (error instanceof Rejection) {
        if (error.type === RejectType.IGNORED) {
          // Consider ignored `Transition.run()` as a successful `transitionTo`
          router.urlRouter.update();
          return services.$q.when(globals.current);
        }

        const detail: any = error.detail;
        if (error.type === RejectType.SUPERSEDED && error.redirected && detail instanceof TargetState) {
          // If `Transition.run()` was redirected, allow the `transitionTo()` promise to resolve successfully
          // by returning the promise for the new (redirect) `Transition.run()`.
          let redirect: Transition = transition.redirect(detail);
          return redirect.run().catch(rejectedTransitionHandler(redirect));
        }

        if (error.type === RejectType.ABORTED) {
          router.urlRouter.update();
          return services.$q.reject(error);
        }
      }

      let errorHandler = this.defaultErrorHandler();
      errorHandler(error);

      return services.$q.reject(error);
    };

    let transition = this.router.transitionService.create(currentPath, ref);
    let transitionToPromise = transition.run().catch(rejectedTransitionHandler(transition));
    silenceUncaughtInPromise(transitionToPromise); // issue #2676

    // Return a promise for the transition, which also has the transition object on it.
    return extend(transitionToPromise, { transition });
  };

  /**
   * Checks if the current state *is* the provided state
   *
   * Similar to [[includes]] but only checks for the full state name.
   * If params is supplied then it will be tested for strict equality against the current
   * active params object, so all params must match with none missing and no extras.
   *
   * #### Example:
   * ```js
   * $state.$current.name = 'contacts.details.item';
   *
   * // absolute name
   * $state.is('contact.details.item'); // returns true
   * $state.is(contactDetailItemStateObject); // returns true
   * ```
   *
   * // relative name (. and ^), typically from a template
   * // E.g. from the 'contacts.details' template
   * ```html
   * <div ng-class="{highlighted: $state.is('.item')}">Item</div>
   * ```
   *
   * @param stateOrName The state name (absolute or relative) or state object you'd like to check.
   * @param params A param object, e.g. `{sectionId: section.id}`, that you'd like
   * to test against the current active state.
   * @param options An options object. The options are:
   *   - `relative`: If `stateOrName` is a relative state name and `options.relative` is set, .is will
   *     test relative to `options.relative` state (or name).
   *
   * @returns Returns true if it is the state.
   */
  is(stateOrName: StateOrName, params?: RawParams, options?: { relative?: StateOrName }): boolean {
    options = defaults(options, { relative: this.$current });
    let state = this.router.stateRegistry.matcher.find(stateOrName, options.relative);
    if (!isDefined(state)) return undefined;
    if (this.$current !== state) return false;
    if (!params) return true;

    let schema: Param[] = state.parameters({ inherit: true, matchingKeys: params });
    return Param.equals(schema, Param.values(schema, params), this.params);
  };

  /**
   * Checks if the current state *includes* the provided state
   *
   * A method to determine if the current active state is equal to or is the child of the
   * state stateName. If any params are passed then they will be tested for a match as well.
   * Not all the parameters need to be passed, just the ones you'd like to test for equality.
   *
   * #### Example when `$state.$current.name === 'contacts.details.item'`
   * ```js
   * // Using partial names
   * $state.includes("contacts"); // returns true
   * $state.includes("contacts.details"); // returns true
   * $state.includes("contacts.details.item"); // returns true
   * $state.includes("contacts.list"); // returns false
   * $state.includes("about"); // returns false
   * ```
   *
   * #### Glob Examples when `* $state.$current.name === 'contacts.details.item.url'`:
   * ```js
   * $state.includes("*.details.*.*"); // returns true
   * $state.includes("*.details.**"); // returns true
   * $state.includes("**.item.**"); // returns true
   * $state.includes("*.details.item.url"); // returns true
   * $state.includes("*.details.*.url"); // returns true
   * $state.includes("*.details.*"); // returns false
   * $state.includes("item.**"); // returns false
   * ```
   *
   * @param stateOrName A partial name, relative name, glob pattern,
   *   or state object to be searched for within the current state name.
   * @param params A param object, e.g. `{sectionId: section.id}`,
   *   that you'd like to test against the current active state.
   * @param options An options object. The options are:
   *   - `relative`: If `stateOrName` is a relative state name and `options.relative` is set, .is will
   *     test relative to `options.relative` state (or name).
   *
   * @returns {boolean} Returns true if it does include the state
   */
  includes(stateOrName: StateOrName, params?: RawParams, options?: TransitionOptions): boolean {
    options = defaults(options, { relative: this.$current });
    let glob = isString(stateOrName) && Glob.fromString(<string> stateOrName);

    if (glob) {
      if (!glob.matches(this.$current.name)) return false;
      stateOrName = this.$current.name;
    }
    let state = this.router.stateRegistry.matcher.find(stateOrName, options.relative), include = this.$current.includes;

    if (!isDefined(state)) return undefined;
    if (!isDefined(include[state.name])) return false;
    if (!params) return true;

    let schema: Param[] = state.parameters({ inherit: true, matchingKeys: params });
    return Param.equals(schema, Param.values(schema, params), this.params);
  };


  /**
   * Generates a URL for a state and parameters
   *
   * Returns the url for the given state populated with the given params.
   *
   * #### Example:
   * ```js
   * expect($state.href("about.person", { person: "bob" })).toEqual("/about/bob");
   * ```
   *
   * @param stateOrName The state name or state object you'd like to generate a url from.
   * @param params An object of parameter values to fill the state's required parameters.
   * @param options Options object. The options are:
   *
   * @returns {string} compiled state url
   */
  href(stateOrName: StateOrName, params: RawParams, options?: HrefOptions): string {
    let defaultHrefOpts = {
      lossy:    true,
      inherit:  true,
      absolute: false,
      relative: this.$current,
    };
    options = defaults(options, defaultHrefOpts);
    params = params || {};

    let state = this.router.stateRegistry.matcher.find(stateOrName, options.relative);

    if (!isDefined(state)) return null;
    if (options.inherit) params = <any> this.params.$inherit(params, this.$current, state);

    let nav = (state && options.lossy) ? state.navigable : state;

    if (!nav || nav.url === undefined || nav.url === null) {
      return null;
    }
    return this.router.urlRouter.href(nav.url, params, {
      absolute: options.absolute,
    });
  };

  /** @hidden */
  private _defaultErrorHandler: ((_error: any) => void) = function $defaultErrorHandler($error$) {
    if ($error$ instanceof Error && $error$.stack) {
      console.error($error$);
      console.error($error$.stack);
    } else if ($error$ instanceof Rejection) {
      console.error($error$.toString());
      if ($error$.detail && $error$.detail.stack)
        console.error($error$.detail.stack);
    } else {
      console.error($error$);
    }
  };

  /**
   * Sets or gets the default [[transitionTo]] error handler.
   *
   * The error handler is called when a [[Transition]] is rejected or when any error occurred during the Transition.
   * This includes errors caused by resolves and transition hooks.
   *
   * Note:
   * This handler does not receive certain Transition rejections.
   * Redirected and Ignored Transitions are not considered to be errors by [[StateService.transitionTo]].
   *
   * The built-in default error handler logs the error to the console.
   *
   * You can provide your own custom handler.
   *
   * #### Example:
   * ```js
   * stateService.defaultErrorHandler(function() {
   *   // Do not log transitionTo errors
   * });
   * ```
   *
   * @param handler a global error handler function
   * @returns the current global error handler
   */
  defaultErrorHandler(handler?: (error: any) => void): (error: any) => void {
    return this._defaultErrorHandler = handler || this._defaultErrorHandler;
  }

  /**
   * Gets a registered [[StateDeclaration]] object
   *
   * Returns the state declaration object for any specific state, or for all registered states.
   *
   * @param stateOrName (absolute or relative) If provided, will only get the declaration object for the requested state.
   * If not provided, returns an array of ALL states.
   * @param base When `stateOrName` is a relative state reference (such as `.bar.baz`), the state will be retrieved relative to this state.
   *
   * @returns a [[StateDeclaration]] object (or array of all registered [[StateDeclaration]] objects.)
   */
  get(stateOrName: StateOrName, base: StateOrName): StateDeclaration;
  get(stateOrName: StateOrName): StateDeclaration;
  get(): StateDeclaration[];
  get(stateOrName?: StateOrName, base?: StateOrName): any {
    let reg = this.router.stateRegistry;
    if (arguments.length === 0) return reg.get();
    return reg.get(stateOrName, base || this.$current);
  }

  /**
   * Lazy loads a state
   *
   * Explicitly runs a state's [[StateDeclaration.lazyLoad]] function.
   *
   * @param stateOrName the state that should be lazy loaded
   * @param transition the optional Transition context to use (if the lazyLoad function requires an injector, etc)
   * Note: If no transition is provided, a noop transition is created using the from the current state to the current state.
   * This noop transition is not actually run.
   *
   * @returns a promise to lazy load
   */
  lazyLoad(stateOrName: StateOrName, transition?: Transition): Promise<LazyLoadResult> {
    let state: StateDeclaration = this.get(stateOrName);
    if (!state || !state.lazyLoad) throw new Error("Can not lazy load " + stateOrName);

    let currentPath = this.getCurrentPath();
    let target = PathFactory.makeTargetState(currentPath);
    transition = transition || this.router.transitionService.create(currentPath, target);

    return lazyLoadState(transition, state);
  }
}
