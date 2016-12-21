/** @module url */ /** */

import { UIRouter } from "../router";
import { LocationServices, notImplemented, LocationConfig } from "../common/coreservices";
import { noop, createProxyFunctions } from "../common/common";

/** @hidden */
const makeStub = (keys: string[]): any =>
    keys.reduce((acc, key) => (acc[key] = notImplemented(key), acc), { dispose: noop });

/** @hidden */
const locationServicesFns = ["setUrl", "path", "search", "hash", "onChange"];
/** @hidden */
const locationConfigFns = ["port", "protocol", "host", "baseHref", "html5Mode", "hashPrefix"];

/**
 * Service methods related to URL management
 *
 * This class delegates to other URL services.
 *
 * - [[LocationService]]: Framework specific code to interact with the browser URL
 * - [[LocationConfig]]: Framework specific code to interact with the browser URL
 * - [[UrlMatcherFactory]]:
 * - [[UrlRouter]]:
 */
export class UrlService implements LocationServices {
  /** @hidden */
  static locationServiceStub: LocationServices = makeStub(locationServicesFns);
  /** @hidden */
  static locationConfigStub: LocationConfig = makeStub(locationConfigFns);

  /** @inheritdoc */
  setUrl(newurl: string, replace?: boolean): void { return };
  /** @inheritdoc */
  path(): string { return };
  /** @inheritdoc */
  search(): { [key: string]: any } { return };
  /** @inheritdoc */
  hash(): string { return };
  /** @inheritdoc */
  onChange(callback: Function): Function { return };

  dispose() { }

  /**
   * The [[LocationConfig]] service
   *
   * This object returns information about the location (url) configuration.
   * This information can be used to build absolute URLs, such as
   * `https://example.com:443/basepath/state/substate?param1=a#hashvalue`;
   */
  config: LocationConfig;

  constructor(private router: UIRouter) {
    this.config = {} as any;
    // proxy function calls from UrlService to the LocationService/LocationConfig
    const locationServices = () => router.locationService;
    createProxyFunctions(locationServices, this, locationServices, locationServicesFns, true);

    const locationConfig = () => router.locationConfig;
    createProxyFunctions(locationConfig, this.config, locationConfig, locationConfigFns, true);
  }
}
