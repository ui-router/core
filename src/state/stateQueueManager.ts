/** @module state */ /** for typedoc */
import { extend, inherit, pluck, inArray } from "../common/common";
import { isString, isDefined } from "../common/predicates";
import { StateDeclaration } from "./interface";
import { State } from "./stateObject";
import { StateBuilder } from "./stateBuilder";
import { StateRegistryListener, StateRegistry } from "./stateRegistry";
import { Disposable } from "../interface";
import { UrlRouter } from "../url/urlRouter";
import { prop } from "../common/hof";

/** @internalapi */
export class StateQueueManager implements Disposable {
  queue: State[];

  constructor(
      private $registry: StateRegistry,
      private $urlRouter: UrlRouter,
      public states: { [key: string]: State; },
      public builder: StateBuilder,
      public listeners: StateRegistryListener[]) {
    this.queue = [];
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

    while (queue.length > 0) {
      let state: State = queue.shift();
      let result: State = builder.build(state);
      let orphanIdx: number = orphans.indexOf(state);

      if (result) {
        let existingState = this.$registry.get(state.name);

        if (existingState && existingState.name === state.name) {
          throw new Error(`State '${state.name}' is already defined`);
        }

        if (existingState && existingState.name === state.name + ".**") {
          // Remove future state of the same name
          this.$registry.deregister(existingState);
        }

        states[state.name] = state;
        this.attachRoute(state);
        if (orphanIdx >= 0) orphans.splice(orphanIdx, 1);
        registered.push(state);
        continue;
      }

      let prev = previousQueueLength[state.name];
      previousQueueLength[state.name] = queue.length;
      if (orphanIdx >= 0 && prev === queue.length) {
        // Wait until two consecutive iterations where no additional states were dequeued successfully.
        // throw new Error(`Cannot register orphaned state '${state.name}'`);
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
