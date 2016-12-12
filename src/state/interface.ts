/**
 * @coreapi
 * @module state
 */ /** for typedoc */
import { ParamDeclaration, RawParams } from "../params/interface";

import {State} from "./stateObject";
import {ViewContext} from "../view/interface";
import {IInjectable} from "../common/common";
import {Transition} from "../transition/transition";
import {TransitionStateHookFn} from "../transition/interface";
import {ResolvePolicy, ResolvableLiteral} from "../resolve/interface";
import {Resolvable} from "../resolve/resolvable";
import {ProviderLike} from "../resolve/interface";
import {TargetState} from "./targetState";

export type StateOrName = (string|StateDeclaration|State);

/** @internalapi */
export interface TransitionPromise extends Promise<State> {
  transition: Transition;
}

export type ResolveTypes = Resolvable | ResolvableLiteral | ProviderLike;
/**
 * Base interface for [[Ng1ViewDeclaration]] and [[Ng2ViewDeclaration]]
 *
 * This interface defines the basic data that a normalized view declaration will have on it.
 * Framework-specific implementations may add additional fields (to their interfaces which extend this interface).
 *
 * @internalapi
 */
export interface _ViewDeclaration {
  /**
   * The raw name for the view declaration, i.e., the [[StateDeclaration.views]] property name.
   */
  $name?: string;

  /**
   * The normalized address for the `ui-view` which this ViewConfig targets.
   *
   * A ViewConfig targets a `ui-view` in the DOM (relative to the `uiViewContextAnchor`) which has
   * a specific name.
   * @example `header` or `$default`
   *
   * The `uiViewName` can also target a _nested view_ by providing a dot-notation address
   * @example `foo.bar` or `foo.$default.bar`
   */
  $uiViewName?: string;
  
  /**
   * The normalized context anchor (state name) for the `uiViewName`
   *
   * When targeting a `ui-view`, the `uiViewName` address is anchored to a context name (state name).
   */
  $uiViewContextAnchor?: string;

  /**
   * A type identifier for the View
   *
   * This is used when loading prerequisites for the view, before it enters the DOM.  Different types of views
   * may load differently (e.g., templateProvider+controllerProvider vs component class)
   */
  $type?: string;

  /**
   * The context that this view is declared within.
   */
  $context?: ViewContext;
}

/**
 * The return value of a [[redirectTo]] function
 *
 * - string: a state name
 * - TargetState: a target state, parameters, and options
 * - object: an object with a state name and parameters
 */
export type RedirectToResult = string | TargetState | { state?: string, params?: RawParams };

/**
 * The StateDeclaration object is used to define a state or nested state.
 *
 * #### Example:
 * ```js
 * // StateDeclaration object
 * var foldersState = {
 *   name: 'folders',
 *   url: '/folders',
 *   resolve: {
 *     allfolders: function(FolderService) {
 *       return FolderService.list();
 *     }
 *   },
 *   template: "<ul><li ng-repeat='folder in allfolders'>{{folder.name}}</li></ul>",
 *   controller: function(allfolders, $scope) {
 *     $scope.allfolders = allfolders;
 *   }
 * }
 * ```
 *
 * Note: Each front-end framework extends this interface as necessary
 */
export interface StateDeclaration {
  /**
   * The state name
   *
   * A unique state name, e.g. `"home"`, `"about"`, `"contacts"`.
   * To create a parent/child state use a dot, e.g. `"about.sales"`, `"home.newest"`.
   *
   *
   * Note: States require unique names.  If you omit this property, you must provide
   * the state name when you register it with the [[$stateProvider]].
   */
  name?: string;

  /**
   * abstract state indicator
   *
   * An abstract state can never be directly activated.  Use an abstract state to provide inherited
   * properties (url, resolve, data, etc) to children states.
   */
  abstract?: boolean;

  /**
   * The parent state
   *
   * Normally, a state's parent is implied from the state's [[name]], e.g., `"parentstate.childstate"`.
   *
   * Alternatively, you can explicitly set the parent state using this property.  This allows shorter state
   * names, e.g., `<a ui-sref="childstate">Child</a>` instead of `<a ui-sref="parentstate.childstate">Child</a>
   *
   * When using this property, the state's name should not have any dots in it.
   *
   * #### Example:
   * ```js
   * var parentstate = {
   *   name: 'parentstate'
   * }
   * var childstate = {
   *   name: 'childstate',
   *   parent: 'parentstate'
   *   // or use a JS var which is the parent StateDeclaration, i.e.:
   *   // parent: parentstate
   * }
   * ```
   */
  parent?: (string|StateDeclaration);

