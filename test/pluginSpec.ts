import { UIRouter, TransitionService, StateService } from "../src/index";
import "../src/justjs";
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
    $registry = router.stateRegistry;
    $state = router.stateService;
    $transitions = router.transitionService;
    $urlRouter = router.urlRouter;
    router.stateRegistry.stateQueue.autoFlush($state);
  });

  class FancyPlugin extends UIRouterPlugin {
    constructor(public router: UIRouter) {
      super();

    }
    name() { return "fancyplugin" }
  }

  describe('initialization', () => {
    it('should return an instance of the plugin', () => {
      let plugin = router.addPlugin(FancyPlugin);
      expect(plugin instanceof FancyPlugin).toBeTruthy();
    });

    it('should pass the router instance to the plugin constructor', () => {
      let pluginRouterInstance = undefined;
      function Plugin(router) {
        pluginRouterInstance = router;
        this.name = () => "plugin";
      }

      router.addPlugin(<any> Plugin);
      expect(pluginRouterInstance).toBe(router);
    });

    it('should throw if the plugin constructor returns an object without name() getter', () => {
      function Plugin(router) {
      }

      expect(() => router.addPlugin(<any> Plugin)).toThrow()
    });
  });

  describe('getPlugin', () => {
    it('should return the plugin instance', () => {
      router.addPlugin(FancyPlugin);
      let plugin = router.getPlugin('fancyplugin');
      expect(plugin instanceof FancyPlugin).toBeTruthy();
    });
  })
});
