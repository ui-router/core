import { pick, forEach, omit } from '../src/index';
import { map } from '../src/common/common';

const stateProps = ['resolve', 'resolvePolicy', 'data', 'template', 'templateUrl', 'url', 'name', 'params'];

const initialUrl = document.location.href;
export const resetBrowserUrl = () =>
  history.replaceState(null, null, initialUrl);

export const delay = (ms) =>
    new Promise<any>(resolve => setTimeout(resolve, ms));
export const _delay = (ms) => () => delay(ms);

export function tree2Array(tree, inheritName) {

  function processState(parent, state, name) {
    const substates: any = omit(state, stateProps);
    const thisState: any = pick(state, stateProps);
    thisState.name = name;
    if (!inheritName) thisState.parent = parent;

    return [thisState].concat(processChildren(thisState, substates));
  }

  function processChildren(parent, substates) {
    let states = [];
    forEach(substates, function (value, key) {
      if (inheritName && parent.name) key = `${parent.name}.${key}`;
      states = states.concat(processState(parent, value, key));
    });
    return states;
  }

  return processChildren('', tree);
}

export function PromiseResult(promise?) {
  let self = this, _promise: Promise<any>;
  let resolve, reject, complete;

  this.setPromise = function(promise) {
    if (_promise) {
      throw new Error("Already have with'd a promise.");
    }

    const onfulfilled = (data) =>
        resolve = data || true;
    const onrejected = (err) =>
        reject = err || true;
    const done = () =>
        complete = true;

    _promise = promise;
    _promise.then(onfulfilled)
        .catch(onrejected)
        .then(done, done);
  };

  this.get = () =>
      ({ resolve: resolve, reject: reject, complete: complete });

  this.called = () =>
      map(self.get(), (val, key) => val !== undefined);

  if (promise) {
    this.setPromise(promise);
  }
}

export const awaitTransition = (router) => new Promise(resolve => {
  const dereg = router.transitionService.onSuccess({}, (trans) => {
    dereg();
    resolve(trans);
  });
});
