/**
 * @coreapi
 * @module transition
 */
/** for typedoc */
import { trace } from '../common/trace';
import { services } from '../common/coreservices';
import { stringify } from '../common/strings';
import { map, find, extend, mergeR, tail, omit, arrayTuples, unnestR, identity, anyTrueR } from '../common/common';
import {isObject, isUndefined} from '../common/predicates';
import { prop, propEq, val, not, is } from '../common/hof';
import { StateDeclaration, StateOrName } from '../state/interface';
import {
  TransitionOptions, TreeChanges, IHookRegistry, TransitionHookPhase, RegisteredHooks, HookRegOptions,
  HookMatchCriteria, TransitionStateHookFn, TransitionHookFn,
} from './interface'; // has or is using
import { TransitionHook } from './transitionHook';
import { matchState, makeEvent, RegisteredHook } from './hookRegistry';
import { HookBuilder } from './hookBuilder';
import { PathNode } from '../path/pathNode';
import { PathUtils } from '../path/pathFactory';
import { StateObject } from '../state/stateObject';
import { TargetState } from '../state/targetState';
import { Param } from '../params/param';
import { Resolvable } from '../resolve/resolvable';
import { ViewConfig } from '../view/interface';
import { ResolveContext } from '../resolve/resolveContext';
import { UIRouter } from '../router';
import { UIInjector } from '../interface';
import { RawParams } from '../params/interface';
import { ResolvableLiteral } from '../resolve/interface';

/** @hidden */
const stateSelf: (_state: StateObject) => StateDeclaration = prop("self");

/**
 * Represents a transition between two states.
 *
 * When navigating to a state, we are transitioning **from** the current state **to** the new state.
 *
 * This object contains all contextual information about the to/from states, parameters, resolves.
 * It has information about all states being entered and exited as a result of the transition.
 */
export class Transition implements IHookRegistry {

  /** @hidden */
  static diToken = Transition;

  /**
   * A unique identifier for the transition.
   *
   * This is an auto incrementing integer, starting from `0`.
   */
  $id: number;

  /**
   * A reference to the [[UIRouter]] instance
   *
   * This reference can be used to access the router services, such as the [[StateService]]
   */
  router: UIRouter;

  /** @hidden */
  private _deferred = services.$q.defer();
  /**
   * This promise is resolved or rejected based on the outcome of the Transition.
   *
   * When the transition is successful, the promise is resolved
   * When the transition is unsuccessful, the promise is rejected with the [[Rejection]] or javascript error
   */
  promise: Promise<any> = this._deferred.promise;
  /**
   * A boolean which indicates if the transition was successful
   *
   * After a successful transition, this value is set to true.
   * After an unsuccessful transition, this value is set to false.
   *
   * The value will be undefined if the transition is not complete
   */
  success: boolean;
  /** @hidden */
  _aborted: boolean;
  /** @hidden */
  private _error: any;

  /** @hidden Holds the hook registration functions such as those passed to Transition.onStart() */
  _registeredHooks: RegisteredHooks = { };

  /** @hidden */
  private _options: TransitionOptions;
  /** @hidden */
  private _treeChanges: TreeChanges;
  /** @hidden */
  private _targetState: TargetState;
  /** @hidden */
  private _hookBuilder = new HookBuilder(this);


  /** @hidden */
  onBefore(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return; }
  /** @inheritdoc */
  onStart(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return; }
  /** @inheritdoc */
  onExit(criteria: HookMatchCriteria, callback: TransitionStateHookFn, options?: HookRegOptions): Function { return; }
  /** @inheritdoc */
  onRetain(criteria: HookMatchCriteria, callback: TransitionStateHookFn, options?: HookRegOptions): Function { return; }
  /** @inheritdoc */
  onEnter(criteria: HookMatchCriteria, callback: TransitionStateHookFn, options?: HookRegOptions): Function { return; }
  /** @inheritdoc */
  onFinish(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return; }
  /** @inheritdoc */
  onSuccess(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return; }
  /** @inheritdoc */
  onError(criteria: HookMatchCriteria, callback: TransitionHookFn, options?: HookRegOptions): Function { return; }

  /** @hidden
   * Creates the transition-level hook registration functions
   * (which can then be used to register hooks)
   */
  private createTransitionHookRegFns() {
    this.router.transitionService._pluginapi._getEvents()
        .filter(type => type.hookPhase !== TransitionHookPhase.CREATE)
        .forEach(type => makeEvent(this, this.router.transitionService, type));
  }