  /**
   * Gets the internal API
   *
   * Gets the *internal API* for a registered state.
   *
   * Note: the internal [[State]] API is subject to change without notice
   */
  $$state?: () => State;

  /**
   * Resolve - a mechanism to asynchronously fetch data, participating in the Transition lifecycle
   *
   * The `resolve:` property defines data (or other dependencies) to be fetched asynchronously when the state
   * is being entered.  After the data is fetched, it can be used in views, transition hooks or other resolves
   * that belong to this state, or to any views or resolves that belong to nested states.
   *
   * ### As an array
   *
   * Each array element should either be:
   *
   * - a [[ResolvableLiteral]] object (a plain old javascript object), e.g., `{ token: 'token', resolveFn: (http) => http.get('/'), deps: [ Http ] }`
   * - a [[Resolvable]] object, e.g., `new Resolvable('token', (http) => http.get('/'), [ Http ])`
   * - an Angular 2 style [provider literal](https://angular.io/docs/ts/latest/cookbook/dependency-injection.html#!#provide), e.g.,
   *   `{ provide: 'token', useFactory: (http) => http.get('/'), deps: [ Http ] }`
   *
   * #### ng2 Example:
   * ```js
   * import {Resolvable} from "ui-router-ng2"; // or "angular-ui-router"
   * ...
   * resolve: [
   *   // If you inject `myStateDependency` into a component, you'll get "abc"
   *   { provide: 'myStateDependency', useFactory: () => 'abc' }, // ng2 style provide literal
   *   new Resolvable('myFoos', (http, trans) => http.get(`/foos/${trans.params().fooId}`), [Http, Transition])
   * ]
   * ```
   *
   * ### As an object
   *
   * - The key (string) is the name of the dependency.
   * - The value (function) is an injectable function which returns the dependency, or a promise for the dependency.
   *
   * Note: You cannot specify a policy for each Resolvable, nor can you use non-string
   * tokens when using the object style `resolve:` block.
   *
   * #### ng1 Example:
   * ```js
   * resolve: {
   *   // If you inject `myStateDependency` into a controller, you'll get "abc"
   *   myStateDependency: function() {
   *     return "abc";
   *   },
   *   myAsyncData: ['$http', '$transition$' function($http, $transition$) {
   *     // Return a promise (async) for the data
   *     return $http.get("/foos/" + $transition$.params().foo);
   *   }]
   * }
   * ```
   *
   * ### Lifecycle
   *
   * Since a resolve function can return a promise, the router will delay entering the state until the  promises
   * are ready.  If any of the promises are rejected, the Transition is aborted with an Error.
   *
   * By default, resolves for a state are fetched just before that state is entered. Note that only states
   * which are being *entered* have their resolves fetched.  States that are "retained" do not have their resolves
   * re-fetched.  If you are currently in a parent state `A` and are transitioning to a child state `A.B`, the
   * previously resolved data for state `A` can be injected into `A.B` without delay.
   *
   * Any resolved data for `A.B` is retained until `A.B` is exited, e.g., by transitioning back to the parent state `A`.
   *
   * Because of this, resolves are a great place to fetch your application's primary data.
   *
   * ### Injecting resolves into other things
   *
   * During a transition, Resolve data can be injected into:
   * - ui-view Controllers
   * - TemplateProviders and ControllerProviders
   * - Other resolves
   *
   * ### Injecting other things into resolves
   *
   * Since resolve functions are injected, a common pattern is to inject a custom service such as `UserService`
   * and delegate to a custom service method, such as `UserService.list()`;
   *
   * #### Angular 1
   *
   * An Angular 1 resolve function can inject some special values:
   * - `$transition$`: The current [[Transition]] object; information and API about the current transition, such as
   *    "to" and "from" State Parameters and transition options.
   * - Other resolves: This resolve can depend on another resolve, either from the same state, or from any parent state.
   * - `$stateParams`: (deprecated) The parameters for the current state (Note: these parameter values are
   *
   * #### Angular 2
   *
   * An Angular 2 resolve function can inject some special values:
   * - `Transition`: The current [[Transition]] object; information and API about the current transition, such as
   *    "to" and "from" State Parameters and transition options.
   * - Other resolves: This resolve can depend on another resolve, either from the same state, or from any parent state.
   *
   * #### Example:
   * ```js
   * // Injecting a resolve into another resolve
   * resolve: [
   *   // Define a resolve 'allusers' which delegates to the UserService.list()
   *   // which returns a promise (async) for all the users
   *   { provide: 'allusers', useFactory: (UserService) => UserService.list(), deps: [UserService] },
   *
   *   // Define a resolve 'user' which depends on the allusers resolve.
   *   // This resolve function is not called until 'allusers' is ready.
   *   { provide: 'user', (allusers, trans) => _.find(allusers, trans.params().userId, deps: ['allusers', Transition] }
   * }
   * ```
   */
  resolve?: (ResolveTypes[] | { [key: string]: IInjectable; });

