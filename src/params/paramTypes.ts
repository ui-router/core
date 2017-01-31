/**
 * @coreapi
 * @module params
 */
/** */
import { fromJson, toJson, identity, equals, inherit, map, extend, pick } from "../common/common";
import { isDefined, isNullOrUndefined } from "../common/predicates";
import { is } from "../common/hof";
import { services } from "../common/coreservices";
import { ParamType } from "./paramType";
import { ParamTypeDefinition } from "./interface";

/**
 * A registry for parameter types.
 *
 * This registry manages the built-in (and custom) parameter types.
 *
 * The built-in parameter types are:
 *
 * - [[string]]
 * - [[path]]
 * - [[query]]
 * - [[hash]]
 * - [[int]]
 * - [[bool]]
 * - [[date]]
 * - [[json]]
 * - [[any]]
 */
export class ParamTypes {
  /** @hidden */
  types: any;
  /** @hidden */
  enqueue: boolean = true;
  /** @hidden */
  typeQueue: any[] = [];

  /**
   * Built-in parameter type: `string`
   *
   * This parameter type coerces values to strings.
   * It matches anything (`new RegExp(".*")`) in the URL
   */
  static string: ParamTypeDefinition;

  /**
   * Built-in parameter type: `path`
   *
   * This parameter type is the default type for path parameters.
   * A path parameter is any parameter declared in the path portion of a url
   *
   * - `/foo/:param1/:param2`: two path parameters
   *
   * This parameter type behaves exactly like the [[string]] type with one exception.
   * When matching parameter values in the URL, the `path` type does not match forward slashes `/`.
   *
   * #### Angular 1 note:
   * In ng1, this type is overridden with one that pre-encodes slashes as `~2F` instead of `%2F`.
   * For more details about this angular 1 behavior, see: https://github.com/angular-ui/ui-router/issues/2598
   */
  static path: ParamTypeDefinition;

  /**
   * Built-in parameter type: `query`
   *
   * This parameter type is the default type for query/search parameters.
   * It behaves the same as the [[string]] parameter type.
   *
   * A query parameter is any parameter declared in the query/search portion of a url
   *
   * - `/bar?param2`: a query parameter
   */
  static query: ParamTypeDefinition;

  /**
   * Built-in parameter type: `hash`
   *
   * This parameter type is used for the `#` parameter (the hash)
   * It behaves the same as the [[string]] parameter type.
   * @coreapi
   */
  static hash: ParamTypeDefinition;

  /**
   * Built-in parameter type: `int`
   *
   * This parameter type serializes javascript integers (`number`s which represent an integer) to the URL.
   *
   * #### Example:
   * ```js
   * .state({
   *   name: 'user',
   *   url: '/user/{id:int}'
   * });
   * ```
   * ```js
   * $state.go('user', { id: 1298547 });
   * ```
   *
   * The URL will serialize to: `/user/1298547`.
   *
   * When the parameter value is read, it will be the `number` `1298547`, not the string `"1298547"`.
   */
  static int: ParamTypeDefinition;

  /**
   * Built-in parameter type: `bool`
   *
   * This parameter type serializes `true`/`false` as `1`/`0`
   *
   * #### Example:
   * ```js
   * .state({
   *   name: 'inbox',
   *   url: '/inbox?{unread:bool}'
   * });
   * ```
   * ```js
   * $state.go('inbox', { unread: true });
   * ```
   *
   * The URL will serialize to: `/inbox?unread=1`.
   *
   * Conversely, if the url is `/inbox?unread=0`, the value of the `unread` parameter will be a `false`.
   */
  static bool: ParamTypeDefinition;

  /**
   * Built-in parameter type: `date`
   *
   * This parameter type can be used to serialize Javascript dates as parameter values.
   *
   * #### Example:
   * ```js
   * .state({
   *   name: 'search',
   *   url: '/search?{start:date}'
   * });
   * ```
   * ```js
   * $state.go('search', { start: new Date(2000, 0, 1) });
   * ```
   *
   * The URL will serialize to: `/search?start=2000-01-01`.
   *
   * Conversely, if the url is `/search?start=2016-12-25`, the value of the `start` parameter will be a `Date` object where:
   *
   * - `date.getFullYear() === 2016`
   * - `date.getMonth() === 11` (month is 0-based)
   * - `date.getDate() === 25`
   */
  static date: ParamTypeDefinition;

  /**
   * Built-in parameter type: `json`
   *
   * This parameter type can be used to serialize javascript objects into the URL using JSON serialization.
   *
   * #### Example:
   * This example serializes an plain javascript object to the URL
   * ```js
   * .state({
   *   name: 'map',
   *   url: '/map/{coords:json}'
   * });
   * ```
   * ```js
   * $state.go('map', { coords: { x: 10399.2, y: 49071 });
   * ```
   *
   * The URL will serialize to: `/map/%7B%22x%22%3A10399.2%2C%22y%22%3A49071%7D`
   */
  static json: ParamTypeDefinition;