  /** @internalapi */
  getHooks(hookName: string): RegisteredHook[] {
    return this._registeredHooks[hookName];
  }

  /**
   * Creates a new Transition object.
   *
   * If the target state is not valid, an error is thrown.
   *
   * @internalapi
   *
   * @param fromPath The path of [[PathNode]]s from which the transition is leaving.  The last node in the `fromPath`
   *        encapsulates the "from state".
   * @param targetState The target state and parameters being transitioned to (also, the transition options)
   * @param router The [[UIRouter]] instance
   */
  constructor(fromPath: PathNode[], targetState: TargetState, router: UIRouter) {
    this.router = router;
    this._targetState = targetState;

    if (!targetState.valid()) {
      throw new Error(targetState.error());
    }

    // current() is assumed to come from targetState.options, but provide a naive implementation otherwise.
    this._options = extend({ current: val(this) }, targetState.options());
    this.$id = router.transitionService._transitionCount++;
    let toPath = PathUtils.buildToPath(fromPath, targetState);
    this._treeChanges = PathUtils.treeChanges(fromPath, toPath, this._options.reloadState);
    this.createTransitionHookRegFns();

    let onCreateHooks = this._hookBuilder.buildHooksForPhase(TransitionHookPhase.CREATE);
    TransitionHook.invokeHooks(onCreateHooks, () => null);

    this.applyViewConfigs(router);
  }

  private applyViewConfigs(router: UIRouter) {
    let enteringStates = this._treeChanges.entering.map(node => node.state);
    PathUtils.applyViewConfigs(router.transitionService.$view, this._treeChanges.to, enteringStates);
  }

  /**
   * @internalapi
   *
   * @returns the internal from [State] object
   */
  $from() {
    return tail(this._treeChanges.from).state;
  }

  /**
   * @internalapi
   *
   * @returns the internal to [State] object
   */
  $to() {
    return tail(this._treeChanges.to).state;
  }

  /**
   * Returns the "from state"
   *
   * Returns the state that the transition is coming *from*.
   *
   * @returns The state declaration object for the Transition's ("from state").
   */
  from(): StateDeclaration {
    return this.$from().self;
  }

  /**
   * Returns the "to state"
   *
   * Returns the state that the transition is going *to*.
   *
   * @returns The state declaration object for the Transition's target state ("to state").
   */
  to(): StateDeclaration {
    return this.$to().self;
  }

  /**
   * Gets the Target State
   *
   * A transition's [[TargetState]] encapsulates the [[to]] state, the [[params]], and the [[options]] as a single object.
   *
   * @returns the [[TargetState]] of this Transition
   */
  targetState() {
    return this._targetState;
  }

  /**
   * Determines whether two transitions are equivalent.
   * @deprecated
   */
  is(compare: (Transition|{to?: any, from?: any})): boolean {
    if (compare instanceof Transition) {
      // TODO: Also compare parameters
      return this.is({ to: compare.$to().name, from: compare.$from().name });
    }
    return !(
      (compare.to && !matchState(this.$to(), compare.to)) ||
      (compare.from && !matchState(this.$from(), compare.from))
    );
  }

  /**
   * Gets transition parameter values
   *
   * Returns the parameter values for a transition as key/value pairs.
   * This object is immutable.
   *
   * By default, returns the new parameter values (for the "to state").
   *
   * #### Example:
   * ```js
   * var toParams = transition.params();
   * ```
   *
   * To return the previous parameter values,  supply `'from'` as the `pathname` argument.
   *
   * #### Example:
   * ```js
   * var fromParams = transition.params('from');
   * ```
   *
   * @param pathname the name of the treeChanges path to get parameter values for:
   *   (`'to'`, `'from'`, `'entering'`, `'exiting'`, `'retained'`)
   *
   * @returns transition parameter values for the desired path.
   */
  params(pathname?: string): any;
  params<T>(pathname?: string): T;
  params(pathname: string = "to") {
    return Object.freeze(this._treeChanges[pathname].map(prop("paramValues")).reduce(mergeR, {}));
  }


