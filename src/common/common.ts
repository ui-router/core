/**
 * Random utility functions used in the UI-Router code
 *
 * These functions are exported, but are subject to change without notice.
 *
 * @preferred
 * @module common
 */
/** for typedoc */
import { isFunction, isString, isArray, isRegExp, isDate } from './predicates';
import { all, any, prop, curry, not } from './hof';
import { services } from './coreservices';
import { StateObject } from '../state/stateObject';

declare const global;
export const root: any =
  (typeof self === 'object' && self.self === self && self) ||
  (typeof global === 'object' && global.global === global && global) ||
  this;
const angular = root.angular || {};

export const fromJson = angular.fromJson || JSON.parse.bind(JSON);
export const toJson = angular.toJson || JSON.stringify.bind(JSON);
export const forEach = angular.forEach || _forEach;
export const extend = Object.assign || _extend;
export const equals = angular.equals || _equals;
export function identity(x: any) {
  return x;
}
export function noop(): any {}

export type Mapper<X, T> = (x: X, key?: string | number) => T;
export interface TypedMap<T> {
  [key: string]: T;
}
export type Predicate<X> = (x?: X) => boolean;
/**
 * An ng1-style injectable
 *
 * This could be a (non-minified) function such as:
 * ```js
 * function injectableFunction(SomeDependency) {
 *
 * }
 * ```
 *
 * or an explicitly annotated function (minify safe)
 * ```js
 * injectableFunction.$inject = [ 'SomeDependency' ];
 * function injectableFunction(SomeDependency) {
 *
 * }
 * ```
 *
 * or an array style annotated function (minify safe)
 * ```js
 * ['SomeDependency', function injectableFunction(SomeDependency) {
 *
 * }];
 * ```
 *
 * @publicapi
 */
export type IInjectable = Function | any[];

export interface Obj extends Object {
  [key: string]: any;
}

/**
 * Builds proxy functions on the `to` object which pass through to the `from` object.
 *
 * For each key in `fnNames`, creates a proxy function on the `to` object.
 * The proxy function calls the real function on the `from` object.
 *
 *
 * #### Example:
 * This example creates an new class instance whose functions are prebound to the new'd object.
 * ```js
 * class Foo {
 *   constructor(data) {
 *     // Binds all functions from Foo.prototype to 'this',
 *     // then copies them to 'this'
 *     bindFunctions(Foo.prototype, this, this);
 *     this.data = data;
 *   }
 *
 *   log() {
 *     console.log(this.data);
 *   }
 * }
 *
 * let myFoo = new Foo([1,2,3]);
 * var logit = myFoo.log;
 * logit(); // logs [1, 2, 3] from the myFoo 'this' instance
 * ```
 *
 * #### Example:
 * This example creates a bound version of a service function, and copies it to another object
 * ```
 *
 * var SomeService = {
 *   this.data = [3, 4, 5];
 *   this.log = function() {
 *     console.log(this.data);
 *   }
 * }
 *
 * // Constructor fn
 * function OtherThing() {
 *   // Binds all functions from SomeService to SomeService,
 *   // then copies them to 'this'
 *   bindFunctions(SomeService, this, SomeService);
 * }
 *
 * let myOtherThing = new OtherThing();
 * myOtherThing.log(); // logs [3, 4, 5] from SomeService's 'this'
 * ```
 *
 * @param source A function that returns the source object which contains the original functions to be bound
 * @param target A function that returns the target object which will receive the bound functions
 * @param bind A function that returns the object which the functions will be bound to
 * @param fnNames The function names which will be bound (Defaults to all the functions found on the 'from' object)
 * @param latebind If true, the binding of the function is delayed until the first time it's invoked
 */
export function createProxyFunctions(
  source: Function,
  target: Obj,
  bind: Function,
  fnNames?: string[],
  latebind = false,
): Obj {
  const bindFunction = fnName => source()[fnName].bind(bind());

  const makeLateRebindFn = fnName =>
    function lateRebindFunction() {
      target[fnName] = bindFunction(fnName);
      return target[fnName].apply(null, arguments);
    };

  fnNames = fnNames || Object.keys(source());

  return fnNames.reduce((acc, name) => {
    acc[name] = latebind ? makeLateRebindFn(name) : bindFunction(name);
    return acc;
  }, target);
}

