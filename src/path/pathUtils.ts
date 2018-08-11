/** @internalapi @module path */ /** */

import {
  extend,
  find,
  pick,
  omit,
  tail,
  mergeR,
  values,
  unnestR,
  Predicate,
  inArray,
  arrayTuples,
} from '../common/common';
import { prop, propEq, not } from '../common/hof';

import { RawParams } from '../params/interface';
import { TreeChanges } from '../transition/interface';
import { ViewConfig } from '../view/interface';
import { _ViewDeclaration } from '../state/interface';

import { StateObject } from '../state/stateObject';
import { TargetState } from '../state/targetState';
import { GetParamsFn, PathNode } from './pathNode';
import { ViewService } from '../view/view';
import { Param } from '../params/param';
import { StateRegistry } from '../state';

/**
 * This class contains functions which convert TargetStates, Nodes and paths from one type to another.
 */
export class PathUtils {
  /** Given a PathNode[], create an TargetState */
  static makeTargetState(registry: StateRegistry, path: PathNode[]): TargetState {
    const state = tail(path).state;
    return new TargetState(registry, state, path.map(prop('paramValues')).reduce(mergeR, {}), {});
  }

  static buildPath(targetState: TargetState) {
    const toParams = targetState.params();
    return targetState.$state().path.map(state => new PathNode(state).applyRawParams(toParams));
  }

  /** Given a fromPath: PathNode[] and a TargetState, builds a toPath: PathNode[] */
  static buildToPath(fromPath: PathNode[], targetState: TargetState): PathNode[] {
    const toPath: PathNode[] = PathUtils.buildPath(targetState);
    if (targetState.options().inherit) {
      return PathUtils.inheritParams(fromPath, toPath, Object.keys(targetState.params()));
    }
    return toPath;
  }

  /**
   * Creates ViewConfig objects and adds to nodes.
   *
   * On each [[PathNode]], creates ViewConfig objects from the views: property of the node's state
   */
  static applyViewConfigs($view: ViewService, path: PathNode[], states: StateObject[]) {
    // Only apply the viewConfigs to the nodes for the given states
    path.filter(node => inArray(states, node.state)).forEach(node => {
      const viewDecls: _ViewDeclaration[] = values(node.state.views || {});
      const subPath = PathUtils.subPath(path, n => n === node);
      const viewConfigs: ViewConfig[][] = viewDecls.map(view => $view.createViewConfig(subPath, view));
      node.views = viewConfigs.reduce(unnestR, []);
    });
  }

  /**
   * Given a fromPath and a toPath, returns a new to path which inherits parameters from the fromPath
   *
   * For a parameter in a node to be inherited from the from path:
   * - The toPath's node must have a matching node in the fromPath (by state).
   * - The parameter name must not be found in the toKeys parameter array.
   *
   * Note: the keys provided in toKeys are intended to be those param keys explicitly specified by some
   * caller, for instance, $state.transitionTo(..., toParams).  If a key was found in toParams,
   * it is not inherited from the fromPath.
   */
  static inheritParams(fromPath: PathNode[], toPath: PathNode[], toKeys: string[] = []): PathNode[] {
    function nodeParamVals(path: PathNode[], state: StateObject): RawParams {
      const node: PathNode = find(path, propEq('state', state));
      return extend({}, node && node.paramValues);
    }

    const noInherit = fromPath
      .map(node => node.paramSchema)
      .reduce(unnestR, [])
      .filter(param => !param.inherit)
      .map(prop('id'));

    /**
     * Given an [[PathNode]] "toNode", return a new [[PathNode]] with param values inherited from the
     * matching node in fromPath.  Only inherit keys that aren't found in "toKeys" from the node in "fromPath""
     */
    function makeInheritedParamsNode(toNode: PathNode): PathNode {
      // All param values for the node (may include default key/vals, when key was not found in toParams)
      let toParamVals = extend({}, toNode && toNode.paramValues);
      // limited to only those keys found in toParams
      const incomingParamVals = pick(toParamVals, toKeys);
      toParamVals = omit(toParamVals, toKeys);
      const fromParamVals = omit(nodeParamVals(fromPath, toNode.state) || {}, noInherit);
      // extend toParamVals with any fromParamVals, then override any of those those with incomingParamVals
      const ownParamVals: RawParams = extend(toParamVals, fromParamVals, incomingParamVals);
      return new PathNode(toNode.state).applyRawParams(ownParamVals);
    }

    // The param keys specified by the incoming toParams
    return <PathNode[]>toPath.map(makeInheritedParamsNode);
  }

