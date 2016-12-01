import { UIRouter, TransitionService, StateService } from "../src/index";
import * as vanilla from "../src/vanilla";
import { StateRegistry } from "../src/state/stateRegistry";
import { UrlRouter } from "../src/url/urlRouter";
import {UIRouterPlugin} from "../src/interface";

describe('plugin api', function () {
  let router: UIRouter;
  let $registry: StateRegistry;
  let $transitions: TransitionService;
  let $state: StateService;
  let $urlRouter: UrlRouter;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.services);
    router.plugin(vanilla.hashLocation);
    $registry = router.stateRegistry;
    $state = router.stateService;
    $transitions = router.transitionService;
    $urlRouter = router.urlRouter;
    router.stateRegistry.stateQueue.autoFlush($state);
  });

  class FancyPlugin implements UIRouterPlugin {
    constructor(public router: UIRouter) { }
    name = "fancyplugin"
  }

  describe('initialization', () => {
    it('should return an instance of the plugin', () => {
      let plugin = router.plugin(() => new FancyPlugin(router));
      expect(plugin instanceof FancyPlugin).toBeTruthy();
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
      router.plugin(() => new FancyPlugin(router));
      let plugin = router.getPlugin('fancyplugin');
      expect(plugin instanceof FancyPlugin).toBeTruthy();
    });
  })
});
