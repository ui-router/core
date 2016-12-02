/** @internalapi @module vanilla */ /** */
import { isDefined } from '../common/module';
import { LocationConfig, LocationServices } from '../common/coreservices';
import { splitHash, splitQuery, trimHashVal, getParams, locationPluginFactory } from './utils';
import { UIRouter } from '../router';
import { LocationPlugin } from "./interface";

let hashPrefix: string = '';
let baseHref: string = '';

/** A `LocationConfig` that delegates to the browser's `location` object */
export const hashLocationConfig: LocationConfig = {
  port: () =>
    parseInt(location.port),
  protocol: () =>
    location.protocol,
  host: () =>
    location.host,
  baseHref: () =>
    baseHref,
  html5Mode: () =>
    false,
  hashPrefix: (newprefix?: string): string => {
    if(isDefined(newprefix)) {
      hashPrefix = newprefix;
    }
    return hashPrefix;
  }
};

/** A `LocationServices` that uses the browser hash "#" to get/set the current location */
export const hashLocationService: LocationServices = {
  hash: () =>
      splitHash(trimHashVal(location.hash))[1],
  path: () =>
      splitHash(splitQuery(trimHashVal(location.hash))[0])[0],
  search: () =>
    getParams(splitQuery(splitHash(trimHashVal(location.hash))[0])[1]),
  setUrl: (url: string, replace: boolean = true) => {
    if (url) location.hash = url;
  },
  onChange: (cb: EventListener) => {
    window.addEventListener('hashchange', cb, false);
    return () => window.removeEventListener('hashchange', cb);
  }
};

/** A `UIRouterPlugin` uses the browser hash to get/set the current location */
export const hashLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory('vanilla.hashBangLocation', hashLocationService, hashLocationConfig);
