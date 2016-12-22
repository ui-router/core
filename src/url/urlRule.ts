import { UrlMatcher } from "./urlMatcher";
import { isString, isDefined } from "../common/predicates";
import { UIRouter } from "../router";
import { Obj, extend, identity } from "../common/common";
import { RawParams } from "../params/interface";
import { is, pattern } from "../common/hof";
import { State } from "../state/stateObject";
import { UIRouterGlobals } from "../globals";
import { StateService } from "../state/stateService";

/**
 * Creates a [[UrlRule]]
 *
 * Creates a [[UrlRule]] from a:
 *
 * - `string`
 * - [[UrlMatcher]]
 * - `RegExp`
 * - [[State]]
 */
export class UrlRuleFactory {
  constructor(public router: UIRouter) { }

  compile(pattern: string): UrlMatcher {
    return this.router.urlMatcherFactory.compile(pattern);
  }

  create(what: string|State|UrlMatcher|RegExp, handler?): UrlRule {
    const makeRule = pattern([
      [isString,       () => this.fromString(what as string, handler)],
      [is(UrlMatcher), () => this.fromMatcher(what as UrlMatcher, handler)],
      [is(RegExp),     () => this.fromRegExp(what as RegExp, handler)],
      [is(State),      () => this.fromState(what as State)],
    ]);
    let rule = makeRule(what);
    if (!rule) throw new Error("invalid 'what' in when()");
    return rule;
  }

  fromString = (pattern: string, handler: string|UrlMatcher|UrlRuleHandlerFn) =>
      extend(this.fromMatcher(this.compile(pattern), handler), { type: UrlRuleType.STRING });

  fromMatcher = (urlMatcher: UrlMatcher, handler: string|UrlMatcher|UrlRuleHandlerFn) =>
      new UrlMatcherRule(urlMatcher, (isString(handler) ? this.compile(handler) : handler));

  fromRegExp = (pattern: RegExp, handler: string|UrlRuleHandlerFn) =>
      new RegExpRule(pattern, handler);

  fromState = (state: State) =>
      new StateUrlRule(state, this.router);

  fromMatchFn = (match: UrlRuleMatchFn) =>
      new RawUrlRule(match);
}

/** @return truthy or falsey */
export interface UrlRuleMatchFn {
  (path: string, search: Obj, hash: string): any;
}

/** Handler invoked when a rule is matched */
export interface UrlRuleHandlerFn {
  (matchObject: any, path?: string, search?: Obj, hash?: string): (string|boolean|void);
}

export enum UrlRuleType { STATE, URLMATCHER, STRING, REGEXP, RAW, OTHER }
export interface UrlRule {
  /** The type of the rule */
  type: UrlRuleType;

  /**
   * This function should match the url and return match details
   */
  match: UrlRuleMatchFn;

  /**
   * This function is called after the rule matched the url.
   * This function handles the rule match event.
   */
  handler: UrlRuleHandlerFn;

  priority: number;
}

export const isUrlRule = obj =>
    obj && ['type', 'match', 'handler', 'priority'].every(key => isDefined(obj[key]));

/**
 * A UrlRule which matches based on a regular expression
 *
 * The `handler` may be either a [[UrlRuleHandlerFn]] or a string.
 *
 * ## Handler as a function
 *
 * If `handler` is a function, the function is invoked with:
 *
 * - regexp match array (from `regexp`)
 * - path: current path
 * - search: current search
 * - hash: current hash
 *
 * #### Example:
 * ```js
 * var rule = RegExpRule(/^\/foo\/(bar|baz)$/, match => "/home/" + match[1])
 * var match = rule.match('/foo/bar'); // results in [ '/foo/bar', 'bar' ]
 * var result = rule.handler(match); // '/home/bar'
 * ```
 *
 * ## Handler as string
 *
 * If `handler` is a string, the url is *replaced by the string* when the Rule is invoked.
 * The string is first interpolated using `string.replace()` style pattern.
 *
 * #### Example:
 * ```js
 * var rule = RegExpRule(/^\/foo\/(bar|baz)$/, "/home/$1")
 * var match = rule.match('/foo/bar'); // results in [ '/foo/bar', 'bar' ]
 * var result = rule.handler(match); // '/home/bar'
 * ```
 */
export class RegExpRule implements UrlRule {
  type = UrlRuleType.REGEXP;
  handler: UrlRuleHandlerFn;
  priority = 0;

