/** @coreapi @module core */ /** */
import { UrlMatcherFactory } from "./url/urlMatcherFactory";
import { UrlRouterProvider } from "./url/urlRouter";
import { UrlRouter } from "./url/urlRouter";
import { TransitionService } from "./transition/transitionService";
import { ViewService } from "./view/view";
import { StateRegistry } from "./state/stateRegistry";
import { StateService } from "./state/stateService";
import { UIRouterGlobals, Globals } from "./globals";
import { UIRouterPlugin, Disposable } from "./interface";
import { values, removeFrom } from "./common/common";
import { isFunction } from "./common/predicates";

/** @hidden */
let _routerInstance = 0;

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
  /** @hidden */
  $id: number = _routerInstance++;

  viewService = new ViewService();

  transitionService: TransitionService = new TransitionService(this);

  globals: UIRouterGlobals = new Globals(this.transitionService);

  urlMatcherFactory: UrlMatcherFactory = new UrlMatcherFactory();

  urlRouterProvider: UrlRouterProvider = new UrlRouterProvider(this.urlMatcherFactory, this.globals.params);

  urlRouter: UrlRouter = new UrlRouter(this.urlRouterProvider);

  stateRegistry: StateRegistry = new StateRegistry(this.urlMatcherFactory, this.urlRouterProvider);

  stateService = new StateService(this);

  private _disposables: Disposable[] = [];

  /** Registers an object to be notified when the router is disposed */
  disposable(disposable: Disposable) {
    this._disposables.push(disposable);
  }

  /**
   * Disposes this router instance
   *
   * When called, clears resources retained by the router by calling `dispose(this)` on all
   * registered [[disposable]] objects.
   *
   * Or, if a `disposable` object is provided, calls `dispose(this)` on that object only.
   *
   * @param disposable (optional) the disposable to dispose
   */
  dispose(disposable?: any): void {
    if (disposable && isFunction(disposable.dispose)) {
      disposable.dispose(this);
      return undefined;
    }

    this._disposables.slice().forEach(d => {
      try {
        typeof d.dispose === 'function' && d.dispose(this);
        removeFrom(this._disposables, d);
      } catch (ignored) {}
    });
  }

  constructor() {
    this.viewService.rootContext(this.stateRegistry.root());
    this.globals.$current = this.stateRegistry.root();
    this.globals.current = this.globals.$current.self;

    this.disposable(this.transitionService);
    this.disposable(this.urlRouterProvider);
    this.disposable(this.urlRouter);
    this.disposable(this.stateRegistry);
  }

  /** @hidden */
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
   * export class MyAuthPlugin implements UIRouterPlugin {
   *   constructor(router: UIRouter, options: any) {
   *     this.name = "MyAuthPlugin";
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
   * @param plugin one of:
   *        - a plugin class which implements [[UIRouterPlugin]]
   *        - a constructor function for a [[UIRouterPlugin]] which accepts a [[UIRouter]] instance
   *        - a factory function which accepts a [[UIRouter]] instance and returns a [[UIRouterPlugin]] instance
   * @param options options to pass to the plugin class/factory
   * @returns the registered plugin instance
   */
  plugin<T extends UIRouterPlugin>(plugin: { new(router: UIRouter, options?: any): T }, options?: any): T;
  /** Allow javascript constructor function */
  plugin<T extends UIRouterPlugin>(plugin: { (router: UIRouter, options?: any): void }, options?: any): T;
  /** Allow javascript factory function */
  plugin<T extends UIRouterPlugin>(plugin: PluginFactory<T>, options?: any): T;
  /** Allow javascript factory function */
  plugin<T extends UIRouterPlugin>(plugin: any, options: any = {}): T {
    let pluginInstance = new plugin(this, options);
    if (!pluginInstance.name) throw new Error("Required property `name` missing on plugin: " + pluginInstance);
    this._disposables.push(pluginInstance);
    return this._plugins[pluginInstance.name] = pluginInstance;
  }

  /**
   * Returns registered plugins
   *
   * Returns the registered plugin of the given `pluginName`.
   * If no `pluginName` is given, returns all registered plugins
   *
   * @param pluginName (optional) the name of the plugin to get
   * @return the named plugin (undefined if not found), or all plugins (if `pluginName` is omitted)
   */
  getPlugin(): UIRouterPlugin[];
  getPlugin(pluginName?: string): UIRouterPlugin;
  getPlugin(pluginName?: string): UIRouterPlugin|UIRouterPlugin[] {
    return pluginName ? this._plugins[pluginName] : values(this._plugins);
  }
}

export type PluginFactory<T> = (router: UIRouter, options?: any) => T;
