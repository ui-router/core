import { LocationConfig } from "../common/coreservices";
import { Obj } from "../common/common";
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

/** @return truthy or falsey */
export interface UrlRuleMatchFn {
  (path: string, search: Obj, hash: string): any;
}

/** Handler invoked when a rule is matched */
export interface UrlRuleHandlerFn {
  (matchObject: any, path?: string, search?: Obj, hash?: string): (string|boolean|void);
}

export type UrlRuleType = "STATE" | "URLMATCHER" | "STRING" | "REGEXP" | "RAW" | "OTHER";
export interface UrlRule {
  /** The type of the rule */
  type: UrlRuleType;

  /**
   * This function should match the url and return match details
   */
  match: UrlRuleMatchFn;

  /**
   * This function is called after the rule matched the url.
   * This function handles the rule match event.
   */
  handler: UrlRuleHandlerFn;

  priority: number;
}


// export interface UrlService {
//   // LocationServices
//   // todo: switch back to url()
//   setUrl(newurl: string, replace?: boolean): void;
//   path(): string;
//   search(): { [key: string]: any };
//   hash(): string;
//   onChange(callback: Function): Function;
//
//   config: {
//     // LocationConfig
//     port(): number;
//     protocol(): string;
//     host(): string;
//     baseHref(): string;
//     html5Mode(): boolean;
//     hashPrefix(): string;
//
//     hashPrefix(newprefix: string): string;
//
//     // MatcherConfig
//     caseInsensitive(value?: boolean): boolean;
//     strictMode(value?: boolean): boolean;
//     defaultSquashPolicy(value?: (boolean|string)): (boolean|string);
//     paramType(name, type?)
//   }
//
//   rules: {
//     // UrlRouterProvider
//     addRule(rule: UrlRule): UrlRouterProvider;
//     otherwise(rule: string | (($injector: $InjectorLike, $location: LocationServices) => string)): UrlRouterProvider ;
//     when(what: (RegExp|UrlMatcher|string), handler: string|IInjectable, ruleCallback?) ;
//   }
//
//   deferIntercept(defer?: boolean);
//
//   // UrlRouter
//   sync(evt?);
//   listen(): Function;
// }
