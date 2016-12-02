/**
 * Core classes and interfaces
 *
 * The classes and interfaces that are core to ui-router and do not belong
 * to a more specific subsystem (such as resolve).
 *
 * @coreapi
 * @preferred
 * @module core
 */ /** for typedoc */

// Need to import or export at least one concrete something
import {noop} from "./common/common";
import {UIRouter} from "./router";

/**
 * An interface for getting values from dependency injection.
 *
 * This injector primarily returns resolve values (using a [[ResolveContext]]) that match the given token.
 * If no resolve is found for a token, then it will delegate to the native injector.
 * The native injector may be Angular 1 `$injector`, Angular 2 `Injector`, or a naive polyfill.
 *
 * In Angular 2, the native injector might be the root Injector,
 * or it might be a lazy loaded `NgModule` injector scoped to a lazy load state tree.
 */
export interface UIInjector {
  /**
   * Gets a value from the injector
   *
   * #### ng1 Example:
   * ```js
   * injector.get('$state').go('home');
   * ```
   *
   * #### ng2 Example:
   * ```js
   * import {StateService} from "ui-router-ng2";
   * injector.get(StateService).go('home');
   * ```
   *
   * @param token the key for the value to get.  May be a string or arbitrary object.
   * @return the Dependency Injection value that matches the token
   */
  get(token: any): any;
  get<T>(token: any): T;

  /**
   * Asynchronously gets a value from the injector
   *
   * If the [[ResolveContext]] has a [[Resolvable]] matching the token, it will be
   * asynchronously resolved.
   *
   * Returns a promise for a value from the injector.
   * Returns resolve values and/or values from the native injector (ng1/ng2).
   *
   * #### Example:
   * ```js
   * return injector.getAsync('myResolve').then(value => {
   *   if (value === 'declined') return false;
   * });
   * ```
   *
   * @param token the key for the value to get.  May be a string or arbitrary object.
   * @return a Promise for the Dependency Injection value that matches the token
   */
  getAsync(token: any): Promise<any>;
  getAsync<T>(token: any): Promise<T>;

  /**
   * Gets a value from the native injector
   *
   * Returns a value from the native injector, bypassing anything in the [[ResolveContext]].
   *
   * Example:
   * ```js
   * let someThing = injector.getNative(SomeToken);
   * ```
   *
   * @param token the key for the value to get.  May be a string or arbitrary object.
   * @return the Dependency Injection value that matches the token
   */
  getNative(token: any): any;
  getNative<T>(token: any): T;
}

export interface UIRouterPlugin extends Disposable {
  name: string;
}

export abstract class UIRouterPluginBase implements UIRouterPlugin {
  abstract name: string;
  dispose(router: UIRouter) { }
}

export interface Disposable {
  dispose(router?: UIRouter);
}