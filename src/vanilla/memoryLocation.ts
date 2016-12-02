import { services, isDefined } from '../common/module';
import { LocationConfig, LocationServices } from '../common/coreservices';
import { splitQuery, trimHashVal, getParams, splitHash, locationPluginFactory } from './utils';
import { removeFrom, unnestR } from "../common/common";
import { UIRouter } from "../router";
import { LocationPlugin } from "./interface";
import { isArray } from "../common/predicates";

var mlc;
export const memoryLocationConfig: LocationConfig = mlc = {
  _hashPrefix: '',
  _baseHref: '',
  _port: 80,
  _protocol: "http",
  _host: "localhost",

  port: () => mlc._port,
  protocol: () => mlc._protocol,
  host: () => mlc._host,
  baseHref: () => mlc._baseHref,
  html5Mode: () => false,
  hashPrefix: (newprefix?: string): string => {
    if (isDefined(newprefix)) {
      mlc._hashPrefix = newprefix;
    }
    return mlc._hashPrefix;
  }
};

var mls;
export const memoryLocationService: LocationServices = mls = {
  _listeners: [],
  _url: {
    path: '',
    search: {},
    hash: ''
  },
  _changed: (newval, oldval) => {
    if (newval === oldval) return;
    let evt = new Event("locationchange");
    evt['url'] = newval;
    mls._listeners.forEach(cb => cb(evt));
  },

  url: () => {
    let s = mls._url.search;
    let hash = mls._url.hash;
    let query = Object.keys(s).map(key => (isArray(s[key]) ? s[key] : [s[key]]) .map(val => key + "=" + val))
        .reduce(unnestR, [])
        .join("&");

    return mls._url.path +
        (query ? "?" + query : "") +
        (hash ? "#" + hash : "");
  },
  hash: () => mls._url.hash,
  path: () => mls._url.path,
  search: () => mls._url.search,
  setUrl: (url: string, replace: boolean = false) => {
    if (isDefined(url)) {
      let path = splitHash(splitQuery(url)[0])[0];
      let hash = splitHash(url)[1];
      let search = getParams(splitQuery(splitHash(url)[0])[1]);

      let oldval = mls.url();
      mls._url = { path, search, hash };
      let newval = mls.url();
      mls._changed(newval, oldval);
    }
  },
  onChange: (cb: EventListener) => (mls._listeners.push(cb), () => removeFrom(mls._listeners, cb))
};

export const memoryLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.memoryLocation", memoryLocationService, memoryLocationConfig);