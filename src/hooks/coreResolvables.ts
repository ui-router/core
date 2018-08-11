/** @internalapi @module hooks */ /** */
import { Transition } from '../transition/transition';
import { UIRouter } from '../router';
import { TransitionService } from '../transition/transitionService';
import { Resolvable } from '../resolve';
import { inArray, uniqR, unnestR, values } from '../common';
import { PathNode } from '../path';

function addCoreResolvables(trans: Transition) {
  trans.addResolvable(Resolvable.fromData(UIRouter, trans.router), '');
  trans.addResolvable(Resolvable.fromData(Transition, trans), '');
  trans.addResolvable(Resolvable.fromData('$transition$', trans), '');
  trans.addResolvable(Resolvable.fromData('$stateParams', trans.params()), '');

  trans.entering().forEach(state => {
    trans.addResolvable(Resolvable.fromData('$state$', state), state);
  });
}

export const registerAddCoreResolvables = (transitionService: TransitionService) =>
  transitionService.onCreate({}, addCoreResolvables);

const TRANSITION_TOKENS = ['$transition$', Transition];
const isTransition = inArray(TRANSITION_TOKENS);

// References to Transition in the treeChanges pathnodes makes all
// previous Transitions reachable in memory, causing a memory leak
// This function removes resolves for '$transition$' and `Transition` from the treeChanges.
// Do not use this on current transitions, only on old ones.
export const treeChangesCleanup = (trans: Transition) => {
  const nodes = values(trans.treeChanges())
    .reduce(unnestR, [])
    .reduce(uniqR, []);

  // If the resolvable is a Transition, return a new resolvable with null data
  const replaceTransitionWithNull = (r: Resolvable): Resolvable => {
    return isTransition(r.token) ? Resolvable.fromData(r.token, null) : r;
  };

  nodes.forEach((node: PathNode) => {
    node.resolvables = node.resolvables.map(replaceTransitionWithNull);
  });
};
