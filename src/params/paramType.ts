import { extend, filter, map } from '../common/common.js';
import { isArray, isDefined } from '../common/predicates.js';
import { ParamTypeDefinition } from './interface.js';

/**
 * An internal class which implements [[ParamTypeDefinition]].
 *
 * A [[ParamTypeDefinition]] is a plain javascript object used to register custom parameter types.
 * When a param type definition is registered, an instance of this class is created internally.
 *
 * This class has naive implementations for all the [[ParamTypeDefinition]] methods.
 *
 * Used by [[UrlMatcher]] when matching or formatting URLs, or comparing and validating parameter values.
 *
 * #### Example:
 * ```js
 * var paramTypeDef = {
 *   decode: function(val) { return parseInt(val, 10); },
 *   encode: function(val) { return val && val.toString(); },
 *   equals: function(a, b) { return this.is(a) && a === b; },
 *   is: function(val) { return angular.isNumber(val) && isFinite(val) && val % 1 === 0; },
 *   pattern: /\d+/
 * }
 *
 * var paramType = new ParamType(paramTypeDef);
 * ```
 */
export class ParamType implements ParamTypeDefinition {
  /** @inheritdoc */
  pattern: RegExp = /.*/;
  /** The name/id of the parameter type */
  name: string;
  /** @inheritdoc */
  raw: boolean;
  /** @inheritdoc */
  dynamic: boolean;
  /** @inheritdoc */
  inherit = true;

  /**
   * @param def  A configuration object which contains the custom type definition.  The object's
   *        properties will override the default methods and/or pattern in `ParamType`'s public interface.
   * @returns a new ParamType object
   */
  constructor(def: ParamTypeDefinition) {
    extend(this, def);
  }

  // consider these four methods to be "abstract methods" that should be overridden
  /** @inheritdoc */
  is(val: any, key?: string): boolean {
    return true;
  }
  /** @inheritdoc */
  encode(val: any, key?: string): string | string[] {
    return val;
  }
  /** @inheritdoc */
  decode(val: string, key?: string): any {
    return val;
  }
  /** @inheritdoc */
  equals(a: any, b: any): boolean {
    // tslint:disable-next-line:triple-equals
    return a == b;
  }

  $subPattern() {
    const sub = this.pattern.toString();
    return sub.substr(1, sub.length - 2);
  }

  toString() {
    return `{ParamType:${this.name}}`;
  }

  /** Given an encoded string, or a decoded object, returns a decoded object */
  $normalize(val: any) {
    return this.is(val) ? val : this.decode(val);
  }

  /**
   * Wraps an existing custom ParamType as an array of ParamType, depending on 'mode'.
   * e.g.:
   * - urlmatcher pattern "/path?{queryParam[]:int}"
   * - url: "/path?queryParam=1&queryParam=2
   * - $stateParams.queryParam will be [1, 2]
   * if `mode` is "auto", then
   * - url: "/path?queryParam=1 will create $stateParams.queryParam: 1
   * - url: "/path?queryParam=1&queryParam=2 will create $stateParams.queryParam: [1, 2]
   */
  $asArray(mode: boolean | 'auto', isSearch: boolean) {
    if (!mode) return this;
    if (mode === 'auto' && !isSearch) throw new Error("'auto' array mode is for query parameters only");
    return new (<any>ArrayType)(this, mode);
  }
}

/** Wraps up a `ParamType` object to handle array values. */
function ArrayType(type: ParamType, mode: boolean | 'auto') {
  // Wrap non-array value as array
  function arrayWrap(val: any): any[] {
    return isArray(val) ? val : isDefined(val) ? [val] : [];
  }

  // Unwrap array value for "auto" mode. Return undefined for empty array.
  function arrayUnwrap(val: any) {
    switch (val.length) {
      case 0:
        return undefined;
      case 1:
        return mode === 'auto' ? val[0] : val;
      default:
        return val;
    }
  }

  // Wraps type (.is/.encode/.decode) functions to operate on each value of an array
  function arrayHandler(callback: (x: any) => any, allTruthyMode?: boolean) {
    return function handleArray(val: any) {
      if (isArray(val) && val.length === 0) return val;
      const arr = arrayWrap(val);
      const result = map(arr, callback);
      return allTruthyMode === true ? filter(result, (x) => !x).length === 0 : arrayUnwrap(result);
    };
  }

  // Wraps type (.equals) functions to operate on each value of an array
  function arrayEqualsHandler(callback: (l: any, r: any) => boolean) {
    return function handleArray(val1: any, val2: any) {
      const left = arrayWrap(val1),
        right = arrayWrap(val2);
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i++) {
        if (!callback(left[i], right[i])) return false;
      }
      return true;
    };
  }

  ['encode', 'decode', 'equals', '$normalize'].forEach((name) => {
    const paramTypeFn = type[name].bind(type);
    const wrapperFn: Function = name === 'equals' ? arrayEqualsHandler : arrayHandler;
    this[name] = wrapperFn(paramTypeFn);
  });

  extend(this, {
    dynamic: type.dynamic,
    name: type.name,
    pattern: type.pattern,
    inherit: type.inherit,
    raw: type.raw,
    is: arrayHandler(type.is.bind(type), true),
    $arrayMode: mode,
  });
}
