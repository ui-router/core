import { LocationServices, $InjectorLike, LocationConfig } from "../common/coreservices";
import { UrlRule } from "./urlRule";
import { UrlMatcher } from "./urlMatcher";
import { IInjectable } from "../common/common";
import { ParamType } from "../params/type";
import { Param } from "../params/param";

export interface ParamFactory {
  /** Creates a new [[Param]] from a CONFIG block */
  fromConfig(id: string, type: ParamType, config: any): Param;
  /** Creates a new [[Param]] from a url PATH */
  fromPath(id: string, type: ParamType, config: any): Param;
  /** Creates a new [[Param]] from a url SEARCH */
  fromSearch(id: string, type: ParamType, config: any): Param;
}

export interface UrlConfig extends LocationConfig, UrlMatcherConfig {};

export interface UrlMatcherConfig {
  caseInsensitive(value?: boolean): boolean;
  strictMode(value?: boolean): boolean;
  defaultSquashPolicy(value?: (boolean|string)): (boolean|string);
  paramType(name, type?)
}

