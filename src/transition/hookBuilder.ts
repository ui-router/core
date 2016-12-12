/**
 * @coreapi
 * @module transition
 */ /** for typedoc */

import {extend, tail, assertPredicate, unnestR, identity} from "../common/common";
import {isArray} from "../common/predicates";

import {
    TransitionOptions, TransitionHookOptions, IHookRegistry, TreeChanges, IMatchingNodes,
    TransitionHookPhase, TransitionHookScope
} from "./interface";

import {Transition} from "./transition";
import {TransitionHook} from "./transitionHook";
import {State} from "../state/stateObject";
import {PathNode} from "../path/node";
import {TransitionService} from "./transitionService";
import {TransitionEventType} from "./transitionEventType";
import {RegisteredHook} from "./hookRegistry";

/**
 * This class returns applicable TransitionHooks for a specific Transition instance.
 *
 * Hooks ([[RegisteredHook]]) may be registered globally, e.g., $transitions.onEnter(...), or locally, e.g.
 * myTransition.onEnter(...).  The HookBuilder finds matching RegisteredHooks (where the match criteria is
 * determined by the type of hook)
 *
 * The HookBuilder also converts RegisteredHooks objects to TransitionHook objects, which are used to run a Transition.
 *
 * The HookBuilder constructor is given the $transitions service and a Transition instance.  Thus, a HookBuilder
 * instance may only be used for one specific Transition object. (side note: the _treeChanges accessor is private
 * in the Transition class, so we must also provide the Transition's _treeChanges)
 *
 */
export class HookBuilder {

  private $transitions: TransitionService;
  private baseHookOptions: TransitionHookOptions;

  treeChanges: TreeChanges;
  transitionOptions: TransitionOptions;

  toState: State;
  fromState: State;

  constructor(private transition: Transition) {
    this.treeChanges        = transition.treeChanges();
    this.transitionOptions  = transition.options();
    this.toState            = tail(this.treeChanges.to).state;
    this.fromState          = tail(this.treeChanges.from).state;
    this.$transitions       = transition.router.transitionService;
    this.baseHookOptions    = <TransitionHookOptions> {
      transition: transition,
      current: transition.options().current
    };
  }

  buildHooksForPhase(phase: TransitionHookPhase): TransitionHook[] {
    return this.$transitions._pluginapi._getEvents(phase)
        .map(type => this.buildHooks(type))
        .reduce(unnestR, [])
        .filter(identity);
  }

  /**
   * Returns an array of newly built TransitionHook objects.
   *
   * - Finds all RegisteredHooks registered for the given `hookType` which matched the transition's [[TreeChanges]].
   * - Finds [[PathNode]] (or `PathNode[]`) to use as the TransitionHook context(s)
   * - For each of the [[PathNode]]s, creates a TransitionHook
   *
   * @param hookType the type of the hook registration function, e.g., 'onEnter', 'onFinish'.
   */
  buildHooks(hookType: TransitionEventType): TransitionHook[] {
    // Find all the matching registered hooks for a given hook type
    let matchingHooks = this.getMatchingHooks(hookType, this.treeChanges);
    if (!matchingHooks) return [];

     const makeTransitionHooks = (hook: RegisteredHook) => {
       // Fetch the Nodes that caused this hook to match.
       let matches: IMatchingNodes = hook.matches(this.treeChanges);
       // Select the PathNode[] that will be used as TransitionHook context objects
       let matchingNodes: PathNode[] = matches[hookType.criteriaMatchPath.name];

       // Return an array of HookTuples
       return matchingNodes.map(node => {
         let _options = extend({
           bind: hook.bind,
           traceData: { hookType: hookType.name, context: node}
         }, this.baseHookOptions);

         let state = hookType.criteriaMatchPath.scope === TransitionHookScope.STATE ? node.state : null;
         let transitionHook = new TransitionHook(this.transition, state, hook, _options);
         return <HookTuple> { hook, node, transitionHook };
       });
    };

    return matchingHooks.map(makeTransitionHooks)
        .reduce(unnestR, [])
        .sort(tupleSort(hookType.reverseSort))
        .map(tuple => tuple.transitionHook);
  }

  /**
   * Finds all RegisteredHooks from:
   * - The Transition object instance hook registry
   * - The TransitionService ($transitions) global hook registry
   *
   * which matched:
   * - the eventType
   * - the matchCriteria (to, from, exiting, retained, entering)
   *
   * @returns an array of matched [[RegisteredHook]]s
   */
  public getMatchingHooks(hookType: TransitionEventType, treeChanges: TreeChanges): RegisteredHook[] {
    let isCreate = hookType.hookPhase === TransitionHookPhase.CREATE;

    // Instance and Global hook registries
    let registries = isCreate ? [ this.$transitions ] : [ this.transition, this.$transitions ];

    return registries.map((reg: IHookRegistry) => reg.getHooks(hookType.name))    // Get named hooks from registries
        .filter(assertPredicate(isArray, `broken event named: ${hookType.name}`)) // Sanity check
        .reduce(unnestR, [])                                                      // Un-nest RegisteredHook[][] to RegisteredHook[] array
        .filter(hook => hook.matches(treeChanges));                               // Only those satisfying matchCriteria
  }
}

interface HookTuple { hook: RegisteredHook, node: PathNode, transitionHook: TransitionHook }

/**
 * A factory for a sort function for HookTuples.
 *
 * The sort function first compares the PathNode depth (how deep in the state tree a node is), then compares
 * the EventHook priority.
 *
 * @param reverseDepthSort a boolean, when true, reverses the sort order for the node depth
 * @returns a tuple sort function
 */
function tupleSort(reverseDepthSort = false) {
  return function nodeDepthThenPriority(l: HookTuple, r: HookTuple): number {
    let factor = reverseDepthSort ? -1 : 1;
    let depthDelta = (l.node.state.path.length - r.node.state.path.length) * factor;
    return depthDelta !== 0 ? depthDelta : r.hook.priority - l.hook.priority;
  }
}