/** @internalapi @module vanilla */ /** */
import { deregAll, isDefined, LocationServices, removeFrom, root } from '../common';
import { Disposable } from '../interface';
import { UIRouter } from '../router';
import { HistoryLike, LocationLike } from './interface';
import { buildUrl, getParams, parseUrl } from './utils';

/** A base `LocationServices` */
export abstract class BaseLocationServices implements LocationServices, Disposable {
  private _listeners: Function[] = [];
  _location: LocationLike;
  _history: HistoryLike;

  _listener = evt => this._listeners.forEach(cb => cb(evt));

  constructor(router: UIRouter, public fireAfterUpdate: boolean) {
    this._location = root.location;
    this._history = root.history;
  }

  /**
   * This should return the current internal URL representation.
   *
   * The internal URL includes only the portion that UI-Router matches.
   * It does not include:
   * - protocol
   * - server
   * - port
   * - base href or hash
   */
  protected abstract _get(): string;

  /**
   * This should set the current URL.
   *
   * The `url` param should include only the portion that UI-Router matches on.
   * It should not include:
   * - protocol
   * - server
   * - port
   * - base href or hash
   *
   * However, after this function completes, the browser URL should reflect the entire (fully qualified)
   * HREF including those data.
   */
  protected abstract _set(state: any, title: string, url: string, replace: boolean);

  hash = () => parseUrl(this._get()).hash;
  path = () => parseUrl(this._get()).path;
  search = () => getParams(parseUrl(this._get()).search);

  url(url?: string, replace = true): string {
    if (isDefined(url) && url !== this._get()) {
      this._set(null, null, url, replace);

      if (this.fireAfterUpdate) {
        this._listeners.forEach(cb => cb({ url }));
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
