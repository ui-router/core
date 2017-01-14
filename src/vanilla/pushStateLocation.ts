/**
 * @internalapi
 * @module vanilla
 */ /** */
import { isDefined } from "../common/index";
import { LocationServices, LocationConfig } from "../common/coreservices";
import { splitQuery, trimHashVal, getParams, locationPluginFactory, buildUrl } from "./utils";
import { LocationPlugin, HistoryLike, LocationLike } from "./interface";
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
  _location: LocationLike;
  _history: HistoryLike;
  _config: LocationConfig;

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

  url(url?: string, replace: boolean = false, state?: any): any {
    if (isDefined(url)) {
      let fullUrl = this._config.baseHref() + url;
      if (replace) this._history.replaceState(state, null, fullUrl);
      else this._history.pushState(state, null, fullUrl);
      let evt = new Event("locationchange");
      evt['url'] = fullUrl;
      this._listeners.forEach(cb => cb(evt));
    }

    return buildUrl(this);
  }

  onChange(cb: EventListener) {
    window.addEventListener("popstate", cb, false);
    this._listeners.push(cb);
    return () => window.removeEventListener("popstate", cb);
  }

  dispose(router: UIRouter) {
    deregAll(this._listeners);
  }
}

/** A `UIRouterPlugin` that gets/sets the current location using the browser's `location` and `history` apis */
export const pushStateLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.pushStateLocation", true, PushStateLocationService, BrowserLocationConfig);

