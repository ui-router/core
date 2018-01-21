/** @module path */ /** for typedoc */
import { extend, applyPairs, find, allTrueR, pairs, arrayTuples } from '../common/common';
import { propEq } from '../common/hof';
import { StateObject } from '../state/stateObject';
import { RawParams } from '../params/interface';
import { Param } from '../params/param';
import { Resolvable } from '../resolve/resolvable';
import { ViewConfig } from '../view/interface';

/**
 * @internalapi
 *
 * A node in a [[TreeChanges]] path
 *
 * For a [[TreeChanges]] path, this class holds the stateful information for a single node in the path.
 * Each PathNode corresponds to a state being entered, exited, or retained.
 * The stateful information includes parameter values and resolve data.
 */
export class PathNode {
  /** The state being entered, exited, or retained */
  public state: StateObject;
  /** The parameters declared on the state */
  public paramSchema: Param[];
  /** The parameter values that belong to the state */
  public paramValues: { [key: string]: any };
  /** The individual (stateful) resolvable objects that belong to the state */
  public resolvables: Resolvable[];
  /** The state's declared view configuration objects */
  public views: ViewConfig[];

  /** Creates a copy of a PathNode */
  constructor(node: PathNode);
  /** Creates a new (empty) PathNode for a State */
  constructor(state: StateObject);
  constructor(stateOrNode: any) {
    if (stateOrNode instanceof PathNode) {
      const node: PathNode = stateOrNode;
      this.state = node.state;
      this.paramSchema = node.paramSchema.slice();
      this.paramValues = extend({}, node.paramValues);
      this.resolvables = node.resolvables.slice();
      this.views = node.views && node.views.slice();
    } else {
      const state: StateObject = stateOrNode;
      this.state = state;
      this.paramSchema = state.parameters({ inherit: false });
      this.paramValues = {};
      this.resolvables = state.resolvables.map(res => res.clone());
    }
  }

  clone() {
    return new PathNode(this);
  }

  /** Sets [[paramValues]] for the node, from the values of an object hash */
  applyRawParams(params: RawParams): PathNode {
    const getParamVal = (paramDef: Param) => [ paramDef.id, paramDef.value(params[paramDef.id]) ];
    this.paramValues = this.paramSchema.reduce((memo, pDef) => applyPairs(memo, getParamVal(pDef)), {});
    return this;
  }

  /** Gets a specific [[Param]] metadata that belongs to the node */
  parameter(name: string): Param {
    return find(this.paramSchema, propEq('id', name));
  }

  /**
   * @returns true if the state and parameter values for another PathNode are
   * equal to the state and param values for this PathNode
   */
  equals(node: PathNode, paramsFn?: GetParamsFn): boolean {
    const diff = this.diff(node, paramsFn);
    return diff && diff.length === 0;
  }

  /**
   * Finds Params with different parameter values on another PathNode.
   *
   * Given another node (of the same state), finds the parameter values which differ.
   * Returns the [[Param]] (schema objects) whose parameter values differ.
   *
   * Given another node for a different state, returns `false`
   *
   * @param node The node to compare to
   * @param paramsFn A function that returns which parameters should be compared.
   * @returns The [[Param]]s which differ, or null if the two nodes are for different states
   */
  diff(node: PathNode, paramsFn?: GetParamsFn): Param[] | false {
    if (this.state !== node.state) return false;

    const params: Param[] = paramsFn ? paramsFn(this) : this.paramSchema;
    return Param.changed(params, this.paramValues, node.paramValues);
  }
}

/** @hidden */
export type GetParamsFn = (pathNode: PathNode) => Param[];
