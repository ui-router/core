/**
 * @coreapi
 * @module url
 */ /** */

import { UIRouter } from '../router';
import { LocationServices, notImplemented, LocationConfig } from '../common/coreservices';
import { noop, createProxyFunctions } from '../common/common';
import { UrlConfigApi, UrlSyncApi, UrlRulesApi, UrlParts, MatchResult } from './interface';

/** @hidden */
const makeStub = (keys: string[]): any =>
  keys.reduce((acc, key) => ((acc[key] = notImplemented(key)), acc), { dispose: noop });

/* tslint:disable:align */
/** @hidden */ const locationServicesFns = ['url', 'path', 'search', 'hash', 'onChange'];
/** @hidden */ const locationConfigFns = ['port', 'protocol', 'host', 'baseHref', 'html5Mode', 'hashPrefix'];
/** @hidden */ const umfFns = ['type', 'caseInsensitive', 'strictMode', 'defaultSquashPolicy'];
/** @hidden */ const rulesFns = ['sort', 'when', 'initial', 'otherwise', 'rules', 'rule', 'removeRule'];
/** @hidden */ const syncFns = ['deferIntercept', 'listen', 'sync', 'match'];
/* tslint:enable:align */

/**
 * API for URL management
 */
export class UrlService implements LocationServices, UrlSyncApi {
  /** @hidden */
  static locationServiceStub: LocationServices = makeStub(locationServicesFns);
  /** @hidden */
  static locationConfigStub: LocationConfig = makeStub(locationConfigFns);

  /**
   * A nested API for managing URL rules and rewrites
   *
   * See: [[UrlRulesApi]] for details
   */
  rules: UrlRulesApi;

  /**
   * A nested API to configure the URL and retrieve URL information
   *
   * See: [[UrlConfigApi]] for details
   */
  config: UrlConfigApi;

  /** @hidden */
  private router: UIRouter;

  /** @hidden */
  constructor(router: UIRouter, lateBind = true) {
    this.router = router;
    this.rules = {} as any;
    this.config = {} as any;

    // proxy function calls from UrlService to the LocationService/LocationConfig
    const locationServices = () => router.locationService;
    createProxyFunctions(locationServices, this, locationServices, locationServicesFns, lateBind);

    const locationConfig = () => router.locationConfig;
    createProxyFunctions(locationConfig, this.config, locationConfig, locationConfigFns, lateBind);

    const umf = () => router.urlMatcherFactory;
    createProxyFunctions(umf, this.config, umf, umfFns);

    const urlRouter = () => router.urlRouter;
    createProxyFunctions(urlRouter, this.rules, urlRouter, rulesFns);
    createProxyFunctions(urlRouter, this, urlRouter, syncFns);
  }

  /** @inheritdoc */
  url(): string;
  /** @inheritdoc */
  url(newurl: string, replace?: boolean, state?): void;
  url(newurl?, replace?, state?): any {
    return;
  }
  /** @inheritdoc */
  path(): string {
    return;
  }
  /** @inheritdoc */
  search(): { [key: string]: any } {
    return;
  }
  /** @inheritdoc */
  hash(): string {
    return;
  }
  /** @inheritdoc */
  onChange(callback: Function): Function {
    return;
  }

  /**
   * Returns the current URL parts
   *
   * This method returns the current URL components as a [[UrlParts]] object.
   *
   * @returns the current url parts
   */
  parts(): UrlParts {
    return { path: this.path(), search: this.search(), hash: this.hash() };
  }

  dispose() {}

  /** @inheritdoc */
  sync(evt?) {
    return;
  }
  /** @inheritdoc */
  listen(enabled?: boolean): Function {
    return;
  }
  /** @inheritdoc */
  deferIntercept(defer?: boolean) {
    return;
  }
  /** @inheritdoc */
  match(urlParts: UrlParts): MatchResult {
    return;
  }
}