/**
 * prototypal inheritance helper.
 * Creates a new object which has `parent` object as its prototype, and then copies the properties from `extra` onto it
 */
export const inherit = (parent: Obj, extra?: Obj) => extend(Object.create(parent), extra);

/** Given an array, returns true if the object is found in the array, (using indexOf) */
export const inArray: typeof _inArray = curry(_inArray) as any;
export function _inArray(array: any[], obj: any): boolean;
export function _inArray(array: any[]): (obj: any) => boolean;
export function _inArray(array, obj?): any {
  return array.indexOf(obj) !== -1;
}

/**
 * Given an array, and an item, if the item is found in the array, it removes it (in-place).
 * The same array is returned
 */
export const removeFrom: typeof _removeFrom = curry(_removeFrom) as any;
export function _removeFrom<T>(array: T[], obj: T): T[];
export function _removeFrom<T>(array: T[]): (obj: T) => T[];
export function _removeFrom(array, obj?) {
  const idx = array.indexOf(obj);
  if (idx >= 0) array.splice(idx, 1);
  return array;
}

/** pushes a values to an array and returns the value */
export const pushTo: typeof _pushTo = curry(_pushTo) as any;
export function _pushTo<T>(arr: T[], val: T): T;
export function _pushTo<T>(arr: T[]): (val: T) => T;
export function _pushTo(arr, val?): any {
  return arr.push(val), val;
}

/** Given an array of (deregistration) functions, calls all functions and removes each one from the source array */
export const deregAll = (functions: Function[]) =>
  functions.slice().forEach(fn => {
    typeof fn === 'function' && fn();
    removeFrom(functions, fn);
  });
/**
 * Applies a set of defaults to an options object.  The options object is filtered
 * to only those properties of the objects in the defaultsList.
 * Earlier objects in the defaultsList take precedence when applying defaults.
 */
export function defaults(opts, ...defaultsList: Obj[]) {
  const _defaultsList = defaultsList.concat({}).reverse();
  const defaultVals = extend.apply(null, _defaultsList);
  return extend({}, defaultVals, pick(opts || {}, Object.keys(defaultVals)));
}

/** Reduce function that merges each element of the list into a single object, using extend */
export const mergeR = (memo: Obj, item: Obj) => extend(memo, item);

/**
 * Finds the common ancestor path between two states.
 *
 * @param {Object} first The first state.
 * @param {Object} second The second state.
 * @return {Array} Returns an array of state names in descending order, not including the root.
 */
export function ancestors(first: StateObject, second: StateObject) {
  const path: StateObject[] = [];

  // tslint:disable-next-line:forin
  for (const n in first.path) {
    if (first.path[n] !== second.path[n]) break;
    path.push(first.path[n]);
  }
  return path;
}

/**
 * Return a copy of the object only containing the whitelisted properties.
 *
 * #### Example:
 * ```
 * var foo = { a: 1, b: 2, c: 3 };
 * var ab = pick(foo, ['a', 'b']); // { a: 1, b: 2 }
 * ```
 * @param obj the source object
 * @param propNames an Array of strings, which are the whitelisted property names
 */
export function pick(obj: Obj, propNames: string[]): Obj {
  const objCopy = {};
  for (const _prop in obj) {
    if (propNames.indexOf(_prop) !== -1) {
      objCopy[_prop] = obj[_prop];
    }
  }
  return objCopy;
}

/**
 * Return a copy of the object omitting the blacklisted properties.
 *
 * @example
 * ```
 *
 * var foo = { a: 1, b: 2, c: 3 };
 * var ab = omit(foo, ['a', 'b']); // { c: 3 }
 * ```
 * @param obj the source object
 * @param propNames an Array of strings, which are the blacklisted property names
 */
export function omit(obj: Obj, propNames: string[]): Obj {
  return Object.keys(obj)
    .filter(not(inArray(propNames)))
    .reduce((acc, key) => ((acc[key] = obj[key]), acc), {});
}

/** Given an array of objects, maps each element to a named property of the element. */
export function pluck<T>(collection: Obj[], propName: string): T[];
/** Given an object, maps each property of the object to a named property of the property. */
export function pluck(collection: { [key: string]: any }, propName: string): { [key: string]: any };
/**
 * Maps an array, or object to a property (by name)
 */
