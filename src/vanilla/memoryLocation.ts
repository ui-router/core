/**
 * @internalapi
 * @module vanilla
 */ /** */
import { isDefined } from "../common/index";
import { LocationConfig, LocationServices } from "../common/coreservices";
import { splitQuery, getParams, splitHash, locationPluginFactory } from "./utils";
import { removeFrom, unnestR, deregAll } from "../common/common";
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

  port = () => this._port;
  protocol = () => this._protocol;
  host = () => this._host;
  baseHref = () => this._baseHref;
}

/** A `LocationServices` that gets/sets the current location from an in-memory object */
export class MemoryLocationService implements LocationServices, Disposable {
  _listeners: Function[] = [];
  _hashPrefix = "";
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

  url() {
    let s = this._url.search;
    let hash = this._url.hash;
    let query = Object.keys(s).map(key => (isArray(s[key]) ? s[key] : [s[key]]) .map(val => key + "=" + val))
        .reduce(unnestR, [])
        .join("&");

    return this._url.path +
        (query ? "?" + query : "") +
        (hash ? "#" + hash : "");
  }

  hash() {
    return this._url.hash;
  }

  path() {
    return this._url.path;
  }

  search() {
    return this._url.search;
  }

  html5Mode() {
    return false;
  }

  hashPrefix(newprefix?: string): string {
    return isDefined(newprefix) ? this._hashPrefix = newprefix : this._hashPrefix;
  }

  setUrl(url: string, replace: boolean = false) {
    if (isDefined(url)) {
      let path = splitHash(splitQuery(url)[0])[0];
      let hash = splitHash(url)[1];
      let search = getParams(splitQuery(splitHash(url)[0])[1]);

      let oldval = this.url();
      this._url = { path, search, hash };
      let newval = this.url();
      this._urlChanged(newval, oldval);
    }
  }

  onChange(cb: EventListener) {
    this._listeners.push(cb);
    return () => removeFrom(this._listeners, cb);
  }
  
  dispose() {
    deregAll(this._listeners);
  }
}

/** A `UIRouterPlugin` that gets/sets the current location from an in-memory object */
export const memoryLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.memoryLocation", MemoryLocationService, MemoryLocationConfig);