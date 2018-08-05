/**
 * @coreapi
 * @module url
 */ /** */
import { UIRouter } from '../router';
import { extend, is, isString, LocationServices, pattern } from '../common';
import { MatchResult, UrlParts, UrlRule, UrlSyncApi } from './interface';
import { UrlRules } from './urlRules';
import { UrlConfig } from './urlConfig';
import { TargetState, TargetStateDef } from '../state';

/** API for URL management */
export class UrlService implements LocationServices, UrlSyncApi {
  /** @hidden */ private _stopListeningFn: Function;
  /** @hidden */ interceptDeferred = false;

  /**
   * A nested API for managing URL rules and rewrites
   *
   * See: [[UrlRulesApi]] for details
   */
  public rules = new UrlRules(this.router);
  /**
   * A nested API to configure the URL and retrieve URL information
   *
   * See: [[UrlConfigApi]] for details
   */
  public config = new UrlConfig(this.router);
  constructor(/** @hidden */ private router: UIRouter) {}

  public dispose() {
    this.listen(false);
    (this.rules as UrlRules).dispose();
  }

  /**
   * Returns the current URL parts
   *
   * This method returns the current URL components as a [[UrlParts]] object.
   *
   * @returns the current url parts
   */
  public parts(): UrlParts {
    return { path: this.path(), search: this.search(), hash: this.hash() };
  }

  /** @inheritdoc */
  public sync(evt?) {
    if (evt && evt.defaultPrevented) return;
    const { urlService, stateService } = this.router;

    const url: UrlParts = { path: urlService.path(), search: urlService.search(), hash: urlService.hash() };
    const best = this.match(url);

    const applyResult = pattern([
      [isString, (newurl: string) => urlService.url(newurl, true)],
      [TargetState.isDef, (def: TargetStateDef) => stateService.go(def.state, def.params, def.options)],
      [is(TargetState), (target: TargetState) => stateService.go(target.state(), target.params(), target.options())],
    ]);

    applyResult(best && best.rule.handler(best.match, url, this.router));
  }

  /** @inheritdoc */
  public listen(enabled?: boolean): Function {
    if (enabled === false) {
      this._stopListeningFn && this._stopListeningFn();
      delete this._stopListeningFn;
    } else {
      return (this._stopListeningFn = this._stopListeningFn || this.router.urlService.onChange(evt => this.sync(evt)));
    }
  }

  /** @inheritdoc */
  public deferIntercept(defer?: boolean) {
    if (defer === undefined) defer = true;
    this.interceptDeferred = defer;
  }

  /**
   * Given a URL, check all rules and return the best [[MatchResult]]
   * @param url
   * @returns {MatchResult}
   */
  public match(url: UrlParts): MatchResult {
    url = extend({ path: '', search: {}, hash: '' }, url);
    const rules = this.rules.rules();

    // Checks a single rule. Returns { rule: rule, match: match, weight: weight } if it matched, or undefined
    const checkRule = (rule: UrlRule): MatchResult => {
      const match = rule.match(url, this.router);
      return match && { match, rule, weight: rule.matchPriority(match) };
    };

    // The rules are pre-sorted.
    // - Find the first matching rule.
    // - Find any other matching rule that sorted *exactly the same*, according to `.sort()`.
    // - Choose the rule with the highest match weight.
    let best: MatchResult;
    for (let i = 0; i < rules.length; i++) {
      // Stop when there is a 'best' rule and the next rule sorts differently than it.
      if (best && best.rule._group !== rules[i]._group) break;

      const current = checkRule(rules[i]);
      // Pick the best MatchResult
      best = !best || (current && current.weight > best.weight) ? current : best;
    }

    return best;
  }

  // Delegate these calls to the current LocationServices implementation
  /** @inheritdoc */ public url = (newurl?: string, replace?: boolean, state?: any): string =>
    this.router.locationService.url(newurl, replace, state);
  /** @inheritdoc */ public path = (): string => this.router.locationService.path();
  /** @inheritdoc */ public search = (): { [key: string]: any } => this.router.locationService.search();
  /** @inheritdoc */ public hash = (): string => this.router.locationService.hash();
  /** @inheritdoc */ public onChange = (callback: Function): Function => this.router.locationService.onChange(callback);
}
