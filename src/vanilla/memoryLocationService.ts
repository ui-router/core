/** @packageDocumentation @internalapi @module vanilla */
import { BaseLocationServices } from './baseLocationService';
import { UIRouter } from '../router';

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
