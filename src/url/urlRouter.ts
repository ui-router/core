/**
 * @internalapi
 * @module url
 */
/** for typedoc */
import { createProxyFunctions, extend, removeFrom } from '../common/common';
import { isDefined, isFunction, isString } from '../common/predicates';
import { UrlMatcher } from './urlMatcher';
import { RawParams } from '../params/interface';
import { Disposable } from '../interface';
import { UIRouter } from '../router';
import { is, pattern, val } from '../common/hof';
import { UrlRuleFactory } from './urlRule';
import { TargetState } from '../state/targetState';
import {
  MatcherUrlRule,
  MatchResult,
  UrlParts,
  UrlRule,
  UrlRuleHandlerFn,
  UrlRuleMatchFn,
  UrlRulesApi,
  UrlSyncApi,
} from './interface';
import { TargetStateDef } from '../state/interface';
import { stripLastPathElement } from '../common';

/** @hidden */
function appendBasePath(url: string, isHtml5: boolean, absolute: boolean, baseHref: string): string {
  if (baseHref === '/') return url;
  if (isHtml5) return stripLastPathElement(baseHref) + url;
  if (absolute) return baseHref.slice(1) + url;
  return url;
}

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
 * - Explicit priority (set rule priority using [[UrlRulesApi.when]])
 * - Rule type (STATE: 4, URLMATCHER: 4, REGEXP: 3, RAW: 2, OTHER: 1)
 * - `UrlMatcher` specificity ([[UrlMatcher.compare]]): works for STATE and URLMATCHER types to pick the most specific rule.
 * - Rule registration order (for rule types other than STATE and URLMATCHER)
 *   - Equally sorted State and UrlMatcher rules will each match the URL.
 *     Then, the *best* match is chosen based on how many parameter values were matched.
 *
 * @coreapi
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

/**
 * Updates URL and responds to URL changes
 *
 * ### Deprecation warning:
 * This class is now considered to be an internal API
 * Use the [[UrlService]] instead.
 * For configuring URL rules, use the [[UrlRulesApi]] which can be found as [[UrlService.rules]].
 *
 * This class updates the URL when the state changes.
 * It also responds to changes in the URL.
 */
export class UrlRouter implements UrlRulesApi, UrlSyncApi, Disposable {
  /** used to create [[UrlRule]] objects for common cases */
  public urlRuleFactory: UrlRuleFactory;

  /** @hidden */ private _router: UIRouter;
  /** @hidden */ private location: string;
  /** @hidden */ private _sortFn = defaultRuleSortFn;
  /** @hidden */ private _stopFn: Function;
  /** @hidden */ _rules: UrlRule[] = [];
  /** @hidden */ private _otherwiseFn: UrlRule;
  /** @hidden */ interceptDeferred = false;
  /** @hidden */ private _id = 0;
  /** @hidden */ private _sorted = false;

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

  /** @inheritdoc */
  sort(compareFn?: (a: UrlRule, b: UrlRule) => number) {
    this._rules = this.stableSort(this._rules, (this._sortFn = compareFn || this._sortFn));
    this._sorted = true;
  }

  private ensureSorted() {
    this._sorted || this.sort();
  }

  private stableSort(arr, compareFn) {
    const arrOfWrapper = arr.map((elem, idx) => ({ elem, idx }));

    arrOfWrapper.sort((wrapperA, wrapperB) => {
      const cmpDiff = compareFn(wrapperA.elem, wrapperB.elem);
      return cmpDiff === 0 ? wrapperA.idx - wrapperB.idx : cmpDiff;
    });

    return arrOfWrapper.map(wrapper => wrapper.elem);
  }

  /**
   * Given a URL, check all rules and return the best [[MatchResult]]
   * @param url
   * @returns {MatchResult}
   */
  match(url: UrlParts): MatchResult {
    this.ensureSorted();

    url = extend({ path: '', search: {}, hash: '' }, url);
    const rules = this.rules();
    if (this._otherwiseFn) rules.push(this._otherwiseFn);

    // Checks a single rule. Returns { rule: rule, match: match, weight: weight } if it matched, or undefined

    const checkRule = (rule: UrlRule): MatchResult => {
      const match = rule.match(url, this._router);
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

      const current = checkRule(rules[i]);
      // Pick the best MatchResult
      best = !best || (current && current.weight > best.weight) ? current : best;
    }

    return best;
  }

