/** @internalapi @module vanilla */ /** */
import { LocationConfig, LocationServices, root, trimHashVal } from '../../common';
import { UIRouter } from '../../router';
import { UrlPlugin } from '../../url';
import { BaseLocationServices } from '../locationServices/baseLocationService';
import { BrowserLocationConfig } from '../locatonConfig/browserLocationConfig';
import { HashLocationService } from '../locationServices/hashLocationService';

/** A base `UrlPlugin` that delegates to the provided config and services object */
export class BaseUrlPlugin implements UrlPlugin {
  constructor(router: UIRouter, public name: string, private cfg: LocationConfig, private svc: LocationServices) {}

  dispose(router: UIRouter) {
    this.cfg.dispose(router);
    this.svc.dispose(router);
  }

  baseHref = () => this.cfg.baseHref();
  hashPrefix = (newprefix?: string) => this.cfg.hashPrefix(newprefix);
  host = () => this.cfg.host();
  html5Mode = () => this.cfg.html5Mode();
  port = () => this.cfg.port();
  protocol = () => this.cfg.protocol();

  hash = () => this.svc.hash();
  onChange = (callback: EventListener) => this.svc.onChange(callback);
  path = () => this.svc.path();
  search = () => this.svc.search();
  url = (newurl?: string, replace?: boolean, state?: any) => this.svc.url(newurl, replace, state);
}
