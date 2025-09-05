import { UrlMatcherFactory } from './url/urlMatcherFactory.js';
import { UrlRouter } from './url/urlRouter.js';
import { TransitionService } from './transition/transitionService.js';
import { ViewService } from './view/view.js';
import { StateRegistry } from './state/stateRegistry.js';
import { StateService } from './state/stateService.js';
import { UIRouterGlobals } from './globals.js';
import { UIRouterPlugin, Disposable } from './interface.js';
import { values, removeFrom } from './common/common.js';
import { isFunction } from './common/predicates.js';
import { UrlService } from './url/urlService.js';
import { LocationServices, LocationConfig } from './common/coreservices.js';
import { Trace, trace } from './common/trace.js';
import { makeStub } from './common/index.js';

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
 */
export class UIRouter {
  /** @internal */ $id = _routerInstance++;
  /** @internal */ _disposed = false;
  /** @internal */ private _disposables: Disposable[] = [];

  /** Enable/disable tracing to the javascript console */
  trace: Trace = trace;

  /** Provides services related to ui-view synchronization */
  viewService = new ViewService(this);

  /** An object that contains global router state, such as the current state and params */
  globals: UIRouterGlobals = new UIRouterGlobals();

  /** A service that exposes global Transition Hooks */
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
   * @internal
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
   * Returns a plugin registered with the given `pluginName`.
   *
   * @param pluginName the name of the plugin to get
   * @return the plugin, or undefined
   */
  getPlugin(pluginName: string): UIRouterPlugin;
  /**
   * Returns all registered plugins
   * @return all registered plugins
   */
  getPlugin(): UIRouterPlugin[];
  getPlugin(pluginName?: string): UIRouterPlugin | UIRouterPlugin[] {
    return pluginName ? this._plugins[pluginName] : values(this._plugins);
  }
}

/** @internal */
export type PluginFactory<T> = (router: UIRouter, options?: any) => T;
