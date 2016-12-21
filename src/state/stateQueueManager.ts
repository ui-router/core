/** @module state */ /** for typedoc */
import { extend, inherit, pluck } from "../common/common";
import { isString } from "../common/predicates";
import { StateDeclaration } from "./interface";
import { State } from "./stateObject";
import { StateBuilder } from "./stateBuilder";
import { UrlRouterProvider } from "../url/urlRouter";
import { StateRegistry, StateRegistryListener } from "./stateRegistry";
import { Disposable } from "../interface";
import { UrlRuleFactory } from "../url/urlRule";

/** @internalapi */
export class StateQueueManager implements Disposable {
  queue: State[];

  constructor(
      public states: { [key: string]: State; },
      public $registry: StateRegistry,
      public builder: StateBuilder,
      public $urlRouterProvider: UrlRouterProvider,
      public listeners: StateRegistryListener[]) {
    this.queue = [];
  }

  /** @internalapi */
  dispose() {
    this.queue = [];
  }

  register(config: StateDeclaration) {
    let {states, queue} = this;
    // Wrap a new object around the state so we can store our private details easily.
    // @TODO: state = new State(extend({}, config, { ... }))
    let state = inherit(new State(), extend({}, config, {
      self: config,
      resolve: config.resolve || [],
      toString: () => config.name
    }));

    if (!isString(state.name)) throw new Error("State must have a valid name");
    if (states.hasOwnProperty(state.name) || pluck(queue, 'name').indexOf(state.name) !== -1)
      throw new Error(`State '${state.name}' is already defined`);

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
    state._urlRule = new UrlRuleFactory(this.$urlRouterProvider._router).fromState(state);
    this.$urlRouterProvider.addRule(state._urlRule);
  }
}
