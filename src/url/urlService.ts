/** @publicapi @module url */ /** */
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
   * The nested [[UrlRules]] API for managing URL rules and rewrites
   *
   * See: [[UrlRules]] for details
   */
  public rules = new UrlRules(this.router);

  /**
   * The nested [[UrlConfig]] API to configure the URL and retrieve URL information
   *
   * See: [[UrlConfig]] for details
   */
  public config = new UrlConfig(this.router);

  /** @hidden */
  constructor(/** @hidden */ private router: UIRouter) {}
  /** @hidden */
  public dispose() {
    this.listen(false);
    (this.rules as UrlRules).dispose();
  }

  /**
   * Gets the current URL parts
   *
   * This method returns the different parts of the current URL (the [[path]], [[search]], and [[hash]]) as a [[UrlParts]] object.
   */
  public parts(): UrlParts {
    return { path: this.path(), search: this.search(), hash: this.hash() };
  }

  /**
   * Activates the best rule for the current URL
   *
   * Checks the current URL for a matching [[UrlRule]], then invokes that rule's handler.
   * This method is called internally any time the URL has changed.
   *
   * This effectively activates the state (or redirect, etc) which matches the current URL.
   *
   * #### Example:
   * ```js
   * urlService.deferIntercept();
   *
   * fetch('/states.json').then(resp => resp.json()).then(data => {
   *   data.forEach(state => $stateRegistry.register(state));
   *   urlService.listen();
   *   // Find the matching URL and invoke the handler.
   *   urlService.sync();
   * });
   * ```
   */
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

  /**
   * Starts or stops listening for URL changes
   *
   * Call this sometime after calling [[deferIntercept]] to start monitoring the url.
   * This causes UI-Router to start listening for changes to the URL, if it wasn't already listening.
   *
   * If called with `false`, UI-Router will stop listening (call listen(true) to start listening again).
   *
   * #### Example:
   * ```js
   * urlService.deferIntercept();
   *
   * fetch('/states.json').then(resp => resp.json()).then(data => {
   *   data.forEach(state => $stateRegistry.register(state));
   *   // Start responding to URL changes
   *   urlService.listen();
   *   urlService.sync();
   * });
   * ```
   *
   * @param enabled `true` or `false` to start or stop listening to URL changes
   */
  public listen(enabled?: boolean): Function {
    if (enabled === false) {
      this._stopListeningFn && this._stopListeningFn();
      delete this._stopListeningFn;
    } else {
      return (this._stopListeningFn = this._stopListeningFn || this.router.urlService.onChange(evt => this.sync(evt)));
    }
  }

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
   * // Prevent UI-Router from automatically intercepting URL changes when it starts;
   * urlService.deferIntercept();
   *
   * fetch('/states.json').then(resp => resp.json()).then(data => {
   *   data.forEach(state => $stateRegistry.register(state));
   *   urlService.listen();
   *   urlService.sync();
   * });
   * ```
   *
   * @param defer Indicates whether to defer location change interception.
   *        Passing no parameter is equivalent to `true`.
   */
  public deferIntercept(defer?: boolean) {
    if (defer === undefined) defer = true;
    this.interceptDeferred = defer;
  }

  /**
   * Matches a URL
   *
   * Given a URL (as a [[UrlParts]] object), check all rules and determine the best matching rule.
   * Return the result as a [[MatchResult]].
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
  /**
   * Gets the current url, or updates the url
   *
   * ### Getting the current URL
   *
   * When no arguments are passed, returns the current URL.
   * The URL is normalized using the internal [[path]]/[[search]]/[[hash]] values.
   *
   * For example, the URL may be stored in the hash ([[HashLocationServices]]) or
   * have a base HREF prepended ([[PushStateLocationServices]]).
   *
   * The raw URL in the browser might be:
   *
   * ```
   * http://mysite.com/somepath/index.html#/internal/path/123?param1=foo#anchor
   * ```
   *
   * or
   *
   * ```
   * http://mysite.com/basepath/internal/path/123?param1=foo#anchor
   * ```
   *
   * then this method returns:
   *
   * ```
   * /internal/path/123?param1=foo#anchor
   * ```
   *
   *
   * #### Example:
   * ```js
   * locationServices.url(); // "/some/path?query=value#anchor"
   * ```
   *
   * ### Updating the URL
   *
   * When `newurl` arguments is provided, changes the URL to reflect `newurl`
   *
   * #### Example:
   * ```js
   * locationServices.url("/some/path?query=value#anchor", true);
   * ```
   *
   * @param newurl The new value for the URL.
   *               This url should reflect only the new internal [[path]], [[search]], and [[hash]] values.
   *               It should not include the protocol, site, port, or base path of an absolute HREF.
   * @param replace When true, replaces the current history entry (instead of appending it) with this new url
   * @param state The history's state object, i.e., pushState (if the LocationServices implementation supports it)
   *
   * @return the url (after potentially being processed)
   */
  public url = (newurl?: string, replace?: boolean, state?: any): string =>
    this.router.locationService.url(newurl, replace, state);

  /**
   * Gets the path part of the current url
   *
   * If the current URL is `/some/path?query=value#anchor`, this returns `/some/path`
   *
   * @return the path portion of the url
   */
  public path = (): string => this.router.locationService.path();

  /**
   * Gets the search part of the current url as an object
   *
   * If the current URL is `/some/path?query=value#anchor`, this returns `{ query: 'value' }`
   *
   * @return the search (query) portion of the url, as an object
   */
  public search = (): { [key: string]: any } => this.router.locationService.search();

  /**
   * Gets the hash part of the current url
   *
   * If the current URL is `/some/path?query=value#anchor`, this returns `anchor`
   *
   * @return the hash (anchor) portion of the url
   */
  public hash = (): string => this.router.locationService.hash();

  /**
   * @internalapi
   *
   * Registers a low level url change handler
   *
   * Note: Because this is a low level handler, it's not recommended for general use.
   *
   * #### Example:
   * ```js
   * let deregisterFn = locationServices.onChange((evt) => console.log("url change", evt));
   * ```
   *
   * @param callback a function that will be called when the url is changing
   * @return a function that de-registers the callback
   */
  public onChange = (callback: Function): Function => this.router.locationService.onChange(callback);
}
