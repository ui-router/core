import { isString } from '../common/predicates';

export function State(stateName?: string): ClassDecorator {
  return function<T>(targetClass: { new(...args: any[]): T }) {
    if (isString(stateName)) targetClass.prototype.name = stateName;
    targetClass['__uiRouterState'] = true;
  };
}