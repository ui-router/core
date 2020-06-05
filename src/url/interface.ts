/**
 * # URL subsystem
 *
 * Contains code related to managing the URL
 *
 * The primary API is found in [[UrlService]], [[UrlService.config]], and [[UrlService.rules]].
 *
 * @packageDocumentation
 * @preferred
 */
import { LocationConfig } from '../common';
import { UIRouter } from '../router';
import { StateDeclaration, StateObject, TargetState, TargetStateDef } from '../state';
import { UrlMatcher } from './urlMatcher';
import { UrlConfig } from './urlConfig';
import { UrlRules } from './urlRules';
import { UrlService } from './urlService';

export interface UrlMatcherCompileConfig {
  // If state is provided, use the configuration in the `params` block
  state?: StateDeclaration;
  strict?: boolean;
  caseInsensitive?: boolean;
}

/** @deprecated use [[UrlConfig]] */
export interface UrlConfigApi extends LocationConfig, UrlMatcherConfig {}

/** @deprecated use [[UrlConfig]] */
export interface UrlMatcherConfig {
  /** See: [[UrlConfig.caseInsensitive]] */ caseInsensitive: UrlConfig['caseInsensitive'];
  /** See: [[UrlConfig.strictMode]] */ strictMode: UrlConfig['strictMode'];
  /** See: [[UrlConfig.defaultSquashPolicy]] */ defaultSquashPolicy: UrlConfig['defaultSquashPolicy'];
  /** See: [[UrlConfig.type]] */ type: UrlConfig['type'];
}

/** @deprecated use [[UrlService]] */
export interface UrlSyncApi {
  /** See: [[UrlService.sync]] */ sync: UrlService['sync'];
  /** See: [[UrlService.listen]] */ listen: UrlService['listen'];
  /** See: [[UrlService.deferIntercept]] */ deferIntercept: UrlService['deferIntercept'];
}

/** @deprecated use [[UrlRules]] */
export interface UrlRulesApi {
  /** See: [[UrlRules.sort]] */ sort: UrlRules['sort'];
  /** See: [[UrlRules.when]] */ when: UrlRules['when'];
  /** See: [[UrlRules.otherwise]] */ otherwise: UrlRules['otherwise'];
  /** See: [[UrlRules.initial]] */ initial: UrlRules['initial'];
  /** See: [[UrlRules.rules]] */ rules: UrlRules['rules'];
  /** See: [[UrlRules.rule]] */ rule: UrlRules['rule'];
  /** See: [[UrlRules.removeRule]] */ removeRule: UrlRules['removeRule'];
}

/**
 * An object containing the three parts of a URL
 */
export interface UrlParts {
  path: string;
  search?: { [key: string]: any };
  hash?: string;
}

/**
 * A UrlRule match result
 *
 * The result of UrlRouter.match()
 */
export interface MatchResult {
  /** The matched value from a [[UrlRule]] */
  match: any;
  /** The rule that matched */
  rule: UrlRule;
  /** The match result weight */
  weight: number;
}

/**
 * A function that matches the URL for a [[UrlRule]]
 *
 * Implementations should match against the provided [[UrlParts]] and return the matched value (truthy) if the rule matches.
 * If this rule is selected, the matched value is passed to the [[UrlRuleHandlerFn]].
 *
 * @return the matched value, either truthy or falsey
 */
export interface UrlRuleMatchFn {
  (url?: UrlParts, router?: UIRouter): any;
}

/**
 * Handler invoked when a rule is matched
 *
 * The matched value from the rule's [[UrlRuleMatchFn]] is passed as the first argument
 * The handler should return a string (to redirect), a [[TargetState]]/[[TargetStateDef]], or void
 *
 * If the handler returns a string, the url is replaced with the string.
 * If the handler returns a [[TargetState]], the target state is activated.
 */
export interface UrlRuleHandlerFn {
  (matchValue?: any, url?: UrlParts, router?: UIRouter): string | TargetState | TargetStateDef | void;
}

/** @internal */
export type UrlRuleType = 'STATE' | 'URLMATCHER' | 'REGEXP' | 'RAW' | 'OTHER';

/**
 * The interface for a URL Rule
 *
 * If you are creating a rule for use with [[UrlRules.rule]], it should implement this interface.
 */
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

  /** @internal */
  _group: number;

  /** The type of the rule */
  type: UrlRuleType;

  /**
   * This function should match the url and return the match details
   *
   * See [[UrlRuleMatchFn]] for details
   */
  match: UrlRuleMatchFn;

  /**
   * This function is called if the rule matched, and was selected as the "best match".
   * This function handles the rule match event.
   *
   * See [[UrlRuleHandlerFn]] for details
   */
  handler: UrlRuleHandlerFn;

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
}

export interface MatcherUrlRule extends UrlRule {
  type: 'URLMATCHER' | 'STATE';
  urlMatcher: UrlMatcher;
}

export interface StateRule extends MatcherUrlRule {
  type: 'STATE';
  state: StateObject;
}

export interface RegExpRule extends UrlRule {
  type: 'REGEXP';
  regexp: RegExp;
}
