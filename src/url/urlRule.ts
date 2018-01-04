/**
 * @coreapi
 * @module url
 */ /** */
import { UrlMatcher } from "./urlMatcher";
import { isString, isDefined, isFunction, isState } from "../common/predicates";
import { UIRouter } from "../router";
import { identity, extend } from "../common/common";
import { is, pattern } from "../common/hof";
import { StateObject } from "../state/stateObject";
import { RawParams } from "../params/interface";
import {
    UrlRule, UrlRuleMatchFn, UrlRuleHandlerFn, UrlRuleType, UrlParts, MatcherUrlRule, StateRule, RegExpRule
} from "./interface";

/**
 * Creates a [[UrlRule]]
 *
 * Creates a [[UrlRule]] from a:
 *
 * - `string`
 * - [[UrlMatcher]]
 * - `RegExp`
 * - [[StateObject]]
 * @internalapi
 */
export class UrlRuleFactory {
  constructor(public router: UIRouter) { }

  compile(str: string) {
    return this.router.urlMatcherFactory.compile(str);
  }

  static isUrlRule = obj =>
      obj && ['type', 'match', 'handler'].every(key => isDefined(obj[key]));

  create(what: string|UrlMatcher|StateObject|RegExp|UrlRuleMatchFn, handler?: string|UrlRuleHandlerFn): UrlRule {
    const makeRule = pattern([
      [isString,       (_what: string)         => makeRule(this.compile(_what))],
      [is(UrlMatcher), (_what: UrlMatcher)     => this.fromUrlMatcher(_what, handler)],
      [isState,        (_what: StateObject)    => this.fromState(_what, this.router)],
      [is(RegExp),     (_what: RegExp)         => this.fromRegExp(_what, handler)],
      [isFunction,     (_what: UrlRuleMatchFn) => new BaseUrlRule(_what, handler as UrlRuleHandlerFn)],
    ]);

    let rule = makeRule(what);
    if (!rule) throw new Error("invalid 'what' in when()");
    return rule;
  }

  /**
   * A UrlRule which matches based on a UrlMatcher
   *
   * The `handler` may be either a `string`, a [[UrlRuleHandlerFn]] or another [[UrlMatcher]]
   *
   * ## Handler as a function
   *
   * If `handler` is a function, the function is invoked with:
   *
   * - matched parameter values ([[RawParams]] from [[UrlMatcher.exec]])
   * - url: the current Url ([[UrlParts]])
   * - router: the router object ([[UIRouter]])
   *
   * #### Example:
   * ```js
   * var urlMatcher = $umf.compile("/foo/:fooId/:barId");
   * var rule = factory.fromUrlMatcher(urlMatcher, match => "/home/" + match.fooId + "/" + match.barId);
   * var match = rule.match('/foo/123/456'); // results in { fooId: '123', barId: '456' }
   * var result = rule.handler(match); // '/home/123/456'
   * ```
   *
   * ## Handler as UrlMatcher
   *
   * If `handler` is a UrlMatcher, the handler matcher is used to create the new url.
   * The `handler` UrlMatcher is formatted using the matched param from the first matcher.
   * The url is replaced with the result.
   *
   * #### Example:
   * ```js
   * var urlMatcher = $umf.compile("/foo/:fooId/:barId");
   * var handler = $umf.compile("/home/:fooId/:barId");
   * var rule = factory.fromUrlMatcher(urlMatcher, handler);
   * var match = rule.match('/foo/123/456'); // results in { fooId: '123', barId: '456' }
   * var result = rule.handler(match); // '/home/123/456'
   * ```
   */
  fromUrlMatcher(urlMatcher: UrlMatcher, handler: string|UrlMatcher|UrlRuleHandlerFn): MatcherUrlRule {
    let _handler: UrlRuleHandlerFn = handler as any;
    if (isString(handler)) handler = this.router.urlMatcherFactory.compile(handler);
    if (is(UrlMatcher)(handler)) _handler = (match: RawParams) => (handler as UrlMatcher).format(match);

    function match(url: UrlParts) {
      let match = urlMatcher.exec(url.path, url.search, url.hash);
      return urlMatcher.validates(match) && match;
    }

    // Prioritize URLs, lowest to highest:
    // - Some optional URL parameters, but none matched
    // - No optional parameters in URL
    // - Some optional parameters, some matched
    // - Some optional parameters, all matched
    function matchPriority(params: RawParams): number {
      let optional = urlMatcher.parameters().filter(param => param.isOptional);
      if (!optional.length) return 0.000001;
      let matched = optional.filter(param => params[param.id]);
      return matched.length / optional.length;
    }

    let details = { urlMatcher, matchPriority, type: "URLMATCHER" };
    return extend(new BaseUrlRule(match, _handler), details) as MatcherUrlRule;
  }


