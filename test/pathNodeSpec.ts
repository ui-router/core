import { UIRouter } from '../src/router';
import { StateRegistry } from '../src/state/stateRegistry';
import { StateService } from '../src/state/stateService';
import { PathNode } from '../src/path/pathNode';
import { TestingPlugin } from './_testingPlugin';

let router: UIRouter;
let registry: StateRegistry;
let $state: StateService;

describe('PathNode', () => {
  let a1: PathNode, a2: PathNode, b: PathNode;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(TestingPlugin);

    registry = router.stateRegistry;
    $state = router.stateService;
    const A = {
      name: 'A',
      url: '/:foo/:bar/:baz',
      params: {
        foo: { dynamic: true },
        nonurl: null,
      },
    };

    const B = {
      name: 'B',
      url: '/B/:qux',
    };

    router.stateRegistry.register(A);
    router.stateRegistry.register(B);

    a1 = new PathNode(registry.get('A').$$state());
    a2 = new PathNode(registry.get('A').$$state());
    b = new PathNode(registry.get('B').$$state());
  });

  describe('.diff()', () => {
    it('returns `false` when states differ', () => {
      expect(a1.diff(b)).toBe(false);
    });

    it('should return an empty array when no param values differ', () => {
      a1.applyRawParams({ foo: '1', bar: '2', baz: '3' });
      a2.applyRawParams({ foo: '1', bar: '2', baz: '3' });

      expect(a1.diff(a2)).toEqual([]);
    });

    it('should return an array of Param objects for each value that differs', () => {
      a1.applyRawParams({ foo: '1', bar: '2', baz: '5' });
      a2.applyRawParams({ foo: '1', bar: '2', baz: '3' });

      const baz = a1.parameter('baz');
      expect(a1.diff(a2)).toEqual([baz]);
    });

    it('should return an array of Param objects for each value that differs (2)', () => {
      a1.applyRawParams({ foo: '0', bar: '0', nonurl: '0' });
      a2.applyRawParams({ foo: '1', bar: '1', baz: '1' });

      expect(a1.diff(a2)).toEqual(a1.paramSchema);
    });

    it('should return an array of Param objects for each value that differs (3)', () => {
      a1.applyRawParams({ foo: '1', bar: '2', baz: '3', nonurl: '4' });
      a2.applyRawParams({ foo: '1', bar: '2', baz: '3' });

      const nonurl = a1.parameter('nonurl');
      expect(a1.diff(a2)).toEqual([nonurl]);
    });
  });
});
