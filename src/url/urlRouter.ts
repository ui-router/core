/**
 * @coreapi
 * @module url
 */ /** for typedoc */
import { removeFrom, createProxyFunctions, inArray, composeSort, sortBy } from "../common/common";
import { isFunction, isString, isDefined } from "../common/predicates";
import { UrlMatcher } from "./urlMatcher";
import { RawParams } from "../params/interface";
import { Disposable } from "../interface";
import { UIRouter } from "../router";
import { val, is, pattern, prop, pipe } from "../common/hof";
import { UrlRuleFactory } from "./urlRule";
import { TargetState } from "../state/targetState";
import { UrlRule, UrlRuleHandlerFn, UrlParts } from "./interface";
import { TargetStateDef } from "../state/interface";

/** @hidden */
function appendBasePath(url: string, isHtml5: boolean, absolute: boolean, baseHref: string): string {
  if (baseHref === '/') return url;
  if (isHtml5) return baseHref.slice(0, -1) + url;
  if (absolute) return baseHref.slice(1) + url;
  return url;
}

/** @hidden */
const getMatcher = prop("urlMatcher");

/**
 * Updates URL and responds to URL changes
 *
 * This class updates the URL when the state changes.
 * It also responds to changes in the URL.
 */
export class UrlRouter implements Disposable {
  /** used to create [[UrlRule]] objects for common cases */
  public urlRuleFactory: UrlRuleFactory;

  /** @hidden */ private _router: UIRouter;
  /** @hidden */ private location: string;
  /** @hidden */ private _sortFn = UrlRouter.defaultRuleSortFn;
  /** @hidden */ private _stopFn: Function;
  /** @hidden */ _rules: UrlRule[] = [];
  /** @hidden */ private _otherwiseFn: UrlRule;
  /** @hidden */ interceptDeferred = false;
  /** @hidden */ private _id = 0;

  /** @hidden */
  constructor(router: UIRouter) {
    this._router = router;
    this.urlRuleFactory = new UrlRuleFactory(router);
    createProxyFunctions(val(UrlRouter.prototype), this, val(this));
  }