  /**
   * A UrlRule which matches a state by its url
   *
   * #### Example:
   * ```js
   * var rule = factory.fromState($state.get('foo'), router);
   * var match = rule.match('/foo/123/456'); // results in { fooId: '123', barId: '456' }
   * var result = rule.handler(match);
   * // Starts a transition to 'foo' with params: { fooId: '123', barId: '456' }
   * ```
   */
  fromState(state: StateObject, router: UIRouter): StateRule {
    /**
     * Handles match by transitioning to matched state
     *
     * First checks if the router should start a new transition.
     * A new transition is not required if the current state's URL
     * and the new URL are already identical
     */
    const handler = (match: RawParams) => {
      let $state = router.stateService;
      let globals = router.globals;
      if ($state.href(state, match) !== $state.href(globals.current, globals.params)) {
        $state.transitionTo(state, match, { inherit: true, source: "url" });
      }
    };

    let details = { state, type: "STATE" };
    return extend(this.fromUrlMatcher(state.url, handler), details) as StateRule;
  }

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
   * - url: the current Url ([[UrlParts]])
   * - router: the router object ([[UIRouter]])
   *
   * #### Example:
   * ```js
   * var rule = factory.fromRegExp(/^\/foo\/(bar|baz)$/, match => "/home/" + match[1])
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
   * var rule = factory.fromRegExp(/^\/foo\/(bar|baz)$/, "/home/$1")
   * var match = rule.match('/foo/bar'); // results in [ '/foo/bar', 'bar' ]
   * var result = rule.handler(match); // '/home/bar'
   * ```
   */
  fromRegExp(regexp: RegExp, handler: string|UrlRuleHandlerFn): RegExpRule {
    if (regexp.global || regexp.sticky) throw new Error("Rule RegExp must not be global or sticky");

    /**
     * If handler is a string, the url will be replaced by the string.
     * If the string has any String.replace() style variables in it (like `$2`),
     * they will be replaced by the captures from [[match]]
     */
    const redirectUrlTo = (match: RegExpExecArray) =>
        // Interpolates matched values into $1 $2, etc using a String.replace()-style pattern
        (handler as string).replace(/\$(\$|\d{1,2})/, (m, what) =>
            match[what === '$' ? 0 : Number(what)]);

    const _handler = isString(handler) ? redirectUrlTo : handler;

    const match = (url: UrlParts): RegExpExecArray =>
        regexp.exec(url.path);

    let details = { regexp, type: "REGEXP" };
    return extend(new BaseUrlRule(match, _handler), details) as RegExpRule
  }
}

/**
 * A base rule which calls `match`
 *
 * The value from the `match` function is passed through to the `handler`.
 * @internalapi
 */
export class BaseUrlRule implements UrlRule {
  $id: number;
  priority: number;
  type: UrlRuleType = "RAW";
  handler: UrlRuleHandlerFn;
  matchPriority = (match) => 0 - this.$id;

  constructor(public match: UrlRuleMatchFn, handler?: UrlRuleHandlerFn) {
    this.handler = handler || identity;
  }
}
