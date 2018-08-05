import { UrlConfigApi } from './interface';
import { Disposable } from '../interface';
import { UIRouter } from '../router';
import { ParamType, ParamTypeDefinition } from '../params';

export class UrlConfig implements UrlConfigApi, Disposable {
  constructor(private router: UIRouter) {}

  public dispose(router?: UIRouter) {}

  // Delegate these calls to the current LocationConfig implementation
  /** @inheritDoc */ public baseHref = (): string => this.router.locationConfig.baseHref();
  /** @inheritDoc */ public hashPrefix = (newprefix?: string): string =>
    this.router.locationConfig.hashPrefix(newprefix);
  /** @inheritDoc */ public host = (): string => this.router.locationConfig.host();
  /** @inheritDoc */ public html5Mode = (): boolean => this.router.locationConfig.html5Mode();
  /** @inheritDoc */ public port = (): number => this.router.locationConfig.port();
  /** @inheritDoc */ public protocol = (): string => this.router.locationConfig.protocol();

  // Delegate these calls to the UrlMatcherFactory
  /** @inheritDoc */ public caseInsensitive = (value?: boolean): boolean =>
    this.router.urlMatcherFactory.caseInsensitive(value);
  /** @inheritDoc */ public defaultSquashPolicy = (value?: boolean | string): boolean | string =>
    this.router.urlMatcherFactory.defaultSquashPolicy(value);
  /** @inheritDoc */ public strictMode = (value?: boolean): boolean => this.router.urlMatcherFactory.strictMode(value);
  /** @inheritDoc */ public type = (name: string, type?: ParamTypeDefinition): ParamType =>
    this.router.urlMatcherFactory.type(name, type);
}
