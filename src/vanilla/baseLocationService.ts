/**
 * @internalapi
 * @module vanilla
 */ /** */

import { LocationServices } from "../common/coreservices";
import { Disposable } from "../interface";
import { UIRouter } from "../router";
import { LocationLike, HistoryLike } from "./interface";
import { parseUrl, getParams, buildUrl } from "./utils";
import { isDefined } from "../common/predicates";
import { extend, deregAll, removeFrom } from "../common/common";
/** A base `LocationServices` */
export abstract class BaseLocationServices implements LocationServices, Disposable {
  constructor(router: UIRouter, public fireAfterUpdate: boolean) {
    this._location = window && window.location;
    this._history = window && window.history;
  }

  _listener = evt => this._listeners.forEach(cb => cb(evt));

  private _listeners: Function[] = [];
  _location: LocationLike;
  _history: HistoryLike;

  abstract _get(): string;
  abstract _set(state: any, title: string, url: string, replace: boolean);

  hash   = () => parseUrl(this._get()).hash;
  path   = () => parseUrl(this._get()).path;
  search = () => getParams(parseUrl(this._get()).search);

  url(url?: string, replace: boolean = true): string {
    if (isDefined(url) && url !== this._get()) {
      this._set(null, null, url, replace);

      if (this.fireAfterUpdate) {
        let evt = extend(new Event("locationchange"), { url });
        this._listeners.forEach(cb => cb(evt));
      }
    }

    return buildUrl(this);
  }

  onChange(cb: EventListener) {
    this._listeners.push(cb);
    return () => removeFrom(this._listeners, cb);
  }

  dispose(router: UIRouter) {
    deregAll(this._listeners);
  }
}