export function pluck(collection: any, propName: string): any {
  return map(collection, <Mapper<any, string>>prop(propName));
}

/** Given an array of objects, returns a new array containing only the elements which passed the callback predicate */
export function filter<T>(collection: T[], callback: (t: T, key?: number) => boolean): T[];
/** Given an object, returns a new object with only those properties that passed the callback predicate */
export function filter<T>(collection: TypedMap<T>, callback: (t: T, key?: string) => boolean): TypedMap<T>;
/** Filters an Array or an Object's properties based on a predicate */
export function filter<T>(collection: any, callback: Function): T {
  const arr = isArray(collection),
    result: any = arr ? [] : {};
  const accept = arr ? x => result.push(x) : (x, key) => (result[key] = x);
  forEach(collection, function(item, i) {
    if (callback(item, i)) accept(item, i);
  });
  return <T>result;
}

/** Given an object, return the first property of that object which passed the callback predicate */
export function find<T>(collection: TypedMap<T>, callback: Predicate<T>): T;
/** Given an array of objects, returns the first object which passed the callback predicate */
export function find<T>(collection: T[], callback: Predicate<T>): T;
/** Finds an object from an array, or a property of an object, that matches a predicate */
export function find(collection: any, callback: any) {
  let result;

  forEach(collection, function(item, i) {
    if (result) return;
    if (callback(item, i)) result = item;
  });

  return result;
}

/** Given an object, returns a new object, where each property is transformed by the callback function */
export let mapObj: <T, U>(
  collection: { [key: string]: T },
  callback: Mapper<T, U>,
  target?: typeof collection,
) => { [key: string]: U } = map;
/** Given an array, returns a new array, where each element is transformed by the callback function */
export function map<T, U>(collection: T[], callback: Mapper<T, U>, target?: typeof collection): U[];
export function map<T, U>(
  collection: { [key: string]: T },
  callback: Mapper<T, U>,
  target?: typeof collection,
): { [key: string]: U };
/** Maps an array or object properties using a callback function */
export function map(collection: any, callback: any, target: typeof collection): any {
  target = target || (isArray(collection) ? [] : {});
  forEach(collection, (item, i) => (target[i] = callback(item, i)));
  return target;
}

/**
 * Given an object, return its enumerable property values
 *
 * @example
 * ```
 *
 * let foo = { a: 1, b: 2, c: 3 }
 * let vals = values(foo); // [ 1, 2, 3 ]
 * ```
 */
export const values: (<T>(obj: TypedMap<T>) => T[]) = (obj: Obj) => Object.keys(obj).map(key => obj[key]);

/**
 * Reduce function that returns true if all of the values are truthy.
 *
 * @example
 * ```
 *
 * let vals = [ 1, true, {}, "hello world"];
 * vals.reduce(allTrueR, true); // true
 *
 * vals.push(0);
 * vals.reduce(allTrueR, true); // false
 * ```
 */
export const allTrueR = (memo: boolean, elem: any) => memo && elem;

/**
 * Reduce function that returns true if any of the values are truthy.
 *
 *  * @example
 * ```
 *
 * let vals = [ 0, null, undefined ];
 * vals.reduce(anyTrueR, true); // false
 *
 * vals.push("hello world");
 * vals.reduce(anyTrueR, true); // true
 * ```
 */
export const anyTrueR = (memo: boolean, elem: any) => memo || elem;

/**
 * Reduce function which un-nests a single level of arrays
 * @example
 * ```
 *
 * let input = [ [ "a", "b" ], [ "c", "d" ], [ [ "double", "nested" ] ] ];
 * input.reduce(unnestR, []) // [ "a", "b", "c", "d", [ "double, "nested" ] ]
 * ```
 */
export const unnestR = (memo: any[], elem: any[]) => memo.concat(elem);

/**
 * Reduce function which recursively un-nests all arrays
 *
 * @example
 * ```
 *
 * let input = [ [ "a", "b" ], [ "c", "d" ], [ [ "double", "nested" ] ] ];
 * input.reduce(unnestR, []) // [ "a", "b", "c", "d", "double, "nested" ]
 * ```
 */
