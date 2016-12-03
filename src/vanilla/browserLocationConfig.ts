/** @internalapi @module vanilla */ /** */

import { isDefined } from "../common/predicates";
import { LocationConfig } from "../common/coreservices";

/** A `LocationConfig` that delegates to the browser's `location` object */
export class BrowserLocationConfig implements LocationConfig {
  private _baseHref = undefined;

  port() {
    return parseInt(location.port);
  }

  protocol () {
    return location.protocol;
  }

  host() {
    return location.host;
  }

  baseHref(href?: string) {
    return isDefined(href) ? this._baseHref = href : this._baseHref || this.applyDocumentBaseHref();
  }

  applyDocumentBaseHref() {
    let baseTags = document.getElementsByTagName("base");
    return this._baseHref = baseTags.length ? baseTags[0].href.substr(location.origin.length) : "";
  }
}