/**
 * # The state subsystem
 *
 * This subsystem implements the ui-router state tree
 *
 * - The [[StateService]] has state-related service methods such as:
 *   - [[StateService.get]]: Get a registered [[StateDeclaration]] object
 *   - [[StateService.go]]: Transition from the current state to a new state
 *   - [[StateService.reload]]: Reload the current state
 *   - [[StateService.target]]: Get a [[TargetState]] (useful when redirecting from a Transition Hook)
 *   - [[StateService.onInvalid]]: Register a callback for when a transition to an invalid state is started
 *   - [[StateService.defaultErrorHandler]]: Register a global callback for when a transition errors
 * - The [[StateDeclaration]] interface defines the shape of a state declaration
 * - The [[StateRegistry]] contains all the registered states
 *   - States can be added/removed using the [[StateRegistry.register]] and [[StateRegistry.deregister]]
 *     - Note: Bootstrap state registration differs by front-end framework.
 *   - Get notified of state registration/deregistration using [[StateRegistry.onStatesChanged]].
 *
 * @packageDocumentation
 */
export * from './interface.js';
export * from './stateBuilder.js';
export * from './stateObject.js';
export * from './stateMatcher.js';
export * from './stateQueueManager.js';
export * from './stateRegistry.js';
export * from './stateService.js';
export * from './targetState.js';
