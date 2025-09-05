import { LocationConfig } from '../common/coreservices.js';
import { isDefined } from '../common/predicates.js';
import { noop } from '../common/common.js';

/** A `LocationConfig` mock that gets/sets all config from an in-memory object */
export class MemoryLocationConfig implements LocationConfig {
  dispose = noop;

  _baseHref = '';
  _port = 80;
  _protocol = 'http';
  _host = 'localhost';
  _hashPrefix = '';

  port = () => this._port;
  protocol = () => this._protocol;
  host = () => this._host;
  baseHref = () => this._baseHref;
  html5Mode = () => false;
  hashPrefix = (newval?) => (isDefined(newval) ? (this._hashPrefix = newval) : this._hashPrefix);
}
