/** @coreapi @module core */ /** */
import {UrlMatcherFactory} from "./url/urlMatcherFactory";
import {UrlRouterProvider} from "./url/urlRouter";
import {UrlRouter} from "./url/urlRouter";
import {TransitionService} from "./transition/transitionService";
import {ViewService} from "./view/view";
import {StateRegistry} from "./state/stateRegistry";
import {StateService} from "./state/stateService";
import {UIRouterGlobals, Globals} from "./globals";
import {UIRouterPlugin} from "./interface";

/**
 * The master class used to instantiate an instance of UI-Router.
 *
 * UI-Router (for a specific framework) will create an instance of this class during bootstrap.
 * This class instantiates and wires the UI-Router services together.
 *
 * After a new instance of the UIRouter class is created, it should be configured for your app.
 * For instance, app states should be registered with the [[stateRegistry]].
 *
 * Tell UI-Router to monitor the URL by calling `uiRouter.urlRouter.listen()` ([[UrlRouter.listen]])
 */
export class UIRouter {
  viewService = new ViewService();

  transitionService: TransitionService = new TransitionService(this);

  globals: UIRouterGlobals = new Globals(this.transitionService);

  urlMatcherFactory: UrlMatcherFactory = new UrlMatcherFactory();

  urlRouterProvider: UrlRouterProvider = new UrlRouterProvider(this.urlMatcherFactory, this.globals.params);

  urlRouter: UrlRouter = new UrlRouter(this.urlRouterProvider);

  stateRegistry: StateRegistry = new StateRegistry(this.urlMatcherFactory, this.urlRouterProvider);

  stateService = new StateService(this);

  constructor() {
    this.viewService.rootContext(this.stateRegistry.root());
    this.globals.$current = this.stateRegistry.root();
    this.globals.current = this.globals.$current.self;
  }

  private _plugins: { [key: string]: UIRouterPlugin } = {};

  /**
   * Adds a plugin to UI-Router
   *
   * This method adds a UI-Router Plugin.
   * A plugin can enhance or change UI-Router behavior using any public API.
   *
   * #### Example:
   * ```js
   * import { MyCoolPlugin } from "ui-router-cool-plugin";
   *
   * var plugin = router.addPlugin(MyCoolPlugin);
   * ```
   *
   * ### Plugin authoring
   *
   * A plugin is simply a class (or constructor function) which accepts a [[UIRouter]] instance and (optionally) an options object.
   *
   * The plugin can implement its functionality using any of the public APIs of [[UIRouter]].
   * For example, it may configure router options or add a Transition Hook.
   *
   * The plugin can then be published as a separate module.
   *
   * #### Example:
   * ```js
   * export class MyAuthPlugin {
   *   constructor(router: UIRouter, options: any) {
   *     let $transitions = router.transitionService;
   *     let $state = router.stateService;
   *
   *     let authCriteria = {
   *       to: (state) => state.data && state.data.requiresAuth
   *     };
   *
   *     function authHook(transition: Transition) {
   *       let authService = transition.injector().get('AuthService');
   *       if (!authService.isAuthenticated()) {
   *         return $state.target('login');
   *       }
   *     }
   *
   *     $transitions.onStart(authCriteria, authHook);
   *   }
   * }
   * ```
   *
   * @param PluginClass a UI-Router Plugin class (or constructor function).
   * @param options options to pass to the plugin
   * @returns {T}
   */
  addPlugin<T extends UIRouterPlugin>(PluginClass: { new(router: UIRouter, options?: any): T }, options: any = {}): T {
    let pluginInstance = new PluginClass(this, options);
    var pluginName = pluginInstance.name();
    return this._plugins[pluginName] = pluginInstance;
  }

  getPlugin(pluginName: string): UIRouterPlugin {
    return this._plugins[pluginName];
  }
}
