/**
 * @internalapi
 * @module vanilla
 */ /** */
import { isDefined } from "../common/index";
import { LocationServices } from "../common/coreservices";
import { splitHash, splitQuery, trimHashVal, getParams, locationPluginFactory, buildUrl } from "./utils";
import { UIRouter } from "../router";
import { LocationPlugin } from "./interface";
import { pushTo, deregAll } from "../common/common";
import { Disposable } from "../interface";
import { BrowserLocationConfig } from "./browserLocationConfig";

/** A `LocationServices` that uses the browser hash "#" to get/set the current location */
export class HashLocationService implements LocationServices, Disposable {
  private _listeners: Function[] = [];

  hash   = () => splitHash(trimHashVal(location.hash))[1];
  path   = () => splitHash(splitQuery(trimHashVal(location.hash))[0])[0];
  search = () => getParams(splitQuery(splitHash(trimHashVal(location.hash))[0])[1]);

  url(url?: string, replace: boolean = true): string {
    if (isDefined(url)) location.hash = url;
    return buildUrl(this);
  }

  onChange(cb: EventListener) {
    window.addEventListener('hashchange', cb, false);
    return pushTo(this._listeners, () => window.removeEventListener('hashchange', cb));
  }

  dispose = () => deregAll(this._listeners);
}

/** A `UIRouterPlugin` uses the browser hash to get/set the current location */
export const hashLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory('vanilla.hashBangLocation', false, HashLocationService, BrowserLocationConfig);
