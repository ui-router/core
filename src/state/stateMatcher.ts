/** @publicapi @module state */ /** */
import { isString } from '../common/predicates';
import { StateOrName } from './interface';
import { StateObject } from './stateObject';
import { values } from '../common/common';
import { safeConsole } from '../common/safeConsole';

export class StateMatcher {
  constructor(private _states: { [key: string]: StateObject }) {}

  isRelative(stateName: string) {
    stateName = stateName || '';
    return stateName.indexOf('.') === 0 || stateName.indexOf('^') === 0;
  }

  find(stateOrName: StateOrName, base?: StateOrName, matchGlob = true): StateObject {
    if (!stateOrName && stateOrName !== '') return undefined;
    const isStr = isString(stateOrName);
    let name: string = isStr ? stateOrName : (<any>stateOrName).name;

    if (this.isRelative(name)) name = this.resolvePath(name, base);
    const state = this._states[name];

    if (state && (isStr || (!isStr && (state === stateOrName || state.self === stateOrName)))) {
      return state;
    } else if (isStr && matchGlob) {
      const _states = values(this._states);
      const matches = _states.filter(
        _state => _state.__stateObjectCache.nameGlob && _state.__stateObjectCache.nameGlob.matches(name)
      );

      if (matches.length > 1) {
        safeConsole.error(
          `stateMatcher.find: Found multiple matches for ${name} using glob: `,
          matches.map(match => match.name)
        );
      }
      return matches[0];
    }
    return undefined;
  }

  resolvePath(name: string, base: StateOrName) {
    if (!base) throw new Error(`No reference point given for path '${name}'`);

    const baseState: StateObject = this.find(base);

    const splitName = name.split('.');
    const pathLength = splitName.length;
    let i = 0,
      current = baseState;

    for (; i < pathLength; i++) {
      if (splitName[i] === '' && i === 0) {
        current = baseState;
        continue;
      }
      if (splitName[i] === '^') {
        if (!current.parent) throw new Error(`Path '${name}' not valid for state '${baseState.name}'`);
        current = current.parent;
        continue;
      }
      break;
    }
    const relName = splitName.slice(i).join('.');
    return current.name + (current.name && relName ? '.' : '') + relName;
  }
}
