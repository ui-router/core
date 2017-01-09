/**
 * Contains code related to managing the URL
 *
 * The primary API is found in [[UrlService]], [[UrlService.config]], and [[UrlService.rules]].
 *
 * @preferred
 * @coreapi
 * @module url
 */ /** */
import { LocationConfig } from "../common/coreservices";
import { ParamType } from "../params/paramType";
import { Param } from "../params/param";
import { UIRouter } from "../router";
import { TargetState } from "../state/targetState";
import { TargetStateDef } from "../state/interface";
import { UrlMatcher } from "./urlMatcher";
import { State } from "../state/stateObject";
import { ParamTypeDefinition } from "../params/interface";

/** @internalapi */
export interface ParamFactory {
  /** Creates a new [[Param]] from a CONFIG block */
  fromConfig(id: string, type: ParamType, config: any): Param;
  /** Creates a new [[Param]] from a url PATH */
  fromPath(id: string, type: ParamType, config: any): Param;
  /** Creates a new [[Param]] from a url SEARCH */
  fromSearch(id: string, type: ParamType, config: any): Param;
}

/**
 * An API to customize the URL behavior and retrieve URL configuration
 *
 *
 * This API can customize the behavior of the URL.
 * This includes optional trailing slashes ([[strictMode]]), case sensitivity ([[caseInsensitive]]),
 * and custom parameter encoding (custom [[type]]).
 *
 * It also has information about the location (url) configuration such as [[port]] and [[baseHref]].
 * This information can be used to build absolute URLs, such as
 * `https://example.com:443/basepath/state/substate?param1=a#hashvalue`;
 *
 * This API is found on [[UrlService.config]].
 */
export interface UrlConfigApi extends LocationConfig, UrlMatcherConfig {}

export interface UrlMatcherConfig {
  /**
   * Defines whether URL matching should be case sensitive (the default behavior), or not.
   *
   * @param value `false` to match URL in a case sensitive manner; otherwise `true`;
   * @returns the current value of caseInsensitive
   *
   * #### Example:
   * ```js
   * // Allow case insensitive url matches
   * urlService.config.caseInsensitive(true);
   * ```
   */
  caseInsensitive(value?: boolean): boolean;

  /**
   * Defines whether URLs should match trailing slashes, or not (the default behavior).
   *
   * @param value `false` to match trailing slashes in URLs, otherwise `true`.
   * @returns the current value of strictMode
   *
   * #### Example:
   * ```js
   * // Allow optional trailing slashes
   * urlService.config.strictMode(false);
   * ```
   */
  strictMode(value?: boolean): boolean;

  /**
   * Sets the default behavior when generating or matching URLs with default parameter values.
   *
   * @param value A string that defines the default parameter URL squashing behavior.
   *    - `nosquash`: When generating an href with a default parameter value, do not squash the parameter value from the URL
   *    - `slash`: When generating an href with a default parameter value, squash (remove) the parameter value, and, if the
   *      parameter is surrounded by slashes, squash (remove) one slash from the URL
   *    - any other string, e.g. "~": When generating an href with a default parameter value, squash (remove)
   *      the parameter value from the URL and replace it with this string.
   * @returns the current value of defaultSquashPolicy
   *
   * #### Example:
   * ```js
   * // Remove default parameter values from the url
   * urlService.config.defaultSquashPolicy(true);
   * ```
   */
  defaultSquashPolicy(value?: (boolean|string)): (boolean|string);

  /**
   * Creates and registers a custom [[ParamTypeDefinition]] object
   *
   * A custom parameter type can be used to generate URLs with typed parameters or custom encoding/decoding.
   *
   * @param name  The type name.
   * @param type The type definition. See [[ParamTypeDefinition]] for examples and information.
   *
   * @returns if only the `name` parameter was specified: the currently registered [[ParamType]] object, or undefined
   *
   * #### Note: Register custom types *before using them* in a state definition.
   *
   * #### Example:
   * ```js
   * // Encode object parameter as JSON string
   * urlService.config.type('myjson', {
   *   encode: (obj) => JSON.stringify(obj),
   *   decode: (str) => JSON.parse(str),
   *   is: (val) => typeof(val) === 'object',
   *   pattern: /[^/]+/,
   *   equals: (a, b) => _.isEqual(a, b),
   * });
   * ```
   */
  type(name: string, type?: ParamTypeDefinition): ParamType;
}

