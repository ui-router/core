import { UrlRule, UrlRuleHandlerFn, UrlRulesApi } from './interface';
import { Disposable } from '../interface';
import { UIRouter } from '../router';
import { TargetState, TargetStateDef } from '../state';
import { UrlMatcher } from './urlMatcher';

export class UrlRules implements UrlRulesApi, Disposable {
  constructor(private router: UIRouter) {}
  dispose(router?: UIRouter) {}

  /** @inheritDoc */ public initial = (handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef): void =>
    this.router.urlRouter.initial(handler);
  /** @inheritDoc */ public otherwise = (handler: string | UrlRuleHandlerFn | TargetState | TargetStateDef): void =>
    this.router.urlRouter.otherwise(handler);
  /** @inheritDoc */ public removeRule = (rule: UrlRule): void => this.router.urlRouter.removeRule(rule);
  /** @inheritDoc */ public rule = (rule: UrlRule): Function => this.router.urlRouter.rule(rule);
  /** @inheritDoc */ public rules = (): UrlRule[] => this.router.urlRouter.rules();
  /** @inheritDoc */ public sort = (compareFn?: (a: UrlRule, b: UrlRule) => number) =>
    this.router.urlRouter.sort(compareFn);
  /** @inheritDoc */ public when = (
    matcher: RegExp | UrlMatcher | string,
    handler: string | UrlRuleHandlerFn,
    options?: { priority: number }
  ): UrlRule => this.router.urlRouter.when(matcher, handler, options);
}
