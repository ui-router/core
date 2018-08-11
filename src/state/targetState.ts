/** @publicapi @module state */ /** */

import { StateDeclaration, StateOrName, TargetStateDef } from './interface';
import { TransitionOptions } from '../transition/interface';
import { StateObject } from './stateObject';
import { isString } from '../common/predicates';
import { stringify } from '../common/strings';
import { extend } from '../common';
import { StateRegistry } from './stateRegistry';
import { RawParams } from '../params';

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
  private _definition: StateObject;
  private _params: RawParams;
  private _options: TransitionOptions;

  /** Returns true if the object has a state property that might be a state or state name */
  static isDef = (obj): obj is TargetStateDef => obj && obj.state && (isString(obj.state) || isString(obj.state.name));

  /**
   * The TargetState constructor
   *
   * Note: Do not construct a `TargetState` manually.
   * To create a `TargetState`, use the [[StateService.target]] factory method.
   *
   * @param _stateRegistry The StateRegistry to use to look up the _definition
   * @param _identifier An identifier for a state.
   *    Either a fully-qualified state name, or the object used to define the state.
   * @param _params Parameters for the target state
   * @param _options Transition options.
   *
   * @internalapi
   */
  constructor(
    private _stateRegistry: StateRegistry,
    private _identifier: StateOrName,
    _params?: RawParams,
    _options?: TransitionOptions
  ) {
    this._identifier = _identifier;
    this._params = extend({}, _params || {});
    this._options = extend({}, _options || {});
    this._definition = _stateRegistry.matcher.find(_identifier, this._options.relative);
  }

  /** The name of the state this object targets */
  name(): string {
    return (this._definition && this._definition.name) || <string>this._identifier;
  }

  /** The identifier used when creating this TargetState */
  identifier(): StateOrName {
    return this._identifier;
  }

  /** The target parameter values */
  params(): RawParams {
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
    const base = <any>this.options().relative;
    if (!this._definition && !!base) {
      const stateName = base.name ? base.name : base;
      return `Could not resolve '${this.name()}' from state '${stateName}'`;
    }
    if (!this._definition) return `No such state '${this.name()}'`;
    if (!this._definition.self) return `State '${this.name()}' has an invalid definition`;
  }

  toString() {
    return `'${this.name()}'${stringify(this.params())}`;
  }

  /**
   * Returns a copy of this TargetState which targets a different state.
   * The new TargetState has the same parameter values and transition options.
   *
   * @param state The new state that should be targeted
   */
  withState(state: StateOrName): TargetState {
    return new TargetState(this._stateRegistry, state, this._params, this._options);
  }

  /**
   * Returns a copy of this TargetState, using the specified parameter values.
   *
   * @param params the new parameter values to use
   * @param replace When false (default) the new parameter values will be merged with the current values.
   *                When true the parameter values will be used instead of the current values.
   */
  withParams(params: RawParams, replace = false): TargetState {
    const newParams: RawParams = replace ? params : extend({}, this._params, params);
    return new TargetState(this._stateRegistry, this._identifier, newParams, this._options);
  }

  /**
   * Returns a copy of this TargetState, using the specified Transition Options.
   *
   * @param options the new options to use
   * @param replace When false (default) the new options will be merged with the current options.
   *                When true the options will be used instead of the current options.
   */
  withOptions(options: TransitionOptions, replace = false): TargetState {
    const newOpts = replace ? options : extend({}, this._options, options);
    return new TargetState(this._stateRegistry, this._identifier, this._params, newOpts);
  }
}