  /**
   * Sets the resolve policy defaults for all resolves on this state
   *
   * This should be an [[ResolvePolicy]] object. 
   * 
   * It can contain the following optional keys/values:
   * 
   * - `when`: (optional) defines when the resolve is fetched. Accepted values: "LAZY" or "EAGER"
   * - `async`: (optional) if the transition waits for the resolve. Accepted values: "WAIT", "NOWAIT", "RXWAIT"
   * 
   * See [[ResolvePolicy]] for more details.
   */
  resolvePolicy?: ResolvePolicy

  /**
   * The url fragment for the state
   *
   * A URL fragment (with optional parameters) which is used to match the browser location with this state.
   *
   * This fragment will be appended to the parent state's URL in order to build up the overall URL for this state.
   * See [[UrlMatcher]] for details on acceptable patterns.
   *
   * @examples
   * ```js
   *
   * url: "/home"
   * // Define a parameter named 'userid'
   * url: "/users/:userid"
   * // param 'bookid' has a custom regexp
   * url: "/books/{bookid:[a-zA-Z_-]}"
   * // param 'categoryid' is of type 'int'
   * url: "/books/{categoryid:int}"
   * // two parameters for this state
   * url: "/books/{publishername:string}/{categoryid:int}"
   * // Query parameters
   * url: "/messages?before&after"
   * // Query parameters of type 'date'
   * url: "/messages?{before:date}&{after:date}"
   * // Path and query parameters
   * url: "/messages/:mailboxid?{before:date}&{after:date}"
   * ```
   */
  url?: string;

  /**
   * Params configuration
   *
   * An object which optionally configures parameters declared in the url, or defines additional non-url
   * parameters. For each parameter being configured, add a [[ParamDeclaration]] keyed to the name of the parameter.
   *
   * #### Example:
   * ```js
   * params: {
   *   param1: {
   *    type: "int",
   *    array: true,
   *    value: []
   *   },
   *   param2: {
   *     value: "index"
   *   }
   * }
   * ```
   */
  params?: { [key: string]: (ParamDeclaration|any); };

  /**
   * Named views
   *
   * An optional object which defines multiple views, or explicitly targets specific named ui-views.
   *
   * - What is a view config
   * - What is a ui-view
   * - Shorthand controller/template
   * - Incompatible with ^
   *
   *  Examples:
   *
   *  Targets three named ui-views in the parent state's template
   *
   * #### Example:
   * ```js
   * views: {
   *   header: {
   *     controller: "headerCtrl",
   *     templateUrl: "header.html"
   *   }, body: {
   *     controller: "bodyCtrl",
   *     templateUrl: "body.html"
   *   }, footer: {
   *     controller: "footCtrl",
   *     templateUrl: "footer.html"
   *   }
   * }
   * ```
   *
   * @example
   * ```js
   * // Targets named ui-view="header" from ancestor state 'top''s template, and
   * // named `ui-view="body" from parent state's template.
   * views: {
   *   'header@top': {
   *     controller: "msgHeaderCtrl",
   *     templateUrl: "msgHeader.html"
   *   }, 'body': {
   *     controller: "messagesCtrl",
   *     templateUrl: "messages.html"
   *   }
   * }
   * ```
   */
  views?: { [key: string]: _ViewDeclaration; };

  /**
   * An inherited property to store state data
   *
   * This is a spot for you to store inherited state metadata.
   * Child states' `data` object will prototypally inherit from their parent state.
   *
   * This is a good spot to put metadata such as `requiresAuth`.
   *
   * Note: because prototypal inheritance is used, changes to parent `data` objects reflect in the child `data` objects.
   * Care should be taken if you are using `hasOwnProperty` on the `data` object.
   * Properties from parent objects will return false for `hasOwnProperty`.
   */
  data?: any;

