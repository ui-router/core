/** @publicapi @module resolve */ /** */
import { extend, identity } from '../common/common';
import { services } from '../common/coreservices';
import { trace } from '../common/trace';
import { ResolvePolicy, ResolvableLiteral, PolicyAsync } from './interface';

import { ResolveContext } from './resolveContext';
import { stringify } from '../common/strings';
import { isFunction, isObject } from '../common/predicates';
import { Transition } from '../transition/transition';
import { StateObject } from '../state/stateObject';
import { PathNode } from '../path/pathNode';
import { isNullOrUndefined } from '../common/predicates';

// TODO: explicitly make this user configurable
export let defaultResolvePolicy: ResolvePolicy = {
  when: 'LAZY',
  async: 'WAIT',
};

/**
 * The basic building block for the resolve system.
 *
 * Resolvables encapsulate a state's resolve's resolveFn, the resolveFn's declared dependencies, the wrapped (.promise),
 * and the unwrapped-when-complete (.data) result of the resolveFn.
 *
 * Resolvable.get() either retrieves the Resolvable's existing promise, or else invokes resolve() (which invokes the
 * resolveFn) and returns the resulting promise.
 *
 * Resolvable.get() and Resolvable.resolve() both execute within a context path, which is passed as the first
 * parameter to those fns.
 */
export class Resolvable implements ResolvableLiteral {
  token: any;
  policy: ResolvePolicy;
  resolveFn: Function;
  deps: any[];

  data: any;
  resolved = false;
  promise: Promise<any> = undefined;

  static fromData = (token: any, data: any) => new Resolvable(token, () => data, null, null, data);

  /** This constructor creates a Resolvable copy */
  constructor(resolvable: Resolvable);

  /** This constructor creates a new Resolvable from the plain old [[ResolvableLiteral]] javascript object */
  constructor(resolvable: ResolvableLiteral);

  /**
   * This constructor creates a new `Resolvable`
   *
   * #### Example:
   * ```js
   * var resolvable1 = new Resolvable('mytoken', http => http.get('foo.json').toPromise(), [Http]);
   *
   * var resolvable2 = new Resolvable(UserService, dep => new UserService(dep.data), [SomeDependency]);
   *
   * var resolvable1Clone = new Resolvable(resolvable1);
   * ```
   *
   * @param token The new resolvable's injection token, such as `"userList"` (a string) or `UserService` (a class).
   *              When this token is used during injection, the resolved value will be injected.
   * @param resolveFn The function that returns the resolved value, or a promise for the resolved value
   * @param deps An array of dependencies, which will be injected into the `resolveFn`
   * @param policy the [[ResolvePolicy]] defines when and how the Resolvable is processed
   * @param data Pre-resolved data. If the resolve value is already known, it may be provided here.
   */
  constructor(token: any, resolveFn: Function, deps?: any[], policy?: ResolvePolicy, data?: any);
  constructor(arg1: any, resolveFn?: Function, deps?: any[], policy?: ResolvePolicy, data?: any) {
    if (arg1 instanceof Resolvable) {
      extend(this, arg1);
    } else if (isFunction(resolveFn)) {
      if (isNullOrUndefined(arg1)) throw new Error('new Resolvable(): token argument is required');
      if (!isFunction(resolveFn)) throw new Error('new Resolvable(): resolveFn argument must be a function');

      this.token = arg1;
      this.policy = policy;
      this.resolveFn = resolveFn;
      this.deps = deps || [];

      this.data = data;
      this.resolved = data !== undefined;
      this.promise = this.resolved ? services.$q.when(this.data) : undefined;
    } else if (isObject(arg1) && arg1.token && (arg1.hasOwnProperty('resolveFn') || arg1.hasOwnProperty('data'))) {
      const literal = <ResolvableLiteral>arg1;
      return new Resolvable(literal.token, literal.resolveFn, literal.deps, literal.policy, literal.data);
    }
  }

  getPolicy(state: StateObject): ResolvePolicy {
    const thisPolicy = this.policy || {};
    const statePolicy = (state && state.resolvePolicy) || {};
    return {
      when: thisPolicy.when || statePolicy.when || defaultResolvePolicy.when,
      async: thisPolicy.async || statePolicy.async || defaultResolvePolicy.async,
    };
  }

  /**
   * Asynchronously resolve this Resolvable's data
   *
   * Given a ResolveContext that this Resolvable is found in:
   * Wait for this Resolvable's dependencies, then invoke this Resolvable's function
   * and update the Resolvable's state
   */
  resolve(resolveContext: ResolveContext, trans?: Transition) {
    const $q = services.$q;

    // Gets all dependencies from ResolveContext and wait for them to be resolved
    const getResolvableDependencies = () =>
      $q.all(resolveContext.getDependencies(this).map(resolvable => resolvable.get(resolveContext, trans))) as Promise<
        any[]
      >;

    // Invokes the resolve function passing the resolved dependencies as arguments
    const invokeResolveFn = (resolvedDeps: any[]) => this.resolveFn.apply(null, resolvedDeps);

    // If the resolve policy is RXWAIT, wait for the observable to emit something. otherwise pass through.
    const node: PathNode = resolveContext.findNode(this);
    const state: StateObject = node && node.state;

    const asyncPolicy: PolicyAsync = this.getPolicy(state).async;
    const customAsyncPolicy = isFunction(asyncPolicy) ? asyncPolicy : identity;

    // After the final value has been resolved, update the state of the Resolvable
    const applyResolvedValue = (resolvedValue: any) => {
      this.data = resolvedValue;
      this.resolved = true;
      this.resolveFn = null;
      trace.traceResolvableResolved(this, trans);
      return this.data;
    };

    // Sets the promise property first, then getsResolvableDependencies in the context of the promise chain. Always waits one tick.
    return (this.promise = $q
      .when()
      .then(getResolvableDependencies)
      .then(invokeResolveFn)
      .then(customAsyncPolicy)
      .then(applyResolvedValue));
  }

  /**
   * Gets a promise for this Resolvable's data.
   *
   * Fetches the data and returns a promise.
   * Returns the existing promise if it has already been fetched once.
   */
  get(resolveContext: ResolveContext, trans?: Transition): Promise<any> {
    return this.promise || this.resolve(resolveContext, trans);
  }

  toString() {
    return `Resolvable(token: ${stringify(this.token)}, requires: [${this.deps.map(stringify)}])`;
  }

  clone(): Resolvable {
    return new Resolvable(this);
  }
}
