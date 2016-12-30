/**
 * @coreapi
 * @module url
 */ /** */

import { UIRouter } from "../router";
import { LocationServices, notImplemented, LocationConfig } from "../common/coreservices";
import { noop, createProxyFunctions } from "../common/common";
import { UrlConfig, UrlSync, UrlListen, UrlRules, UrlDeferIntercept } from "./interface";

/** @hidden */
const makeStub = (keys: string[]): any =>
    keys.reduce((acc, key) => (acc[key] = notImplemented(key), acc), { dispose: noop });

/** @hidden */ const locationServicesFns = ["url", "path", "search", "hash", "onChange"];
/** @hidden */ const locationConfigFns = ["port", "protocol", "host", "baseHref", "html5Mode", "hashPrefix"];
/** @hidden */ const umfFns = ["type", "caseInsensitive", "strictMode", "defaultSquashPolicy"];
/** @hidden */ const rulesFns = ["sort", "when", "otherwise", "rules", "rule", "removeRule"];
/** @hidden */ const syncFns = ["deferIntercept", "listen", "sync"];

/**
 * API for URL management
 */
export class UrlService implements LocationServices, UrlSync, UrlListen, UrlDeferIntercept {
  /** @hidden */
  static locationServiceStub: LocationServices = makeStub(locationServicesFns);
  /** @hidden */
  static locationConfigStub: LocationConfig = makeStub(locationConfigFns);

  /** @inheritdoc */
  url(): string;
  /** @inheritdoc */
  url(newurl: string, replace?: boolean, state?): void;
  url(newurl?, replace?, state?): any { return };
  /** @inheritdoc */
  path(): string { return };
  /** @inheritdoc */
  search(): { [key: string]: any } { return };
  /** @inheritdoc */
  hash(): string { return };
  /** @inheritdoc */
  onChange(callback: Function): Function { return };

  dispose() { }

  /** @inheritdoc */
  sync(evt?) { return }
  /** @inheritdoc */
  listen(enabled?: boolean): Function { return };
  /** @inheritdoc */
  deferIntercept(defer?: boolean) { return }

  /**
   * A nested API for managing URL rules and rewrites
   *
   * See: [[UrlRules]] for details
   */
  rules: UrlRules;

  /**
   * A nested API to configure the URL and retrieve URL information
   *
   * See: [[UrlConfig]] for details
   */
  config: UrlConfig;

  /** @hidden */
  private router: UIRouter;

  /** @hidden */
  constructor(router: UIRouter) {
    this.router = router;
    this.rules = {} as any;
    this.config = {} as any;

    // proxy function calls from UrlService to the LocationService/LocationConfig
    const locationServices = () => router.locationService;
    createProxyFunctions(locationServices, this, locationServices, locationServicesFns, true);

    const locationConfig = () => router.locationConfig;
    createProxyFunctions(locationConfig, this.config, locationConfig, locationConfigFns, true);

    const umf = () => router.urlMatcherFactory;
    createProxyFunctions(umf, this.config, umf, umfFns);

    const urlRouter = () => router.urlRouter;
    createProxyFunctions(urlRouter, this.rules, urlRouter, rulesFns);
    createProxyFunctions(urlRouter, this, urlRouter, syncFns);
  }
}