  /**
   * Built-in parameter type: `any`
   *
   * This parameter type is used by default for url-less parameters (parameters that do not appear in the URL).
   * This type does not encode or decode.
   * It is compared using a deep `equals` comparison.
   *
   * #### Example:
   * This example defines a non-url parameter on a [[StateDeclaration]].
   * ```js
   * .state({
   *   name: 'new',
   *   url: '/new',
   *   params: {
   *     inrepyto: null
   *   }
   * });
   * ```
   * ```js
   * $state.go('new', { inreplyto: currentMessage });
   * ```
   */
  static any: ParamTypeDefinition;


  /** @internalapi */
  private defaultTypes: any = pick(ParamTypes.prototype, ["hash", "string", "query", "path", "int", "bool", "date", "json", "any"]);

  /** @internalapi */
  constructor() {
    // Register default types. Store them in the prototype of this.types.
    const makeType = (definition: ParamTypeDefinition, name: string) =>
        new ParamType(extend({ name }, definition));
    this.types = inherit(map(this.defaultTypes, makeType), {});
  }

  /** @internalapi */
  dispose() {
    this.types = {};
  }

  /**
   * Registers a parameter type
   *
   * End users should call [[UrlMatcherFactory.type]], which delegates to this method.
   */
  type(name: string, definition?: ParamTypeDefinition, definitionFn?: () => ParamTypeDefinition) {
    if (!isDefined(definition)) return this.types[name];
    if (this.types.hasOwnProperty(name)) throw new Error(`A type named '${name}' has already been defined.`);

    this.types[name] = new ParamType(extend({ name }, definition));

    if (definitionFn) {
      this.typeQueue.push({ name, def: definitionFn });
      if (!this.enqueue) this._flushTypeQueue();
    }

    return this;
  }

  /** @internalapi */
  _flushTypeQueue() {
    while (this.typeQueue.length) {
      let type = this.typeQueue.shift();
      if (type.pattern) throw new Error("You cannot override a type's .pattern at runtime.");
      extend(this.types[type.name], services.$injector.invoke(type.def));
    }
  }
}

/** @hidden */
function initDefaultTypes() {

  const makeDefaultType = (def) => {
    const valToString = (val: any) =>
        val != null ? val.toString() : val;

    const defaultTypeBase = {
      encode: valToString,
      decode: valToString,
      is: is(String),
      pattern: /.*/,
      equals: (a: any, b: any) => a == b, // allow coersion for null/undefined/""
    };

    return extend({}, defaultTypeBase, def) as ParamTypeDefinition;
  };

  // Default Parameter Type Definitions
  extend(ParamTypes.prototype, {
    string: makeDefaultType({}),

    path: makeDefaultType({
      pattern: /[^/]*/,
    }),

    query: makeDefaultType({}),

    hash: makeDefaultType({
      inherit: false,
    }),

    int: makeDefaultType({
      decode: (val: string) => parseInt(val, 10),
      is: function(val: any) {
        return !isNullOrUndefined(val) && this.decode(val.toString()) === val;
      },
      pattern: /-?\d+/,
    }),

    bool: makeDefaultType({
      encode: (val: any) => val && 1 || 0,
      decode: (val: string) => parseInt(val, 10) !== 0,
      is: is(Boolean),
      pattern: /0|1/
    }),

    date: makeDefaultType({
      encode: function(val: any) {
        return !this.is(val) ? undefined : [
          val.getFullYear(),
          ('0' + (val.getMonth() + 1)).slice(-2),
          ('0' + val.getDate()).slice(-2)
        ].join("-");
      },
      decode: function(val: string) {
        if (this.is(val)) return <any> val as Date;
        let match = this.capture.exec(val);
        return match ? new Date(match[1], match[2] - 1, match[3]) : undefined;
      },
      is: (val: any) => val instanceof Date && !isNaN(val.valueOf()),
      equals(l: any, r: any) {
        return ['getFullYear', 'getMonth', 'getDate']
            .reduce((acc, fn) => acc && l[fn]() === r[fn](), true)
      },
      pattern: /[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])/,
      capture: /([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/
    }),

    json: makeDefaultType({
      encode: toJson,
      decode: fromJson,
      is: is(Object),
      equals: equals,
      pattern: /[^/]*/
    }),

    // does not encode/decode
    any: makeDefaultType({
      encode: identity,
      decode: identity,
      is: () => true,
      equals: equals,
    }),
  })

}

initDefaultTypes();