  /**
   * Creates a [[UIInjector]] Dependency Injector
   *
   * Returns a Dependency Injector for the Transition's target state (to state).
   * The injector provides resolve values which the target state has access to.
   *
   * The `UIInjector` can also provide values from the native root/global injector (ng1/ng2).
   *
   * #### Example:
   * ```js
   * .onEnter({ entering: 'myState' }, trans => {
   *   var myResolveValue = trans.injector().get('myResolve');
   *   // Inject a global service from the global/native injector (if it exists)
   *   var MyService = trans.injector().get('MyService');
   * })
   * ```
   *
   * In some cases (such as `onBefore`), you may need access to some resolve data but it has not yet been fetched.
   * You can use [[UIInjector.getAsync]] to get a promise for the data.
   * #### Example:
   * ```js
   * .onBefore({}, trans => {
   *   return trans.injector().getAsync('myResolve').then(myResolveValue =>
   *     return myResolveValue !== 'ABORT';
   *   });
   * });
   * ```
   *
   * If a `state` is provided, the injector that is returned will be limited to resolve values that the provided state has access to.
   * This can be useful if both a parent state `foo` and a child state `foo.bar` have both defined a resolve such as `data`.
   * #### Example:
   * ```js
   * .onEnter({ to: 'foo.bar' }, trans => {
   *   // returns result of `foo` state's `myResolve` resolve
   *   // even though `foo.bar` also has a `myResolve` resolve
   *   var fooData = trans.injector('foo').get('myResolve');
   * });
   * ```
   *
   * If you need resolve data from the exiting states, pass `'from'` as `pathName`.
   * The resolve data from the `from` path will be returned.
   * #### Example:
   * ```js
   * .onExit({ exiting: 'foo.bar' }, trans => {
   *   // Gets the resolve value of `myResolve` from the state being exited
   *   var fooData = trans.injector(null, 'from').get('myResolve');
   * });
   * ```
   *
   *
   * @param state Limits the resolves provided to only the resolves the provided state has access to.
   * @param pathName Default: `'to'`: Chooses the path for which to create the injector. Use this to access resolves for `exiting` states.
   *
   * @returns a [[UIInjector]]
   */
  injector(state?: StateOrName, pathName = "to"): UIInjector {
    let path: PathNode[] = this._treeChanges[pathName];
    if (state) path = PathUtils.subPath(path, node => node.state === state || node.state.name === state);
    return new ResolveContext(path).injector();
  }

  /**
   * Gets all available resolve tokens (keys)
   *
   * This method can be used in conjunction with [[injector]] to inspect the resolve values
   * available to the Transition.
   *
   * This returns all the tokens defined on [[StateDeclaration.resolve]] blocks, for the states
   * in the Transition's [[TreeChanges.to]] path.
   *
   * #### Example:
   * This example logs all resolve values
   * ```js
   * let tokens = trans.getResolveTokens();
   * tokens.forEach(token => console.log(token + " = " + trans.injector().get(token)));
   * ```
   *
   * #### Example:
   * This example creates promises for each resolve value.
   * This triggers fetches of resolves (if any have not yet been fetched).
   * When all promises have all settled, it logs the resolve values.
   * ```js
   * let tokens = trans.getResolveTokens();
   * let promise = tokens.map(token => trans.injector().getAsync(token));
   * Promise.all(promises).then(values => console.log("Resolved values: " + values));
   * ```
   *
   * Note: Angular 1 users whould use `$q.all()`
   *
   * @param pathname resolve context's path name (e.g., `to` or `from`)
   *
   * @returns an array of resolve tokens (keys)
   */
  getResolveTokens(pathname: string = "to"): any[] {
    return new ResolveContext(this._treeChanges[pathname]).getTokens();
  }

  /**
   * Dynamically adds a new [[Resolvable]] (i.e., [[StateDeclaration.resolve]]) to this transition.
   *
   * #### Example:
   * ```js
   * transitionService.onBefore({}, transition => {
   *   transition.addResolvable({
   *     token: 'myResolve',
   *     deps: ['MyService'],
   *     resolveFn: myService => myService.getData()
   *   });
   * });
   * ```
   *
   * @param resolvable a [[ResolvableLiteral]] object (or a [[Resolvable]])
   * @param state the state in the "to path" which should receive the new resolve (otherwise, the root state)
   */
  addResolvable(resolvable: Resolvable|ResolvableLiteral, state: StateOrName = ""): void {
    resolvable = is(Resolvable)(resolvable) ? resolvable : new Resolvable(resolvable);

    let stateName: string = (typeof state === "string") ? state : state.name;
    let topath = this._treeChanges.to;
    let targetNode = find(topath, node => node.state.name === stateName);
    let resolveContext: ResolveContext = new ResolveContext(topath);
    resolveContext.addResolvables([resolvable as Resolvable], targetNode.state);
  }

