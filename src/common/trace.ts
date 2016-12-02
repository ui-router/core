/**
 * UI-Router Transition Tracing
 *
 * Enable transition tracing to print transition information to the console,
 * in order to help debug your application.
 * Tracing logs detailed information about each Transition to your console.
 *
 * To enable tracing, import the [[Trace]] singleton and enable one or more categories.
 *
 * ### ES6
 * ```js
 * import {trace} from "ui-router-ng2"; // or "angular-ui-router"
 * trace.enable(1, 5); // TRANSITION and VIEWCONFIG
 * ```
 *
 * ### CJS
 * ```js
 * let trace = require("angular-ui-router").trace; // or "ui-router-ng2"
 * trace.enable("TRANSITION", "VIEWCONFIG");
 * ```
 *
 * ### Globals
 * ```js
 * let trace = window["angular-ui-router"].trace; // or "ui-router-ng2"
 * trace.enable(); // Trace everything (very verbose)
 * ```
 *
 * ### Angular 1:
 * ```js
 * app.run($trace => $trace.enable());
 * ```
 *
 * @coreapi
 * @module trace
 */ /** for typedoc */
import {parse} from "../common/hof";
import {isNumber} from "../common/predicates";
import {Transition}  from "../transition/transition";
import {ActiveUIView, ViewConfig, ViewContext}  from "../view/interface";
import {stringify, functionToString, maxLength, padString} from "./strings";
import {Resolvable} from "../resolve/resolvable";
import {PathNode} from "../path/node";
import {PolicyWhen} from "../resolve/interface";
import {TransitionHook} from "../transition/transitionHook";
import {HookResult} from "../transition/interface";
import {State} from "../state/stateObject";

/** @hidden */
function uiViewString (viewData: ActiveUIView) {
    if (!viewData) return 'ui-view (defunct)';
    return `[ui-view#${viewData.id} tag ` +
        `in template from '${viewData.creationContext && viewData.creationContext.name || '(root)'}' state]: ` +
        `fqn: '${viewData.fqn}', ` +
        `name: '${viewData.name}@${viewData.creationContext}')`;
}

/** @hidden */
const viewConfigString = (viewConfig: ViewConfig) =>
    `[ViewConfig#${viewConfig.$id} from '${viewConfig.viewDecl.$context.name || '(root)'}' state]: target ui-view: '${viewConfig.viewDecl.$uiViewName}@${viewConfig.viewDecl.$uiViewContextAnchor}'`;

/** @hidden */
function normalizedCat(input: Category|string): string {
  return isNumber(input) ? Category[input] : Category[Category[input]];
}


/**
 * Trace categories Enum
 *
 * Enable or disable a category using [[Trace.enable]] or [[Trace.disable]]
 *
 * `trace.enable(Category.TRANSITION)`
 *
 * These can also be provided using a matching string, or position ordinal
 *
 * `trace.enable("TRANSITION")`
 *
 * `trace.enable(1)`
 */
export enum Category {
  RESOLVE, TRANSITION, HOOK, UIVIEW, VIEWCONFIG
}

/**
 * Prints UI-Router Transition trace information to the console.
 */
export class Trace {
  /** @hidden */
  approximateDigests: number;

  /** @hidden */
  constructor() {
    this.approximateDigests = 0;
  }

  /** @hidden */
  private _enabled: { [key: string]: boolean } = {};

   /** @hidden */
  private _set(enabled: boolean, categories: Category[]) {
    if (!categories.length) {
      categories = <any> Object.keys(Category)
          .map(k => parseInt(k, 10))
          .filter(k => !isNaN(k))
          .map(key => Category[key]);
    }
    categories.map(normalizedCat).forEach(category => this._enabled[category] = enabled);
  }

  /**
   * Enables a trace [[Category]]
   *
   * ```js
   * trace.enable("TRANSITION");
   * ```
   *
   * @param categories categories to enable. If `categories` is omitted, all categories are enabled.
   *        Also takes strings (category name) or ordinal (category position)
   */
  enable(...categories: Category[]) { this._set(true, categories) }
  /**
   * Disables a trace [[Category]]
   *
   * ```js
   * trace.disable("VIEWCONFIG");
   * ```
   *
   * @param categories categories to disable. If `categories` is omitted, all categories are disabled.
   *        Also takes strings (category name) or ordinal (category position)
   */
  disable(...categories: Category[]) { this._set(false, categories) }

  /**
   * Retrieves the enabled stateus of a [[Category]]
   *
   * ```js
   * trace.enabled("VIEWCONFIG"); // true or false
   * ```
   *
   * @returns boolean true if the category is enabled
   */
  enabled(category: Category): boolean {
    return !!this._enabled[normalizedCat(category)];
  }

  /** @internalapi called by ui-router code */
  traceTransitionStart(trans: Transition) {
    if (!this.enabled(Category.TRANSITION)) return;
    let tid = trans.$id,
        digest = this.approximateDigests,
        transitionStr = stringify(trans);
    console.log(`Transition #${tid} r${trans.router.$id}: Started  -> ${transitionStr}`);
  }