  /** @internalapi */
  dispose() {
    this.listen(false);
    this._rules = [];
    delete this._otherwiseFn;
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
  sort(compareFn?: (a: UrlRule, b: UrlRule) => number) {
    this._rules.sort(this._sortFn = compareFn || this._sortFn);
  }

  /**
   * Checks the current URL for a matching rule
   *
   * Triggers an update; the same update that happens when the address bar url changes, aka `$locationChangeSuccess`.
   * This method is useful when you need to use `preventDefault()` on the `$locationChangeSuccess` event,
   * perform some custom logic (route protection, auth, config, redirection, etc) and then finally proceed
   * with the transition by calling `$urlRouter.sync()`.
   *
   * #### Example:
   * ```js
   * angular.module('app', ['ui.router'])
   *   .run(function($rootScope, $urlRouter) {
   *     $rootScope.$on('$locationChangeSuccess', function(evt) {
   *       // Halt state change from even starting
   *       evt.preventDefault();
   *       // Perform custom logic
   *       var meetsRequirement = ...
   *       // Continue with the update and state transition if logic allows
   *       if (meetsRequirement) $urlRouter.sync();
   *     });
   * });
   * ```
   */
  sync(evt?) {
    if (evt && evt.defaultPrevented) return;

    let router = this._router,
        $url = router.urlService,
        $state = router.stateService;

    let rules = this.rules();
    if (this._otherwiseFn) rules.push(this._otherwiseFn);

    let url: UrlParts = {
      path: $url.path(), search: $url.search(), hash: $url.hash()
    };

    // Checks a single rule. Returns { rule: rule, match: match, weight: weight } if it matched, or undefined
    interface MatchResult { match: any, rule: UrlRule, weight: number }
    let checkRule = (rule: UrlRule): MatchResult => {
      let match = rule.match(url, router);
      return match && { match, rule, weight: rule.matchPriority(match) };
    };

    // The rules are pre-sorted.
    // - Find the first matching rule.
    // - Find any other matching rule that sorted *exactly the same*, according to `.sort()`.
    // - Choose the rule with the highest match weight.
    let best: MatchResult;
    for (let i = 0; i < rules.length; i++) {
      // Stop when there is a 'best' rule and the next rule sorts differently than it.
      if (best && this._sortFn(rules[i], best.rule) !== 0) break;

      let current = checkRule(rules[i]);
      // Pick the best MatchResult
      best = (!best || current && current.weight > best.weight) ? current : best;
    }

    let applyResult = pattern([
      [isString, (newurl: string) => $url.url(newurl)],
      [TargetState.isDef, (def: TargetStateDef) => $state.go(def.state, def.params, def.options)],
      [is(TargetState), (target: TargetState) => $state.go(target.state(), target.params(), target.options())],
    ]);

    applyResult(best && best.rule.handler(best.match, url, router));
  }

  /**
   * Starts or stops listening for URL changes
   *
   * Call this sometime after calling [[deferIntercept]] to start monitoring the url.
   * This causes [[UrlRouter]] to start listening for changes to the URL, if it wasn't already listening.
   *
   * If called with `false`, will stop listening.  Call listen() again to start listening
   */
  listen(enabled?: boolean): Function {
    if (enabled === false) {
      this._stopFn && this._stopFn();
      delete this._stopFn;
    } else {
      return this._stopFn = this._stopFn || this._router.urlService.onChange(evt => this.sync(evt));
    }
  }

  /**
   * Internal API.
   * @internalapi
   */
  update(read?: boolean) {
    let $url = this._router.locationService;
    if (read) {
      this.location = $url.path();
      return;
    }
    if ($url.path() === this.location) return;

    $url.url(this.location, true);
  }

  /**
   * Internal API.
   *
   * Pushes a new location to the browser history.
   *
   * @internalapi
   * @param urlMatcher
   * @param params
   * @param options
   */
  push(urlMatcher: UrlMatcher, params?: RawParams, options?: { replace?: (string|boolean) }) {
    let replace = options && !!options.replace;
    this._router.urlService.url(urlMatcher.format(params || {}), replace);
  }

  /**
   * Builds and returns a URL with interpolated parameters
   *
   * #### Example:
   * ```js
   * matcher = $umf.compile("/about/:person");
   * params = { person: "bob" };
   * $bob = $urlRouter.href(matcher, params);
   * // $bob == "/about/bob";
   * ```
   *
   * @param urlMatcher The [[UrlMatcher]] object which is used as the template of the URL to generate.
   * @param params An object of parameter values to fill the matcher's required parameters.
   * @param options Options object. The options are:
   *
   * - **`absolute`** - {boolean=false},  If true will generate an absolute url, e.g. "http://www.example.com/fullurl".
   *
   * @returns Returns the fully compiled URL, or `null` if `params` fail validation against `urlMatcher`
   */
  href(urlMatcher: UrlMatcher, params?: any, options?: { absolute: boolean }): string {
    if (!urlMatcher.validates(params)) return null;

    let url = urlMatcher.format(params);
    options = options || { absolute: false };

    let cfg = this._router.urlService.config;
    let isHtml5 = cfg.html5Mode();
    if (!isHtml5 && url !== null) {
      url = "#" + cfg.hashPrefix() + url;
    }
    url = appendBasePath(url, isHtml5, options.absolute, cfg.baseHref());

    if (!options.absolute || !url) {
      return url;
    }

    let slash = (!isHtml5 && url ? '/' : ''), port = cfg.port();
    port = <any> (port === 80 || port === 443 ? '' : ':' + port);

    return [cfg.protocol(), '://', cfg.host(), port, slash, url].join('');
  }


  /**
   * Manually adds a URL Rule.
   *
   * Usually, a url rule is added using [[StateDeclaration.url]] or [[when]].
   * This api can be used directly for more control (to register [[RawUrlRule]], for example).
   * Rules can be created using [[UrlRouter.ruleFactory]], or create manually as simple objects.
   *
   * @return a function that deregisters the rule
   */
  rule(rule: UrlRule): Function {
    if (!UrlRuleFactory.isUrlRule(rule)) throw new Error("invalid rule");
    rule.$id = this._id++;
    rule.priority = rule.priority || 0;
    this._rules.push(rule);
    this.sort();
    return () => this.removeRule(rule);
  }

  /**
   * Remove a rule previously registered
   *
   * @param rule the matcher rule that was previously registered using [[rule]]
   */
  removeRule(rule): void {
    removeFrom(this._rules, rule);
    this.sort();
  }

  /**
   * Gets all registered rules
   *
   * @returns an array of all the registered rules
   */
  rules = (): UrlRule[] => this._rules.slice();

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
  otherwise(handler: string|UrlRuleHandlerFn|TargetState|TargetStateDef) {
    if (!isFunction(handler) && !isString(handler) && !is(TargetState)(handler) && !TargetState.isDef(handler)) {
      throw new Error("'redirectTo' must be a string, function, TargetState, or have a state: 'newtarget' property");
    }

    let handlerFn: UrlRuleHandlerFn = isFunction(handler) ? handler as UrlRuleHandlerFn : val(handler);
    this._otherwiseFn = this.urlRuleFactory.create(val(true), handlerFn);
    this.sort();
  };

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
  when(matcher: (RegExp|UrlMatcher|string), handler: string|UrlRuleHandlerFn, options?: { priority: number }): UrlRule {
    let rule = this.urlRuleFactory.create(matcher, handler);
    if (isDefined(options && options.priority)) rule.priority = options.priority;
    this.rule(rule);
    return rule;
  };

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
   * var app = angular.module('app', ['ui.router']);
   *
   * app.config(function ($urlRouterProvider) {
   *   // Prevent $urlRouter from automatically intercepting URL changes;
   *   $urlRouterProvider.deferIntercept();
   * })
   *
   * app.run(function (MyService, $urlRouter, $http) {
   *   $http.get("/stuff").then(function(resp) {
   *     MyService.doStuff(resp.data);
   *     $urlRouter.listen();
   *     $urlRouter.sync();
   *   });
   * });
   * ```
   *
   * @param defer Indicates whether to defer location change interception.
   *        Passing no parameter is equivalent to `true`.
   */
  deferIntercept(defer?: boolean) {
    if (defer === undefined) defer = true;
    this.interceptDeferred = defer;
  };

  /**
   * Default rule priority sorting function.
   *
   * Sorts rules by:
   *
   * - Explicit priority (set rule priority using [[UrlRouter.when]])
   * - Rule type (STATE: 4, URLMATCHER: 4, REGEXP: 3, RAW: 2, OTHER: 1)
   * - `UrlMatcher` specificity ([[UrlMatcher.compare]]): works for STATE and URLMATCHER types to pick the most specific rule.
   * - Registration order (for rule types other than STATE and URLMATCHER)
   */
  static defaultRuleSortFn =  composeSort(
    sortBy(pipe(prop("priority"), x => -x)),
    sortBy(pipe(prop("type"), type => ({ "STATE": 4, "URLMATCHER": 4, "REGEXP": 3, "RAW": 2, "OTHER": 1 })[type])),
    (a,b) => (getMatcher(a) && getMatcher(b)) ? UrlMatcher.compare(getMatcher(a), getMatcher(b)) : 0,
    sortBy(prop("$id"), inArray([ "REGEXP", "RAW", "OTHER" ])),
  );
}
