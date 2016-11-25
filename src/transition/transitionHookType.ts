import {TransitionHookScope, TransitionHookPhase} from "./interface";
import {PathNode} from "../path/node";
import {Transition} from "./transition";
import {isString} from "../common/predicates";
/**
 * This class defines a type of hook, such as `onBefore` or `onEnter`.
 * Plugins can define custom hook types, such as sticky states does for `onInactive`.
 *
 * @interalapi
 * @module transition
 */
export class TransitionHookType {

  public name: string;
  public hookScope: TransitionHookScope;
  public hookPhase: TransitionHookPhase;
  public hookOrder: number;
  public criteriaMatchPath: string;
  public resolvePath: (trans: Transition) => PathNode[];
  public reverseSort: boolean;

  constructor(name:               string,
              hookScope:          TransitionHookScope,
              hookPhase:          TransitionHookPhase,
              hookOrder:          number,
              criteriaMatchPath:  string,
              resolvePath:        ((trans: Transition) => PathNode[]) | string,
              reverseSort:       boolean = false
  ) {
    this.name = name;
    this.hookScope = hookScope;
    this.hookPhase = hookPhase;
    this.hookOrder = hookOrder;
    this.criteriaMatchPath = criteriaMatchPath;
    this.resolvePath = isString(resolvePath) ? (trans: Transition) => trans.treeChanges(resolvePath) : resolvePath;
    this.reverseSort = reverseSort;
  }
}
