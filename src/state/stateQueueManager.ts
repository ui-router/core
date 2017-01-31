/** @module state */ /** for typedoc */
import { inArray } from "../common/common";
import { isString } from "../common/predicates";
import { StateDeclaration } from "./interface";
import { State } from "./stateObject";
import { StateBuilder } from "./stateBuilder";
import { StateRegistryListener, StateRegistry } from "./stateRegistry";
import { Disposable } from "../interface";
import { UrlRouter } from "../url/urlRouter";
import { prop } from "../common/hof";
import { StateMatcher } from "./stateMatcher";

/** @internalapi */
export class StateQueueManager implements Disposable {
  queue: State[];
  matcher: StateMatcher;

  constructor(
      private $registry: StateRegistry,
      private $urlRouter: UrlRouter,
      public states: { [key: string]: State; },
      public builder: StateBuilder,
      public listeners: StateRegistryListener[]) {
    this.queue = [];
    this.matcher = $registry.matcher;
  }

  /** @internalapi */
  dispose() {
    this.queue = [];
  }

  register(stateDecl: StateDeclaration) {
    let queue = this.queue;
    let state = State.create(stateDecl);
    let name = state.name;

    if (!isString(name)) throw new Error("State must have a valid name");
    if (this.states.hasOwnProperty(name) || inArray(queue.map(prop('name')), name))
      throw new Error(`State '${name}' is already defined`);

    queue.push(state);
    this.flush();

    return state;
  }

  flush() {
    let {queue, states, builder} = this;
    let registered: State[] = [], // states that got registered
        orphans: State[] = [], // states that don't yet have a parent registered
        previousQueueLength = {}; // keep track of how long the queue when an orphan was first encountered
    const getState = (name) =>
        this.states.hasOwnProperty(name) && this.states[name];

    while (queue.length > 0) {
      let state: State = queue.shift();
      let name = state.name;
      let result: State = builder.build(state);
      let orphanIdx: number = orphans.indexOf(state);

      if (result) {
        let existingState = getState(name);
        if (existingState && existingState.name === name) {
          throw new Error(`State '${name}' is already defined`);
        }

        let existingFutureState = getState(name + ".**");
        if (existingFutureState) {
          // Remove future state of the same name
          this.$registry.deregister(existingFutureState);
        }

        states[name] = state;
        this.attachRoute(state);
        if (orphanIdx >= 0) orphans.splice(orphanIdx, 1);
        registered.push(state);
        continue;
      }

      let prev = previousQueueLength[name];
      previousQueueLength[name] = queue.length;
      if (orphanIdx >= 0 && prev === queue.length) {
        // Wait until two consecutive iterations where no additional states were dequeued successfully.
        // throw new Error(`Cannot register orphaned state '${name}'`);
        queue.push(state);
        return states;
      } else if (orphanIdx < 0) {
        orphans.push(state);
      }

      queue.push(state);
    }

    if (registered.length) {
      this.listeners.forEach(listener => listener("registered", registered.map(s => s.self)));
    }

    return states;
  }

  attachRoute(state: State) {
    if (state.abstract || !state.url) return;

    this.$urlRouter.rule(this.$urlRouter.urlRuleFactory.create(state));
  }
}
