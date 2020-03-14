import { UIRouter } from '../src/router';
import { ActiveUIView, ViewSyncListener, ViewTuple } from '../src/view';
import { tree2Array } from './_testUtils';
import { StateRegistry } from '../src/state/stateRegistry';
import { ViewService } from '../src/view/view';
import { RegisteredUIViewPortal } from '../src/view/interface';

let router: UIRouter = null;
let registry: StateRegistry = null;
let $view: ViewService = null;
const statetree = {
  A: {
    B: {
      C: {
        D: {},
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

describe('View Service', () => {
  beforeEach(() => {
    router = new UIRouter();
    registry = router.stateRegistry;
    $view = router.viewService;
    tree2Array(statetree, true).forEach(state => registry.register(state));
  });

  describe('registerUIView', () => {
    it('should track a ui-view', () => {
      expect($view.available().length).toBe(0);
      $view.registerUIView(makeUIView());
      expect($view.available().length).toBe(1);
    });

    it('should return a deregistration function', () => {
      expect($view.available().length).toBe(0);
      const deregistrationFn = $view.registerUIView(makeUIView());
      expect(typeof deregistrationFn).toBe('function');
      expect($view.available().length).toBe(1);
      deregistrationFn();
      expect($view.available().length).toBe(0);
    });
  });

  describe('_pluginapi._registeredUIView', () => {
    it('should return a ui-view from an id', () => {
      expect($view._pluginapi._registeredUIViews()).toEqual([]);

      const uiView = makeUIView();
      const id = $view.registerView(uiView.$type, null, uiView.name, () => null);
      const registeredView = $view._pluginapi._registeredUIView(id);
      expect(registeredView).toBeDefined();
      expect(registeredView.name).toBe(uiView.name);
      expect(registeredView.fqn).toBe(uiView.fqn);
      expect(registeredView.id).toBe(id);
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
      const id1 = $view.registerView('type1', null, 'foo', () => null);
      const id2 = $view.registerView('type2', null, 'bar', () => null);

      $view._pluginapi._onSync(listener);
      $view.sync();

      const argument = listener.calls.mostRecent().args[0];
      expect(argument).toEqual(jasmine.any(Array));
      expect(argument.length).toBe(2);
      const [tuple1, tuple2] = argument;
      expect(Object.keys(tuple1)).toEqual(['uiView', 'viewConfig']);
      expect(Object.keys(tuple2)).toEqual(['uiView', 'viewConfig']);
      expect(tuple1.uiView).toEqual(jasmine.objectContaining({ id: id1 }));
      expect(tuple2.uiView).toEqual(jasmine.objectContaining({ id: id2 }));
    });
  });
});
