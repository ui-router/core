import { StateDeclaration } from '../state/interface';
import { isArray } from '../common/predicates';

export function Resolve(resolveConfig: { token?: string, deps?: any[] }): PropertyDecorator {
  resolveConfig = resolveConfig || {};

  return function(target: StateDeclaration, property) {
    const resolve = target.resolve = target.resolve || [];
    const token = resolveConfig.token || property;
    const deps = resolveConfig.deps || [];

    if (!isArray(resolve)) {
      throw new Error(`@ResolveData() only supports array style resolve: state: '${target.name}', resolve: ${property}, token: ${token}.`)
    }

    resolve.push({ token, deps, resolveFn: target[property] });
  };
}
