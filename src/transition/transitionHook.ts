/**
 * @coreapi
 * @module transition
 */
/** for typedoc */
import { TransitionHookOptions, HookResult } from './interface';
import { defaults, noop, silentRejection } from '../common/common';
import { fnToString, maxLength } from '../common/strings';
import { isPromise } from '../common/predicates';
import { is, parse } from '../common/hof';
import { trace } from '../common/trace';
import { services } from '../common/coreservices';
import { Rejection } from './rejectFactory';
import { TargetState } from '../state/targetState';
import { Transition } from './transition';
import { TransitionEventType } from './transitionEventType';
import { RegisteredHook } from './hookRegistry';
import { StateDeclaration } from '../state/interface'; // has or is using

let defaultOptions: TransitionHookOptions = {
  current: noop,
  transition: null,
  traceData: {},
  bind: null
};

export type GetResultHandler = (hook: TransitionHook) => ResultHandler;
export type GetErrorHandler  = (hook: TransitionHook) => ErrorHandler;

export type ResultHandler = (result: HookResult)      => Promise<HookResult>;
export type ErrorHandler  = (error: any)              => Promise<any>;

/** @hidden */
export class TransitionHook {
  type: TransitionEventType;
  constructor(private transition: Transition,
              private stateContext: StateDeclaration,
              private registeredHook: RegisteredHook,
              private options: TransitionHookOptions) {
    this.options = defaults(options, defaultOptions);
    this.type = registeredHook.eventType;
  }

  /**
   * These GetResultHandler(s) are used by [[invokeHook]] below
   * Each HookType chooses a GetResultHandler (See: [[TransitionService._defineCoreEvents]])
   */
  static HANDLE_RESULT: GetResultHandler = (hook: TransitionHook) => (result: HookResult) =>
      hook.handleHookResult(result);

  /**
   * If the result is a promise rejection, log it.
   * Otherwise, ignore the result.
   */
  static LOG_REJECTED_RESULT: GetResultHandler = (hook: TransitionHook) => (result: HookResult) => {
    isPromise(result) && result.catch(err =>
        hook.logError(Rejection.normalize(err)));
    return undefined;
  };

  /**
   * These GetErrorHandler(s) are used by [[invokeHook]] below
   * Each HookType chooses a GetErrorHandler (See: [[TransitionService._defineCoreEvents]])
   */
  static LOG_ERROR: GetErrorHandler = (hook: TransitionHook) => (error: any) =>
      hook.logError(error);

  static REJECT_ERROR: GetErrorHandler = (hook: TransitionHook) => (error: any) =>
      silentRejection(error);

  static THROW_ERROR: GetErrorHandler = (hook: TransitionHook) => (error: any) => {
    throw error;
  };

  private isSuperseded = () =>
      !this.type.synchronous && this.options.current() !== this.options.transition;

  logError(err): any {
    this.transition.router.stateService.defaultErrorHandler()(err);
  }

  invokeHook(): Promise<HookResult> {
    let hook = this.registeredHook;
    if (hook._deregistered) return;

    let options = this.options;
    trace.traceHookInvocation(this, this.transition, options);

    // A new transition started before this hook (from a previous transition) could be run.
    if (this.isSuperseded()) {
      return Rejection.superseded(options.current()).toPromise();
    }

    const invokeCallback = () =>
        hook.callback.call(this.options.bind, this.transition, this.stateContext);

    const normalizeErr = err =>
        Rejection.normalize(err).toPromise();

    const handleError = err =>
        hook.eventType.getErrorHandler(this)(err);

    const handleResult = result =>
        hook.eventType.getResultHandler(this)(result);

    if (this.type.synchronous) {
      try {
        return handleResult(invokeCallback());
      } catch (err) {
        return handleError(Rejection.normalize(err));
      }
    }

    return services.$q.when()
        .then(invokeCallback)
        .catch(normalizeErr)
        .then(handleResult, handleError);
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
    if (this.isSuperseded()) {
      // Abort this transition
      return Rejection.superseded(this.options.current()).toPromise();
    }

    // Hook returned a promise
    if (isPromise(result)) {
      // Wait for the promise, then reprocess with the resulting value
      return result.then(val => this.handleHookResult(val));
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
      // Halt the current Transition and redirect (a new Transition) to the TargetState.
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
   * Chains together an array of TransitionHooks.
   *
   * Given a list of [[TransitionHook]] objects, chains them together.
   * Each hook is invoked after the previous one completes.
   *
   * #### Example:
   * ```js
   * var hooks: TransitionHook[] = getHooks();
   * let promise: Promise<any> = TransitionHook.chain(hooks);
   *
   * promise.then(handleSuccess, handleError);
   * ```
   *
   * @param hooks the list of hooks to chain together
   * @param waitFor if provided, the chain is `.then()`'ed off this promise
   * @returns a `Promise` for sequentially invoking the hooks (in order)
   */
  static chain(hooks: TransitionHook[], waitFor?: Promise<any>): Promise<any> {
    // Chain the next hook off the previous
    const createHookChainR = (prev: Promise<any>, nextHook: TransitionHook) =>
        prev.then(() => nextHook.invokeHook());
    return hooks.reduce(createHookChainR, waitFor || services.$q.when());
  }


  /**
   * Run all TransitionHooks, ignoring their return value.
   */
  static runAllHooks(hooks: TransitionHook[]): void {
    hooks.forEach(hook => hook.invokeHook());
  }

}