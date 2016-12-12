/**
 * @internalapi
 * @module vanilla
 */ /** */
import { isDefined } from "../common/index";
import { LocationServices } from "../common/coreservices";
import { splitHash, splitQuery, trimHashVal, getParams, locationPluginFactory } from "./utils";
import { UIRouter } from "../router";
import { LocationPlugin } from "./interface";
import { pushTo, deregAll } from "../common/common";
import { Disposable } from "../interface";
import { BrowserLocationConfig } from "./browserLocationConfig";

/** A `LocationServices` that uses the browser hash "#" to get/set the current location */
export class HashLocationService implements LocationServices, Disposable {
  private _listeners: Function[] = [];
  private _hashPrefix = "";

  hash() {
      return splitHash(trimHashVal(location.hash))[1];
  }

  path() {
      return splitHash(splitQuery(trimHashVal(location.hash))[0])[0];
  }

  search() {
    return getParams(splitQuery(splitHash(trimHashVal(location.hash))[0])[1]);
  }

  setUrl(url: string, replace: boolean = true) {
    if (isDefined(url)) location.hash = url;
  };

  onChange(cb: EventListener) {
    window.addEventListener('hashchange', cb, false);
    return pushTo(this._listeners, () => window.removeEventListener('hashchange', cb));
  }

  html5Mode() {
    return false;
  }

  hashPrefix(newprefix?: string): string {
    if(isDefined(newprefix)) {
      this._hashPrefix = newprefix;
    }
    return this._hashPrefix;
  }

  dispose() {
    deregAll(this._listeners);
  }
}

/** A `UIRouterPlugin` uses the browser hash to get/set the current location */
export const hashLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory('vanilla.hashBangLocation', HashLocationService, BrowserLocationConfig);
