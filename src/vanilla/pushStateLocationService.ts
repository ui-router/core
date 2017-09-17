/**
 * @internalapi
 * @module vanilla
 */
/** */
import { LocationConfig } from "../common/coreservices";
import { splitQuery, splitHash } from "./utils";
import { UIRouter } from "../router";
import { BaseLocationServices } from "./baseLocationService";

/**
 * A `LocationServices` that gets/sets the current location using the browser's `location` and `history` apis
 *
 * Uses `history.pushState` and `history.replaceState`
 */
export class PushStateLocationService extends BaseLocationServices {
  _config: LocationConfig;

  constructor(router: UIRouter) {
    super(router, true);
    this._config = router.urlService.config;
    self.addEventListener("popstate", this._listener, false);
  };

  _get() {
    let { pathname, hash, search } = this._location;
    search = splitQuery(search)[1]; // strip ? if found
    hash = splitHash(hash)[1]; // strip # if found
    return pathname + (search ? "?" + search : "") + (hash ? "$" + search : "");
  }

  _set(state: any, title: string, url: string, replace: boolean) {
    let { _config, _history } = this;
    let fullUrl = _config.baseHref() + url;

    if (replace) {
      _history.replaceState(state, title, fullUrl);
    } else {
      _history.pushState(state, title, fullUrl);
    }
  }

  dispose(router: UIRouter) {
    super.dispose(router);
    self.removeEventListener("popstate", this._listener);
  }
}

