/**
 * @internalapi
 * @module vanilla
 */
/** */
import { UIRouter } from '../router';
import { BaseLocationServices } from './baseLocationService';
import { LocationConfig, root, splitHash, splitQuery, stripLastPathElement } from '../common';

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
    root.addEventListener('popstate', this._listener, false);
  };

  /**
   * Gets the base prefix without:
   * - trailing slash
   * - trailing filename
   * - protocol and hostname
   *
   * If <base href='/base/index.html'>, this returns '/base'.
   * If <base href='http://localhost:8080/base/index.html'>, this returns '/base'.
   *
   * See: https://html.spec.whatwg.org/dev/semantics.html#the-base-element
   */
  _getBasePrefix() {
    return stripLastPathElement(this._config.baseHref());
  }

  _get() {
    let { pathname, hash, search } = this._location;
    search = splitQuery(search)[1]; // strip ? if found
    hash = splitHash(hash)[1]; // strip # if found

    const basePrefix = this._getBasePrefix();
    let exactMatch = pathname === this._config.baseHref();
    let startsWith = pathname.startsWith(basePrefix);
    pathname = exactMatch ? '/' : startsWith ? pathname.substring(basePrefix.length) : pathname;

    return pathname + (search ? '?' + search : '') + (hash ? '#' + hash : '');
  }

  _set(state: any, title: string, url: string, replace: boolean) {
    let fullUrl = this._getBasePrefix() + url;

    if (replace) {
      this._history.replaceState(state, title, fullUrl);
    } else {
      this._history.pushState(state, title, fullUrl);
    }
  }

  dispose(router: UIRouter) {
    super.dispose(router);
    root.removeEventListener('popstate', this._listener);
  }
}

