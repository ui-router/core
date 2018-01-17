import { UIRouter } from '../src/router';
import { tree2Array } from './_testUtils';
import { find } from '../src/common/common';
import { StateService } from '../src/state/stateService';
import { StateDeclaration } from '../src/state/interface';
import { TestingPlugin } from './_testingPlugin';
import { TransitionService } from '../src/transition/transitionService';


const statetree = {
  A: {
    AA: {
      AAA:  {
        url: '/:fooId', params: { fooId: '' },
      },
    },
  },
  B: {},
};

describe('hooks', () => {
  let router: UIRouter;
  let $state: StateService;
  let $transitions: TransitionService;
  let states: StateDeclaration[];
  let init: Function;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(TestingPlugin);

    $state = router.stateService;
    $transitions = router.transitionService;
    states = tree2Array(statetree, false);
    init = () => states.forEach(state => router.stateRegistry.register(state));
  });

  describe('redirectTo:', () => {
    it('should redirect to a state by name from the redirectTo: string', (done) => {
      find(states, s => s.name === 'A').redirectTo = 'AAA';
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('AAA');
        done();
      });
    });

    it('should redirect to a state by name from the redirectTo: object', (done) => {
      find(states, s => s.name === 'A').redirectTo = { state: 'AAA' };
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('AAA');
        done();
      });
    });

    it('should redirect to a state and params by name from the redirectTo: object', (done) => {
      find(states, s => s.name === 'A').redirectTo = { state: 'AAA', params: { fooId: 'abc' } };
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('AAA');
        expect(router.globals.params['fooId']).toBe('abc');
        done();
      });
    });

    it('should redirect to a TargetState returned from the redirectTo: function', (done) => {
      find(states, s => s.name === 'A').redirectTo =
          () => $state.target('AAA');
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('AAA');
        done();
      });
    });

    it('should redirect after waiting for a promise for a state name returned from the redirectTo: function', (done) => {
      find(states, s => s.name === 'A').redirectTo = () => new Promise((resolve) => {
        setTimeout(() => resolve('AAA'), 50);
      });
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('AAA');
        done();
      });
    });

    it('should redirect after waiting for a promise for a {state, params} returned from the redirectTo: function', (done) => {
      find(states, s => s.name === 'A').redirectTo = () => new Promise((resolve) => {
        setTimeout(() => resolve({ state: 'AAA', params: { fooId: 'FOO' } }), 50);
      });
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('AAA');
        expect(router.globals.params['fooId']).toBe('FOO');
        done();
      });
    });

    it('should redirect after waiting for a promise for a TargetState returned from the redirectTo: function', (done) => {
      find(states, s => s.name === 'A').redirectTo = () => new Promise((resolve) => {
        setTimeout(() => resolve($state.target('AAA')), 50);
      });
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('AAA');
        done();
      });
    });

    // Test for #3117
    it('should not redirect if the redirectTo: function returns undefined', (done) => {
      find(states, s => s.name === 'A').redirectTo = function() {} as any;
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('A');
        done();
      });
    });

    it('should not redirect if the redirectTo: function returns something other than a string, { state, params}, TargetState (or promise for)', (done) => {
      find(states, s => s.name === 'A').redirectTo = () => new Promise((resolve) => {
        setTimeout(() => resolve(12345 as any), 50);
      });
      init();

      $state.go('A').then(() => {
        expect(router.globals.current.name).toBe('A');
        done();
      });
    });
  });

  describe('onEnter:', () => {
    it('should enter states from shallow to deep states', (done) => {
      init();
      let log = [];
      $transitions.onEnter({}, (trans, state) => { log.push(state); });

      $state.go('B')
          .then(() => expect(router.globals.current.name).toBe('B'))
          .then(() => {
            log = [];
            return $state.go('AAA');
          })
          .then(() => {
            expect(router.globals.current.name).toBe('AAA');
            expect(log.map(x => x.name)).toEqual(['A', 'AA', 'AAA']);
          })
          .then(done);
    });
  });

  describe('onExit:', () => {
    it('should exit states from deep to shallow states', (done) => {
      init();
      let log = [];
      $transitions.onExit({}, (trans, state) => { log.push(state); });

      $state.go('AAA')
          .then(() => expect(router.globals.current.name).toBe('AAA'))
          .then(() => {
            log = [];
            return $state.go('B');
          })
          .then(() => {
            expect(router.globals.current.name).toBe('B');
            expect(log.map(x => x.name)).toEqual(['AAA', 'AA', 'A']);
          })
          .then(done);
    });
  });

  it('should not run a hook after the router is stopped', (done) => {
    init();
    let called = false;
    router.transitionService.onSuccess({}, () => called = true);

    $state.go('A').catch(err => {
      expect(called).toBe(false);
      expect(err).toBeDefined();
      expect(err.detail).toContain('disposed');
      done();
    });

    router.dispose();
  });

  it('should not process a hook result after the router is stopped', (done) => {
    init();
    let called = false;
    let disposed, isdisposed = new Promise<any>(resolve => disposed = resolve);

    router.transitionService.onEnter({}, () => {
      called = true;
      return isdisposed.then(() => $state.target('B'));
    });

    $state.go('A').catch(err => {
      expect(called).toBe(true);
      expect(err).toBeDefined();
      expect(err.detail).toContain('disposed');
      done();
    });

    setTimeout(() => { router.dispose(); disposed(); }, 50);
  });
});
