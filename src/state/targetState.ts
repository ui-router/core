/**
 * @coreapi
 * @module state
 */ /** for typedoc */

import {StateDeclaration, StateOrName} from "./interface";
import {ParamsOrArray} from "../params/interface";
import {TransitionOptions} from "../transition/interface";

import {State} from "./stateObject";
import {toJson} from "../common/common";

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
 * either be a *state object* (a [[StateDeclaration]] or [[State]]) or a *state name* (a string).
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
   */
  constructor(
    private _identifier: StateOrName,
    private _definition?: State,
    _params: ParamsOrArray = {},
    private _options: TransitionOptions = {}
  ) {
    this._params = _params || {};
  }

  name(): String {
    return this._definition && this._definition.name || <String> this._identifier;
  }

  identifier(): StateOrName {
    return this._identifier;
  }

  params(): ParamsOrArray {
    return this._params;
  }

  $state(): State {
    return this._definition;
  }

  state(): StateDeclaration {
    return this._definition && this._definition.self;
  }

  options() {
    return this._options;
  }

  exists(): boolean {
    return !!(this._definition && this._definition.self);
  }

  valid(): boolean {
    return !this.error();
  }

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
}