export const flattenR = (memo: any[], elem: any) =>
  isArray(elem) ? memo.concat(elem.reduce(flattenR, [])) : pushR(memo, elem);

/**
 * Reduce function that pushes an object to an array, then returns the array.
 * Mostly just for [[flattenR]] and [[uniqR]]
 */
export function pushR(arr: any[], obj: any) {
  arr.push(obj);
  return arr;
}

/** Reduce function that filters out duplicates */
export const uniqR = <T>(acc: T[], token: T): T[] => (inArray(acc, token) ? acc : pushR(acc, token));

/**
 * Return a new array with a single level of arrays unnested.
 *
 * @example
 * ```
 *
 * let input = [ [ "a", "b" ], [ "c", "d" ], [ [ "double", "nested" ] ] ];
 * unnest(input) // [ "a", "b", "c", "d", [ "double, "nested" ] ]
 * ```
 */
export const unnest = (arr: any[]) => arr.reduce(unnestR, []);
/**
 * Return a completely flattened version of an array.
 *
 * @example
 * ```
 *
 * let input = [ [ "a", "b" ], [ "c", "d" ], [ [ "double", "nested" ] ] ];
 * flatten(input) // [ "a", "b", "c", "d", "double, "nested" ]
 * ```
 */
export const flatten = (arr: any[]) => arr.reduce(flattenR, []);

/**
 * Given a .filter Predicate, builds a .filter Predicate which throws an error if any elements do not pass.
 * @example
 * ```
 *
 * let isNumber = (obj) => typeof(obj) === 'number';
 * let allNumbers = [ 1, 2, 3, 4, 5 ];
 * allNumbers.filter(assertPredicate(isNumber)); //OK
 *
 * let oneString = [ 1, 2, 3, 4, "5" ];
 * oneString.filter(assertPredicate(isNumber, "Not all numbers")); // throws Error(""Not all numbers"");
 * ```
 */
export const assertPredicate: <T>(predicate: Predicate<T>, errMsg: string | Function) => Predicate<T> = assertFn;
/**
 * Given a .map function, builds a .map function which throws an error if any mapped elements do not pass a truthyness test.
 * @example
 * ```
 *
 * var data = { foo: 1, bar: 2 };
 *
 * let keys = [ 'foo', 'bar' ]
 * let values = keys.map(assertMap(key => data[key], "Key not found"));
 * // values is [1, 2]
 *
 * let keys = [ 'foo', 'bar', 'baz' ]
 * let values = keys.map(assertMap(key => data[key], "Key not found"));
 * // throws Error("Key not found")
 * ```
 */
export const assertMap: <T, U>(mapFn: (t: T) => U, errMsg: string | Function) => (t: T) => U = assertFn;
export function assertFn(predicateOrMap: Function, errMsg: string | Function = 'assert failure'): any {
  return obj => {
    const result = predicateOrMap(obj);
    if (!result) {
      throw new Error(isFunction(errMsg) ? (<Function>errMsg)(obj) : errMsg);
    }
    return result;
  };
}

/**
 * Like _.pairs: Given an object, returns an array of key/value pairs
 *
 * @example
 * ```
 *
 * pairs({ foo: "FOO", bar: "BAR }) // [ [ "foo", "FOO" ], [ "bar": "BAR" ] ]
 * ```
 */
export const pairs = (obj: Obj) => Object.keys(obj).map(key => [key, obj[key]]);

/**
 * Given two or more parallel arrays, returns an array of tuples where
 * each tuple is composed of [ a[i], b[i], ... z[i] ]
 *
 * @example
 * ```
 *
 * let foo = [ 0, 2, 4, 6 ];
 * let bar = [ 1, 3, 5, 7 ];
 * let baz = [ 10, 30, 50, 70 ];
 * arrayTuples(foo, bar);       // [ [0, 1], [2, 3], [4, 5], [6, 7] ]
 * arrayTuples(foo, bar, baz);  // [ [0, 1, 10], [2, 3, 30], [4, 5, 50], [6, 7, 70] ]
 * ```
 */
