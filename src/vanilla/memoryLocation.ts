/**
 * @internalapi
 * @module vanilla
 */ /** */
import { isDefined } from "../common/index";
import { LocationConfig, LocationServices } from "../common/coreservices";
import { splitQuery, getParams, splitHash, locationPluginFactory, buildUrl } from "./utils";
import { removeFrom, unnestR, deregAll, noop } from "../common/common";
import { UIRouter } from "../router";
import { LocationPlugin } from "./interface";
import { isArray } from "../common/predicates";
import { Disposable } from "../interface";

/** A `LocationConfig` mock that gets/sets all config from an in-memory object */
export class MemoryLocationConfig implements LocationConfig {
  _baseHref = '';
  _port = 80;
  _protocol = "http";
  _host = "localhost";
  _hashPrefix = "";

  port = () => this._port;
  protocol = () => this._protocol;
  host = () => this._host;
  baseHref = () => this._baseHref;
  html5Mode = () => false;
  hashPrefix = (newval?) => isDefined(newval) ? this._hashPrefix = newval : this._hashPrefix;
  dispose = noop;
}

/** A `LocationServices` that gets/sets the current location from an in-memory object */
export class MemoryLocationService implements LocationServices, Disposable {
  _listeners: Function[] = [];
  _url = {
    path: '',
    search: {},
    hash: ''
  };

  private _urlChanged(newval, oldval) {
    if (newval === oldval) return;
    let evt = new Event("locationchange");
    evt['url'] = newval;
    this._listeners.forEach(cb => cb(evt));
  }

  hash   = () => this._url.hash;
  path   = () => this._url.path;
  search = () => this._url.search;

  url(url?: string, replace: boolean = false, state?): string {
    if (isDefined(url)) {
      let path = splitHash(splitQuery(url)[0])[0];
      let hash = splitHash(url)[1];
      let search = getParams(splitQuery(splitHash(url)[0])[1]);

      let oldval = this.url();
      this._url = { path, search, hash };

      let newval = this.url();
      this._urlChanged(newval, oldval);
    }

    return buildUrl(this);
  }

  onChange(cb: EventListener) {
    this._listeners.push(cb);
    return () => removeFrom(this._listeners, cb);
  }
  
  dispose = () => deregAll(this._listeners);
}

/** A `UIRouterPlugin` that gets/sets the current location from an in-memory object */
export const memoryLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.memoryLocation", false, MemoryLocationService, MemoryLocationConfig);