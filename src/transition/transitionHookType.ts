import {TransitionHookScope, TransitionHookPhase} from "./interface";
import {PathNode} from "../path/node";
import {Transition} from "./transition";
import {isString} from "../common/predicates";
import {GetErrorHandler, GetResultHandler, TransitionHook} from "./transitionHook";
/**
 * This class defines a type of hook, such as `onBefore` or `onEnter`.
 * Plugins can define custom hook types, such as sticky states does for `onInactive`.
 *
 * @interalapi
 * @module transition
 */
export class TransitionHookType {

  public name: string;
  public hookPhase: TransitionHookPhase;
  public hookScope: TransitionHookScope;
  public hookOrder: number;
  public criteriaMatchPath: string;
  public resolvePath: (trans: Transition) => PathNode[];
  public reverseSort: boolean;
  public errorHandler: GetErrorHandler;
  public resultHandler: GetResultHandler;
  public rejectIfSuperseded: boolean;

  constructor(name:               string,
              hookPhase:          TransitionHookPhase,
              hookScope:          TransitionHookScope,
              hookOrder:          number,
              criteriaMatchPath:  string,
              resolvePath:        ((trans: Transition) => PathNode[]) | string,
              reverseSort:        boolean = false,
              resultHandler:      GetResultHandler = TransitionHook.HANDLE_RESULT,
              errorHandler:       GetErrorHandler = TransitionHook.REJECT_ERROR,
              rejectIfSuperseded: boolean = true,
  ) {
    this.name = name;
    this.hookScope = hookScope;
    this.hookPhase = hookPhase;
    this.hookOrder = hookOrder;
    this.criteriaMatchPath = criteriaMatchPath;
    this.resolvePath = isString(resolvePath) ? (trans: Transition) => trans.treeChanges(resolvePath) : resolvePath;
    this.reverseSort = reverseSort;
    this.resultHandler = resultHandler;
    this.errorHandler = errorHandler;
    this.rejectIfSuperseded = rejectIfSuperseded;
  }
}
