import { map, inherit, identity, unnest, tail, find, Obj, allTrueR, unnestR, arrayTuples } from '../common/common';
import { prop, propEq } from '../common/hof';
import { isArray, isString, isDefined } from '../common/predicates';
import { Param, DefType } from '../params/param';
import { ParamTypes } from '../params/paramTypes';
import { RawParams } from '../params/interface';
import { UrlMatcherCompileConfig } from './interface';
import { joinNeighborsR, splitOnDelim } from '../common/strings';
import { ParamType } from '../params';
import { defaults } from '../common';
import { ParamFactory } from './urlMatcherFactory';

function quoteRegExp(str: any, param?: any) {
  let surroundPattern = ['', ''],
    result = str.replace(/[\\\[\]\^$*+?.()|{}]/g, '\\$&');
  if (!param) return result;

  switch (param.squash) {
    case false:
      surroundPattern = ['(', ')' + (param.isOptional ? '?' : '')];
      break;
    case true:
      result = result.replace(/\/$/, '');
      surroundPattern = ['(?:/(', ')|/)?'];
      break;
    default:
      surroundPattern = [`(${param.squash}|`, ')?'];
      break;
  }
  return result + surroundPattern[0] + param.type.pattern.source + surroundPattern[1];
}

const memoizeTo = (obj: Obj, _prop: string, fn: Function) => (obj[_prop] = obj[_prop] || fn());

const splitOnSlash = splitOnDelim('/');

interface UrlMatcherCache {
  segments?: any[];
  weights?: number[];
  path?: UrlMatcher[];
  parent?: UrlMatcher;
  pattern?: RegExp;
}

interface MatchDetails {
  id: string;
  regexp: string;
  segment: string;
  type: ParamType;
}

const defaultConfig: UrlMatcherCompileConfig = {
  state: { params: {} },
  strict: true,
  caseInsensitive: true,
  decodeParams: true,
};

/**
 * Matches URLs against patterns.
 *
 * Matches URLs against patterns and extracts named parameters from the path or the search
 * part of the URL.
 *
 * A URL pattern consists of a path pattern, optionally followed by '?' and a list of search (query)
 * parameters. Multiple search parameter names are separated by '&'. Search parameters
 * do not influence whether or not a URL is matched, but their values are passed through into
 * the matched parameters returned by [[UrlMatcher.exec]].
 *
 * - *Path parameters* are defined using curly brace placeholders (`/somepath/{param}`)
 * or colon placeholders (`/somePath/:param`).
 *
 * - *A parameter RegExp* may be defined for a param after a colon
 * (`/somePath/{param:[a-zA-Z0-9]+}`) in a curly brace placeholder.
 * The regexp must match for the url to be matched.
 * Should the regexp itself contain curly braces, they must be in matched pairs or escaped with a backslash.
 *
 * Note: a RegExp parameter will encode its value using either [[ParamTypes.path]] or [[ParamTypes.query]].
 *
 * - *Custom parameter types* may also be specified after a colon (`/somePath/{param:int}`) in curly brace parameters.
 *   See [[UrlMatcherFactory.type]] for more information.
 *
 * - *Catch-all parameters* are defined using an asterisk placeholder (`/somepath/*catchallparam`).
 *   A catch-all * parameter value will contain the remainder of the URL.
 *
 * ---
 *
 * Parameter names may contain only word characters (latin letters, digits, and underscore) and
 * must be unique within the pattern (across both path and search parameters).
 * A path parameter matches any number of characters other than '/'. For catch-all
 * placeholders the path parameter matches any number of characters.
 *
 * Examples:
 *
 * * `'/hello/'` - Matches only if the path is exactly '/hello/'. There is no special treatment for
 *   trailing slashes, and patterns have to match the entire path, not just a prefix.
 * * `'/user/:id'` - Matches '/user/bob' or '/user/1234!!!' or even '/user/' but not '/user' or
 *   '/user/bob/details'. The second path segment will be captured as the parameter 'id'.
 * * `'/user/{id}'` - Same as the previous example, but using curly brace syntax.
 * * `'/user/{id:[^/]*}'` - Same as the previous example.
 * * `'/user/{id:[0-9a-fA-F]{1,8}}'` - Similar to the previous example, but only matches if the id
 *   parameter consists of 1 to 8 hex digits.
 * * `'/files/{path:.*}'` - Matches any URL starting with '/files/' and captures the rest of the
 *   path into the parameter 'path'.
 * * `'/files/*path'` - ditto.
 * * `'/calendar/{start:date}'` - Matches "/calendar/2014-11-12" (because the pattern defined
 *   in the built-in  `date` ParamType matches `2014-11-12`) and provides a Date object in $stateParams.start
 *
 */
