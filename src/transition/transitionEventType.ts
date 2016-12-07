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
export class TransitionEventType {

  constructor(public name:               string,
              public hookPhase:          TransitionHookPhase,
              public hookScope:          TransitionHookScope,
              public hookOrder:          number,
              public criteriaMatchPath:  string,
              public reverseSort:        boolean = false,
              public getResultHandler:   GetResultHandler = TransitionHook.HANDLE_RESULT,
              public getErrorHandler:    GetErrorHandler = TransitionHook.REJECT_ERROR,
              public rejectIfSuperseded: boolean = true,
  ) { }
}