  /**
   * Gets the transition from which this transition was redirected.
   *
   * If the current transition is a redirect, this method returns the transition that was redirected.
   *
   * #### Example:
   * ```js
   * let transitionA = $state.go('A').transition
   * transitionA.onStart({}, () => $state.target('B'));
   * $transitions.onSuccess({ to: 'B' }, (trans) => {
   *   trans.to().name === 'B'; // true
   *   trans.redirectedFrom() === transitionA; // true
   * });
   * ```
   *
   * @returns The previous Transition, or null if this Transition is not the result of a redirection
   */
  redirectedFrom(): Transition {
    return this._options.redirectedFrom || null;
  }

  /**
   * Gets the original transition in a redirect chain
   *
   * A transition might belong to a long chain of multiple redirects.
   * This method walks the [[redirectedFrom]] chain back to the original (first) transition in the chain.
   *
   * #### Example:
   * ```js
   * // states
   * registry.register({ name: 'A', redirectTo: 'B' });
   * registry.register({ name: 'B', redirectTo: 'C' });
   * registry.register({ name: 'C', redirectTo: 'D' });
   * registry.register({ name: 'D' });
   *
   * let transitionA = $state.go('A').transition
   *
   * $transitions.onSuccess({ to: 'D' }, (trans) => {
   *   trans.to().name === 'D'; // true
   *   trans.redirectedFrom().to().name === 'C'; // true
   *   trans.originalTransition() === transitionA; // true
   *   trans.originalTransition().to().name === 'A'; // true
   * });
   * ```
   *
   * @returns The original Transition that started a redirect chain
   */
  originalTransition(): Transition {
    let rf = this.redirectedFrom();
    return (rf && rf.originalTransition()) || this;
  }

  /**
   * Get the transition options
   *
   * @returns the options for this Transition.
   */
  options(): TransitionOptions {
    return this._options;
  }

  /**
   * Gets the states being entered.
   *
   * @returns an array of states that will be entered during this transition.
   */
  entering(): StateDeclaration[] {
    return map(this._treeChanges.entering, prop('state')).map(stateSelf);
  }

  /**
   * Gets the states being exited.
   *
   * @returns an array of states that will be exited during this transition.
   */
  exiting(): StateDeclaration[] {
    return map(this._treeChanges.exiting, prop('state')).map(stateSelf).reverse();
  }

  /**
   * Gets the states being retained.
   *
   * @returns an array of states that are already entered from a previous Transition, that will not be
   *    exited during this Transition
   */
  retained(): StateDeclaration[] {
    return map(this._treeChanges.retained, prop('state')).map(stateSelf);
  }

  /**
   * Get the [[ViewConfig]]s associated with this Transition
   *
   * Each state can define one or more views (template/controller), which are encapsulated as `ViewConfig` objects.
   * This method fetches the `ViewConfigs` for a given path in the Transition (e.g., "to" or "entering").
   *
   * @param pathname the name of the path to fetch views for:
   *   (`'to'`, `'from'`, `'entering'`, `'exiting'`, `'retained'`)
   * @param state If provided, only returns the `ViewConfig`s for a single state in the path
   *
   * @returns a list of ViewConfig objects for the given path.
   */
  views(pathname: string = "entering", state?: StateObject): ViewConfig[] {
    let path = this._treeChanges[pathname];
    path = !state ? path : path.filter(propEq('state', state));
    return path.map(prop("views")).filter(identity).reduce(unnestR, []);
  }

  /**
   * Return the transition's tree changes
   *
   * A transition goes from one state/parameters to another state/parameters.
   * During a transition, states are entered and/or exited.
   *
   * This function returns various branches (paths) which represent the changes to the
   * active state tree that are caused by the transition.
   *
   * @param pathname The name of the tree changes path to get:
   *   (`'to'`, `'from'`, `'entering'`, `'exiting'`, `'retained'`)
   */
  treeChanges(pathname: string): PathNode[];
  treeChanges(): TreeChanges;
  treeChanges(pathname?: string) {
    return pathname ? this._treeChanges[pathname] : this._treeChanges;
  }

