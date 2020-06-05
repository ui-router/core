import { isDefined, isUndefined } from '../common/predicates';
import { LocationConfig } from '../common/coreservices';

/** A `LocationConfig` that delegates to the browser's `location` object */
export class BrowserLocationConfig implements LocationConfig {
  private _baseHref = undefined;
  private _hashPrefix = '';

  constructor(router?, private _isHtml5 = false) {}

  port(): number {
    if (location.port) {
      return Number(location.port);
    }

    return this.protocol() === 'https' ? 443 : 80;
  }

  protocol(): string {
    return location.protocol.replace(/:/g, '');
  }

  host(): string {
    return location.hostname;
  }

  html5Mode(): boolean {
    return this._isHtml5;
  }

  hashPrefix(): string;
  hashPrefix(newprefix?: string): string {
    return isDefined(newprefix) ? (this._hashPrefix = newprefix) : this._hashPrefix;
  }

  baseHref(href?: string): string {
    if (isDefined(href)) this._baseHref = href;
    if (isUndefined(this._baseHref)) this._baseHref = this.getBaseHref();
    return this._baseHref;
  }

  private getBaseHref() {
    const baseTag: HTMLBaseElement = document.getElementsByTagName('base')[0];
    if (baseTag && baseTag.href) {
      return baseTag.href.replace(/^([^/:]*:)?\/\/[^/]*/, '');
    }

    return this._isHtml5 ? '/' : location.pathname || '/';
  }

  dispose() {}
}
