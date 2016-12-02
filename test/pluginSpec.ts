import { UIRouter, TransitionService, StateService } from "../src/index";
import * as vanilla from "../src/vanilla";
import { StateRegistry } from "../src/state/stateRegistry";
import { UrlRouter } from "../src/url/urlRouter";
import {UIRouterPlugin} from "../src/interface";
import { isArray } from "../src/common/predicates";

describe('plugin api', function () {
  let router: UIRouter;
  let $registry: StateRegistry;
  let $transitions: TransitionService;
  let $state: StateService;
  let $urlRouter: UrlRouter;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.hashLocationPlugin);
    $registry = router.stateRegistry;
    $state = router.stateService;
    $transitions = router.transitionService;
    $urlRouter = router.urlRouter;
    router.stateRegistry.stateQueue.autoFlush($state);
  });

  class FancyPluginClass implements UIRouterPlugin {
    name = "fancypluginclass";
    constructor(public router: UIRouter) { }
    dispose() {}
  }

  function FancyPluginConstructor(router: UIRouter, options: any) {
    this.name = "fancypluginconstructor";
  }

  describe('initialization', () => {
    it('should accept a plugin class', () => {
      let plugin = router.plugin(FancyPluginClass);
      expect(plugin instanceof FancyPluginClass).toBeTruthy();
      expect(plugin.name).toBe('fancypluginclass');
    });

    it('should accept a constructor function', () => {
      let plugin = router.plugin(FancyPluginConstructor);
      expect(plugin instanceof FancyPluginConstructor).toBeTruthy();
      expect(plugin.name).toBe('fancypluginconstructor');
    });

    it('should accept a factory function', () => {
      function factoryFn(router: UIRouter, options: any) {
        return new FancyPluginClass(router);
      }
      let plugin = router.plugin(factoryFn);
      expect(plugin instanceof FancyPluginClass).toBeTruthy();
      expect(plugin.name).toBe('fancypluginclass');
    });

    it('should return an instance of the plugin', () => {
      let plugin = router.plugin(() => new FancyPluginClass(router));
      expect(plugin instanceof FancyPluginClass).toBeTruthy();
    });

    it('should pass the router instance to the plugin constructor', () => {
      let pluginRouterInstance = undefined;
      function PluginFactory(router) {
        pluginRouterInstance = router;
        return { name: 'plugin' }
      }

      router.plugin(PluginFactory);
      expect(pluginRouterInstance).toBe(router);
    });

    it('should throw if the plugin constructor returns an object without name() getter', () => {
      function PluginFactory(router) {
        return { }
      }

      expect(() => router.plugin(<any> PluginFactory)).toThrow()
    });
  });

  describe('getPlugin', () => {
    it('should return the plugin instance', () => {
      router.plugin(FancyPluginClass);
      let plugin = router.getPlugin('fancypluginclass');
      expect(plugin instanceof FancyPluginClass).toBeTruthy();
    });

    it('should return undefined if no pluginName is registered', () => {
      router.plugin(FancyPluginClass);
      let plugin = router.getPlugin('notexists');
      expect(plugin).toBeUndefined();
    });

    it('should return all registered plugins when no pluginName is specified', () => {
      router.plugin(FancyPluginClass);
      router.plugin(FancyPluginConstructor);
      let plugins = router.getPlugin();
      expect(isArray(plugins)).toBeTruthy();
      expect(plugins.pop() instanceof FancyPluginConstructor).toBeTruthy();
      expect(plugins.pop() instanceof FancyPluginClass).toBeTruthy();
    });
  })
});