/** @internalapi */
export interface UrlSyncApi {
  /**
   * Checks the URL for a matching [[UrlRule]]
   *
   * Checks the current URL for a matching url rule, then invokes that rule's handler.
   * This method is called internally any time the URL has changed.
   *
   * This effectively activates the state which matches the current URL.
   *
   * #### Example:
   * ```js
   * urlService.deferIntercept();
   *
   * $http.get('/states.json').then(function(resp) {
   *   resp.data.forEach(state => $stateRegistry.register(state));
   *   urlService.listen();
   *   // Find the matching URL and invoke the handler.
   *   urlService.sync();
   * });
   * ```
   */
  sync(evt?): void;

  /**
   * Starts or stops listening for URL changes
   *
   * Call this sometime after calling [[deferIntercept]] to start monitoring the url.
   * This causes [[UrlRouter]] to start listening for changes to the URL, if it wasn't already listening.
   *
   * If called with `false`, will stop listening.  Call listen() again to start listening
   *
   * #### Example:
   * ```js
   * urlService.deferIntercept();
   *
   * $http.get('/states.json').then(function(resp) {
   *   resp.data.forEach(state => $stateRegistry.register(state));
   *   // Start responding to URL changes
   *   urlService.listen();
   *   urlService.sync();
   * });
   * ```
   */
  listen(enabled?: boolean): Function

  /**
   * Disables monitoring of the URL.
   *
   * Call this method before UI-Router has bootstrapped.
   * It will stop UI-Router from performing the initial url sync.
   *
   * This can be useful to perform some asynchronous initialization before the router starts.
   * Once the initialization is complete, call [[listen]] to tell UI-Router to start watching and synchronizing the URL.
   *
   * #### Example:
   * ```js
   * // Prevent $urlRouter from automatically intercepting URL changes when it starts;
   * urlService.deferIntercept();
   *
   * $http.get('/states.json').then(function(resp) {
   *   resp.data.forEach(state => $stateRegistry.register(state));
   *   urlService.listen();
   *   urlService.sync();
   * });
   * ```
   *
   * @param defer Indicates whether to defer location change interception.
   *        Passing no parameter is equivalent to `true`.
   */
  deferIntercept(defer?: boolean)
}

/**
 * API for managing URL rules
 *
 * This API can be used to create and manage URL rules.
 * URL rules are a mechanism to respond to specific URL patterns.
 *
 * The most commonly used methods are [[otherwise]] and [[when]].
 */
export interface UrlRulesApi {
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
   * of [[UrlRule]] (such as [[StateUrlRule.state]]), to order the rules as desired.
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
  sort(compareFn?: (a: UrlRule, b: UrlRule) => number);

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
   * @param matcher A pattern `string` to match, compiled as a [[UrlMatcher]], or a `RegExp`.
   * @param handler The path to redirect to, or a function that returns the path.
   * @param options `{ priority: number }`
   *
   * @return the registered [[UrlRule]]
   *
   * Note: the `handler` may also invoke arbitrary code, such as `$state.go()`
   */
  when(matcher: (RegExp|UrlMatcher|string), handler: string|UrlRuleHandlerFn, options?: { priority: number }): UrlRule;

  /**
   * Defines the path or behavior to use when no url can be matched.
   *
   * - If a string, it is treated as a url redirect
   *
   * #### Example:
   * When no other url rule matches, redirect to `/index`
   * ```js
   * .otherwise('/index');
   * ```
   *
   * - If a function, the function receives the current url ([[UrlParts]]) and the [[UIRouter]] object.
   *   If the function returns a string, the url is redirected to the return value.
   *
   * #### Example:
   * When no other url rule matches, redirect to `/index`
   * ```js
   * .otherwise(() => '/index');
   * ```
   *
   * #### Example:
   * When no other url rule matches, go to `home` state
   * ```js
   * .otherwise((url, router) => {
   *   router.stateService.go('home');
   *   return;
   * }
   * ```
   *
   * @param handler The url path to redirect to, or a function which returns the url path (or performs custom logic).
   */
  otherwise(handler: string|UrlRuleHandlerFn|TargetState|TargetStateDef): void;