  /**
   * Creates a new transition that is a redirection of the current one.
   *
   * This transition can be returned from a [[TransitionService]] hook to
   * redirect a transition to a new state and/or set of parameters.
   *
   * @internalapi
   *
   * @returns Returns a new [[Transition]] instance.
   */
  redirect(targetState: TargetState): Transition {
    let redirects = 1, trans: Transition = this;
    while ((trans = trans.redirectedFrom()) != null) {
      if (++redirects > 20) throw new Error(`Too many consecutive Transition redirects (20+)`);
    }

    let redirectOpts: TransitionOptions = { redirectedFrom: this, source: "redirect" };
    // If the original transition was caused by URL sync, then use { location: 'replace' }
    // on the new transition (unless the target state explicitly specifies location: false).
    // This causes the original url to be replaced with the url for the redirect target
    // so the original url disappears from the browser history.
    if (this.options().source === 'url' && targetState.options().location !== false) {
      redirectOpts.location = 'replace';
    }

    let newOptions = extend({}, this.options(), targetState.options(), redirectOpts);
    targetState = targetState.withOptions(newOptions, true);

    let newTransition = this.router.transitionService.create(this._treeChanges.from, targetState);
    let originalEnteringNodes = this._treeChanges.entering;
    let redirectEnteringNodes = newTransition._treeChanges.entering;

    // --- Re-use resolve data from original transition ---
    // When redirecting from a parent state to a child state where the parent parameter values haven't changed
    // (because of the redirect), the resolves fetched by the original transition are still valid in the
    // redirected transition.
    //
    // This allows you to define a redirect on a parent state which depends on an async resolve value.
    // You can wait for the resolve, then redirect to a child state based on the result.
    // The redirected transition does not have to re-fetch the resolve.
    // ---------------------------------------------------------

    const nodeIsReloading = (reloadState: StateObject) => (node: PathNode) => {
      return reloadState && node.state.includes[reloadState.name];
    };

    // Find any "entering" nodes in the redirect path that match the original path and aren't being reloaded
    let matchingEnteringNodes: PathNode[] = PathUtils.matching(redirectEnteringNodes, originalEnteringNodes, PathUtils.nonDynamicParams)
        .filter(not(nodeIsReloading(targetState.options().reloadState)));

    // Use the existing (possibly pre-resolved) resolvables for the matching entering nodes.
    matchingEnteringNodes.forEach((node, idx) => {
      node.resolvables = originalEnteringNodes[idx].resolvables;
    });

    return newTransition;
  }

  /** @hidden If a transition doesn't exit/enter any states, returns any [[Param]] whose value changed */
  private _changedParams(): Param[] {
    let tc = this._treeChanges;

    /** Return undefined if it's not a "dynamic" transition, for the following reasons */
    // If user explicitly wants a reload
    if (this._options.reload) return undefined;
    // If any states are exiting or entering
    if (tc.exiting.length || tc.entering.length) return undefined;
    // If to/from path lengths differ
    if (tc.to.length !== tc.from.length) return undefined;
    // If the to/from paths are different
    let pathsDiffer: boolean = arrayTuples(tc.to, tc.from)
        .map(tuple => tuple[0].state !== tuple[1].state)
        .reduce(anyTrueR, false);
    if (pathsDiffer) return undefined;

    // Find any parameter values that differ
    let nodeSchemas: Param[][] = tc.to.map((node: PathNode) => node.paramSchema);
    let [toValues, fromValues] = [tc.to, tc.from].map(path => path.map(x => x.paramValues));
    let tuples = arrayTuples(nodeSchemas, toValues, fromValues);

    return tuples.map(([schema, toVals, fromVals]) => Param.changed(schema, toVals, fromVals)).reduce(unnestR, []);
  }

  /**
   * Returns true if the transition is dynamic.
   *
   * A transition is dynamic if no states are entered nor exited, but at least one dynamic parameter has changed.
   *
   * @returns true if the Transition is dynamic
   */
  dynamic(): boolean {
    let changes = this._changedParams();
    return !changes ? false : changes.map(x => x.dynamic).reduce(anyTrueR, false);
  }

  /**
   * Returns true if the transition is ignored.
   *
   * A transition is ignored if no states are entered nor exited, and no parameter values have changed.
   *
   * @returns true if the Transition is ignored.
   */
  ignored(): boolean {
    return !!this._ignoredReason();
  }

  /** @hidden */
  _ignoredReason(): "SameAsCurrent"|"SameAsPending"|undefined {
    const pending = this.router.globals.transition;
    const reloadState = this._options.reloadState;

    const same = (pathA, pathB) => {
      if (pathA.length !== pathB.length) return false;
      const matching = PathUtils.matching(pathA, pathB);
      return pathA.length === matching.filter(node => !reloadState || !node.state.includes[reloadState.name]).length;
    };

    let newTC = this.treeChanges();
    let pendTC = pending && pending.treeChanges();

    if (pendTC && same(pendTC.to, newTC.to) && same(pendTC.exiting, newTC.exiting)) return "SameAsPending";
    if (newTC.exiting.length === 0 && newTC.entering.length === 0 && same(newTC.from, newTC.to)) return "SameAsCurrent";
  }

