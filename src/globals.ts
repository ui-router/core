/**
 * @coreapi
 * @module core
 */ /** */
import {StateParams} from "./params/stateParams";
import {StateDeclaration} from "./state/interface";
import {State} from "./state/stateObject";
import {Transition} from "./transition/transition";
import {Queue} from "./common/queue";
import {TransitionService} from "./transition/transitionService";
import {copy} from "./common/common";

/**
 * Global router state
 *
 * This is where we hold the global mutable state such as current state, current
 * params, current transition, etc.
 */
export interface UIRouterGlobals {
  /**
   * Current parameter values
   *
   * The parameter values from the latest successful transition
   */
  params: StateParams;
  /**
   * Current state
   *
   * The to-state from the latest successful transition
   */
  current: StateDeclaration;
  /**
   * Current state
   *
   * The to-state from the latest successful transition
   */
  $current: State;
  /**
   * The current transition (in progress)
   */
  transition: Transition;
}


/**
 * Global router state
 *
 * This is where we hold the global mutable state such as current state, current
 * params, current transition, etc.
 */
export class Globals implements UIRouterGlobals {
  /** @inheritdoc */
  params: StateParams = new StateParams();
  /** @inheritdoc */
  current: StateDeclaration;
  /** @inheritdoc */
  $current: State;
  /** @inheritdoc */
  transition: Transition;

  /** @internalapi */
  transitionHistory = new Queue<Transition>([], 1);

  /** @internalapi */
  successfulTransitions = new Queue<Transition>([], 1);

  /** @hidden */
  constructor(transitionService: TransitionService) {
    // TODO: This probably belongs in a hooks/globals.ts
    const beforeNewTransition = ($transition$: Transition) => {

      this.transition = $transition$;
      this.transitionHistory.enqueue($transition$);

      const updateGlobalState = () => {
        this.successfulTransitions.enqueue($transition$);
        this.$current = $transition$.$to();
        this.current = this.$current.self;
        copy($transition$.params(), this.params);
      };

      $transition$.onSuccess({}, updateGlobalState, {priority: 10000});

      const clearCurrentTransition = () => { if (this.transition === $transition$) this.transition = null; };

      $transition$.promise.then(clearCurrentTransition, clearCurrentTransition);

    };

    transitionService.onBefore({}, beforeNewTransition);
  }
}
