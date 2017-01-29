/** Predicates
 *
 * These predicates return true/false based on the input.
 * Although these functions are exported, they are subject to change without notice.
 *
 * @module common_predicates
 */
/** */
import { and, not, pipe, prop, or } from "./hof";
import { Predicate } from "./common"; // has or is using
import { State } from "../state/stateObject";

const toStr = Object.prototype.toString;
const tis = (t: string) => (x: any) => typeof(x) === t;
export const isUndefined = tis('undefined');
export const isDefined = not(isUndefined);
export const isNull = (o: any) => o === null;
export const isNullOrUndefined = or(isNull, isUndefined);
export const isFunction: (x: any) => x is Function = <any> tis('function');
export const isNumber: (x: any) => x is number = <any> tis('number');
export const isString = <(x: any) => x is string> tis('string');
export const isObject = (x: any) => x !== null && typeof x === 'object';
export const isArray = Array.isArray;
export const isDate: (x: any) => x is Date = <any> ((x: any) => toStr.call(x) === '[object Date]');
export const isRegExp: (x: any) => x is RegExp = <any> ((x: any) => toStr.call(x) === '[object RegExp]');
export const isState: (x: any) => x is State = State.isState;

/**
 * Predicate which checks if a value is injectable
 *
 * A value is "injectable" if it is a function, or if it is an ng1 array-notation-style array
 * where all the elements in the array are Strings, except the last one, which is a Function
 */
export function isInjectable(val: any) {
  if (isArray(val) && val.length) {
    let head = val.slice(0, -1), tail = val.slice(-1);
    return !(head.filter(not(isString)).length || tail.filter(not(isFunction)).length);
  }
  return isFunction(val);
}

/**
 * Predicate which checks if a value looks like a Promise
 *
 * It is probably a Promise if it's an object, and it has a `then` property which is a Function
 */
export const isPromise = <(x: any) => x is Promise<any>> and(isObject, pipe(prop('then'), isFunction));

