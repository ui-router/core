/**
 * @coreapi
 * @module url
 */ /** for typedoc */
import { IInjectable, removeFrom, createProxyFunctions } from "../common/common";
import { isFunction, isString, isArray } from "../common/predicates";
import { UrlMatcher } from "./urlMatcher";
import { services, $InjectorLike, LocationServices } from "../common/coreservices";
import { RawParams } from "../params/interface";
import { Disposable } from "../interface";
import { UIRouter } from "../router";
import { val } from "../common/hof";
import { UrlRuleFactory, UrlRule, RawNg1UrlRule } from "./urlRule";

/** @hidden */
function appendBasePath(url: string, isHtml5: boolean, absolute: boolean, baseHref: string): string {
  if (baseHref === '/') return url;
  if (isHtml5) return baseHref.slice(0, -1) + url;
  if (absolute) return baseHref.slice(1) + url;
  return url;
}

/**
 * Manages rules for client-side URL
 *
 * This class manages the router rules for what to do when the URL changes.
 */
export class UrlRouterProvider implements Disposable {
  /** @hidden */
  rules: UrlRule[] = [];
  /** @hidden */
  otherwiseFn: ($injector: $InjectorLike, $location: LocationServices) => string;
  /** @hidden */
  interceptDeferred = false;
  /** @hidden */
  _router: UIRouter;

  constructor(router: UIRouter) {
    this._router = router;
  }

  /** @internalapi */
  dispose() {
    this.rules = [];
    delete this.otherwiseFn;
  }

  /**
   * Registers a url handler function.
   *
   * Registers a low level url handler (a `rule`). A rule detects specific URL patterns and returns
   * a redirect, or performs some action.
   *
   * If a rule returns a string, the URL is replaced with the string, and all rules are fired again.
   *
   * #### Example:
   * ```js
   * var app = angular.module('app', ['ui.router.router']);
   *
   * app.config(function ($urlRouterProvider) {
   *   // Here's an example of how you might allow case insensitive urls
   *   $urlRouterProvider.rule(function ($injector, $location) {
   *     var path = $location.path(),
   *         normalized = path.toLowerCase();
   *
   *     if (path !== normalized) {
   *       return normalized;
   *     }
   *   });
   * });
   * ```
   *
   * @param ruleFn
   * Handler function that takes `$injector` and `$location` services as arguments.
   * You can use them to detect a url and return a different url as a string.
   *
   * @return [[$urlRouterProvider]] (`this`)
   */
  rule(ruleFn: ($injector: $InjectorLike, $location: LocationServices) => string|void): UrlRouterProvider {
    if (!isFunction(ruleFn)) throw new Error("'rule' must be a function");
    let rule = new RawNg1UrlRule(ruleFn, this._router);
    this.addRule(rule);
    return this;
  };

  addRule(rule: UrlRule) {
    this.rules.push(rule);
    return () => this.removeRule(rule);
  }

  /**
   * Remove a rule previously registered
   *
   * @param rule the matcher rule that was previously registered using [[rule]]
   * @return true if the rule was found (and removed)
   */
  removeRule(rule): boolean {
    return this.rules.length !== removeFrom(this.rules, rule).length;
  }

  /**
   * Defines the path or behavior to use when no url can be matched.
   *
   * #### Example:
   * ```js
   * var app = angular.module('app', ['ui.router.router']);
   *
   * app.config(function ($urlRouterProvider) {
   *   // if the path doesn't match any of the urls you configured
   *   // otherwise will take care of routing the user to the
   *   // specified url
   *   $urlRouterProvider.otherwise('/index');
   *
   *   // Example of using function rule as param
   *   $urlRouterProvider.otherwise(function ($injector, $location) {
   *     return '/a/valid/url';
   *   });
   * });
   * ```
   *
   * @param rule 
   * The url path you want to redirect to or a function rule that returns the url path or performs a `$state.go()`. 
   * The function version is passed two params: `$injector` and `$location` services, and should return a url string.
   *
   * @return {object} `$urlRouterProvider` - `$urlRouterProvider` instance
   */
  otherwise(rule: string | (($injector: $InjectorLike, $location: LocationServices) => string)): UrlRouterProvider {
    if (!isFunction(rule) && !isString(rule)) throw new Error("'rule' must be a string or function");
    this.otherwiseFn = isString(rule) ? () => rule : rule;
    return this;
  };