  /**
   * Synchronously or asynchronously redirects Transitions to a different state/params
   *
   * If this property is defined, a Transition directly to this state will be redirected based on the property's value.
   *
   * - If the value is a `string`, the Transition is redirected to the state named by the string.
   *
   * - If the property is an object with a `state` and/or `params` property,
   *   the Transition is redirected to the named `state` and/or `params`.
   *
   * - If the value is a [[TargetState]] the Transition is redirected to the `TargetState`
   *
   * - If the property is a function:
   *   - The function is called with two parameters:
   *     - The current [[Transition]]
   *     - An injector which can be used to get dependencies using [[UIRInjector.get]]
   *   - The return value is processed using the previously mentioned rules.
   *   - If the return value is a promise, the promise is waited for, then the resolved async value is processed using the same rules.
   *
   * #### Example:
   * ```js
   * // a string
   * .state('A', {
   *   redirectTo: 'A.B'
   * })
   *
   * // a {state, params} object
   * .state('C', {
   *   redirectTo: { state: 'C.D', params: { foo: 'index' } }
   * })
   *
   * // a fn
   * .state('E', {
   *   redirectTo: () => "A"
   * })
   *
   * // a fn conditionally returning a {state, params}
   * .state('F', {
   *   redirectTo: (trans) => {
   *     if (trans.params().foo < 10)
   *       return { state: 'F', params: { foo: 10 } };
   *   }
   * })
   *
   * // a fn returning a promise for a redirect
   * .state('G', {
   *   redirectTo: (trans) => {
   *     let svc = trans.injector().get('SomeAsyncService')
   *     let promise = svc.getAsyncRedirectTo(trans.params.foo);
   *     return promise;
   *   }
   * })
   * ```
   */
  redirectTo?: RedirectToResult | Promise<RedirectToResult>

  /**
   * A Transition Hook called with the state is being entered.  See: [[IHookRegistry.onEnter]]
   *
   * #### Example:
   * ```js
   * .state({
   *   name: 'mystate',
   *   onEnter: function(trans, state) {
   *     console.log("Entering " + state.name);
   *   }
   * });
   * ```
   *
   * Note: The above `onEnter` on the state declaration is effectively sugar for:
   * ```
   * transitionService.onEnter({ entering: 'mystate' }, function(trans, state) {
   *   console.log("Entering " + state.name);
   * });
   */
  onEnter?: TransitionStateHookFn;
  /**
   * A [[TransitionStateHookFn]] called with the state is being retained/kept. See: [[IHookRegistry.onRetain]]
   *
   * #### Example:
   * ```js
   * .state({
   *   name: 'mystate',
   *   onRetain: function(trans, state) {
   *     console.log(state.name + " is still active!");
   *   }
   * });
   * ```
   *
   * Note: The above `onRetain` on the state declaration is effectively sugar for:
   * ```
   * transitionService.onRetain({ retained: 'mystate' }, function(trans, state) {
   *   console.log(state.name + " is still active!");
   * });
   */
  onRetain?: TransitionStateHookFn;
  /**
   * A Transition Hook called with the state is being exited. See: [[IHookRegistry.onExit]]
   *
   * #### Example:
   * ```js
   * .state({
   *   name: 'mystate',
   *   onExit: function(trans, state) {
   *     console.log("Leaving " + state.name);
   *   }
   * });
   * ```
   *
   * Note: The above `onRetain` on the state declaration is effectively sugar for:
   * ```
   * transitionService.onExit({ exiting: 'mystate' }, function(trans, state) {
   *   console.log("Leaving " + state.name);
   * });
   */
  onExit?: TransitionStateHookFn;

