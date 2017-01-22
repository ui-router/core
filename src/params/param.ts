/**
 * @coreapi
 * @module params
 */ /** for typedoc */
import { extend, filter, map, applyPairs, allTrueR } from "../common/common";
import { prop, propEq } from "../common/hof";
import { isInjectable, isDefined, isString, isArray } from "../common/predicates";
import { RawParams, ParamDeclaration } from "../params/interface";
import { services } from "../common/coreservices";
import { ParamType } from "./paramType";
import { ParamTypes } from "./paramTypes";
import { UrlMatcherFactory } from "../url/urlMatcherFactory";

/** @hidden */ let hasOwn = Object.prototype.hasOwnProperty;
/** @hidden */ let isShorthand = (cfg: ParamDeclaration) =>
    ["value", "type", "squash", "array", "dynamic"].filter(hasOwn.bind(cfg || {})).length === 0;

/** @internalapi */
export enum DefType {
  PATH, SEARCH, CONFIG
}

/** @hidden */
function unwrapShorthand(cfg: ParamDeclaration): ParamDeclaration {
  cfg = isShorthand(cfg) && { value: cfg } as any || cfg;

  return extend(cfg, {
    $$fn: isInjectable(cfg.value) ? cfg.value : () => cfg.value
  });
}

/** @hidden */
function getType(cfg: ParamDeclaration, urlType: ParamType, location: DefType, id: string, paramTypes: ParamTypes) {
  if (cfg.type && urlType && urlType.name !== 'string') throw new Error(`Param '${id}' has two type configurations.`);
  if (cfg.type && urlType && urlType.name === 'string' && paramTypes.type(cfg.type as string)) return paramTypes.type(cfg.type as string);
  if (urlType) return urlType;
  if (!cfg.type) {
    let type = location === DefType.CONFIG ? "any" :
        location === DefType.PATH ? "path" :
        location === DefType.SEARCH ? "query" : "string";
    return paramTypes.type(type);
  }
  return cfg.type instanceof ParamType ? cfg.type : paramTypes.type(cfg.type as string);
}

/**
 * @internalapi
 * returns false, true, or the squash value to indicate the "default parameter url squash policy".
 */
function getSquashPolicy(config: ParamDeclaration, isOptional: boolean, defaultPolicy: (boolean|string)) {
  let squash = config.squash;
  if (!isOptional || squash === false) return false;
  if (!isDefined(squash) || squash == null) return defaultPolicy;
  if (squash === true || isString(squash)) return squash;
  throw new Error(`Invalid squash policy: '${squash}'. Valid policies: false, true, or arbitrary string`);
}

/** @internalapi */
function getReplace(config: ParamDeclaration, arrayMode: boolean, isOptional: boolean, squash: (string|boolean)) {
  let replace: any, configuredKeys: string[], defaultPolicy = [
    {from: "", to: (isOptional || arrayMode ? undefined : "")},
    {from: null, to: (isOptional || arrayMode ? undefined : "")}
  ];
  replace = isArray(config.replace) ? config.replace : [];
  if (isString(squash)) replace.push({ from: squash, to: undefined });
  configuredKeys = map(replace, prop("from"));
  return filter(defaultPolicy, item => configuredKeys.indexOf(item.from) === -1).concat(replace);
}


/** @internalapi */
export class Param {
  id: string;
  type: ParamType;
  location: DefType;
  isOptional: boolean;
  dynamic: boolean;
  raw: boolean;
  squash: (boolean|string);
  replace: any;
  inherit: boolean;
  array: boolean;
  config: any;

