import { stripLastPathElement } from '../common';
import { UrlMatcher } from './urlMatcher';
import { RawParams } from '../params';
import { UIRouter } from '../router';
import { UrlRuleFactory } from './urlRule';
import { MatchResult, UrlParts, UrlRule, UrlRuleHandlerFn } from './interface';
import { TargetState, TargetStateDef } from '../state';

function appendBasePath(url: string, isHtml5: boolean, absolute: boolean, baseHref: string): string {
  if (baseHref === '/') return url;
  if (isHtml5) return stripLastPathElement(baseHref) + url;
  if (absolute) return baseHref.slice(1) + url;
  return url;
}

/**
 * Updates URL and responds to URL changes
 *
 * ### Deprecation warning:
 * This class is now considered to be an internal API
 * Use the [[UrlService]] instead.
 * For configuring URL rules, use the [[UrlRules]] which can be found as [[UrlService.rules]].
 */
export class UrlRouter {
  /** used to create [[UrlRule]] objects for common cases */
  public urlRuleFactory: UrlRuleFactory;
  /** @internal */ private location: string;

  /** @internal */
  constructor(/** @internal */ private router: UIRouter) {
    this.urlRuleFactory = new UrlRuleFactory(router);
  }

  /** Internal API. */
  update(read?: boolean) {
    const $url = this.router.locationService;
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
   * @internal
   * @param urlMatcher
   * @param params
   * @param options
   */
  push(urlMatcher: UrlMatcher, params?: RawParams, options?: { replace?: string | boolean }) {
    const replace = options && !!options.replace;
    this.router.urlService.url(urlMatcher.format(params || {}), replace);
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

    const cfg = this.router.urlService.config;
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

  // Delegate these calls to [[UrlService]]
  /** @deprecated use [[UrlService.sync]]*/
  public sync = (evt?) => this.router.urlService.sync(evt);
  /** @deprecated use [[UrlService.listen]]*/
  public listen = (enabled?: boolean): Function => this.router.urlService.listen(enabled);
  /** @deprecated use [[UrlService.deferIntercept]]*/
  public deferIntercept = (defer?: boolean) => this.router.urlService.deferIntercept(defer);
  /** @deprecated use [[UrlService.interceptDeferred]]*/
  public get interceptDeferred() {
    return this.router.urlService.interceptDeferred;
  }
  /** @deprecated use [[UrlService.match]]*/
  public match = (urlParts: UrlParts): MatchResult => this.router.urlService.match(urlParts);

  // Delegate these calls to [[UrlRules]]
  /** @deprecated use [[UrlRules.initial]]*/
  public initial = (handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef): void =>
    this.router.urlService.rules.initial(handler);
  /** @deprecated use [[UrlRules.otherwise]]*/
  public otherwise = (handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef): void =>
    this.router.urlService.rules.otherwise(handler);
  /** @deprecated use [[UrlRules.removeRule]]*/
  public removeRule = (rule: UrlRule): void => this.router.urlService.rules.removeRule(rule);
  /** @deprecated use [[UrlRules.rule]]*/
  public rule = (rule: UrlRule): Function => this.router.urlService.rules.rule(rule);
  /** @deprecated use [[UrlRules.rules]]*/
  public rules = (): UrlRule[] => this.router.urlService.rules.rules();
  /** @deprecated use [[UrlRules.sort]]*/
  public sort = (compareFn?: (a: UrlRule, b: UrlRule) => number) => this.router.urlService.rules.sort(compareFn);
  /** @deprecated use [[UrlRules.when]]*/
  public when = (
    matcher: RegExp | UrlMatcher | string,
    handler: string | UrlRuleHandlerFn,
    options?: { priority: number }
  ): UrlRule => this.router.urlService.rules.when(matcher, handler, options);
}