  /**
   * Registers a handler for a given url matching. 
   * 
   * If the handler is a string, it is
   * treated as a redirect, and is interpolated according to the syntax of match
   * (i.e. like `String.replace()` for `RegExp`, or like a `UrlMatcher` pattern otherwise).
   *
   * If the handler is a function, it is injectable.
   * It gets invoked if `$location` matches.
   * You have the option of inject the match object as `$match`.
   *
   * The handler can return
   *
   * - **falsy** to indicate that the rule didn't match after all, then `$urlRouter`
   *   will continue trying to find another one that matches.
   * - **string** which is treated as a redirect and passed to `$location.url()`
   * - **void** or any **truthy** value tells `$urlRouter` that the url was handled.
   *
   * @example
   * ```js
   * 
   * var app = angular.module('app', ['ui.router.router']);
   *
   * app.config(function ($urlRouterProvider) {
   *   $urlRouterProvider.when($state.url, function ($match, $stateParams) {
   *     if ($state.$current.navigable !== state ||
   *         !equalForKeys($match, $stateParams) {
   *      $state.transitionTo(state, $match, false);
   *     }
   *   });
   * });
   * ```
   *
   * @param what A pattern string to match, compiled as a [[UrlMatcher]].
   * @param handler The path (or function that returns a path) that you want to redirect your user to.
   * @param ruleCallback [optional] A callback that receives the `rule` registered with [[UrlMatcher.rule]]
   *
   * Note: the handler may also invoke arbitrary code, such as `$state.go()`
   */
  when(what: (RegExp|UrlMatcher|string), handler: string|IInjectable, ruleCallback?) {
    let rule: UrlRule, ruleFactory = new UrlRuleFactory(this._router);

    if (isArray(handler) || isFunction(handler)) {
      handler = UrlRouterProvider.injectableHandler(this._router, handler);
    }

    rule = ruleFactory.create(what, handler);
    ruleCallback && ruleCallback(rule);
    this.addRule(rule);
    return this;
  };

  static injectableHandler(router: UIRouter, handler): IInjectable {
    return (match: any, path: string, search: any, hash: string) => {
      services.$injector.invoke(handler, null, { $match: match, $stateParams: router.globals.params });
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
}

export class UrlRouter implements Disposable {
  /** @hidden */
  private location: string;
  /** @hidden */
  private listener: Function;
  /** @hidden */
  private _router: UIRouter;

  /** @hidden */
  constructor(router: UIRouter) {
    this._router = router;
    createProxyFunctions(val(UrlRouter.prototype), this, val(this));
  }

  /** @internalapi */
  dispose() {
    this.listener && this.listener();
    delete this.listener;
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
        rules = router.urlRouterProvider.rules,
        otherwiseFn = router.urlRouterProvider.otherwiseFn;

    let path = $url.path(),
        search = $url.search(),
        hash = $url.hash();

    function check(rule: UrlRule) {
      let match = rule.match(path, search, hash);
      if (!match) return false;

      let result = match && rule.handler(match, path, search, hash);
      if (isString(result)) {
        $url.setUrl(result, true);
      }
      return true;
    }

    for (let i = 0; i < rules.length; i++) {
      if (check(rules[i])) return;
    }
    // always check otherwise last to allow dynamic updates to the set of rules
    if (otherwiseFn) check(<any> { match: val(true), handler: otherwiseFn });
  }

  /**
   * Starts listening for URL changes
   *
   * Call this sometime after calling [[deferIntercept]] to start monitoring the url.
   * This causes [[UrlRouter]] to start listening for changes to the URL, if it wasn't already listening.
   */
  listen(): Function {
    return this.listener = this.listener || this._router.urlService.onChange(evt => this.sync(evt));
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

    $url.setUrl(this.location, true);
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
  push(urlMatcher: UrlMatcher, params: RawParams, options: { replace?: (string|boolean) }) {
    let replace = options && !!options.replace;
    this._router.urlService.setUrl(urlMatcher.format(params || {}), replace);
  }

  /**
   * Builds and returns a URL with interpolated parameters
   *
   * #### Example:
   * ```js
   * $bob = $urlRouter.href(new UrlMatcher("/about/:person"), {
   *   person: "bob"
   * });
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
  href(urlMatcher: UrlMatcher, params: any, options: { absolute: boolean }): string {
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
}

