/**
 * @coreapi
 * @module transition
 */ /** for typedoc */
import {TransitionHookOptions, HookResult} from "./interface";
import {defaults, noop, identity} from "../common/common";
import {fnToString, maxLength} from "../common/strings";
import {isPromise} from "../common/predicates";
import {val, is, parse} from "../common/hof";
import {trace} from "../common/trace";
import {services} from "../common/coreservices";

import {Rejection} from "./rejectFactory";
import {TargetState} from "../state/targetState";
import {Transition} from "./transition";
import {State} from "../state/stateObject";
import {TransitionEventType} from "./transitionEventType";
import {StateService} from "../state/stateService"; // has or is using
import {RegisteredHook} from "./hookRegistry"; // has or is using

let defaultOptions: TransitionHookOptions = {
  current: noop,
  transition: null,
  traceData: {},
  bind: null
};

export type GetResultHandler = (hook: TransitionHook) => ResultHandler;
export type GetErrorHandler  = (hook: TransitionHook) => ErrorHandler;

export type ResultHandler = (result: HookResult) => Promise<HookResult>;
export type ErrorHandler  = (error)              => Promise<any>;

/** @hidden */
export class TransitionHook {
  constructor(private transition: Transition,
              private stateContext: State,
              private registeredHook: RegisteredHook,
              private options: TransitionHookOptions) {
    this.options = defaults(options, defaultOptions);
  }

  stateService = () => this.transition.router.stateService;

  static HANDLE_RESULT: GetResultHandler = (hook: TransitionHook) =>
      (result: HookResult) =>
          hook.handleHookResult(result);

  static IGNORE_RESULT: GetResultHandler = (hook: TransitionHook) =>
      (result: HookResult) => undefined;

  static LOG_ERROR: GetErrorHandler = (hook: TransitionHook) =>
      (error) =>
          (hook.stateService().defaultErrorHandler()(error), undefined);

  static REJECT_ERROR: GetErrorHandler = (hook: TransitionHook) =>
      (error) =>
          Rejection.errored(error).toPromise();

  static THROW_ERROR: GetErrorHandler = (hook: TransitionHook) =>
      undefined;

  private rejectIfSuperseded = () =>
      this.registeredHook.eventType.rejectIfSuperseded && this.options.current() !== this.options.transition;

  invokeHook(): Promise<HookResult> {
    let hook = this.registeredHook;
    if (hook._deregistered) return;

    let options = this.options;
    trace.traceHookInvocation(this, this.transition, options);

    if (this.rejectIfSuperseded()) {
      return Rejection.superseded(options.current()).toPromise();
    }

    let cb = hook.callback;
    let bind = this.options.bind;
    let trans = this.transition;
    let state = this.stateContext;

    let errorHandler  = hook.eventType.getErrorHandler(this);
    let resultHandler = hook.eventType.getResultHandler(this);
    resultHandler = resultHandler || identity;

    if (!errorHandler) {
      return resultHandler(cb.call(bind, trans, state));
    }

    try {
      return resultHandler(cb.call(bind, trans, state));
    } catch (error) {
      return errorHandler(error);
    }
  }
  
  /**
   * This method handles the return value of a Transition Hook.
   *
   * A hook can return false (cancel), a TargetState (redirect),
   * or a promise (which may later resolve to false or a redirect)
   *
   * This also handles "transition superseded" -- when a new transition
   * was started while the hook was still running
   */
  handleHookResult(result: HookResult): Promise<HookResult> {
    // This transition is no longer current.
    // Another transition started while this hook was still running.
    if (this.rejectIfSuperseded()) {
      // Abort this transition
      return Rejection.superseded(this.options.current()).toPromise();
    }

    // Hook returned a promise
    if (isPromise(result)) {
      // Wait for the promise, then reprocess the resolved value
      return result.then(this.handleHookResult.bind(this));
    }

    trace.traceHookResult(result, this.transition, this.options);

    // Hook returned false
    if (result === false) {
      // Abort this Transition
      return Rejection.aborted("Hook aborted transition").toPromise();
    }

    const isTargetState = is(TargetState);
    // hook returned a TargetState
    if (isTargetState(result)) {
      // Halt the current Transition and start a redirected Transition (to the TargetState).
      return Rejection.redirected(result).toPromise();
    }
  }

  toString() {
    let { options, registeredHook } = this;
    let event = parse("traceData.hookType")(options) || "internal",
        context = parse("traceData.context.state.name")(options) || parse("traceData.context")(options) || "unknown",
        name = fnToString(registeredHook.callback);
    return `${event} context: ${context}, ${maxLength(200, name)}`;
  }

  /**
   * Run all TransitionHooks, ignoring their return value.
   */
  static runAllHooks(hooks: TransitionHook[]): void {
    hooks.forEach(hook => hook.invokeHook());
  }

  /**
   * Given an array of TransitionHooks, runs each one synchronously and sequentially.
   * Should any hook return a Rejection synchronously, the remaining hooks will not run.
   *
   * Returns a promise chain composed of any promises returned from each hook.invokeStep() call
   */
  static runOnBeforeHooks(hooks: TransitionHook[]): Promise<any> {
    let results: Promise<HookResult>[] = [];

    for (let hook of hooks) {
      let hookResult = hook.invokeHook();

      if (Rejection.isTransitionRejectionPromise(hookResult)) {
        // Break on first thrown error or false/TargetState
        return hookResult;
      }

      results.push(hookResult);
    }

    return results
        .filter(isPromise)
        .reduce((chain: Promise<any>, promise: Promise<any>) => chain.then(val(promise)), services.$q.when());
  }
}