/**
 * @coreapi
 * @module transition
 */ /** for typedoc */
import { extend, removeFrom, tail, values, identity, map } from "../common/common";
import {isString, isFunction} from "../common/predicates";
import {PathNode} from "../path/node";
import {
    TransitionStateHookFn, TransitionHookFn, TransitionHookPhase, TransitionHookScope, IHookRegistry, PathType
} from "./interface"; // has or is using

import {
    HookRegOptions, HookMatchCriteria, TreeChanges,
    HookMatchCriterion, IMatchingNodes, HookFn
} from "./interface";
import {Glob} from "../common/glob";
import {State} from "../state/stateObject";
import {TransitionEventType} from "./transitionEventType";
import { TransitionService } from "./transitionService";

/**
 * Determines if the given state matches the matchCriteria
 *
 * @hidden
 *
 * @param state a State Object to test against
 * @param criterion
 * - If a string, matchState uses the string as a glob-matcher against the state name
 * - If an array (of strings), matchState uses each string in the array as a glob-matchers against the state name
 *   and returns a positive match if any of the globs match.
 * - If a function, matchState calls the function with the state and returns true if the function's result is truthy.
 * @returns {boolean}
 */
export function matchState(state: State, criterion: HookMatchCriterion) {
  let toMatch = isString(criterion) ? [criterion] : criterion;

  function matchGlobs(_state: State) {
    let globStrings = <string[]> toMatch;
    for (let i = 0; i < globStrings.length; i++) {
      let glob = new Glob(globStrings[i]);

      if ((glob && glob.matches(_state.name)) || (!glob && globStrings[i] === _state.name)) {
        return true;
      }
    }
    return false;
  }

  let matchFn = <any> (isFunction(toMatch) ? toMatch : matchGlobs);
  return !!matchFn(state);
}

/**
 * @internalapi
 * The registration data for a registered transition hook
 */
export class RegisteredHook {
  priority: number;
  bind: any;
  _deregistered: boolean;

  constructor(public tranSvc: TransitionService,
              public eventType: TransitionEventType,
              public callback: HookFn,
              public matchCriteria: HookMatchCriteria,
              options: HookRegOptions = {} as any) {
    this.priority = options.priority || 0;
    this.bind = options.bind || null;
    this._deregistered = false;
  }

  /**
   * Gets the matching [[PathNode]]s
   *
   * Given an array of [[PathNode]]s, and a [[HookMatchCriterion]], returns an array containing
   * the [[PathNode]]s that the criteria matches, or `null` if there were no matching nodes.
   *
   * Returning `null` is significant to distinguish between the default
   * "match-all criterion value" of `true` compared to a `() => true` function,
   * when the nodes is an empty array.
   *
   * This is useful to allow a transition match criteria of `entering: true`
   * to still match a transition, even when `entering === []`.  Contrast that
   * with `entering: (state) => true` which only matches when a state is actually
   * being entered.
   */
  private _matchingNodes(nodes: PathNode[], criterion: HookMatchCriterion): PathNode[] {
    if (criterion === true) return nodes;
    let matching = nodes.filter(node => matchState(node.state, criterion));
    return matching.length ? matching : null;
  }

  /**
   * Gets the default match criteria (all `true`)
   *
   * Returns an object which has all the criteria match paths as keys and `true` as values, i.e.:
   *
   * ```js
   * {
   *   to: true,
   *   from: true,
   *   entering: true,
   *   exiting: true,
   *   retained: true,
   * }
   */
  private _getDefaultMatchCriteria(): HookMatchCriteria {
    return map(this.tranSvc._pluginapi._getPathTypes(), () => true);
  }

  /**
   * Gets matching nodes as [[IMatchingNodes]]
   *
   * Create a IMatchingNodes object from the TransitionHookTypes that is roughly equivalent to:
   *
   * ```js
   * let matches: IMatchingNodes = {
   *   to:       _matchingNodes([tail(treeChanges.to)],   mc.to),
   *   from:     _matchingNodes([tail(treeChanges.from)], mc.from),
   *   exiting:  _matchingNodes(treeChanges.exiting,      mc.exiting),
   *   retained: _matchingNodes(treeChanges.retained,     mc.retained),
   *   entering: _matchingNodes(treeChanges.entering,     mc.entering),
   * };
   * ```
   */
  private _getMatchingNodes(treeChanges: TreeChanges): IMatchingNodes {
    let criteria = extend(this._getDefaultMatchCriteria(), this.matchCriteria);
    let paths: PathType[] = values(this.tranSvc._pluginapi._getPathTypes());

    return paths.reduce((mn: IMatchingNodes, pathtype: PathType) => {
      // STATE scope criteria matches against every node in the path.
      // TRANSITION scope criteria matches against only the last node in the path
      let isStateHook = pathtype.scope === TransitionHookScope.STATE;
      let path = treeChanges[pathtype.name] || [];
      let nodes: PathNode[] = isStateHook ? path : [tail(path)];

      mn[pathtype.name] = this._matchingNodes(nodes, criteria[pathtype.name]);
      return mn;
    }, {} as IMatchingNodes);
  }

  /**
   * Determines if this hook's [[matchCriteria]] match the given [[TreeChanges]]
   *
   * @returns an IMatchingNodes object, or null. If an IMatchingNodes object is returned, its values
   * are the matching [[PathNode]]s for each [[HookMatchCriterion]] (to, from, exiting, retained, entering)
   */
  matches(treeChanges: TreeChanges): IMatchingNodes {
    let matches = this._getMatchingNodes(treeChanges);

    // Check if all the criteria matched the TreeChanges object
    let allMatched = values(matches).every(identity);
    return allMatched ? matches : null;
  }
}

/** @hidden Return a registration function of the requested type. */
export function makeEvent(registry: IHookRegistry, transitionService: TransitionService, eventType: TransitionEventType) {
  // Create the object which holds the registered transition hooks.
  let _registeredHooks = registry._registeredHooks = (registry._registeredHooks || {});
  let hooks = _registeredHooks[eventType.name] = [];

  // Create hook registration function on the IHookRegistry for the event
  registry[eventType.name] = hookRegistrationFn;

  function hookRegistrationFn(matchObject, callback, options = {}) {
    let registeredHook = new RegisteredHook(transitionService, eventType, callback, matchObject, options);
    hooks.push(registeredHook);

    return function deregisterEventHook() {
      registeredHook._deregistered = true;
      removeFrom(hooks)(registeredHook);
    };
  }

  return hookRegistrationFn;
}