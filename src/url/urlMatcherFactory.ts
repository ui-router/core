/**
 * @internalapi
 * @module url
 */ /** for typedoc */
import { forEach, extend } from "../common/common";
import { isObject, isDefined, isFunction, isString } from "../common/predicates";
import { UrlMatcher } from "./urlMatcher";
import { Param, DefType } from "../params/param";
import { ParamTypes } from "../params/paramTypes";
import { ParamTypeDefinition } from "../params/interface";
import { Disposable } from "../interface";
import { ParamType } from "../params/paramType";
import { ParamFactory, UrlMatcherConfig } from "./interface";

/**
 * Factory for [[UrlMatcher]] instances.
 *
 * The factory is available to ng1 services as
 * `$urlMatcherFactory` or ng1 providers as `$urlMatcherFactoryProvider`.
 */
export class UrlMatcherFactory implements Disposable, UrlMatcherConfig {
  /** @hidden */ paramTypes = new ParamTypes();
  /** @hidden */ _isCaseInsensitive = false;
  /** @hidden */ _isStrictMode = true;
  /** @hidden */ _defaultSquashPolicy: (boolean|string) = false;

  /** @internalapi Creates a new [[Param]] for a given location (DefType) */
  paramFactory: ParamFactory = {
    /** Creates a new [[Param]] from a CONFIG block */
    fromConfig: (id: string, type: ParamType, config: any) =>
      new Param(id, type, config, DefType.CONFIG, this),

    /** Creates a new [[Param]] from a url PATH */
    fromPath: (id: string, type: ParamType, config: any) =>
      new Param(id, type, config, DefType.PATH, this),

    /** Creates a new [[Param]] from a url SEARCH */
    fromSearch: (id: string, type: ParamType, config: any) =>
      new Param(id, type, config, DefType.SEARCH, this),
  };

  constructor() {
    extend(this, { UrlMatcher, Param });
  }

  /** @inheritdoc */
  caseInsensitive(value?: boolean): boolean {
    return this._isCaseInsensitive = isDefined(value) ? value : this._isCaseInsensitive;
  }

  /** @inheritdoc */
  strictMode(value?: boolean): boolean {
    return this._isStrictMode = isDefined(value) ? value : this._isStrictMode;
  }

  /** @inheritdoc */
  defaultSquashPolicy(value?: (boolean|string)) {
    if (isDefined(value) && value !== true && value !== false && !isString(value))
      throw new Error(`Invalid squash policy: ${value}. Valid policies: false, true, arbitrary-string`);
    return this._defaultSquashPolicy = isDefined(value) ? value : this._defaultSquashPolicy;
  }

  /** @hidden */
  private _getConfig = (config) =>
      extend({ strict: this._isStrictMode, caseInsensitive: this._isCaseInsensitive }, config);

  /**
   * Creates a [[UrlMatcher]] for the specified pattern.
   *
   * @param pattern  The URL pattern.
   * @param config  The config object hash.
   * @returns The UrlMatcher.
   */
  compile(pattern: string, config?: { [key: string]: any }) {
    return new UrlMatcher(pattern, this.paramTypes, this.paramFactory, this._getConfig(config));
  }

  /**
   * Returns true if the specified object is a [[UrlMatcher]], or false otherwise.
   *
   * @param object  The object to perform the type check against.
   * @returns `true` if the object matches the `UrlMatcher` interface, by
   *          implementing all the same methods.
   */
  isMatcher(object: any): boolean {
    // TODO: typeof?
    if (!isObject(object)) return false;
    let result = true;

    forEach(UrlMatcher.prototype, (val, name) => {
      if (isFunction(val)) result = result && (isDefined(object[name]) && isFunction(object[name]));
    });
    return result;
  };

  /**
   * Creates and registers a custom [[ParamType]] object
   *
   * A [[ParamType]] can be used to generate URLs with typed parameters.
   *
   * @param name  The type name.
   * @param definition The type definition. See [[ParamTypeDefinition]] for information on the values accepted.
   * @param definitionFn A function that is injected before the app runtime starts.
   *        The result of this function should be a [[ParamTypeDefinition]].
   *        The result is merged into the existing `definition`.
   *        See [[ParamType]] for information on the values accepted.
   *
   * @returns - if a type was registered: the [[UrlMatcherFactory]]
   *   - if only the `name` parameter was specified: the currently registered [[ParamType]] object, or undefined
   *
   * Note: Register custom types *before using them* in a state definition.
   *
   * See [[ParamTypeDefinition]] for examples
   */
  type(name: string, definition?: ParamTypeDefinition, definitionFn?: () => ParamTypeDefinition) {
    const type = this.paramTypes.type(name, definition, definitionFn);
    return !isDefined(definition) ? type : this;
  };

  /** @hidden */
  $get() {
    this.paramTypes.enqueue = false;
    this.paramTypes._flushTypeQueue();
    return this;
  };

  /** @internalapi */
  dispose() {
    this.paramTypes.dispose();
  }
}