  /**
   * Runs the transition
   *
   * This method is generally called from the [[StateService.transitionTo]]
   *
   * @internalapi
   *
   * @returns a promise for a successful transition.
   */
  run(): Promise<any> {
    let runAllHooks = TransitionHook.runAllHooks;

    // Gets transition hooks array for the given phase
    const getHooksFor = (phase: TransitionHookPhase) =>
        this._hookBuilder.buildHooksForPhase(phase);

    // When the chain is complete, then resolve or reject the deferred
    const transitionSuccess = () => {
      trace.traceSuccess(this.$to(), this);
      this.success = true;
      this._deferred.resolve(this.to());
      runAllHooks(getHooksFor(TransitionHookPhase.SUCCESS));
    };

    const transitionError = (reason: any) => {
      trace.traceError(reason, this);
      this.success = false;
      this._deferred.reject(reason);
      this._error = reason;
      runAllHooks(getHooksFor(TransitionHookPhase.ERROR));
    };

    const runTransition = () => {
      // Wait to build the RUN hook chain until the BEFORE hooks are done
      // This allows a BEFORE hook to dynamically add additional RUN hooks via the Transition object.
      let allRunHooks = getHooksFor(TransitionHookPhase.RUN);
      let done = () => services.$q.when(undefined);
      return TransitionHook.invokeHooks(allRunHooks, done);
    };

    const startTransition = () => {
      let globals = this.router.globals;

      globals.lastStartedTransitionId = this.$id;
      globals.transition = this;
      globals.transitionHistory.enqueue(this);

      trace.traceTransitionStart(this);

      return services.$q.when(undefined);
    };

    let allBeforeHooks = getHooksFor(TransitionHookPhase.BEFORE);
    TransitionHook.invokeHooks(allBeforeHooks, startTransition)
        .then(runTransition)
        .then(transitionSuccess, transitionError);

    return this.promise;
  }

  /** Checks if this transition is currently active/running. */
  isActive = () =>
      this.router.globals.transition === this;

  /**
   * Checks if the Transition is valid
   *
   * @returns true if the Transition is valid
   */
  valid() {
    return !this.error() || this.success !== undefined;
  }

  /**
   * Aborts this transition
   *
   * Imperative API to abort a Transition.
   * This only applies to Transitions that are not yet complete.
   */
  abort() {
    // Do not set flag if the transition is already complete
    if (isUndefined(this.success))  {
      this._aborted = true;
    }
  }

  /**
   * The Transition error reason.
   *
   * If the transition is invalid (and could not be run), returns the reason the transition is invalid.
   * If the transition was valid and ran, but was not successful, returns the reason the transition failed.
   *
   * @returns an error message explaining why the transition is invalid, or the reason the transition failed.
   */
  error() {
    let state: StateObject = this.$to();

    if (state.self.abstract)
      return `Cannot transition to abstract state '${state.name}'`;

    const paramDefs = state.parameters(), values = this.params();
    const invalidParams = paramDefs.filter(param => !param.validates(values[param.id]));
    if (invalidParams.length) {
      return `Param values not valid for state '${state.name}'. Invalid params: [ ${invalidParams.map(param => param.id).join(', ')} ]`;
    }

    if (this.success === false)
      return this._error;
  }

  /**
   * A string representation of the Transition
   *
   * @returns A string representation of the Transition
   */
  toString () {
    let fromStateOrName = this.from();
    let toStateOrName = this.to();

    const avoidEmptyHash = (params: RawParams) =>
      (params["#"] !== null && params["#"] !== undefined) ? params : omit(params, ["#"]);

    // (X) means the to state is invalid.
    let id = this.$id,
        from = isObject(fromStateOrName) ? fromStateOrName.name : fromStateOrName,
        fromParams = stringify(avoidEmptyHash(this._treeChanges.from.map(prop('paramValues')).reduce(mergeR, {}))),
        toValid = this.valid() ? "" : "(X) ",
        to = isObject(toStateOrName) ? toStateOrName.name : toStateOrName,
        toParams = stringify(avoidEmptyHash(this.params()));

    return `Transition#${id}( '${from}'${fromParams} -> ${toValid}'${to}'${toParams} )`;
  }
}