export class UrlMatcher {
  /** @internal */
  static nameValidator: RegExp = /^\w+([-.]+\w+)*(?:\[\])?$/;

  /** @internal */
  private _cache: UrlMatcherCache = { path: [this] };
  /** @internal */
  private _children: UrlMatcher[] = [];
  /** @internal */
  private _params: Param[] = [];
  /** @internal */
  private _segments: string[] = [];
  /** @internal */
  private _compiled: string[] = [];
  /** @internal */
  private readonly config: UrlMatcherCompileConfig;

  /** The pattern that was passed into the constructor */
  public pattern: string;

  /** @internal */
  static encodeDashes(str: string) {
    // Replace dashes with encoded "\-"
    return encodeURIComponent(str).replace(/-/g, (c) => `%5C%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /** @internal Given a matcher, return an array with the matcher's path segments and path params, in order */
  static pathSegmentsAndParams(matcher: UrlMatcher) {
    const staticSegments = matcher._segments;
    const pathParams = matcher._params.filter((p) => p.location === DefType.PATH);
    return arrayTuples(staticSegments, pathParams.concat(undefined))
      .reduce(unnestR, [])
      .filter((x) => x !== '' && isDefined(x));
  }

  /** @internal Given a matcher, return an array with the matcher's query params */
  static queryParams(matcher: UrlMatcher): Param[] {
    return matcher._params.filter((p) => p.location === DefType.SEARCH);
  }

  /**
   * Compare two UrlMatchers
   *
   * This comparison function converts a UrlMatcher into static and dynamic path segments.
   * Each static path segment is a static string between a path separator (slash character).
   * Each dynamic segment is a path parameter.
   *
   * The comparison function sorts static segments before dynamic ones.
   */
  static compare(a: UrlMatcher, b: UrlMatcher): number {
    /**
     * Turn a UrlMatcher and all its parent matchers into an array
     * of slash literals '/', string literals, and Param objects
     *
     * This example matcher matches strings like "/foo/:param/tail":
     * var matcher = $umf.compile("/foo").append($umf.compile("/:param")).append($umf.compile("/")).append($umf.compile("tail"));
     * var result = segments(matcher); // [ '/', 'foo', '/', Param, '/', 'tail' ]
     *
     * Caches the result as `matcher._cache.segments`
     */
    const segments = (matcher: UrlMatcher) =>
      (matcher._cache.segments =
        matcher._cache.segments ||
        matcher._cache.path
          .map(UrlMatcher.pathSegmentsAndParams)
          .reduce(unnestR, [])
          .reduce(joinNeighborsR, [])
          .map((x) => (isString(x) ? splitOnSlash(x) : x))
          .reduce(unnestR, []));

    /**
     * Gets the sort weight for each segment of a UrlMatcher
     *
     * Caches the result as `matcher._cache.weights`
     */
    const weights = (matcher: UrlMatcher) =>
      (matcher._cache.weights =
        matcher._cache.weights ||
        segments(matcher).map((segment) => {
          // Sort slashes first, then static strings, the Params
          if (segment === '/') return 1;
          if (isString(segment)) return 2;
          if (segment instanceof Param) return 3;
        }));

    /**
     * Pads shorter array in-place (mutates)
     */
    const padArrays = (l: any[], r: any[], padVal: any) => {
      const len = Math.max(l.length, r.length);
      while (l.length < len) l.push(padVal);
      while (r.length < len) r.push(padVal);
    };

    const weightsA = weights(a),
      weightsB = weights(b);
    padArrays(weightsA, weightsB, 0);

    const _pairs = arrayTuples(weightsA, weightsB);
    let cmp, i;

    for (i = 0; i < _pairs.length; i++) {
      cmp = _pairs[i][0] - _pairs[i][1];
      if (cmp !== 0) return cmp;
    }

    return 0;
  }

  /**
   * @param pattern The pattern to compile into a matcher.
   * @param paramTypes The [[ParamTypes]] registry
   * @param paramFactory A [[ParamFactory]] object
   * @param config  A [[UrlMatcherCompileConfig]] configuration object
   */
  constructor(pattern: string, paramTypes: ParamTypes, paramFactory: ParamFactory, config?: UrlMatcherCompileConfig) {
    this.config = config = defaults(config, defaultConfig);
    this.pattern = pattern;

    // Find all placeholders and create a compiled pattern, using either classic or curly syntax:
    //   '*' name
    //   ':' name
    //   '{' name '}'
    //   '{' name ':' regexp '}'
    // The regular expression is somewhat complicated due to the need to allow curly braces
    // inside the regular expression. The placeholder regexp breaks down as follows:
    //    ([:*])([\w\[\]]+)              - classic placeholder ($1 / $2) (search version has - for snake-case)
    //    \{([\w\[\]]+)(?:\:\s*( ... ))?\}  - curly brace placeholder ($3) with optional regexp/type ... ($4) (search version has - for snake-case
    //    (?: ... | ... | ... )+         - the regexp consists of any number of atoms, an atom being either
    //    [^{}\\]+                       - anything other than curly braces or backslash
    //    \\.                            - a backslash escape
    //    \{(?:[^{}\\]+|\\.)*\}          - a matched set of curly braces containing other atoms
    const placeholder = /([:*])([\w\[\]]+)|\{([\w\[\]]+)(?:\:\s*((?:[^{}\\]+|\\.|\{(?:[^{}\\]+|\\.)*\})+))?\}/g;
    const searchPlaceholder = /([:]?)([\w\[\].-]+)|\{([\w\[\].-]+)(?:\:\s*((?:[^{}\\]+|\\.|\{(?:[^{}\\]+|\\.)*\})+))?\}/g;
    const patterns: any[][] = [];
    let last = 0;
    let matchArray: RegExpExecArray;

    const checkParamErrors = (id: string) => {
      if (!UrlMatcher.nameValidator.test(id)) throw new Error(`Invalid parameter name '${id}' in pattern '${pattern}'`);
      if (find(this._params, propEq('id', id)))
        throw new Error(`Duplicate parameter name '${id}' in pattern '${pattern}'`);
    };

    // Split into static segments separated by path parameter placeholders.
    // The number of segments is always 1 more than the number of parameters.
    const matchDetails = (m: RegExpExecArray, isSearch: boolean): MatchDetails => {
      // IE[78] returns '' for unmatched groups instead of null
      const id: string = m[2] || m[3];
      const regexp: string = isSearch ? m[4] : m[4] || (m[1] === '*' ? '[\\s\\S]*' : null);

      const makeRegexpType = (str) =>
        inherit(paramTypes.type(isSearch ? 'query' : 'path'), {
          pattern: new RegExp(str, this.config.caseInsensitive ? 'i' : undefined),
        });

      return {
        id,
        regexp,
        segment: pattern.substring(last, m.index),
        type: !regexp ? null : paramTypes.type(regexp) || makeRegexpType(regexp),
      };
    };

    let details: MatchDetails;
    let segment: string;

    // tslint:disable-next-line:no-conditional-assignment
    while ((matchArray = placeholder.exec(pattern))) {
      details = matchDetails(matchArray, false);
      if (details.segment.indexOf('?') >= 0) break; // we're into the search part

      checkParamErrors(details.id);
      this._params.push(paramFactory.fromPath(details.id, details.type, config.state));
      this._segments.push(details.segment);
      patterns.push([details.segment, tail(this._params)]);
      last = placeholder.lastIndex;
    }
    segment = pattern.substring(last);

    // Find any search parameter names and remove them from the last segment
    const i = segment.indexOf('?');

    if (i >= 0) {
      const search = segment.substring(i);
      segment = segment.substring(0, i);

      if (search.length > 0) {
        last = 0;

        // tslint:disable-next-line:no-conditional-assignment
        while ((matchArray = searchPlaceholder.exec(search))) {
          details = matchDetails(matchArray, true);
          checkParamErrors(details.id);
          this._params.push(paramFactory.fromSearch(details.id, details.type, config.state));
          last = placeholder.lastIndex;
          // check if ?&
        }
      }
    }

    this._segments.push(segment);
    this._compiled = patterns.map((_pattern) => quoteRegExp.apply(null, _pattern)).concat(quoteRegExp(segment));
  }

  /**
   * Creates a new concatenated UrlMatcher
   *
   * Builds a new UrlMatcher by appending another UrlMatcher to this one.
   *
   * @param url A `UrlMatcher` instance to append as a child of the current `UrlMatcher`.
   */
  append(url: UrlMatcher): UrlMatcher {
    this._children.push(url);
    url._cache = {
      path: this._cache.path.concat(url),
      parent: this,
      pattern: null,
    };
    return url;
  }

  /** @internal */
  isRoot(): boolean {
    return this._cache.path[0] === this;
  }

  /** Returns the input pattern string */
  toString(): string {
    return this.pattern;
  }

  private _getDecodedParamValue(value: any, param: Param): any {
    if (isDefined(value)) {
      if (this.config.decodeParams && !param.type.raw && !isArray(value)) {
        value = decodeURIComponent(value);
      }

      value = param.type.decode(value);
    }

    return param.value(value);
  }

  /**
   * Tests the specified url/path against this matcher.
   *
   * Tests if the given url matches this matcher's pattern, and returns an object containing the captured
   * parameter values.  Returns null if the path does not match.
   *
   * The returned object contains the values
   * of any search parameters that are mentioned in the pattern, but their value may be null if
   * they are not present in `search`. This means that search parameters are always treated
   * as optional.
   *
   * #### Example:
   * ```js
   * new UrlMatcher('/user/{id}?q&r').exec('/user/bob', {
   *   x: '1', q: 'hello'
   * });
   * // returns { id: 'bob', q: 'hello', r: null }
   * ```
   *
   * @param path    The URL path to match, e.g. `$location.path()`.
   * @param search  URL search parameters, e.g. `$location.search()`.
   * @param hash    URL hash e.g. `$location.hash()`.
   * @param options
   *
   * @returns The captured parameter values.
   */
  exec(path: string, search: any = {}, hash?: string, options: any = {}): RawParams {
    const match = memoizeTo(this._cache, 'pattern', () => {
      return new RegExp(
        [
          '^',
          unnest(this._cache.path.map(prop('_compiled'))).join(''),
          this.config.strict === false ? '/?' : '',
          '$',
        ].join(''),
        this.config.caseInsensitive ? 'i' : undefined
      );
    }).exec(path);

    if (!match) return null;

    // options = defaults(options, { isolate: false });

    const allParams: Param[] = this.parameters(),
      pathParams: Param[] = allParams.filter((param) => !param.isSearch()),
      searchParams: Param[] = allParams.filter((param) => param.isSearch()),
      nPathSegments = this._cache.path.map((urlm) => urlm._segments.length - 1).reduce((a, x) => a + x),
      values: RawParams = {};

    if (nPathSegments !== match.length - 1) throw new Error(`Unbalanced capture group in route '${this.pattern}'`);

    function decodePathArray(paramVal: string) {
      const reverseString = (str: string) => str.split('').reverse().join('');
      const unquoteDashes = (str: string) => str.replace(/\\-/g, '-');

      const split = reverseString(paramVal).split(/-(?!\\)/);
      const allReversed = map(split, reverseString);
      return map(allReversed, unquoteDashes).reverse();
    }

    for (let i = 0; i < nPathSegments; i++) {
      const param: Param = pathParams[i];
      let value: any | any[] = match[i + 1];

      // if the param value matches a pre-replace pair, replace the value before decoding.
      for (let j = 0; j < param.replace.length; j++) {
        if (param.replace[j].from === value) value = param.replace[j].to;
      }

      if (value && param.array === true) value = decodePathArray(value);

      values[param.id] = this._getDecodedParamValue(value, param);
    }
    searchParams.forEach((param: Param) => {
      let value = search[param.id];

      for (let j = 0; j < param.replace.length; j++) {
        if (param.replace[j].from === value) value = param.replace[j].to;
      }

      values[param.id] = this._getDecodedParamValue(value, param);
    });

    if (hash) values['#'] = hash;

    return values;
  }

  /**
   * @internal
   * Returns all the [[Param]] objects of all path and search parameters of this pattern in order of appearance.
   *
   * @returns {Array.<Param>}  An array of [[Param]] objects. Must be treated as read-only. If the
   *    pattern has no parameters, an empty array is returned.
   */
  parameters(opts: any = {}): Param[] {
    if (opts.inherit === false) return this._params;
    return unnest(this._cache.path.map((matcher) => matcher._params));
  }

  /**
   * @internal
   * Returns a single parameter from this UrlMatcher by id
   *
   * @param id
   * @param opts
   * @returns {T|Param|any|boolean|UrlMatcher|null}
   */
  parameter(id: string, opts: any = {}): Param {
    const findParam = () => {
      for (const param of this._params) {
        if (param.id === id) return param;
      }
    };

    const parent = this._cache.parent;
    return findParam() || (opts.inherit !== false && parent && parent.parameter(id, opts)) || null;
  }

  /**
   * Validates the input parameter values against this UrlMatcher
   *
   * Checks an object hash of parameters to validate their correctness according to the parameter
   * types of this `UrlMatcher`.
   *
   * @param params The object hash of parameters to validate.
   * @returns Returns `true` if `params` validates, otherwise `false`.
   */
  validates(params: RawParams): boolean {
    const validParamVal = (param: Param, val: any) => !param || param.validates(val);

    params = params || {};

    // I'm not sure why this checks only the param keys passed in, and not all the params known to the matcher
    const paramSchema = this.parameters().filter((paramDef) => params.hasOwnProperty(paramDef.id));
    return paramSchema.map((paramDef) => validParamVal(paramDef, params[paramDef.id])).reduce(allTrueR, true);
  }

  /**
   * Given a set of parameter values, creates a URL from this UrlMatcher.
   *
   * Creates a URL that matches this pattern by substituting the specified values
   * for the path and search parameters.
   *
   * #### Example:
   * ```js
   * new UrlMatcher('/user/{id}?q').format({ id:'bob', q:'yes' });
   * // returns '/user/bob?q=yes'
   * ```
   *
   * @param values  the values to substitute for the parameters in this pattern.
   * @returns the formatted URL (path and optionally search part).
   */
  format(values: RawParams = {}) {
    // Build the full path of UrlMatchers (including all parent UrlMatchers)
    const urlMatchers = this._cache.path;

    // Extract all the static segments and Params (processed as ParamDetails)
    // into an ordered array
    const pathSegmentsAndParams: Array<string | ParamDetails> = urlMatchers
      .map(UrlMatcher.pathSegmentsAndParams)
      .reduce(unnestR, [])
      .map((x) => (isString(x) ? x : getDetails(x)));

    // Extract the query params into a separate array
    const queryParams: Array<ParamDetails> = urlMatchers
      .map(UrlMatcher.queryParams)
      .reduce(unnestR, [])
      .map(getDetails);

    const isInvalid = (param: ParamDetails) => param.isValid === false;
    if (pathSegmentsAndParams.concat(queryParams).filter(isInvalid).length) {
      return null;
    }

    /**
     * Given a Param, applies the parameter value, then returns detailed information about it
     */
    function getDetails(param: Param): ParamDetails {
      // Normalize to typed value
      const value = param.value(values[param.id]);
      const isValid = param.validates(value);
      const isDefaultValue = param.isDefaultValue(value);
      // Check if we're in squash mode for the parameter
      const squash = isDefaultValue ? param.squash : false;
      // Allow the Parameter's Type to encode the value
      const encoded = param.type.encode(value);

      return { param, value, isValid, isDefaultValue, squash, encoded };
    }

    // Build up the path-portion from the list of static segments and parameters
    const pathString = pathSegmentsAndParams.reduce((acc: string, x: string | ParamDetails) => {
      // The element is a static segment (a raw string); just append it
      if (isString(x)) return acc + x;

      // Otherwise, it's a ParamDetails.
      const { squash, encoded, param } = x;

      // If squash is === true, try to remove a slash from the path
      if (squash === true) return acc.match(/\/$/) ? acc.slice(0, -1) : acc;
      // If squash is a string, use the string for the param value
      if (isString(squash)) return acc + squash;
      if (squash !== false) return acc; // ?
      if (encoded == null) return acc;
      // If this parameter value is an array, encode the value using encodeDashes
      if (isArray(encoded)) return acc + map(<string[]>encoded, UrlMatcher.encodeDashes).join('-');
      // If the parameter type is "raw", then do not encodeURIComponent
      if (param.raw) return acc + encoded;
      // Encode the value
      return acc + encodeURIComponent(<string>encoded);
    }, '');

    // Build the query string by applying parameter values (array or regular)
    // then mapping to key=value, then flattening and joining using "&"
    const queryString = queryParams
      .map((paramDetails: ParamDetails) => {
        let { param, squash, encoded, isDefaultValue } = paramDetails;
        if (encoded == null || (isDefaultValue && squash !== false)) return;
        if (!isArray(encoded)) encoded = [<string>encoded];
        if (encoded.length === 0) return;
        if (!param.raw) encoded = map(<string[]>encoded, encodeURIComponent);

        return (<string[]>encoded).map((val) => `${param.id}=${val}`);
      })
      .filter(identity)
      .reduce(unnestR, [])
      .join('&');

    // Concat the pathstring with the queryString (if exists) and the hashString (if exists)
    return pathString + (queryString ? `?${queryString}` : '') + (values['#'] ? '#' + values['#'] : '');
  }
}

/** @internal */
interface ParamDetails {
  param: Param;
  value: any;
  isValid: boolean;
  isDefaultValue: boolean;
  squash: boolean | string;
  encoded: string | string[];
}