  /** @internalapi called by ui-router code */
  traceTransitionIgnored(trans: Transition) {
    if (!this.enabled(Category.TRANSITION)) return;
    let tid = trans && trans.$id,
        digest = this.approximateDigests,
        transitionStr = stringify(trans);
    console.log(`Transition #${tid} r${trans.router.$id}: Ignored  <> ${transitionStr}`);
  }

  /** @internalapi called by ui-router code */
  traceHookInvocation(step: TransitionHook, trans: Transition, options: any) {
    if (!this.enabled(Category.HOOK)) return;
    let tid = parse("transition.$id")(options),
        digest = this.approximateDigests,
        event = parse("traceData.hookType")(options) || "internal",
        context = parse("traceData.context.state.name")(options) || parse("traceData.context")(options) || "unknown",
        name = functionToString((step as any).registeredHook.callback);
    console.log(`Transition #${tid} r${trans.router.$id}:   Hook -> ${event} context: ${context}, ${maxLength(200, name)}`);
  }

  /** @internalapi called by ui-router code */
  traceHookResult(hookResult: HookResult, trans: Transition, transitionOptions: any) {
    if (!this.enabled(Category.HOOK)) return;
    let tid = parse("transition.$id")(transitionOptions),
        digest = this.approximateDigests,
        hookResultStr = stringify(hookResult);
    console.log(`Transition #${tid} r${trans.router.$id}:   <- Hook returned: ${maxLength(200, hookResultStr)}`);
  }

  /** @internalapi called by ui-router code */
  traceResolvePath(path: PathNode[], when: PolicyWhen, trans?: Transition) {
    if (!this.enabled(Category.RESOLVE)) return;
    let tid = trans && trans.$id,
        digest = this.approximateDigests,
        pathStr = path && path.toString();
    console.log(`Transition #${tid} r${trans.router.$id}:         Resolving ${pathStr} (${when})`);
  }

  /** @internalapi called by ui-router code */
  traceResolvableResolved(resolvable: Resolvable, trans?: Transition) {
    if (!this.enabled(Category.RESOLVE)) return;
    let tid = trans && trans.$id,
        digest = this.approximateDigests,
        resolvableStr = resolvable && resolvable.toString(),
        result = stringify(resolvable.data);
    console.log(`Transition #${tid} r${trans.router.$id}:               <- Resolved  ${resolvableStr} to: ${maxLength(200, result)}`);
  }

  /** @internalapi called by ui-router code */
  traceError(reason: any, trans: Transition) {
    if (!this.enabled(Category.TRANSITION)) return;
    let tid = trans && trans.$id,
        digest = this.approximateDigests,
        transitionStr = stringify(trans);
    console.log(`Transition #${tid} r${trans.router.$id}: <- Rejected ${transitionStr}, reason: ${reason}`);
  }

  /** @internalapi called by ui-router code */
  traceSuccess(finalState: State, trans: Transition) {
    if (!this.enabled(Category.TRANSITION)) return;
    let tid = trans && trans.$id,
        digest = this.approximateDigests,
        state = finalState.name,
        transitionStr = stringify(trans);
    console.log(`Transition #${tid} r${trans.router.$id}: <- Success  ${transitionStr}, final state: ${state}`);
  }

  /** @internalapi called by ui-router code */
  traceUIViewEvent(event: string, viewData: ActiveUIView, extra = "") {
    if (!this.enabled(Category.UIVIEW)) return;
    console.log(`ui-view: ${padString(30, event)} ${uiViewString(viewData)}${extra}`);
  }

  /** @internalapi called by ui-router code */
  traceUIViewConfigUpdated(viewData: ActiveUIView, context: ViewContext) {
    if (!this.enabled(Category.UIVIEW)) return;
    this.traceUIViewEvent("Updating", viewData, ` with ViewConfig from context='${context}'`);
  }

  /** @internalapi called by ui-router code */
  traceUIViewFill(viewData: ActiveUIView, html: string) {
    if (!this.enabled(Category.UIVIEW)) return;
    this.traceUIViewEvent("Fill", viewData, ` with: ${maxLength(200, html)}`);
  }

  /** @internalapi called by ui-router code */
  traceViewServiceEvent(event: string, viewConfig: ViewConfig) {
    if (!this.enabled(Category.VIEWCONFIG)) return;
    console.log(`VIEWCONFIG: ${event} ${viewConfigString(viewConfig)}`);
  }

  /** @internalapi called by ui-router code */
  traceViewServiceUIViewEvent(event: string, viewData: ActiveUIView) {
    if (!this.enabled(Category.VIEWCONFIG)) return;
    console.log(`VIEWCONFIG: ${event} ${uiViewString(viewData)}`);
  }
}

/**
 * The [[Trace]] singleton
 *
 * #### Example:
 * ```js
 * import {trace} from "angular-ui-router";
 * trace.enable(1, 5);
 * ```
 */
let trace = new Trace();
export {trace};
