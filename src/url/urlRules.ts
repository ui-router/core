/** @packageDocumentation @publicapi @module url */
import { UIRouter } from '../router';
import { Disposable } from '../interface';
import { MatcherUrlRule, UrlRule, UrlRuleHandlerFn, UrlRuleMatchFn, UrlRulesApi } from './interface';
import { TargetState, TargetStateDef } from '../state';
import { UrlMatcher } from './urlMatcher';
import { is, isDefined, isFunction, isString, removeFrom, val } from '../common';
import { UrlRuleFactory } from './urlRule';

/** @hidden */
const prioritySort = (a: UrlRule, b: UrlRule) => (b.priority || 0) - (a.priority || 0);

/** @hidden */
const typeSort = (a: UrlRule, b: UrlRule) => {
  const weights = { STATE: 4, URLMATCHER: 4, REGEXP: 3, RAW: 2, OTHER: 1 };
  return (weights[a.type] || 0) - (weights[b.type] || 0);
};

/** @hidden */
const urlMatcherSort = (a: MatcherUrlRule, b: MatcherUrlRule) =>
  !a.urlMatcher || !b.urlMatcher ? 0 : UrlMatcher.compare(a.urlMatcher, b.urlMatcher);

/** @hidden */
const idSort = (a: UrlRule, b: UrlRule) => {
  // Identically sorted STATE and URLMATCHER best rule will be chosen by `matchPriority` after each rule matches the URL
  const useMatchPriority = { STATE: true, URLMATCHER: true };
  const equal = useMatchPriority[a.type] && useMatchPriority[b.type];
  return equal ? 0 : (a.$id || 0) - (b.$id || 0);
};

/**
 * Default rule priority sorting function.
 *
 * Sorts rules by:
 *
 * - Explicit priority (set rule priority using [[UrlRules.when]])
 * - Rule type (STATE: 4, URLMATCHER: 4, REGEXP: 3, RAW: 2, OTHER: 1)
 * - `UrlMatcher` specificity ([[UrlMatcher.compare]]): works for STATE and URLMATCHER types to pick the most specific rule.
 * - Rule registration order (for rule types other than STATE and URLMATCHER)
 *   - Equally sorted State and UrlMatcher rules will each match the URL.
 *     Then, the *best* match is chosen based on how many parameter values were matched.
 *
 * @publicapi
 */
let defaultRuleSortFn: (a: UrlRule, b: UrlRule) => number;
defaultRuleSortFn = (a, b) => {
  let cmp = prioritySort(a, b);
  if (cmp !== 0) return cmp;

  cmp = typeSort(a, b);
  if (cmp !== 0) return cmp;

  cmp = urlMatcherSort(a as MatcherUrlRule, b as MatcherUrlRule);
  if (cmp !== 0) return cmp;

  return idSort(a, b);
};

/** @hidden */
function getHandlerFn(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef): UrlRuleHandlerFn {
  if (!isFunction(handler) && !isString(handler) && !is(TargetState)(handler) && !TargetState.isDef(handler)) {
    throw new Error("'handler' must be a string, function, TargetState, or have a state: 'newtarget' property");
  }
  return isFunction(handler) ? (handler as UrlRuleHandlerFn) : val(handler);
}

/**
 * API for managing URL rules
 *
 * This API is used to create and manage URL rules.
 * URL rules are a mechanism to respond to specific URL patterns.
 *
 * The most commonly used methods are [[otherwise]] and [[when]].
 *
 * This API is a property of [[UrlService]] as [[UrlService.rules]]
 *
 * @publicapi
 */
export class UrlRules implements Disposable {
  /** used to create [[UrlRule]] objects for common cases */
  public urlRuleFactory: UrlRuleFactory;

  /** @hidden */ private _sortFn = defaultRuleSortFn;
  /** @hidden */ private _otherwiseFn: UrlRule;
  /** @hidden */ private _sorted: boolean;
  /** @hidden */ private _rules: UrlRule[] = [];
  /** @hidden */ private _id = 0;

  /** @hidden */
  constructor(/** @hidden */ private router: UIRouter) {
    this.urlRuleFactory = new UrlRuleFactory(router);
  }

  /** @hidden */
  public dispose(router?: UIRouter) {
    this._rules = [];
    delete this._otherwiseFn;
  }

