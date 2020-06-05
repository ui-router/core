import { UrlMatcherFactory } from './url/urlMatcherFactory';
import { UrlRouter } from './url/urlRouter';
import { TransitionService } from './transition/transitionService';
import { ViewService } from './view/view';
import { StateRegistry } from './state/stateRegistry';
import { StateService } from './state/stateService';
import { UIRouterGlobals } from './globals';
import { UIRouterPlugin, Disposable } from './interface';
import { values, removeFrom } from './common/common';
import { isFunction } from './common/predicates';
import { UrlService } from './url/urlService';
import { LocationServices, LocationConfig } from './common/coreservices';
import { Trace, trace } from './common/trace';
import { makeStub } from './common';

/** @internal */
let _routerInstance = 0;

/** @internal */
const locSvcFns: (keyof LocationServices)[] = ['url', 'path', 'search', 'hash', 'onChange'];
/** @internal */
const locCfgFns: (keyof LocationConfig)[] = ['port', 'protocol', 'host', 'baseHref', 'html5Mode', 'hashPrefix'];
/** @internal */
const locationServiceStub = makeStub<LocationServices>('LocationServices', locSvcFns);
/** @internal */
const locationConfigStub = makeStub<LocationConfig>('LocationConfig', locCfgFns);

/**
 * An instance of UI-Router.
 *
 * This object contains references to service APIs which define your application's routing behavior.
 *
 * At a minimum, you should use the [[UIRouter.stateRegistry]] API to register application states (routes).
 */
export class UIRouter {
  /** @internal */ $id = _routerInstance++;
  /** @internal */ _disposed = false;
  /** @internal */ private _disposables: Disposable[] = [];

  /** Provides trace information to the console */
  trace: Trace = trace;

  /** Provides services related to ui-view synchronization */
  viewService = new ViewService(this);

  /** Global router state */
  globals: UIRouterGlobals = new UIRouterGlobals();

  /** Provides services related to Transitions */
  transitionService: TransitionService = new TransitionService(this);

  /**
   * Deprecated for public use. Use [[urlService]] instead.
   * @deprecated Use [[urlService]] instead
   */
  urlMatcherFactory: UrlMatcherFactory = new UrlMatcherFactory(this);

  /**
   * Deprecated for public use. Use [[urlService]] instead.
   * @deprecated Use [[urlService]] instead
   */
  urlRouter: UrlRouter = new UrlRouter(this);

  /** Provides services related to the URL */
  urlService: UrlService = new UrlService(this);

  /** Provides a registry for states, and related registration services */
  stateRegistry: StateRegistry = new StateRegistry(this);

  /** Provides services related to states */
  stateService = new StateService(this);

  /** @internal plugin instances are registered here */
  private _plugins: { [key: string]: UIRouterPlugin } = {};

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

    this._disposed = true;
    this._disposables.slice().forEach((d) => {
      try {
        typeof d.dispose === 'function' && d.dispose(this);
        removeFrom(this._disposables, d);
      } catch (ignored) {}
    });
  }

  /**
   * Creates a new `UIRouter` object
   *
   * @param locationService a [[LocationServices]] implementation
   * @param locationConfig a [[LocationConfig]] implementation
   * @internal
   */
  constructor(
    public locationService: LocationServices = locationServiceStub,
    public locationConfig: LocationConfig = locationConfigStub
  ) {
    this.viewService._pluginapi._rootViewContext(this.stateRegistry.root());
    this.globals.$current = this.stateRegistry.root();
    this.globals.current = this.globals.$current.self;

    this.disposable(this.globals);
    this.disposable(this.stateService);
    this.disposable(this.stateRegistry);
    this.disposable(this.transitionService);
    this.disposable(this.urlService);
    this.disposable(locationService);
    this.disposable(locationConfig);
  }

  /** Add plugin (as ES6 class) */
  plugin<T extends UIRouterPlugin>(plugin: { new (router: UIRouter, options?: any): T }, options?: any): T;
  /** Add plugin (as javascript constructor function) */
  plugin<T extends UIRouterPlugin>(plugin: { (router: UIRouter, options?: any): void }, options?: any): T;
  /** Add plugin (as javascript factory function) */
  plugin<T extends UIRouterPlugin>(plugin: PluginFactory<T>, options?: any): T;
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
  plugin<T extends UIRouterPlugin>(plugin: any, options: any = {}): T {
    const pluginInstance = new plugin(this, options);
    if (!pluginInstance.name) throw new Error('Required property `name` missing on plugin: ' + pluginInstance);
    this._disposables.push(pluginInstance);
    return (this._plugins[pluginInstance.name] = pluginInstance);
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
  getPlugin(pluginName: string): UIRouterPlugin;
  getPlugin(): UIRouterPlugin[];
  getPlugin(pluginName?: string): UIRouterPlugin | UIRouterPlugin[] {
    return pluginName ? this._plugins[pluginName] : values(this._plugins);
  }
}

/** @internal */
export type PluginFactory<T> = (router: UIRouter, options?: any) => T;
