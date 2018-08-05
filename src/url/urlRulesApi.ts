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

function getHandlerFn(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef): UrlRuleHandlerFn {
  if (!isFunction(handler) && !isString(handler) && !is(TargetState)(handler) && !TargetState.isDef(handler)) {
    throw new Error("'handler' must be a string, function, TargetState, or have a state: 'newtarget' property");
  }
  return isFunction(handler) ? (handler as UrlRuleHandlerFn) : val(handler);
}

export class UrlRules implements UrlRulesApi, Disposable {
  /** used to create [[UrlRule]] objects for common cases */
  public urlRuleFactory: UrlRuleFactory;

  /** @hidden */ private _sortFn = defaultRuleSortFn;
  /** @hidden */ private _otherwiseFn: UrlRule;
  /** @hidden */ private _sorted: boolean;
  /** @hidden */ private _rules: UrlRule[] = [];
  /** @hidden */ private _id = 0;

  constructor(private router: UIRouter) {
    this.urlRuleFactory = new UrlRuleFactory(router);
  }

  public dispose(router?: UIRouter) {
    this._rules = [];
    delete this._otherwiseFn;
  }

  /** @inheritdoc */
  public initial(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef) {
    const handlerFn: UrlRuleHandlerFn = getHandlerFn(handler);
    const matchFn: UrlRuleMatchFn = (urlParts, router) =>
      router.globals.transitionHistory.size() === 0 && !!/^\/?$/.exec(urlParts.path);

    this.rule(this.urlRuleFactory.create(matchFn, handlerFn));
  }

  /** @inheritdoc */
  public otherwise(handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef) {
    const handlerFn: UrlRuleHandlerFn = getHandlerFn(handler);

    this._otherwiseFn = this.urlRuleFactory.create(val(true), handlerFn);
    this._sorted = false;
  }

  /** @inheritdoc */
  public removeRule(rule): void {
    removeFrom(this._rules, rule);
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
  public rule(rule: UrlRule): Function {
    if (!UrlRuleFactory.isUrlRule(rule)) throw new Error('invalid rule');
    rule.$id = this._id++;
    rule.priority = rule.priority || 0;

    this._rules.push(rule);
    this._sorted = false;

    return () => this.removeRule(rule);
  }

  /** @inheritdoc */
  public rules(): UrlRule[] {
    this.ensureSorted();
    return this._rules.concat(this._otherwiseFn ? [this._otherwiseFn] : []);
  }

  /** @inheritdoc */
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

  /** @inheritdoc */
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
