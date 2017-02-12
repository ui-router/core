/**
 * @internalapi
 * @module vanilla
 */
/** */
import { isDefined } from "../common/predicates";
import { LocationConfig } from "../common/coreservices";

/** A `LocationConfig` that delegates to the browser's `location` object */
export class BrowserLocationConfig implements LocationConfig {
  private _baseHref = undefined;
  private _hashPrefix = "";

  constructor(router?, private _isHtml5 = false) { }

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
    return location.host;
  }

  html5Mode(): boolean {
    return this._isHtml5;
  }

  hashPrefix(): string;
  hashPrefix(newprefix?: string): string {
    return isDefined(newprefix) ? this._hashPrefix = newprefix : this._hashPrefix;
  };

  baseHref(href?: string): string {
    return isDefined(href) ? this._baseHref = href : this._baseHref || this.applyDocumentBaseHref();
  }

  applyDocumentBaseHref() {
    let baseTags = document.getElementsByTagName("base");
    return this._baseHref = baseTags.length ? baseTags[0].href.substr(location.origin.length) : "";
  }

  dispose() {}
}