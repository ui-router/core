/**
 * This module is a stub for core services such as Dependency Injection or Browser Location.
 * Core services may be implemented by a specific framework, such as ng1 or ng2, or be pure javascript.
 *
 * @module common
 */
/** for typedoc */
import {IInjectable, Obj} from "./common";
import { Disposable } from "../interface";
import { UrlParts } from "../url/interface";

export let notImplemented = (fnname: string) => () => {
  throw new Error(`${fnname}(): No coreservices implementation for UI-Router is loaded.`);
};

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

export interface LocationServices extends Disposable {
  /**
   * Gets the current url string
   *
   * The URL is normalized using the internal [[path]]/[[search]]/[[hash]] values.
   *
   * For example, the URL may be stored in the hash ([[HashLocationServices]]) or
   * have a base HREF prepended ([[PushStateLocationServices]]).
   *
   * The raw URL in the browser might be:
   *
   * ```
   * http://mysite.com/somepath/index.html#/internal/path/123?param1=foo#anchor
   * ```
   *
   * or
   *
   * ```
   * http://mysite.com/basepath/internal/path/123?param1=foo#anchor
   * ```
   *
   * then this method returns:
   *
   * ```
   * /internal/path/123?param1=foo#anchor
   * ```
   *
   *
   * #### Example:
   * ```js
   * locationServices.url(); // "/some/path?query=value#anchor"
   * ```
   *
   * @returns the current value of the url, as a string.
   */
  url(): string;

  /**
   * Updates the url, or gets the current url
   *
   * Updates the url, changing it to the value in `newurl`
   *
   * #### Example:
   * ```js
   * locationServices.url("/some/path?query=value#anchor", true);
   * ```
   *
   * @param newurl The new value for the URL.
   *               This url should reflect only the new internal [[path]], [[search]], and [[hash]] values.
   *               It should not include the protocol, site, port, or base path of an absolute HREF.
   * @param replace When true, replaces the current history entry (instead of appending it) with this new url
   * @param state The history's state object, i.e., pushState (if the LocationServices implementation supports it)
   * @return the url (after potentially being processed)
   */
  url(newurl: string, replace?: boolean, state?: any): string;

  /**
   * Gets the path part of the current url
   *
   * If the current URL is `/some/path?query=value#anchor`, this returns `/some/path`
   *
   * @return the path portion of the url
   */
  path(): string;

  /**
   * Gets the search part of the current url as an object
   *
   * If the current URL is `/some/path?query=value#anchor`, this returns `{ query: 'value' }`
   *
   * @return the search (querystring) portion of the url, as an object
   */
  search(): { [key: string]: any };

  /**
   * Gets the hash part of the current url
   *
   * If the current URL is `/some/path?query=value#anchor`, this returns `anchor`
   *
   * @return the hash (anchor) portion of the url
   */
  hash(): string;

  /**
   * Registers a url change handler
   *
   * #### Example:
   * ```js
   * let deregisterFn = locationServices.onChange((evt) => console.log("url change", evt));
   * ```
   *
   * @param callback a function that will be called when the url is changing
   * @return a function that de-registers the callback
   */
  onChange(callback: Function): Function;
}

/**
 * This service returns the location configuration
 *
 * This service returns information about the location configuration.
 * This service is primarily used when building URLs (e.g., for `hrefs`)
 */
export interface LocationConfig extends Disposable {
  /**
   * Gets the port, e.g., `80`
   *
   * @return the port number
   */
  port(): number;
  /**
   * Gets the protocol, e.g., `http`
   *
   * @return the protocol
   */
  protocol(): string;
  /**
   * Gets the host, e.g., `localhost`
   *
   * @return the protocol
   */
  host(): string;
  /**
   * Gets the base Href, e.g., `http://localhost/approot/`
   *
   * @return the application's base href
   */
  baseHref(): string;
  /**
   * Returns true when running in pushstate mode
   *
   * @return true when running in pushstate mode
   */
  html5Mode(): boolean;
  /**
   * Gets the hashPrefix (when not running in pushstate mode)
   *
   * If the current url is `http://localhost/app#!/uirouter/path/#anchor`, it returns `!` which is the prefix for the "hashbang" portion.
   *
   * @return the hash prefix
   */
  hashPrefix(): string;
  /**
   * Sets the hashPrefix (when not running in pushstate mode)
   *
   * @return the new hash prefix
   */
  hashPrefix(newprefix: string): string;
}

export {services};
