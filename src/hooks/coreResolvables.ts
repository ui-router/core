/** @module hooks */ /** */
import { Transition } from '../transition/transition';
import { UIRouter } from '../router';
import { TransitionService } from '../transition/transitionService';

function addCoreResolvables(trans: Transition) {
  trans.addResolvable({ token: UIRouter,       deps: [], resolveFn: () => trans.router,   data: trans.router },   '');
  trans.addResolvable({ token: Transition,     deps: [], resolveFn: () => trans,          data: trans },          '');
  trans.addResolvable({ token: '$transition$', deps: [], resolveFn: () => trans,          data: trans },          '');
  trans.addResolvable({ token: '$stateParams', deps: [], resolveFn: () => trans.params(), data: trans.params() }, '');

  trans.entering().forEach(state => {
    trans.addResolvable({ token: '$state$',    deps: [], resolveFn: () => state,          data: state },       state);
  });
}

export const registerAddCoreResolvables = (transitionService: TransitionService) =>
    transitionService.onCreate({}, addCoreResolvables);