  /**
   * Gets all registered rules
   *
   * @returns an array of all the registered rules
   */
  rules(): UrlRule[];

  /**
   * Manually adds a URL Rule.
   *
   * Usually, a url rule is added using [[StateDeclaration.url]] or [[when]].
   * This api can be used directly for more control (to register [[RawUrlRule]], for example).
   * Rules can be created using [[UrlRouter.urlRuleFactory]], or create manually as simple objects.
   *
   * @return a function that deregisters the rule
   */
  rule(rule: UrlRule): Function;

  /**
   * Remove a rule previously registered
   *
   * @param rule the matcher rule that was previously registered using [[rule]]
   */
  removeRule(rule: UrlRule): void;
}

/**
 * An object containing the three parts of a URL
 */
export interface UrlParts {
  path: string;
  search?: { [key: string]: any };
  hash?: string;
}

/**
 * A UrlRule match result
 *
 * The result of UrlRouter.match()
 */
export interface MatchResult {
  /** The matched value from a [[UrlRule]] */
  match: any;
  /** The rule that matched */
  rule: UrlRule;
  /** The match result weight */
  weight: number;
}
/**
 * A function that matches the URL for a [[UrlRule]]
 *
 * Implementations should match against the provided [[UrlParts]] and return the matched value (truthy) if the rule matches.
 * If this rule is selected, the matched value is passed to the [[UrlRuleHandlerFn]].
 *
 * @return the matched value, either truthy or falsey
 */
export interface UrlRuleMatchFn {
  (url?: UrlParts, router?: UIRouter): any;
}

/**
 * Handler invoked when a rule is matched
 *
 * The matched value from the rule's [[UrlRuleMatchFn]] is passed as the first argument
 * The handler should return a string (to redirect), a [[TargetState]]/[[TargetStateDef]], or void
 *
 * If the handler returns a string, the url is replaced with the string.
 * If the handler returns a [[TargetState]], the target state is activated.
 */
export interface UrlRuleHandlerFn {
  (matchValue?: any, url?: UrlParts, router?: UIRouter): (string|TargetState|TargetStateDef|void);
}

/** @internalapi */
export type UrlRuleType = "STATE" | "URLMATCHER" | "REGEXP" | "RAW" | "OTHER";

/**
 * The interface for a URL Rule
 *
 * If you are creating a rule for use with [[UrlRulesApi.rule]], it should implement this interface.
 */
export interface UrlRule {
  /**
   * The rule's ID.
   *
   * IDs are auto-assigned when the rule is registered, in increasing order.
   */
  $id: number;

  /**
   * The rule's priority (defaults to 0).
   *
   * This can be used to explicitly modify the rule's priority.
   * Higher numbers are higher priority.
   */
  priority: number;

  /**
   * The priority of a given match.
   *
   * Sometimes more than one UrlRule might have matched.
   * This method is used to choose the best match.
   *
   * If multiple rules matched, each rule's `matchPriority` is called with the value from [[match]].
   * The rule with the highest `matchPriority` has its [[handler]] called.
   */
  matchPriority(match: any): number;

  /** The type of the rule */
  type: UrlRuleType;

  /**
   * This function should match the url and return the match details
   *
   * See [[UrlRuleMatchFn]] for details
   */
  match: UrlRuleMatchFn;

  /**
   * This function is called if the rule matched, and was selected as the "best match".
   * This function handles the rule match event.
   *
   * See [[UrlRuleHandlerFn]] for details
   */
  handler: UrlRuleHandlerFn;
}

/** @internalapi */
export interface MatcherUrlRule extends UrlRule {
  type: "URLMATCHER"|"STATE";
  urlMatcher: UrlMatcher;
}

/** @internalapi */
export interface StateRule extends MatcherUrlRule {
  type: "STATE";
  state: State;
}

/** @internalapi */
export interface RegExpRule extends UrlRule {
  type: "REGEXP";
  regexp: RegExp;
}