  /**
   * Defines the initial state, path, or behavior to use when the app starts.
   *
   * This rule defines the initial/starting state for the application.
   *
   * This rule is triggered the first time the URL is checked (when the app initially loads).
   * The rule is triggered only when the url matches either `""` or `"/"`.
   *
   * Note: The rule is intended to be used when the root of the application is directly linked to.
   * When the URL is *not* `""` or `"/"` and doesn't match other rules, the [[otherwise]] rule is triggered.
   * This allows 404-like behavior when an unknown URL is deep-linked.
   *
   * #### Example:
   * Start app at `home` state.
   * ```js
   * .initial({ state: 'home' });
   * ```
   *
   * #### Example:
   * Start app at `/home` (by url)
   * ```js
   * .initial('/home');
   * ```
   *
   * #### Example:
   * When no other url rule matches, go to `home` state
   * ```js
   * .initial((matchValue, url, router) => {
   *   console.log('initial state');
   *   return { state: 'home' };
   * })
   * ```
   *
   * @param handler The initial state or url path, or a function which returns the state or url path (or performs custom logic).
   */
  public initial(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef) {
    const handlerFn: UrlRuleHandlerFn = getHandlerFn(handler);
    const matchFn: UrlRuleMatchFn = (urlParts, router) =>
      router.globals.transitionHistory.size() === 0 && !!/^\/?$/.exec(urlParts.path);

    this.rule(this.urlRuleFactory.create(matchFn, handlerFn));
  }

  /**
   * Defines the state, url, or behavior to use when no other rule matches the URL.
   *
   * This rule is matched when *no other rule* matches.
   * It is generally used to handle unknown URLs (similar to "404" behavior, but on the client side).
   *
   * - If `handler` a string, it is treated as a url redirect
   *
   * #### Example:
   * When no other url rule matches, redirect to `/index`
   * ```js
   * .otherwise('/index');
   * ```
   *
   * - If `handler` is an object with a `state` property, the state is activated.
   *
   * #### Example:
   * When no other url rule matches, redirect to `home` and provide a `dashboard` parameter value.
   * ```js
   * .otherwise({ state: 'home', params: { dashboard: 'default' } });
   * ```
   *
   * - If `handler` is a function, the function receives the current url ([[UrlParts]]) and the [[UIRouter]] object.
   *   The function can perform actions, and/or return a value.
   *
   * #### Example:
   * When no other url rule matches, manually trigger a transition to the `home` state
   * ```js
   * .otherwise((matchValue, urlParts, router) => {
   *   router.stateService.go('home');
   * });
   * ```
   *
   * #### Example:
   * When no other url rule matches, go to `home` state
   * ```js
   * .otherwise((matchValue, urlParts, router) => {
   *   return { state: 'home' };
   * });
   * ```
   *
   * @param handler The url path to redirect to, or a function which returns the url path (or performs custom logic).
   */
  public otherwise(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef) {
    const handlerFn: UrlRuleHandlerFn = getHandlerFn(handler);

    this._otherwiseFn = this.urlRuleFactory.create(val(true), handlerFn);
    this._sorted = false;
  }

  /**
   * Remove a rule previously registered
   *
   * @param rule the matcher rule that was previously registered using [[rule]]
   */
  public removeRule(rule): void {
    removeFrom(this._rules, rule);
  }

  /**
   * Manually adds a URL Rule.
   *
   * Usually, a url rule is added using [[StateDeclaration.url]] or [[when]].
   * This api can be used directly for more control (to register a [[BaseUrlRule]], for example).
   * Rules can be created using [[urlRuleFactory]], or created manually as simple objects.
   *
   * A rule should have a `match` function which returns truthy if the rule matched.
   * It should also have a `handler` function which is invoked if the rule is the best match.
   *
   * @return a function that deregisters the rule
   */
  public rule(rule: UrlRule): Function {
    if (!UrlRuleFactory.isUrlRule(rule)) throw new Error('invalid rule');
    rule.$id = this._id++;
    rule.priority = rule.priority || 0;

    this._rules.push(rule);
    this._sorted = false;

    return () => this.removeRule(rule);
  }

  /**
   * Gets all registered rules
   *
   * @returns an array of all the registered rules
   */
  public rules(): UrlRule[] {
    this.ensureSorted();
    return this._rules.concat(this._otherwiseFn ? [this._otherwiseFn] : []);
  }

