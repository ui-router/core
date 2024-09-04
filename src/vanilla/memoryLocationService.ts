import { BaseLocationServices } from './baseLocationService.js';
import { UIRouter } from '../router.js';

/** A `LocationServices` that gets/sets the current location from an in-memory object */
export class MemoryLocationService extends BaseLocationServices {
  _url: string;

  constructor(router: UIRouter) {
    super(router, true);
  }

  _get() {
    return this._url;
  }

  _set(state: any, title: string, url: string, replace: boolean) {
    this._url = url;
  }
}
