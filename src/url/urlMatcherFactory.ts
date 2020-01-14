/** @packageDocumentation @publicapi @module url */
import { extend, forEach, isDefined, isFunction, isObject } from '../common';
import { UrlMatcher } from './urlMatcher';
import { DefType, Param, ParamType, ParamTypeDefinition } from '../params';
import { UrlMatcherCompileConfig } from './interface';
import { StateDeclaration } from '../state';
import { UIRouter } from '../router';

/** @internalapi */
export class ParamFactory {
  fromConfig(id: string, type: ParamType, state: StateDeclaration) {
    return new Param(id, type, DefType.CONFIG, this.router.urlService.config, state);
  }

  fromPath(id: string, type: ParamType, state: StateDeclaration) {
    return new Param(id, type, DefType.PATH, this.router.urlService.config, state);
  }

  fromSearch(id: string, type: ParamType, state: StateDeclaration) {
    return new Param(id, type, DefType.SEARCH, this.router.urlService.config, state);
  }

  constructor(private router: UIRouter) {}
}

/**
 * Factory for [[UrlMatcher]] instances.
 *
 * The factory is available to ng1 services as
 * `$urlMatcherFactory` or ng1 providers as `$urlMatcherFactoryProvider`.
 *
 * @internalapi
 */
export class UrlMatcherFactory {
  /** @internalapi Creates a new [[Param]] for a given location (DefType) */
  paramFactory = new ParamFactory(this.router);

  // TODO: move implementations to UrlConfig (urlService.config)
  constructor(/** @hidden */ private router: UIRouter) {
    extend(this, { UrlMatcher, Param });
  }

  /**
   * Creates a [[UrlMatcher]] for the specified pattern.
   *
   * @param pattern  The URL pattern.
   * @param config  The config object hash.
   * @returns The UrlMatcher.
   */
  compile(pattern: string, config?: UrlMatcherCompileConfig) {
    const urlConfig = this.router.urlService.config;
    // backward-compatible support for config.params -> config.state.params
    const params = config && !config.state && (config as any).params;
    config = params ? { state: { params }, ...config } : config;
    const globalConfig = { strict: urlConfig._isStrictMode, caseInsensitive: urlConfig._isCaseInsensitive };
    return new UrlMatcher(pattern, urlConfig.paramTypes, this.paramFactory, extend(globalConfig, config));
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
  }

  /** @hidden */
  $get() {
    const urlConfig = this.router.urlService.config;
    urlConfig.paramTypes.enqueue = false;
    urlConfig.paramTypes._flushTypeQueue();
    return this;
  }

  /** @deprecated use [[UrlConfig.caseInsensitive]] */
  caseInsensitive = (value?: boolean) => this.router.urlService.config.caseInsensitive(value);

  /** @deprecated use [[UrlConfig.defaultSquashPolicy]] */
  defaultSquashPolicy = (value?: boolean | string) => this.router.urlService.config.defaultSquashPolicy(value);

  /** @deprecated use [[UrlConfig.strictMode]] */
  strictMode = (value?: boolean) => this.router.urlService.config.strictMode(value);

  /** @deprecated use [[UrlConfig.type]] */
  type = (name: string, definition?: ParamTypeDefinition, definitionFn?: () => ParamTypeDefinition) => {
    return this.router.urlService.config.type(name, definition, definitionFn) || this;
  };
}
