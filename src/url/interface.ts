import { LocationConfig } from "../common/coreservices";
import { ParamType } from "../params/type";
import { Param } from "../params/param";
import { UIRouter } from "../router";
import { TargetState } from "../state/targetState";
import { TargetStateDef } from "../state/interface";
import { UrlMatcher } from "./urlMatcher";
import { State } from "../state/stateObject";

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

export interface UrlParts {
  path: string;
  search: { [key: string]: any };
  hash: string;
}

/**
 * A function that matches the URL for a [[UrlRule]]
 *
 * Implementations should match against the current
 * [[UrlService.path]], [[UrlService.search]], and [[UrlService.hash]]
 *
 * @return truthy or falsey
 */
export interface UrlRuleMatchFn {
  (url?: UrlParts, router?: UIRouter): any;
}

/**
 * Handler invoked when a rule is matched
 *
 * The matched value from the rule's [[UrlRuleMatchFn]] is passed as the first argument
 * The handler should return a string (to redirect), or void
 */
export interface UrlRuleHandlerFn {
  (matchValue?: any, url?: UrlParts, router?: UIRouter): (string|TargetState|TargetStateDef|void);
}

export type UrlRuleType = "STATE" | "URLMATCHER" | "REGEXP" | "RAW" | "OTHER";

export interface UrlRule {
  /**
   * The rule's ID.
   *
   * IDs are auto-assigned when the rule is registered, in increasing order.
   */
  $id: number;

  /**
   * The rule's priority (defaults to 0).
   *
   * This can be used to explicitly modify the rule's priority.
   * Higher numbers are higher priority.
   */
  priority: number;

  /**
   * The priority of a given match.
   *
   * Sometimes more than one UrlRule might have matched.
   * This method is used to choose the best match.
   *
   * If multiple rules matched, each rule's `matchPriority` is called with the value from [[match]].
   * The rule with the highest `matchPriority` has its [[handler]] called.
   */
  matchPriority(match: any): number;

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
}

export interface MatcherUrlRule extends UrlRule {
  type: "URLMATCHER"|"STATE";
  urlMatcher: UrlMatcher;
}

export interface StateRule extends MatcherUrlRule {
  type: "STATE";
  state: State;
}

export interface RegExpRule extends UrlRule {
  type: "REGEXP";
  regexp: RegExp;
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
//     rule(rule: UrlRule): UrlRouterProvider;
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
