/**
 * # Transition tracing (debug)
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
import {StateObject} from "../state/stateObject";

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

/** @hidden */ const _tid = parse("$id");
/** @hidden */ const _rid = parse("router.$id");
/** @hidden */ const transLbl = (trans) => `Transition #${_tid(trans)}-${_rid(trans)}`;

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
    console.log(`${transLbl(trans)}: Started  -> ${stringify(trans)}`);
  }

  /** @internalapi called by ui-router code */
  traceTransitionIgnored(trans: Transition) {
    if (!this.enabled(Category.TRANSITION)) return;
    console.log(`${transLbl(trans)}: Ignored  <> ${stringify(trans)}`);
  }

  /** @internalapi called by ui-router code */
  traceHookInvocation(step: TransitionHook, trans: Transition, options: any) {
    if (!this.enabled(Category.HOOK)) return;
    let event = parse("traceData.hookType")(options) || "internal",
        context = parse("traceData.context.state.name")(options) || parse("traceData.context")(options) || "unknown",
        name = functionToString((step as any).registeredHook.callback);
    console.log(`${transLbl(trans)}:   Hook -> ${event} context: ${context}, ${maxLength(200, name)}`);
  }

  /** @internalapi called by ui-router code */
  traceHookResult(hookResult: HookResult, trans: Transition, transitionOptions: any) {
    if (!this.enabled(Category.HOOK)) return;
    console.log(`${transLbl(trans)}:   <- Hook returned: ${maxLength(200, stringify(hookResult))}`);
  }

  /** @internalapi called by ui-router code */
  traceResolvePath(path: PathNode[], when: PolicyWhen, trans?: Transition) {
    if (!this.enabled(Category.RESOLVE)) return;
    console.log(`${transLbl(trans)}:         Resolving ${path} (${when})`);
  }

  /** @internalapi called by ui-router code */
  traceResolvableResolved(resolvable: Resolvable, trans?: Transition) {
    if (!this.enabled(Category.RESOLVE)) return;
    console.log(`${transLbl(trans)}:               <- Resolved  ${resolvable} to: ${maxLength(200, stringify(resolvable.data))}`);
  }

  /** @internalapi called by ui-router code */
  traceError(reason: any, trans: Transition) {
    if (!this.enabled(Category.TRANSITION)) return;
    console.log(`${transLbl(trans)}: <- Rejected ${stringify(trans)}, reason: ${reason}`);
  }

  /** @internalapi called by ui-router code */
  traceSuccess(finalState: StateObject, trans: Transition) {
    if (!this.enabled(Category.TRANSITION)) return;
    console.log(`${transLbl(trans)}: <- Success  ${stringify(trans)}, final state: ${finalState.name}`);
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
