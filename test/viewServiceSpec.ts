import { UIRouter } from "../src/router";
import { ViewSyncListener, ViewTuple } from '../src/view';
import { tree2Array } from "./_testUtils";
import { StateRegistry } from "../src/state/stateRegistry";
import { ViewService } from "../src/view/view";
import { ActiveUIView } from "../src/view/interface";

let router: UIRouter = null;
let registry: StateRegistry = null;
let $view: ViewService = null;
let statetree = {
  A: {
    B: {
      C: {
        D: {

        },
      },
    },
  },
};

let count = 0;
const makeUIView = (state?): ActiveUIView => ({
  $type: 'test',
  id: count++,
  name: '$default',
  fqn: '$default',
  config: null,
  creationContext: state,
  configUpdated: function() {},
});

describe("View Service", () => {
  beforeEach(() => {
    router = new UIRouter();
    registry = router.stateRegistry;
    $view = router.viewService;
    tree2Array(statetree, true).forEach(state => registry.register(state));
  });

  describe('registerUIView', () => {
    it("should track a ui-view", () => {
      expect($view.available().length).toBe(0);
      $view.registerUIView(makeUIView());
      expect($view.available().length).toBe(1);
    });

    it("should return a deregistration function", () => {
      expect($view.available().length).toBe(0);
      let deregistrationFn = $view.registerUIView(makeUIView());
      expect(typeof deregistrationFn).toBe('function');
      expect($view.available().length).toBe(1);
      deregistrationFn();
      expect($view.available().length).toBe(0);
    });
  });

  describe('onSync', () => {
    it('registers view sync listeners', () => {
      function listener(tuples: ViewTuple[]) {}
      const listeners: ViewSyncListener[] = ($view as any)._listeners;
      expect(listeners).not.toContain(listener);

      $view._pluginapi._onSync(listener);

      expect(listeners).toContain(listener);
    });

    it('returns a deregistration function', () => {
      function listener(tuples: ViewTuple[]) {}
      const listeners: ViewSyncListener[] = ($view as any)._listeners;
      const deregister = $view._pluginapi._onSync(listener);
      expect(listeners).toContain(listener);

      deregister();
      expect(listeners).not.toContain(listener);
    });

    it('calls the listener during sync()', () => {
      const listener = jasmine.createSpy('listener');
      $view._pluginapi._onSync(listener);
      $view.sync();
      expect(listener).toHaveBeenCalledWith([]);
    });

    it('ViewSyncListeners receive tuples for all registered uiviews', () => {
      const listener = jasmine.createSpy('listener');
      const uiView1 = makeUIView();
      const uiView2 = makeUIView();
      $view.registerUIView(uiView1);
      $view.registerUIView(uiView2);

      $view._pluginapi._onSync(listener);
      $view.sync();

      const tuple1 = { uiView: uiView1, viewConfig: undefined };
      const tuple2 = { uiView: uiView2, viewConfig: undefined };
      expect(listener).toHaveBeenCalledWith([tuple1, tuple2]);
    });
  });
});
