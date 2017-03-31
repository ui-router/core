/** @module transition */ /** */
import { TransitionHookPhase, PathType } from "./interface";
import { GetErrorHandler, GetResultHandler, TransitionHook } from "./transitionHook";
/**
 * This class defines a type of hook, such as `onBefore` or `onEnter`.
 * Plugins can define custom hook types, such as sticky states does for `onInactive`.
 *
 * @interalapi
 */
export class TransitionEventType {

  constructor(public name:               string,
              public hookPhase:          TransitionHookPhase,
              public hookOrder:          number,
              public criteriaMatchPath:  PathType,
              public reverseSort:        boolean = false,
              public getResultHandler:   GetResultHandler = TransitionHook.HANDLE_RESULT,
              public getErrorHandler:    GetErrorHandler = TransitionHook.REJECT_ERROR,
              public synchronous:        boolean = false,
  ) { }
}
