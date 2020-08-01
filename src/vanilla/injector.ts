import {
  extend,
  assertPredicate,
  isFunction,
  isArray,
  isInjectable,
  $InjectorLike,
  IInjectable,
} from '../common/index';

// globally available injectables
const globals = {};
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
const ARGUMENT_NAMES = /([^\s,]+)/g;

/**
 * A basic angular1-like injector api
 *
 * This object implements four methods similar to the
 * [angular 1 dependency injector](https://docs.angularjs.org/api/auto/service/$injector)
 *
 * UI-Router evolved from an angular 1 library to a framework agnostic library.
 * However, some of the `@uirouter/core` code uses these ng1 style APIs to support ng1 style dependency injection.
 *
 * This object provides a naive implementation of a globally scoped dependency injection system.
 * It supports the following DI approaches:
 *
 * ### Function parameter names
 *
 * A function's `.toString()` is called, and the parameter names are parsed.
 * This only works when the parameter names aren't "mangled" by a minifier such as UglifyJS.
 *
 * ```js
 * function injectedFunction(FooService, BarService) {
 *   // FooService and BarService are injected
 * }
 * ```
 *
 * ### Function annotation
 *
 * A function may be annotated with an array of dependency names as the `$inject` property.
 *
 * ```js
 * injectedFunction.$inject = [ 'FooService', 'BarService' ];
 * function injectedFunction(fs, bs) {
 *   // FooService and BarService are injected as fs and bs parameters
 * }
 * ```
 *
 * ### Array notation
 *
 * An array provides the names of the dependencies to inject (as strings).
 * The function is the last element of the array.
 *
 * ```js
 * [ 'FooService', 'BarService', function (fs, bs) {
 *   // FooService and BarService are injected as fs and bs parameters
 * }]
 * ```
 *
 * @type {$InjectorLike}
 */
export const $injector = {
  /** Gets an object from DI based on a string token */
  get: (name) => globals[name],

  /** Returns true if an object named `name` exists in global DI */
  has: (name) => $injector.get(name) != null,

  /**
   * Injects a function
   *
   * @param fn the function to inject
   * @param context the function's `this` binding
   * @param locals An object with additional DI tokens and values, such as `{ someToken: { foo: 1 } }`
   */
  invoke: (fn: IInjectable, context?, locals?) => {
    const all = extend({}, globals, locals || {});
    const params = $injector.annotate(fn);
    const ensureExist = assertPredicate(
      (key: string) => all.hasOwnProperty(key),
      (key) => `DI can't find injectable: '${key}'`
    );
    const args = params.filter(ensureExist).map((x) => all[x]);
    if (isFunction(fn)) return fn.apply(context, args);
    else return (fn as any[]).slice(-1)[0].apply(context, args);
  },

  /**
   * Returns a function's dependencies
   *
   * Analyzes a function (or array) and returns an array of DI tokens that the function requires.
   * @return an array of `string`s
   */
  annotate: (fn: IInjectable): any[] => {
    if (!isInjectable(fn)) throw new Error(`Not an injectable function: ${fn}`);
    if (fn && (fn as any).$inject) return (fn as any).$inject;
    if (isArray(fn)) return fn.slice(0, -1);
    const fnStr = fn.toString().replace(STRIP_COMMENTS, '');
    const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
    return result || [];
  },
} as $InjectorLike;
