import { root, trimHashVal } from '../common/index.js';
import { UIRouter } from '../router.js';
import { BaseLocationServices } from './baseLocationService.js';

/** A `LocationServices` that uses the browser hash "#" to get/set the current location */
export class HashLocationService extends BaseLocationServices {
  constructor(router: UIRouter) {
    super(router, false);
    root.addEventListener('hashchange', this._listener, false);
  }

  _get() {
    return trimHashVal(this._location.hash);
  }
  _set(state: any, title: string, url: string, replace: boolean) {
    this._location.hash = url;
  }

  dispose(router: UIRouter) {
    super.dispose(router);
    root.removeEventListener('hashchange', this._listener);
  }
}
