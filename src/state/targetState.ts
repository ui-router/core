/**
 * @coreapi
 * @module state
 */ /** for typedoc */

import { StateDeclaration, StateOrName, TargetStateDef } from "./interface";
import { ParamsOrArray } from "../params/interface";
import { TransitionOptions } from "../transition/interface";
import { StateObject } from "./stateObject";
import { toJson } from "../common/common";
import { isString } from "../common/predicates";

/**
 * Encapsulate the target (destination) state/params/options of a [[Transition]].
 *
 * This class is frequently used to redirect a transition to a new destination.
 *
 * See:
 *
 * - [[HookResult]]
 * - [[TransitionHookFn]]
 * - [[TransitionService.onStart]]
 *
 * To create a `TargetState`, use [[StateService.target]].
 *
 * ---
 *
 * This class wraps:
 *
 * 1) an identifier for a state
 * 2) a set of parameters
 * 3) and transition options
 * 4) the registered state object (the [[StateDeclaration]])
 *
 * Many UI-Router APIs such as [[StateService.go]] take a [[StateOrName]] argument which can
 * either be a *state object* (a [[StateDeclaration]] or [[StateObject]]) or a *state name* (a string).
 * The `TargetState` class normalizes those options.
 *
 * A `TargetState` may be valid (the state being targeted exists in the registry)
 * or invalid (the state being targeted is not registered).
 */
export class TargetState {
  private _params: ParamsOrArray;

  /**
   * The TargetState constructor
   *
   * Note: Do not construct a `TargetState` manually.
   * To create a `TargetState`, use the [[StateService.target]] factory method.
   *
   * @param _identifier An identifier for a state.
   *    Either a fully-qualified state name, or the object used to define the state.
   * @param _definition The internal state representation, if exists.
   * @param _params Parameters for the target state
   * @param _options Transition options.
   *
   * @internalapi
   */
  constructor(
    private _identifier: StateOrName,
    private _definition?: StateObject,
    _params?: ParamsOrArray,
    private _options: TransitionOptions = {}
  ) {
    this._params = _params || {};
  }

  /** The name of the state this object targets */
  name(): String {
    return this._definition && this._definition.name || <String> this._identifier;
  }

  /** The identifier used when creating this TargetState */
  identifier(): StateOrName {
    return this._identifier;
  }

  /** The target parameter values */
  params(): ParamsOrArray {
    return this._params;
  }

  /** The internal state object (if it was found) */
  $state(): StateObject {
    return this._definition;
  }

  /** The internal state declaration (if it was found) */
  state(): StateDeclaration {
    return this._definition && this._definition.self;
  }

  /** The target options */
  options() {
    return this._options;
  }

  /** True if the target state was found */
  exists(): boolean {
    return !!(this._definition && this._definition.self);
  }

  /** True if the object is valid */
  valid(): boolean {
    return !this.error();
  }

  /** If the object is invalid, returns the reason why */
  error(): string {
    let base = <any> this.options().relative;
    if (!this._definition && !!base) {
      let stateName = base.name ? base.name : base;
      return `Could not resolve '${this.name()}' from state '${stateName}'`;
    }
    if (!this._definition)
      return `No such state '${this.name()}'`;
    if (!this._definition.self)
      return `State '${this.name()}' has an invalid definition`;
  }

  toString() {
    return `'${this.name()}'${toJson(this.params())}`;
  }

  /** Returns true if the object has a state property that might be a state or state name */
  static isDef = (obj): obj is TargetStateDef =>
      obj && obj.state && (isString(obj.state) || isString(obj.state.name));

  // /** Returns a new TargetState based on this one, but using the specified options */
  // withOptions(_options: TransitionOptions): TargetState {
  //   return extend(this._clone(), { _options });
  // }
  //
  // /** Returns a new TargetState based on this one, but using the specified params */
  // withParams(_params: ParamsOrArray): TargetState {
  //   return extend(this._clone(), { _params });
  // }

  // private _clone = () =>
  //     new TargetState(this._identifier, this._definition, this._params, this._options);
}