  constructor(id: string, type: ParamType, config: ParamDeclaration, location: DefType, urlMatcherFactory: UrlMatcherFactory) {
    config = unwrapShorthand(config);
    type = getType(config, type, location, id, urlMatcherFactory.paramTypes);
    let arrayMode = getArrayMode();
    type = arrayMode ? type.$asArray(arrayMode, location === DefType.SEARCH) : type;
    let isOptional = config.value !== undefined || location === DefType.SEARCH;
    let dynamic = isDefined(config.dynamic) ? !!config.dynamic : !!type.dynamic;
    let raw = isDefined(config.raw) ? !!config.raw : !!type.raw;
    let squash = getSquashPolicy(config, isOptional, urlMatcherFactory.defaultSquashPolicy());
    let replace = getReplace(config, arrayMode, isOptional, squash);
    let inherit = isDefined(config.inherit) ? !!config.inherit : !!type.inherit;

    // array config: param name (param[]) overrides default settings.  explicit config overrides param name.
    function getArrayMode() {
      let arrayDefaults = { array: (location === DefType.SEARCH ? "auto" : false) };
      let arrayParamNomenclature = id.match(/\[\]$/) ? { array: true } : {};
      return extend(arrayDefaults, arrayParamNomenclature, config).array;
    }

    extend(this, {id, type, location, isOptional, dynamic, raw, squash, replace, inherit, array: arrayMode, config, });
  }

  isDefaultValue(value: any): boolean {
    return this.isOptional && this.type.equals(this.value(), value);
  }

  /**
   * [Internal] Gets the decoded representation of a value if the value is defined, otherwise, returns the
   * default value, which may be the result of an injectable function.
   */
  value(value?: any): any {
    /**
     * [Internal] Get the default value of a parameter, which may be an injectable function.
     */
    const $$getDefaultValue = () => {
      if (!services.$injector) throw new Error("Injectable functions cannot be called at configuration time");
      let defaultValue = services.$injector.invoke(this.config.$$fn);
      if (defaultValue !== null && defaultValue !== undefined && !this.type.is(defaultValue))
        throw new Error(`Default value (${defaultValue}) for parameter '${this.id}' is not an instance of ParamType (${this.type.name})`);
      return defaultValue;
    };

    const $replace = (val: any) => {
      let replacement: any = map(filter(this.replace, propEq('from', val)), prop("to"));
      return replacement.length ? replacement[0] : val;
    };

    value = $replace(value);
    return !isDefined(value) ? $$getDefaultValue() : this.type.$normalize(value);
  }

  isSearch(): boolean {
    return this.location === DefType.SEARCH;
  }

  validates(value: any): boolean {
    // There was no parameter value, but the param is optional
    if ((!isDefined(value) || value === null) && this.isOptional) return true;

    // The value was not of the correct ParamType, and could not be decoded to the correct ParamType
    const normalized = this.type.$normalize(value);
    if (!this.type.is(normalized)) return false;

    // The value was of the correct type, but when encoded, did not match the ParamType's regexp
    const encoded = this.type.encode(normalized);
    return !(isString(encoded) && !this.type.pattern.exec(<string> encoded));
  }

  toString() {
    return `{Param:${this.id} ${this.type} squash: '${this.squash}' optional: ${this.isOptional}}`;
  }

  static values(params: Param[], values: RawParams = {}): RawParams {
    return <RawParams> params.map(param => [param.id, param.value(values[param.id])]).reduce(applyPairs, {});
  }

  /**
   * Finds [[Param]] objects which have different param values
   *
   * Filters a list of [[Param]] objects to only those whose parameter values differ in two param value objects
   *
   * @param params: The list of Param objects to filter
   * @param values1: The first set of parameter values
   * @param values2: the second set of parameter values
   *
   * @returns any Param objects whose values were different between values1 and values2
   */
  static changed(params: Param[], values1: RawParams = {}, values2: RawParams = {}): Param[] {
    return params.filter(param => !param.type.equals(values1[param.id], values2[param.id]));
  }

  /**
   * Checks if two param value objects are equal (for a set of [[Param]] objects)
   *
   * @param params The list of [[Param]] objects to check
   * @param values1 The first set of param values
   * @param values2 The second set of param values
   *
   * @returns true if the param values in values1 and values2 are equal
   */
  static equals(params: Param[], values1 = {}, values2 = {}): boolean {
    return Param.changed(params, values1, values2).length === 0;
  }

  /** Returns true if a the parameter values are valid, according to the Param definitions */
  static validates(params: Param[], values: RawParams = {}): boolean {
    return params.map(param => param.validates(values[param.id])).reduce(allTrueR, true);
  }
}