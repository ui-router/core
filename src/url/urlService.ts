/**
 * @coreapi
 * @module url
 */ /** */

import { UIRouter } from '../router';
import { LocationServices } from '../common/coreservices';
import { MatchResult, UrlConfigApi, UrlParts, UrlRulesApi, UrlSyncApi } from './interface';
import { UrlRules } from './urlRulesApi';
import { UrlConfig } from './urlConfigApi';

/** API for URL management */
export class UrlService implements LocationServices, UrlSyncApi {
  /**
   * A nested API for managing URL rules and rewrites
   *
   * See: [[UrlRulesApi]] for details
   */
  public rules: UrlRulesApi = new UrlRules(this.router);
  /**
   * A nested API to configure the URL and retrieve URL information
   *
   * See: [[UrlConfigApi]] for details
   */
  public config: UrlConfigApi = new UrlConfig(this.router);
  constructor(/** @hidden */ private router: UIRouter) {}

  // Delegate these calls to the current LocationServices implementation
  /** @inheritdoc */ public url = (newurl?: string, replace?: boolean, state?: any): string =>
    this.router.locationService.url(newurl, replace, state);
  /** @inheritdoc */ public path = (): string => this.router.locationService.path();
  /** @inheritdoc */ public search = (): { [key: string]: any } => this.router.locationService.search();
  /** @inheritdoc */ public hash = (): string => this.router.locationService.hash();
  /** @inheritdoc */ public onChange = (callback: Function): Function => this.router.locationService.onChange(callback);

  /**
   * Returns the current URL parts
   *
   * This method returns the current URL components as a [[UrlParts]] object.
   *
   * @returns the current url parts
   */
  public parts(): UrlParts {
    return { path: this.path(), search: this.search(), hash: this.hash() };
  }

  public dispose() {}

  // Delegate these calls to the UrlRouter
  // TODO: move impl from UrlRouter into this class
  /** @inheritdoc */ public sync = (evt?) => this.router.urlRouter.sync(evt);
  /** @inheritdoc */ public listen = (enabled?: boolean): Function => this.router.urlRouter.listen(enabled);
  /** @inheritdoc */ public deferIntercept = (defer?: boolean) => this.router.urlRouter.deferIntercept(defer);
  /** @inheritdoc */ public match = (urlParts: UrlParts): MatchResult => this.router.urlRouter.match(urlParts);
}
