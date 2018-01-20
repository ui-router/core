/** @module hooks */ /** */
import { Transition } from '../transition/transition';
import { UIRouter } from '../router';
import { TransitionService } from '../transition/transitionService';
import { Resolvable } from '../resolve';
import { extend, inArray, map, mapObj, unnestR, values } from '../common';
import { PathNode } from '../path';
import { TreeChanges } from "../transition";

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
  // If the resolvable is a Transition, return a new resolvable with null data
  const replaceTransitionWithNull = (r: Resolvable): Resolvable =>
    isTransition(r.token) ? Resolvable.fromData(r.token, null) : r;

  const cleanPath = (path: PathNode[]) => path.map((node: PathNode) => {
    const resolvables = node.resolvables.map(replaceTransitionWithNull);
    return extend(node.clone(), { resolvables });
  });

  const treeChanges: TreeChanges = trans.treeChanges();
  mapObj(treeChanges, cleanPath, treeChanges);
};