export function arrayTuples(...args: any[]): any[] {
  if (args.length === 0) return [];
  const maxArrayLen = args.reduce((min, arr) => Math.min(arr.length, min), 9007199254740991); // aka 2^53 − 1 aka Number.MAX_SAFE_INTEGER
  const result = [];

  for (let i = 0; i < maxArrayLen; i++) {
    // This is a hot function
    // Unroll when there are 1-4 arguments
    switch (args.length) {
      case 1:
        result.push([args[0][i]]);
        break;
      case 2:
        result.push([args[0][i], args[1][i]]);
        break;
      case 3:
        result.push([args[0][i], args[1][i], args[2][i]]);
        break;
      case 4:
        result.push([args[0][i], args[1][i], args[2][i], args[3][i]]);
        break;
      default:
        result.push(args.map(array => array[i]));
        break;
    }
  }

  return result;
}

/**
 * Reduce function which builds an object from an array of [key, value] pairs.
 *
 * Each iteration sets the key/val pair on the memo object, then returns the memo for the next iteration.
 *
 * Each keyValueTuple should be an array with values [ key: string, value: any ]
 *
 * @example
 * ```
 *
 * var pairs = [ ["fookey", "fooval"], ["barkey", "barval"] ]
 *
 * var pairsToObj = pairs.reduce((memo, pair) => applyPairs(memo, pair), {})
 * // pairsToObj == { fookey: "fooval", barkey: "barval" }
 *
 * // Or, more simply:
 * var pairsToObj = pairs.reduce(applyPairs, {})
 * // pairsToObj == { fookey: "fooval", barkey: "barval" }
 * ```
 */
export function applyPairs(memo: TypedMap<any>, keyValTuple: any[]) {
  let key: string, value: any;
  if (isArray(keyValTuple)) [key, value] = keyValTuple;
  if (!isString(key)) throw new Error('invalid parameters to applyPairs');
  memo[key] = value;
  return memo;
}

/** Get the last element of an array */
export function tail<T>(arr: T[]): T {
  return (arr.length && arr[arr.length - 1]) || undefined;
}

/**
 * shallow copy from src to dest
 */
export function copy(src: Obj, dest?: Obj) {
  if (dest) Object.keys(dest).forEach(key => delete dest[key]);
  if (!dest) dest = {};
  return extend(dest, src);
}

/** Naive forEach implementation works with Objects or Arrays */
function _forEach(obj: any[] | any, cb: (el, idx?) => void, _this: Obj) {
  if (isArray(obj)) return obj.forEach(cb, _this);
  Object.keys(obj).forEach(key => cb(obj[key], key));
}

/** Like Object.assign() */
export function _extend(toObj: Obj, ...fromObjs: Obj[]): any;
export function _extend(toObj: Obj): any {
  for (let i = 1; i < arguments.length; i++) {
    const obj = arguments[i];
    if (!obj) continue;
    const keys = Object.keys(obj);

    for (let j = 0; j < keys.length; j++) {
      toObj[keys[j]] = obj[keys[j]];
    }
  }

  return toObj;
}

function _equals(o1: any, o2: any): boolean {
  if (o1 === o2) return true;
  if (o1 === null || o2 === null) return false;
  if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
  const t1 = typeof o1,
    t2 = typeof o2;
  if (t1 !== t2 || t1 !== 'object') return false;

  const tup = [o1, o2];
  if (all(isArray)(tup)) return _arraysEq(o1, o2);
  if (all(isDate)(tup)) return o1.getTime() === o2.getTime();
  if (all(isRegExp)(tup)) return o1.toString() === o2.toString();
  if (all(isFunction)(tup)) return true; // meh

  const predicates = [isFunction, isArray, isDate, isRegExp];
  if (predicates.map(any).reduce((b, fn) => b || !!fn(tup), false)) return false;

  const keys: { [i: string]: boolean } = {};
  // tslint:disable-next-line:forin
  for (const key in o1) {
    if (!_equals(o1[key], o2[key])) return false;
    keys[key] = true;
  }
  for (const key in o2) {
    if (!keys[key]) return false;
  }

  return true;
}

function _arraysEq(a1: any[], a2: any[]) {
  if (a1.length !== a2.length) return false;
  return arrayTuples(a1, a2).reduce((b, t) => b && _equals(t[0], t[1]), true);
}

// issue #2676
export const silenceUncaughtInPromise = (promise: Promise<any>) => promise.catch(e => 0) && promise;
export const silentRejection = (error: any) => silenceUncaughtInPromise(services.$q.reject(error));
