/** @publicapi @module state */ /** */
import { inArray, isString, prop } from '../common';
import { _StateDeclaration } from './interface';
import { StateObject } from './stateObject';
import { StateBuilder } from './stateBuilder';
import { StateRegistryListener } from './stateRegistry';
import { Disposable } from '../interface';
import { UIRouter } from '../router';

/** @internalapi */
export class StateQueueManager implements Disposable {
  queue: StateObject[] = [];

  constructor(
    private router: UIRouter,
    public states: { [key: string]: StateObject },
    public builder: StateBuilder,
    public listeners: StateRegistryListener[]
  ) {}

  /** @internalapi */
  dispose() {
    this.queue = [];
  }

  register(stateDecl: _StateDeclaration) {
    const queue = this.queue;
    const state = StateObject.create(stateDecl);
    const name = state.name;

    if (!isString(name)) throw new Error('State must have a valid name');
    if (this.states.hasOwnProperty(name) || inArray(queue.map(prop('name')), name))
      throw new Error(`State '${name}' is already defined`);

    queue.push(state);
    this.flush();

    return state;
  }

  flush() {
    const { queue, states, builder } = this;
    const registered: StateObject[] = [], // states that got registered
      orphans: StateObject[] = [], // states that don't yet have a parent registered
      previousQueueLength = {}; // keep track of how long the queue when an orphan was first encountered
    const getState = name => this.states.hasOwnProperty(name) && this.states[name];
    const notifyListeners = () => {
      if (registered.length) {
        this.listeners.forEach(listener => listener('registered', registered.map(s => s.self)));
      }
    };

    while (queue.length > 0) {
      const state: StateObject = queue.shift();
      const name = state.name;
      const result: StateObject = builder.build(state);
      const orphanIdx: number = orphans.indexOf(state);

      if (result) {
        const existingState = getState(name);
        if (existingState && existingState.name === name) {
          throw new Error(`State '${name}' is already defined`);
        }

        const existingFutureState = getState(name + '.**');
        if (existingFutureState) {
          // Remove future state of the same name
          this.router.stateRegistry.deregister(existingFutureState);
        }

        states[name] = state;
        this.attachRoute(state);
        if (orphanIdx >= 0) orphans.splice(orphanIdx, 1);
        registered.push(state);
        continue;
      }

      const prev = previousQueueLength[name];
      previousQueueLength[name] = queue.length;
      if (orphanIdx >= 0 && prev === queue.length) {
        // Wait until two consecutive iterations where no additional states were dequeued successfully.
        // throw new Error(`Cannot register orphaned state '${name}'`);
        queue.push(state);
        notifyListeners();
        return states;
      } else if (orphanIdx < 0) {
        orphans.push(state);
      }

      queue.push(state);
    }

    notifyListeners();
    return states;
  }

  attachRoute(state: StateObject) {
    if (state.abstract || !state.url) return;
    const rulesApi = this.router.urlService.rules;
    rulesApi.rule(rulesApi.urlRuleFactory.create(state));
  }
}