  /**
   * Defines URL Rule priorities
   *
   * More than one rule ([[UrlRule]]) might match a given URL.
   * This `compareFn` is used to sort the rules by priority.
   * Higher priority rules should sort earlier.
   *
   * The [[defaultRuleSortFn]] is used by default.
   *
   * You only need to call this function once.
   * The `compareFn` will be used to sort the rules as each is registered.
   *
   * If called without any parameter, it will re-sort the rules.
   *
   * ---
   *
   * Url rules may come from multiple sources: states's urls ([[StateDeclaration.url]]), [[when]], and [[rule]].
   * Each rule has a (user-provided) [[UrlRule.priority]], a [[UrlRule.type]], and a [[UrlRule.$id]]
   * The `$id` is is the order in which the rule was registered.
   *
   * The sort function should use these data, or data found on a specific type
   * of [[UrlRule]] (such as [[StateRule.state]]), to order the rules as desired.
   *
   * #### Example:
   * This compare function prioritizes rules by the order in which the rules were registered.
   * A rule registered earlier has higher priority.
   *
   * ```js
   * function compareFn(a, b) {
   *   return a.$id - b.$id;
   * }
   * ```
   *
   * @param compareFn a function that compares to [[UrlRule]] objects.
   *    The `compareFn` should abide by the `Array.sort` compare function rules.
   *    Given two rules, `a` and `b`, return a negative number if `a` should be higher priority.
   *    Return a positive number if `b` should be higher priority.
   *    Return `0` if the rules are identical.
   *
   *    See the [mozilla reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#Description)
   *    for details.
   */
  sort(compareFn?: (a: UrlRule, b: UrlRule) => number) {
    const sorted = this.stableSort(this._rules, (this._sortFn = compareFn || this._sortFn));

    // precompute _sortGroup values and apply to each rule
    let group = 0;
    for (let i = 0; i < sorted.length; i++) {
      sorted[i]._group = group;
      if (i < sorted.length - 1 && this._sortFn(sorted[i], sorted[i + 1]) !== 0) {
        group++;
      }
    }

    this._rules = sorted;
    this._sorted = true;
  }

  /** @hidden */
  private ensureSorted() {
    this._sorted || this.sort();
  }

  /** @hidden */
  private stableSort(arr, compareFn) {
    const arrOfWrapper = arr.map((elem, idx) => ({ elem, idx }));

    arrOfWrapper.sort((wrapperA, wrapperB) => {
      const cmpDiff = compareFn(wrapperA.elem, wrapperB.elem);
      return cmpDiff === 0 ? wrapperA.idx - wrapperB.idx : cmpDiff;
    });

    return arrOfWrapper.map(wrapper => wrapper.elem);
  }

  /**
   * Registers a `matcher` and `handler` for custom URLs handling.
   *
   * The `matcher` can be:
   *
   * - a [[UrlMatcher]]: See: [[UrlMatcherFactory.compile]]
   * - a `string`: The string is compiled to a [[UrlMatcher]]
   * - a `RegExp`: The regexp is used to match the url.
   *
   * The `handler` can be:
   *
   * - a string: The url is redirected to the value of the string.
   * - a function: The url is redirected to the return value of the function.
   *
   * ---
   *
   * When the `handler` is a `string` and the `matcher` is a `UrlMatcher` (or string), the redirect
   * string is interpolated with parameter values.
   *
   * #### Example:
   * When the URL is `/foo/123` the rule will redirect to `/bar/123`.
   * ```js
   * .when("/foo/:param1", "/bar/:param1")
   * ```
   *
   * ---
   *
   * When the `handler` is a string and the `matcher` is a `RegExp`, the redirect string is
   * interpolated with capture groups from the RegExp.
   *
   * #### Example:
   * When the URL is `/foo/123` the rule will redirect to `/bar/123`.
   * ```js
   * .when(new RegExp("^/foo/(.*)$"), "/bar/$1");
   * ```
   *
   * ---
   *
   * When the handler is a function, it receives the matched value, the current URL, and the `UIRouter` object (See [[UrlRuleHandlerFn]]).
   * The "matched value" differs based on the `matcher`.
   * For [[UrlMatcher]]s, it will be the matched state params.
   * For `RegExp`, it will be the match array from `regexp.exec()`.
   *
   * If the handler returns a string, the URL is redirected to the string.
   *
   * #### Example:
   * When the URL is `/foo/123` the rule will redirect to `/bar/123`.
   * ```js
   * .when(new RegExp("^/foo/(.*)$"), match => "/bar/" + match[1]);
   * ```
   *
   * Note: the `handler` may also invoke arbitrary code, such as `$state.go()`
   *
   * @param matcher A pattern `string` to match, compiled as a [[UrlMatcher]], or a `RegExp`.
   * @param handler The path to redirect to, or a function that returns the path.
   * @param options `{ priority: number }`
   *
   * @return the registered [[UrlRule]]
   */
  public when(
    matcher: RegExp | UrlMatcher | string,
    handler: string | UrlRuleHandlerFn,
    options?: { priority: number }
  ): UrlRule {
    const rule = this.urlRuleFactory.create(matcher, handler);
    if (isDefined(options && options.priority)) rule.priority = options.priority;
    this.rule(rule);
    return rule;
  }
}
