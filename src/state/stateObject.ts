/**
 * @coreapi
 * @module state
 */
/** for typedoc */
import { StateDeclaration, _ViewDeclaration } from "./interface";
import { defaults, values, find, inherit } from "../common/common";
import { propEq } from "../common/hof";
import { Param } from "../params/param";
import { UrlMatcher } from "../url/urlMatcher";
import { Resolvable } from "../resolve/resolvable";
import { TransitionStateHookFn } from "../transition/interface";
import { TargetState } from "./targetState";
import { Transition } from "../transition/transition";

/**
 * Internal representation of a UI-Router state.
 *
 * Instances of this class are created when a [[StateDeclaration]] is registered with the [[StateRegistry]].
 *
 * A registered [[StateDeclaration]] is augmented with a getter ([[StateDeclaration.$$state]]) which returns the corresponding [[State]] object.
 *
 * This class prototypally inherits from the corresponding [[StateDeclaration]].
 * Each of its own properties (i.e., `hasOwnProperty`) are built using builders from the [[StateBuilder]].
 */
export class State {
  /** The parent [[State]] */
  public parent: State;

  /** The name used to register the state */
  public name: string;

  /** Prototypally inherits from [[StateDeclaration.abstract]] */
  public abstract: boolean;

  /** Prototypally inherits from [[StateDeclaration.resolve]] */
  public resolve: ({ [key: string]: (string|any[]|Function) }|any[]);

  /** A list of [[Resolvable]] objects.  The internal representation of [[resolve]]. */
  public resolvables: Resolvable[];

  /** Prototypally inherits from [[StateDeclaration.resolvePolicy]] */
  public resolvePolicy: any;

  /** A compiled URLMatcher which detects when the state's URL is matched */
  public url: UrlMatcher;

  /** The parameters for the state, built from the URL and [[StateDeclaration.params]] */
  public params: { [key: string]: Param };

  /**
   * The views for the state.
   * Note: `ui-router-core` does not register a builder for views.
   * The framework specific code should register a `views` builder.
   */
  public views: { [key: string]: _ViewDeclaration; };

  /**
   * The original [[StateDeclaration]] used to build this [[State]].
   * Note: `this` object also prototypally inherits from the `self` declaration object.
   */
  public self: StateDeclaration;

  /** The nearest parent [[State]] which has a URL */
  public navigable: State;

  /** The parent [[State]] objects from this state up to the root */
  public path: State[];

  /**
   * Prototypally inherits from [[StateDeclaration.data]]
   * Note: This is the only field on the [[StateDeclaration]] which is mutated.
   * The definition object's `data` field is replaced with a new object
   * which prototypally inherits from the parent state definition's `data` field.
   */
  public data: any;

  /** An array of strings of the parent States' names */
  public includes: { [name: string] : boolean };

  /** Prototypally inherits from [[StateDeclaration.onExit]] */
  public onExit: TransitionStateHookFn;
  /** Prototypally inherits from [[StateDeclaration.onRetain]] */
  public onRetain: TransitionStateHookFn;
  /** Prototypally inherits from [[StateDeclaration.onEnter]] */
  public onEnter: TransitionStateHookFn;

  /** Prototypally inherits from [[StateDeclaration.lazyLoad]] */
  public lazyLoad: (transition: Transition, state: StateDeclaration) => Promise<StateDeclaration[]>;

  /** Prototypally inherits from [[StateDeclaration.redirectTo]] */
  redirectTo: (
      string |
      (($transition$: Transition) => TargetState) |
      { state: (string|StateDeclaration), params: { [key: string]: any }}
  );


  /** @deprecated use State.create() */
  constructor(config?: StateDeclaration) {
    return State.create(config || {});
  }

  /**
   * Create a state object to put the private/internal implementation details onto.
   * The object's prototype chain looks like:
   * (Internal State Object) -> (Copy of State.prototype) -> (State Declaration object) -> (State Declaration's prototype...)
   *
   * @param stateDecl the user-supplied State Declaration
   * @returns {State} an internal State object
   */
  static create(stateDecl: StateDeclaration): State {
    let state = inherit(inherit(stateDecl, State.prototype)) as State;
    stateDecl.$$state = () => state;
    state['__stateObject'] = true;
    state.self = stateDecl;
    return state;
  }

  /** Predicate which returns true if the object is an internal State object */
  static isState = (obj: any): obj is State =>
      obj['__stateObject'] === true;

  /**
   * Returns true if the provided parameter is the same state.
   *
   * Compares the identity of the state against the passed value, which is either an object
   * reference to the actual `State` instance, the original definition object passed to
   * `$stateProvider.state()`, or the fully-qualified name.
   *
   * @param ref Can be one of (a) a `State` instance, (b) an object that was passed
   *        into `$stateProvider.state()`, (c) the fully-qualified name of a state as a string.
   * @returns Returns `true` if `ref` matches the current `State` instance.
   */
  is(ref: State|StateDeclaration|string): boolean {
    return this === ref || this.self === ref || this.fqn() === ref;
  }

  /**
   * @deprecated this does not properly handle dot notation
   * @returns Returns a dot-separated name of the state.
   */
  fqn(): string {
    if (!this.parent || !(this.parent instanceof this.constructor)) return this.name;
    let name = this.parent.fqn();
    return name ? name + "." + this.name : this.name;
  }

  /**
   * Returns the root node of this state's tree.
   *
   * @returns The root of this state's tree.
   */
  root(): State {
    return this.parent && this.parent.root() || this;
  }

  /**
   * Gets the state's `Param`eters
   *
   * Gets [[Param]] information that is owned by the state.
   * If `opts.inherit` is true, it also includes the ancestor states' [[Param]] information.
   * If `opts.matchingKeys` exists, returns only `Param`s whose `id` is a key on the `matchingKeys` object
   *
   * @param opts options
   */
  parameters(opts?: { inherit?: boolean, matchingKeys?: any }): Param[] {
    opts = defaults(opts, { inherit: true, matchingKeys: null });
    let inherited = opts.inherit && this.parent && this.parent.parameters() || [];
    return inherited.concat(values(this.params))
        .filter(param => !opts.matchingKeys || opts.matchingKeys.hasOwnProperty(param.id));
  }

  /**
   * Returns a single [[Param]] that is owned by the state
   *
   * If `opts.inherit` is true, it also searches the ancestor states` [[Param]] information.
   * @param id the name of the [[Param]] to return
   * @param opts options
   */
  parameter(id: string, opts: { inherit?: boolean } = {}): Param {
    return (
        this.url && this.url.parameter(id, opts) ||
        find(values(this.params), propEq('id', id)) ||
        opts.inherit && this.parent && this.parent.parameter(id)
    );
  }

  toString() {
    return this.fqn();
  }
}
