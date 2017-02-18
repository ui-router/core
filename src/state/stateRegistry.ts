/**
 * @coreapi
 * @module state
 */ /** for typedoc */

import { StateObject } from "./stateObject";
import { StateMatcher } from "./stateMatcher";
import { StateBuilder } from "./stateBuilder";
import { StateQueueManager } from "./stateQueueManager";
import { StateDeclaration, _StateDeclaration } from "./interface";
import { BuilderFunction } from "./stateBuilder";
import { StateOrName } from "./interface";
import { removeFrom } from "../common/common";
import { UIRouter } from "../router";
import { propEq } from "../common/hof";

/**
 * The signature for the callback function provided to [[StateRegistry.onStatesChanged]].
 *
 * This callback receives two parameters:
 *
 * @param event a string; either "registered" or "deregistered"
 * @param states the list of [[StateDeclaration]]s that were registered (or deregistered).
 */
export type StateRegistryListener = (event: "registered"|"deregistered", states: StateDeclaration[]) => void;

export class StateRegistry {
  private _root: StateObject;
  private states: { [key: string]: StateObject } = {};

  matcher: StateMatcher;
  private builder: StateBuilder;
  stateQueue: StateQueueManager;

  listeners: StateRegistryListener[] = [];

  /** @internalapi */
  constructor(private _router: UIRouter) {
    this.matcher = new StateMatcher(this.states);
    this.builder = new StateBuilder(this.matcher, _router.urlMatcherFactory);
    this.stateQueue = new StateQueueManager(this, _router.urlRouter, this.states, this.builder, this.listeners);
    this._registerRoot();
  }

  /** @internalapi */
  private _registerRoot() {
    let rootStateDef: StateDeclaration = {
      name: '',
      url: '^',
      views: null,
      params: {
        '#': { value: null, type: 'hash', dynamic: true }
      },
      abstract: true
    };

    let _root = this._root = this.stateQueue.register(rootStateDef);
    _root.navigable = null;
  }

  /** @internalapi */
  dispose() {
    this.stateQueue.dispose();
    this.listeners = [];
    this.get().forEach(state => this.get(state) && this.deregister(state));
  }

  /**
   * Listen for a State Registry events
   *
   * Adds a callback that is invoked when states are registered or deregistered with the StateRegistry.
   *
   * #### Example:
   * ```js
   * let allStates = registry.get();
   *
   * // Later, invoke deregisterFn() to remove the listener
   * let deregisterFn = registry.onStatesChanged((event, states) => {
   *   switch(event) {
   *     case: 'registered':
   *       states.forEach(state => allStates.push(state));
   *       break;
   *     case: 'deregistered':
   *       states.forEach(state => {
   *         let idx = allStates.indexOf(state);
   *         if (idx !== -1) allStates.splice(idx, 1);
   *       });
   *       break;
   *   }
   * });
   * ```
   *
   * @param listener a callback function invoked when the registered states changes.
   *        The function receives two parameters, `event` and `state`.
   *        See [[StateRegistryListener]]
   * @return a function that deregisters the listener
   */
  onStatesChanged(listener: StateRegistryListener): () => void {
    this.listeners.push(listener);
    return function deregisterListener() {
      removeFrom(this.listeners)(listener);
    }.bind(this);
  }

  /**
   * Gets the implicit root state
   *
   * Gets the root of the state tree.
   * The root state is implicitly created by UI-Router.
   * Note: this returns the internal [[StateObject]] representation, not a [[StateDeclaration]]
   *
   * @return the root [[StateObject]]
   */
  root() {
    return this._root;
  }

  /**
   * Adds a state to the registry
   *
   * Registers a [[StateDeclaration]] or queues it for registration.
   *
   * Note: a state will be queued if the state's parent isn't yet registered.
   *
   * @param stateDefinition the definition of the state to register.
   * @returns the internal [[StateObject]] object.
   *          If the state was successfully registered, then the object is fully built (See: [[StateBuilder]]).
   *          If the state was only queued, then the object is not fully built.
   */
  register(stateDefinition: _StateDeclaration): StateObject {
    return this.stateQueue.register(stateDefinition);
  }

  /** @hidden */
  private _deregisterTree(state: StateObject) {
    let all = this.get().map(s => s.$$state());
    const getChildren = (states: StateObject[]) => {
      let children = all.filter(s => states.indexOf(s.parent) !== -1);
      return children.length === 0 ? children : children.concat(getChildren(children));
    };

    let children = getChildren([state]);
    let deregistered: StateObject[] = [state].concat(children).reverse();

    deregistered.forEach(state => {
      let $ur = this._router.urlRouter;
      // Remove URL rule
      $ur.rules().filter(propEq("state", state)).forEach($ur.removeRule.bind($ur));
      // Remove state from registry
      delete this.states[state.name];
    });

    return deregistered;
  }

  /**
   * Removes a state from the registry
   *
   * This removes a state from the registry.
   * If the state has children, they are are also removed from the registry.
   *
   * @param stateOrName the state's name or object representation
   * @returns {StateObject[]} a list of removed states
   */
  deregister(stateOrName: StateOrName) {
    let _state = this.get(stateOrName);
    if (!_state) throw new Error("Can't deregister state; not found: " + stateOrName);
    let deregisteredStates = this._deregisterTree(_state.$$state());

    this.listeners.forEach(listener => listener("deregistered", deregisteredStates.map(s => s.self)));
    return deregisteredStates;
  }

  /**
   * Gets all registered states
   *
   * Calling this method with no arguments will return a list of all the states that are currently registered.
   * Note: this does not return states that are *queued* but not yet registered.
   *
   * @return a list of [[StateDeclaration]]s
   */
  get(): StateDeclaration[];

  /**
   * Gets a registered state
   *
   * Given a state or a name, finds and returns the [[StateDeclaration]] from the registry.
   * Note: this does not return states that are *queued* but not yet registered.
   *
   * @param stateOrName either the name of a state, or a state object.
   * @return a registered [[StateDeclaration]] that matched the `stateOrName`, or null if the state isn't registered.
   */
  get(stateOrName: StateOrName, base?: StateOrName): StateDeclaration;
  get(stateOrName?: StateOrName, base?: StateOrName): any {
    if (arguments.length === 0) 
      return <StateDeclaration[]> Object.keys(this.states).map(name => this.states[name].self);
    let found = this.matcher.find(stateOrName, base);
    return found && found.self || null;
  }

  decorator(name: string, func: BuilderFunction) {
    return this.builder.builder(name, func);
  }
}