  constructor(public regexp: RegExp, handler: string|UrlRuleHandlerFn) {
    if (regexp.global || regexp.sticky) {
      throw new Error("Rule RegExp must not be global or sticky");
    }
    this.handler = isString(handler) ? this.redirectUrlTo(handler) : handler;
  }

  /**
   * If handler is a string, the url will be replaced by the string.
   * If the string has any String.replace() style variables in it (like `$2`),
   * they will be replaced by the captures from [[match]]
   */
  redirectUrlTo = (newurl: string) =>
      (match: RegExpExecArray) =>
          // Interpolates matched values into $1 $2, etc using a String.replace()-style pattern
          newurl.replace(/\$(\$|\d{1,2})/, (m, what) =>
              match[what === '$' ? 0 : Number(what)]);

  match(path: string): RegExpExecArray {
    return this.regexp.exec(path);
  }
}

/**
 * A UrlRule which matches based on a UrlMatcher
 *
 * The `handler` may be either a [[UrlRuleHandlerFn]] or a different [[UrlMatcher]]
 *
 * ## Handler as a function
 *
 * If `handler` is a function, the function is invoked with:
 *
 * - matched parameter values (from `urlMatcher`)
 * - path: current path
 * - search: current search
 * - hash: current hash
 *
 * #### Example:
 * ```js
 * var urlMatcher = $umf.compile("/foo/:fooId/:barId");
 * var rule = UrlMatcherRule(urlMatcher, match => "/home/" + match.fooId + "/" + match.barId);
 * var match = rule.match('/foo/123/456'); // results in { fooId: '123', barId: '456' }
 * var result = rule.handler(match); // '/home/123/456'
 * ```
 *
 * ## Handler as UrlMatcher
 *
 * If `handler` is a UrlMatcher, the handler matcher is used to create the new url.
 * The `handler` UrlMatcher is formatted, using the param values matched from the first matcher.
 * The url is replaced with the result.
 *
 * #### Example:
 * ```js
 * var urlMatcher = $umf.compile("/foo/:fooId/:barId");
 * var handler = $umf.compile("/home/:fooId/:barId");
 * var rule = UrlMatcherRule(urlMatcher, handler);
 * var match = rule.match('/foo/123/456'); // results in { fooId: '123', barId: '456' }
 * var result = rule.handler(match); // '/home/123/456'
 * ```
 */
export class UrlMatcherRule implements UrlRule {
  type = UrlRuleType.URLMATCHER;
  handler: UrlRuleHandlerFn;
  priority = 0;

  constructor(public urlMatcher: UrlMatcher, handler: UrlMatcher|UrlRuleHandlerFn) {
    this.handler = is(UrlMatcher)(handler) ? this.redirectUrlTo(handler) : handler;
  }

  redirectUrlTo = (newurl: UrlMatcher) =>
      (match: RawParams) =>
          newurl.format(match);

  match = (path: string, search: any, hash: string) =>
      this.urlMatcher.exec(path, search, hash);
}

/**
 * A UrlRule which matches a state by its url
 *
 * #### Example:
 * ```js
 * var rule = new StateUrlRule($state.get('foo'), router);
 * var match = rule.match('/foo/123/456'); // results in { fooId: '123', barId: '456' }
 * var result = rule.handler(match); // '/home/123/456'
 * ```
 */
export class StateUrlRule implements UrlRule {
  type = UrlRuleType.STATE;
  priority = 0;
  $state: StateService;
  globals: UIRouterGlobals;

  constructor(public state: State, router: UIRouter) {
    this.globals = router.globals;
    this.$state = router.stateService;
  }

  match = (path: string, search: any, hash: string) =>
      this.state.url.exec(path, search, hash);

  /**
   * Checks if the router should start a new transition.
   *
   * A new transition is not required if the current state's
   * URL and the new URL are identical
   */
  shouldTransition(match: RawParams) {
    return this.$state.href(this.state, match) !== this.$state.href(this.globals.current, this.globals.params);
  }

  handler = (match: RawParams) => {
    if (this.shouldTransition(match)) {
      this.$state.transitionTo(this.state, match, { inherit: true, source: "url" });
    }
    return true;
  };
}

/**
 * A "raw" rule which calls `match`
 *
 * The value from the `match` function is passed through as the `handler` result.
 */
export class RawUrlRule implements UrlRule {
  type = UrlRuleType.RAW;
  priority = 0;

  constructor(public match: UrlRuleMatchFn) { }

  handler = identity
}
