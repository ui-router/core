/**
 * This module is a stub for core services such as Dependency Injection or Browser Location.
 * Core services may be implemented by a specific framework, such as ng1 or ng2, or be pure javascript.
 *
 * @packageDocumentation
 */
import { IInjectable, Obj } from './common';
import { Disposable } from '../interface';
import { UrlConfig, UrlService } from '../url';

const noImpl = (fnname: string) => () => {
  throw new Error(`No implementation for ${fnname}. The framework specific code did not implement this method.`);
};

export const makeStub = <T>(service: string, methods: (keyof T)[]): T =>
  methods.reduce((acc, key) => ((acc[key] = noImpl(`${service}.${key}()`) as any), acc), {} as T);

const services: CoreServices = {
  $q: undefined,
  $injector: undefined,
};

export interface $QLikeDeferred {
  resolve: (val?: any) => void;
  reject: (reason?: any) => void;
  promise: Promise<any>;
}

export interface $QLike {
  when<T>(value?: T | PromiseLike<T>): Promise<T>;
  reject<T>(reason: any): Promise<T>;
  defer(): $QLikeDeferred;
  all(promises: { [key: string]: Promise<any> }): Promise<any>;
  all(promises: Promise<any>[]): Promise<any[]>;
}

export interface $InjectorLike {
  strictDi?: boolean;
  get(token: any): any;
  get<T>(token: any): T;
  has(token: any): boolean;
  invoke(fn: IInjectable, context?: any, locals?: Obj): any;
  annotate(fn: IInjectable, strictDi?: boolean): any[];
}

export interface CoreServices {
  $q: $QLike;
  $injector: $InjectorLike;
}

/**
 * Handles low level URL read/write
 *
 * This service handles low level reads and updates of the URL and listens for url changes.
 * Implementors should pass these through to the underlying URL mechanism.
 * The underlying URL mechanism might be browser APIs, framework APIs, or some 3rd party URL management library.
 *
 * UI-Router Core includes three basic implementations:
 *
 * - [[PushStateLocationService]]
 * - [[HashLocationService]]
 * - [[MemoryLocationService]]
 */
export interface LocationServices extends Disposable {
  /** See: [[UrlService.url]] */ url: UrlService['url'];
  /** See: [[UrlService.path]] */ path: UrlService['path'];
  /** See: [[UrlService.search]] */ search: UrlService['search'];
  /** See: [[UrlService.hash]] */ hash: UrlService['hash'];
  /** See: [[UrlService.onChange]] */ onChange: UrlService['onChange'];
}

/**
 * Returns low level URL configuration and metadata
 *
 * This service returns information about the location configuration.
 * This service is primarily used when building URLs (e.g., for `hrefs`)
 *
 * Implementors should pass these through to the underlying URL APIs.
 * The underlying URL mechanism might be browser APIs, framework APIs, or some 3rd party URL management library.
 *
 * UI-Router Core includes two basic implementations:
 *
 * - [[BrowserLocationConfig]]
 * - [[MemoryLocationConfig]]
 */
export interface LocationConfig extends Disposable {
  /** See: [[UrlConfig.port]] */ port: UrlConfig['port'];
  /** See: [[UrlConfig.protocol]] */ protocol: UrlConfig['protocol'];
  /** See: [[UrlConfig.host]] */ host: UrlConfig['host'];
  /** See: [[UrlConfig.baseHref]] */ baseHref: UrlConfig['baseHref'];
  /** See: [[UrlConfig.html5Mode]] */ html5Mode: UrlConfig['html5Mode'];
  /** See: [[UrlConfig.hashPrefix]] */ hashPrefix: UrlConfig['hashPrefix'];
}

export { services };