  static nonDynamicParams = (node: PathNode): Param[] =>
    node.state.parameters({ inherit: false }).filter(param => !param.dynamic);

  /**
   * Computes the tree changes (entering, exiting) between a fromPath and toPath.
   */
  static treeChanges(fromPath: PathNode[], toPath: PathNode[], reloadState: StateObject): TreeChanges {
    const max = Math.min(fromPath.length, toPath.length);
    let keep = 0;

    const nodesMatch = (node1: PathNode, node2: PathNode) => node1.equals(node2, PathUtils.nonDynamicParams);

    while (keep < max && fromPath[keep].state !== reloadState && nodesMatch(fromPath[keep], toPath[keep])) {
      keep++;
    }

    /** Given a retained node, return a new node which uses the to node's param values */
    function applyToParams(retainedNode: PathNode, idx: number): PathNode {
      const cloned = retainedNode.clone();
      cloned.paramValues = toPath[idx].paramValues;
      return cloned;
    }

    let from: PathNode[], retained: PathNode[], exiting: PathNode[], entering: PathNode[], to: PathNode[];

    from = fromPath;
    retained = from.slice(0, keep);
    exiting = from.slice(keep);

    // Create a new retained path (with shallow copies of nodes) which have the params of the toPath mapped
    const retainedWithToParams = retained.map(applyToParams);
    entering = toPath.slice(keep);
    to = retainedWithToParams.concat(entering);

    return { from, to, retained, retainedWithToParams, exiting, entering };
  }

  /**
   * Returns a new path which is: the subpath of the first path which matches the second path.
   *
   * The new path starts from root and contains any nodes that match the nodes in the second path.
   * It stops before the first non-matching node.
   *
   * Nodes are compared using their state property and their parameter values.
   * If a `paramsFn` is provided, only the [[Param]] returned by the function will be considered when comparing nodes.
   *
   * @param pathA the first path
   * @param pathB the second path
   * @param paramsFn a function which returns the parameters to consider when comparing
   *
   * @returns an array of PathNodes from the first path which match the nodes in the second path
   */
  static matching(pathA: PathNode[], pathB: PathNode[], paramsFn?: GetParamsFn): PathNode[] {
    let done = false;
    const tuples: PathNode[][] = arrayTuples(pathA, pathB);
    return tuples.reduce((matching, [nodeA, nodeB]) => {
      done = done || !nodeA.equals(nodeB, paramsFn);
      return done ? matching : matching.concat(nodeA);
    }, []);
  }

  /**
   * Returns true if two paths are identical.
   *
   * @param pathA
   * @param pathB
   * @param paramsFn a function which returns the parameters to consider when comparing
   * @returns true if the the states and parameter values for both paths are identical
   */
  static equals(pathA: PathNode[], pathB: PathNode[], paramsFn?: GetParamsFn): boolean {
    return pathA.length === pathB.length && PathUtils.matching(pathA, pathB, paramsFn).length === pathA.length;
  }

  /**
   * Return a subpath of a path, which stops at the first matching node
   *
   * Given an array of nodes, returns a subset of the array starting from the first node,
   * stopping when the first node matches the predicate.
   *
   * @param path a path of [[PathNode]]s
   * @param predicate a [[Predicate]] fn that matches [[PathNode]]s
   * @returns a subpath up to the matching node, or undefined if no match is found
   */
  static subPath(path: PathNode[], predicate: Predicate<PathNode>): PathNode[] {
    const node = find(path, predicate);
    const elementIdx = path.indexOf(node);
    return elementIdx === -1 ? undefined : path.slice(0, elementIdx + 1);
  }

  /** Gets the raw parameter values from a path */
  static paramValues = (path: PathNode[]) => path.reduce((acc, node) => extend(acc, node.paramValues), {});
}