  /**
   * A function used to lazy load code
   *
   * The `lazyLoad` function is invoked before the state is activated.
   * The transition waits while the code is loading.
   *
   * The function should load the code that is required to activate the state.
   * For example, it may load a component class, or some service code.
   * The function must retur a promise which resolves when loading is complete.
   *
   * For example, this code lazy loads a service before the `abc` state is activated:
   *
   * ```
   * .state('abc', {
   *   lazyLoad: (transition, state) => System.import('./abcService')
   * }
   * ```
   *
   * The `abcService` file is imported and loaded
   * (it is assumed that the `abcService` file knows how to register itself as a service).
   *
   * #### Lifecycle
   *
   * - The `lazyLoad` function is invoked if a transition is going to enter the state.
   * - The function is invoked before the transition starts (using an `onBefore` transition hook).
   * - The function is only invoked once; while the `lazyLoad` function is loading code, it will not be invoked again.
   *   For example, if the user double clicks a ui-sref, `lazyLoad` is only invoked once even though there were two transition attempts.
   *   Instead, the existing lazy load promise is re-used.
   * - When the promise resolves successfully, the `lazyLoad` property is deleted from the state declaration.
   * - If the promise resolves to a [[LazyLoadResult]] which has an array of `states`, those states are registered.
   * - The original transition is retried (this time without the `lazyLoad` property present).
   *
   * - If the `lazyLoad` function fails, then the transition also fails.
   *   The failed transition (and the `lazyLoad` function) could potentially be retried by the user.
   *
   * ### Lazy loading state definitions (Future States)
   *
   * State definitions can also be lazy loaded.
   * This might be desirable when building large, multi-module applications.
   *
   * To lazy load state definitions, a Future State should be registered as a placeholder.
   * When the state definitions are lazy loaded, the Future State is deregistered.
   *
   * A future state can act as a placeholder for a single state, or for an entire module of states and substates.
   * A future state should have:
   *
   * - A `name` which ends in `.**`.
   *   A future state's `name` property acts as a wildcard [[Glob]].
   *   It matches any state name that starts with the `name` (including child states that are not yet loaded).
   * - A `url` prefix.
   *   A future state's `url` property acts as a wildcard.
   *   UI-Router matches all paths that begin with the `url`.
   *   It effectively appends `.*` to the internal regular expression.
   *   When the prefix matches, the future state will begin loading.
   * - A `lazyLoad` function.
   *   This function should should return a Promise to lazy load the code for one or more [[StateDeclaration]] objects.
   *   It should return a [[LazyLoadResult]].
   *   Generally, one of the lazy loaded states should have the same name as the future state.
   *   The new state will then **replace the future state placeholder** in the registry.
   *
   * ### Additional resources
   *
   * For in depth information on lazy loading and Future States, see the [Lazy Loading Guide](https://ui-router.github.io/guides/lazyload).
   *
   * #### Example: states.js
   * ```js
   *
   * // This child state is a lazy loaded future state
   * // The `lazyLoad` function loads the final state definition
   * {
   *   name: 'parent.**',
   *   url: '/parent',
   *   lazyLoad: () => System.import('./lazy.states.js')
   * }
   * ```
   *
   * #### Example: lazy.states.js
   *
   * This file is lazy loaded.  It exports an array of states.
   *
   * ```js
   * import {ChildComponent} from "./child.component.js";
   * import {ParentComponent} from "./parent.component.js";
   *
   * // This fully defined state replaces the future state
   * let parentState = {
   *   // the name should match the future state
   *   name: 'parent',
   *   url: '/parent/:parentId',
   *   component: ParentComponent,
   *   resolve: {
   *     parentData: ($transition$, ParentService) =>
   *         ParentService.get($transition$.params().parentId)
   *   }
   * }
   *
   * let childState = {
   *   name: 'parent.child',
   *   url: '/child/:childId',
   *   params: {
   *     childId: "default"
   *   },
   *   resolve: {
   *     childData: ($transition$, ChildService) =>
   *         ChildService.get($transition$.params().childId)
   *   }
   * };
   *
   * // This array of states will be registered by the lazyLoad hook
   * let lazyLoadResults = {
   *   states: [ parentState, childState ]
   * };
   *
   * export default lazyLoadResults;
   * ```
   *
   * @param transition the [[Transition]] that is activating the future state
   * @param state the [[StateDeclaration]] that the `lazyLoad` function is declared on
   * @return a Promise to load the states.
   *         Optionally, if the promise resolves to a [[LazyLoadResult]],
   *         the states will be registered with the [[StateRegistry]].
   */
  lazyLoad?: (transition: Transition, state: StateDeclaration) => Promise<LazyLoadResult>;

  /**
   * @deprecated define individual parameters as [[ParamDeclaration.dynamic]]
   */
  reloadOnSearch?: boolean;
}

/**
 * The return type of a [[StateDeclaration.lazyLoad]] function
 *
 * If your state has a `lazyLoad` function, it should return a promise.
 * If promise resolves to an object matching this interface, then the `states` array
 * of [[StateDeclaration]] objects will be automatically registered.
 *
 * @internalapi
 */
export interface LazyLoadResult {
  states?: StateDeclaration[];
}

/** @internalapi */
export interface HrefOptions {
  relative?:  StateOrName;
  lossy?:     boolean;
  inherit?:   boolean;
  absolute?:  boolean;
}