  /** @inheritdoc */
  sync(evt?) {
    if (evt && evt.defaultPrevented) return;

    const router = this._router,
      $url = router.urlService,
      $state = router.stateService;

    const url: UrlParts = {
      path: $url.path(),
      search: $url.search(),
      hash: $url.hash(),
    };

    const best = this.match(url);

    const applyResult = pattern([
      [isString, (newurl: string) => $url.url(newurl, true)],
      [TargetState.isDef, (def: TargetStateDef) => $state.go(def.state, def.params, def.options)],
      [is(TargetState), (target: TargetState) => $state.go(target.state(), target.params(), target.options())],
    ]);

    applyResult(best && best.rule.handler(best.match, url, router));
  }

  /** @inheritdoc */
  listen(enabled?: boolean): Function {
    if (enabled === false) {
      this._stopFn && this._stopFn();
      delete this._stopFn;
    } else {
      return (this._stopFn = this._stopFn || this._router.urlService.onChange(evt => this.sync(evt)));
    }
  }

  /**
   * Internal API.
   * @internalapi
   */
  update(read?: boolean) {
    const $url = this._router.locationService;
    if (read) {
      this.location = $url.url();
      return;
    }
    if ($url.url() === this.location) return;

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
  push(urlMatcher: UrlMatcher, params?: RawParams, options?: { replace?: string | boolean }) {
    const replace = options && !!options.replace;
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
    let url = urlMatcher.format(params);
    if (url == null) return null;

    options = options || { absolute: false };

    const cfg = this._router.urlService.config;
    const isHtml5 = cfg.html5Mode();
    if (!isHtml5 && url !== null) {
      url = '#' + cfg.hashPrefix() + url;
    }
    url = appendBasePath(url, isHtml5, options.absolute, cfg.baseHref());

    if (!options.absolute || !url) {
      return url;
    }

    const slash = !isHtml5 && url ? '/' : '';
    const cfgPort = cfg.port();
    const port = <any>(cfgPort === 80 || cfgPort === 443 ? '' : ':' + cfgPort);

    return [cfg.protocol(), '://', cfg.host(), port, slash, url].join('');
  }

  /**
   * Manually adds a URL Rule.
   *
   * Usually, a url rule is added using [[StateDeclaration.url]] or [[when]].
   * This api can be used directly for more control (to register a [[BaseUrlRule]], for example).
   * Rules can be created using [[UrlRouter.urlRuleFactory]], or create manually as simple objects.
   *
   * A rule should have a `match` function which returns truthy if the rule matched.
   * It should also have a `handler` function which is invoked if the rule is the best match.
   *
   * @return a function that deregisters the rule
   */
  rule(rule: UrlRule): Function {
    if (!UrlRuleFactory.isUrlRule(rule)) throw new Error('invalid rule');
    rule.$id = this._id++;
    rule.priority = rule.priority || 0;

    this._rules.push(rule);
    this._sorted = false;

    return () => this.removeRule(rule);
  }

  /** @inheritdoc */
  removeRule(rule): void {
    removeFrom(this._rules, rule);
  }

  /** @inheritdoc */
  rules(): UrlRule[] {
    this.ensureSorted();
    return this._rules.slice();
  }

  /** @inheritdoc */
  otherwise(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef) {
    const handlerFn: UrlRuleHandlerFn = getHandlerFn(handler);

    this._otherwiseFn = this.urlRuleFactory.create(val(true), handlerFn);
    this._sorted = false;
  }

  /** @inheritdoc */
  initial(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef) {
    const handlerFn: UrlRuleHandlerFn = getHandlerFn(handler);

    const matchFn: UrlRuleMatchFn = (urlParts, router) =>
      router.globals.transitionHistory.size() === 0 && !!/^\/?$/.exec(urlParts.path);

    this.rule(this.urlRuleFactory.create(matchFn, handlerFn));
  }

  /** @inheritdoc */
  when(
    matcher: RegExp | UrlMatcher | string,
    handler: string | UrlRuleHandlerFn,
    options?: { priority: number },
  ): UrlRule {
    const rule = this.urlRuleFactory.create(matcher, handler);
    if (isDefined(options && options.priority)) rule.priority = options.priority;
    this.rule(rule);
    return rule;
  }

  /** @inheritdoc */
  deferIntercept(defer?: boolean) {
    if (defer === undefined) defer = true;
    this.interceptDeferred = defer;
  }
}

function getHandlerFn(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef): UrlRuleHandlerFn {
  if (!isFunction(handler) && !isString(handler) && !is(TargetState)(handler) && !TargetState.isDef(handler)) {
    throw new Error("'handler' must be a string, function, TargetState, or have a state: 'newtarget' property");
  }
  return isFunction(handler) ? (handler as UrlRuleHandlerFn) : val(handler);
}
