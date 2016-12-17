/**
 * @internalapi
 * @module vanilla
 */ /** */
import { isDefined } from "../common/index";
import { LocationServices, LocationConfig } from "../common/coreservices";
import { splitQuery, trimHashVal, getParams, locationPluginFactory } from "./utils";
import { LocationPlugin } from "./interface";
import { UIRouter } from "../router";
import { pushTo, deregAll } from "../common/common";
import { Disposable } from "../interface";
import { BrowserLocationConfig } from "./browserLocationConfig";

/**
 * A `LocationServices` that gets/sets the current location using the browser's `location` and `history` apis
 *
 * Uses `history.pushState` and `history.replaceState`
 */
export class PushStateLocationService implements LocationServices, Disposable {
  private _listeners: Function[] = [];
  private _location: Location;
  private _history: History;
  private _config: LocationConfig;

  constructor(router: UIRouter) {
    this._location = location;
    this._history = history;
    this._config = router.urlService.config;
  };

  hash() {
    return trimHashVal(this._location.hash);
  }

  path() {
    let base = this._config.baseHref();
    let path = this._location.pathname;
    let idx = path.indexOf(base);
    if (idx !== 0) throw new Error(`current url: ${path} does not start with <base> tag ${base}`);
    return path.substr(base.length);
  }

  search() {
    return getParams(splitQuery(this._location.search)[1]);
  }

  setUrl(url: string, replace: boolean = false) {
    if (isDefined(url)) {
      let fullUrl = this._config.baseHref() + url;
      if (replace) this._history.replaceState(null, null, fullUrl);
      else this._history.pushState(null, null, fullUrl);
    }
  }

  onChange(cb: EventListener) {
    window.addEventListener("popstate", cb, false);
    return pushTo(this._listeners, () => window.removeEventListener("popstate", cb));
  }

  dispose(router: UIRouter) {
    deregAll(this._listeners);
  }
}

/** A `UIRouterPlugin` that gets/sets the current location using the browser's `location` and `history` apis */
export const pushStateLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.pushStateLocation", true, PushStateLocationService, BrowserLocationConfig);

