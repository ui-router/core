import { UIRouter, TransitionService, StateService } from "../src/index";
import * as vanilla from "../src/vanilla";

import { StateRegistry } from "../src/state/stateRegistry";
import { services } from "../src/common/coreservices";
import { UrlRouter } from "../src/url/urlRouter";
import {StateDeclaration} from "../src/state/interface";
import {tail} from "../src/common/common";
import {Transition} from "../src/transition/transition";

describe('future state', function () {
  let router: UIRouter;
  let $registry: StateRegistry;
  let $transitions: TransitionService;
  let $state: StateService;
  let $urlRouter: UrlRouter;

  const wait = (val?) =>
      new Promise((resolve) => setTimeout(() => resolve(val)));

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

  describe('registry', () => {
    it('should register future states', () => {
      let beforeLen = $registry.get().length;
      $registry.register({ name: 'future.**' });
      expect($registry.get().length).toBe(beforeLen + 1);
      expect(tail($registry.get()).name).toBe('future.**');
    });

    it('should get future states by non-wildcard name', () => {
      $registry.register({ name: 'future.**' });
      expect($registry.get('future')).toBeDefined();
    });

    it('should get future states by wildcard name', () => {
      $registry.register({ name: 'future.**' });
      expect($registry.get('future.**')).toBeDefined();
    });

    it('should get future states by state declaration object', () => {
      let statedef = { name: 'future.**' };
      let state = $registry.register(statedef);
      expect($registry.get(statedef)).toBe(statedef);
    });

    it('should get future states by state object', () => {
      let statedef = { name: 'future.**' };
      let state = $registry.register(statedef);
      expect($registry.get(state)).toBe(statedef);
    });

    it('should replace a future state when a normal state of the same name is registered', () => {
      let state = $registry.register({ name: 'future.**' });

      expect($registry.get('future')).toBe(state.self);
      expect($registry.get('future.**')).toBe(state.self);
      expect($registry.matcher.find('future')).toBe(state);
      expect($registry.matcher.find('future').name).toBe('future.**');
      let statecount = $registry.get().length;

      // Register the regular (non-future) state
      let regularState = $registry.register({ name: 'future', url: '/future', resolve: {} });

      expect($registry.get('future')).toBe(regularState.self);
      expect($registry.matcher.find('future')).toBe(regularState);
      expect($registry.get('future.**')).toBeFalsy();
      expect($registry.get().length).toBe(statecount); // Total number of states did not change
    });
  });

  describe('state matcher', () => {
    it('should match future states (by non-wildcard name)', () => {
      let state = $registry.register({ name: 'future.**' });
      expect($registry.matcher.find('future')).toBe(state);
    });

    it('should match any potential children of the future state (by name prefix)', () => {
      let state = $registry.register({ name: 'future.**' });
      expect($registry.matcher.find('future.lazystate')).toBe(state);
    });

    it('should match any potential descendants of the future state (by name prefix)', () => {
      let state = $registry.register({ name: 'future.**' });
      expect($registry.matcher.find('future.foo.bar.baz')).toBe(state);
    });

    it('should match future states (by wildcard name)', () => {
      let state = $registry.register({ name: 'future.**' });
      expect($registry.matcher.find('future.**')).toBe(state);
    });

    it('should match future states (by state declaration object)', () => {
      let stateDef = { name: 'future.**' };
      let state = $registry.register(stateDef);
      expect($registry.matcher.find(stateDef)).toBe(state);
    });

    it('should match future states (by internal state object)', () => {
      let stateDef = { name: 'future.**' };
      let state = $registry.register(stateDef);
      expect($registry.matcher.find(state)).toBe(state);
    });

    it('should not match future states with non-matching prefix', () => {
      let state = $registry.register({ name: 'future.**' });
      expect($registry.matcher.find('futurX')).toBeFalsy();
      expect($registry.matcher.find('futurX.lazystate')).toBeFalsy();
      expect($registry.matcher.find('futurX.foo.bar.baz')).toBeFalsy();
      expect($registry.matcher.find('futurX.**')).toBeFalsy();
    });
  });

  describe('url matcher', () => {
    let match = (url): StateDeclaration => {
      let matches: StateDeclaration[] = router.stateRegistry.get()
          .filter(state => state.$$state().url.exec(url));
      if (matches.length > 1) throw new Error('Matched ' + matches.length + ' states');
      return matches[0];
    };

    it('should match future states by url', () => {
      let state = $registry.register({ name: 'future.**', url: '/future' });
      expect(match('/future')).toBe(state.self);
    });

    it('should not match future states if the prefix does not match', () => {
      let state = $registry.register({ name: 'future.**', url: '/future' });
      expect(match('/futurX')).toBeFalsy();
    });

    it('should match the future state for any urls that start with the url prefix', () => {
      let state = $registry.register({ name: 'future.**', url: '/future' });
      expect(match('/future')).toBe(state.self);
      expect(match('/futurex')).toBe(state.self);
      expect(match('/future/foo')).toBe(state.self);
      expect(match('/future/asdflj/32oi/diufg')).toBe(state.self);
    });
  });

  describe('imperative StateService.lazyLoad api', () => {

    describe('should run the lazyLoad function', () => {
      let stateDeclaration, stateObject, lazyLoadCount;

      beforeEach(() => {
        stateDeclaration = { name: 'state1', url: '/state1', lazyLoad: () => Promise.resolve(lazyLoadCount++) };
        stateObject = $registry.register(stateDeclaration);
        lazyLoadCount = 0;
      });

      afterEach(() => expect(lazyLoadCount).toBe(1));

      it('given a name',                    (done) => $state.lazyLoad('state1').then(done));
      it('given a state declaration',       (done) => $state.lazyLoad(stateDeclaration).then(done));
      it('given a state object',            (done) => $state.lazyLoad(stateObject).then(done));
      it('given a state from the registry', (done) => $state.lazyLoad($registry.get('state1')).then(done));
    });

    it('should throw if there is no lazyLoad function', () => {
      $registry.register({ name: 'nolazyloadfn', url: '/nolazyloadfn' });
      expect(() => $state.lazyLoad('nolazyloadfn')).toThrow();
    });

    it('should resolve to the lazyLoad result', (done) => {
      $registry.register({name: 'll', url: '/ll', lazyLoad: () => Promise.resolve('abc')});
      $state.lazyLoad('ll').then((result) => {
        expect(result).toBe('abc');
        done();
      });
    });

    it('should pass a transition and the state context to the lazyLoad function', (done) => {
      let objs = {};
      var stateDefinition = {name: 'll', url: '/ll', lazyLoad: (trans, state) => (objs = { trans, state }, null) };
      $registry.register(stateDefinition);
      $state.lazyLoad('ll').then(() => {
        expect(objs['trans'] instanceof Transition).toBeTruthy();
        expect(objs['state']).toBe(stateDefinition);
        done();
      });
    });

    it('should remove the lazyLoad function from the state definition', (done) => {
      let llstate = {name: 'll', url: '/ll', lazyLoad: () => Promise.resolve('abc')};
      $registry.register(llstate);
      $state.lazyLoad('ll').then(() => {
        expect(llstate.lazyLoad).toBeUndefined();
        done();
      });
    });

    it('should not re-run the pending lazyLoad function', (done) => {
      let lazyLoadCount = 0;
      const lazyLoad = () => new Promise(resolve => setTimeout(() => resolve(++lazyLoadCount), 100));
      $registry.register({name: 'll', lazyLoad: lazyLoad});

      Promise.all([
        $state.lazyLoad('ll'),
        $state.lazyLoad('ll')
      ]).then((result) => {
        expect(result).toEqual([1,1]);
        expect(lazyLoadCount).toBe(1);
        done();
      });
    });

    it('should allow lazyLoad retry after a failed lazyload attempt', (done) => {
      let lazyLoadCount = 0;
      const lazyLoad = () => new Promise(resolve => {
        lazyLoadCount++;
        throw new Error('doh');
      });
      let stateDeclaration = {name: 'll', lazyLoad: lazyLoad};
      $registry.register(stateDeclaration);

      $state.lazyLoad('ll').catch(err => {
        expect(err).toBeDefined();
        expect(err.message).toBe('doh');
        expect(stateDeclaration.lazyLoad['_promise']).toBeUndefined();

        $state.lazyLoad('ll').catch(err => {
          expect(err).toBeDefined();
          expect(err.message).toBe('doh');
          expect(lazyLoadCount).toBe(2);
          done();
        })
      });

      expect(stateDeclaration.lazyLoad['_promise']).toBeDefined();
    });
  });

  describe('which returns a successful promise', () => {
    let lazyStateDefA = { name: 'A', url: '/a/:id', params: {id: "default"} };
    let futureStateDef;

    beforeEach(() => {
      futureStateDef = {
        name: 'A.**', url: '/a',
        lazyLoad: () => new Promise(resolve => { resolve({ states: [lazyStateDefA] }); })
      };

      $registry.register(futureStateDef)
    });

    it('should deregister the placeholder (future state)', (done) => {
      expect($state.get().map(x=>x.name)).toEqual(["", "A.**"]);
      expect($state.get('A')).toBe(futureStateDef);
      expect($state.get('A').lazyLoad).toBeDefined();

      $state.go('A').then(() => {
        expect($state.get().map(x=>x.name)).toEqual(["", "A"]);
        expect($state.get('A')).toBe(lazyStateDefA);
        expect($state.get('A').lazyLoad).toBeUndefined();
        expect($state.current.name).toBe('A');
        done();
      })
    });

    it('should register newly loaded states returned in the `states: ` array', (done) => {
      expect($state.get('A')).toBe(futureStateDef);

      $state.go('A').then(() => {
        expect($state.get().map(x=>x.name)).toEqual(["", "A"]);
        expect($state.get('A')).toBe(lazyStateDefA);
        expect($state.get('A').lazyLoad).toBeUndefined();
        expect($state.current.name).toBe('A');
        done();
      })
    });

    it('should retry the original $state.go()', (done) => {
      $state.go('A', { id: 'abc' }).then(() => {
        expect($state.current.name).toBe('A');
        expect($state.params).toEqualValues({ id: 'abc' });
        done();
      })
    });

    it('triggered by a URL sync should re-parse the URL to activate the lazy loaded state', (done) => {
      services.location.setUrl('/a/def');
      $urlRouter.sync();
      $transitions.onSuccess({}, () => {
        expect($state.current.name).toBe('A');
        expect($state.params).toEqualValues({ id: 'def' });
        done();
      });
    });
  });

  describe('that resolves to multiple states', () => {
    let lazyStateDefA = { name: 'A', url: '/a/:id', params: {id: "default"} };
    let lazyStateDefAB = { name: 'A.B', url: '/b' };
    let futureStateDef;

    beforeEach(() => {
      futureStateDef = {
        name: 'A.**', url: '/a',
        lazyLoad: () => new Promise(resolve => { resolve({ states: [lazyStateDefA, lazyStateDefAB] }); })
      };
      $registry.register(futureStateDef)
    });

    it('should register all returned states and remove the placeholder', (done) => {
      expect($state.get().map(x=>x.name)).toEqual(["", "A.**"]);
      expect($state.get('A')).toBe(futureStateDef);
      expect($state.get('A').lazyLoad).toBeDefined();

      $state.go('A').then(() => {
        expect($state.get().map(x=>x.name)).toEqual(["", "A", "A.B"]);
        expect($state.get('A')).toBe(lazyStateDefA);
        expect($state.get('A').lazyLoad).toBeUndefined();
        expect($state.current.name).toBe('A');
        done();
      })
    });

    it('should allow transitions to non-loaded child states', (done) => {
      $state.go('A.B', { id: 'abc' }).then(() => {
        expect($state.current.name).toBe('A.B');
        expect($state.params).toEqualValues({ id: 'abc' });
        done();
      })
    });

    it('should re-parse the URL to activate the final state', (done) => {
      services.location.setUrl('/a/def/b');
      $urlRouter.sync();
      $transitions.onSuccess({}, () => {
        expect($state.current.name).toBe('A.B');
        expect($state.params).toEqualValues({ id: 'def' });
        done();
      });
    });
  });

  it('should not invoke lazyLoad twice', (done) => {
    $state.defaultErrorHandler(function() {});

    let count = 0;
    let futureStateDef = {
      name: 'A.**', url: '/a',
      lazyLoad: () => new Promise(resolve => {
        count++;
        setTimeout(() => resolve({ states: [{ name: 'A', url: '/a' }] }), 50);
      })
    };
    $registry.register(futureStateDef);

    $state.go('A');
    $state.go('A').then(() => {
      expect(count).toBe(1);
      expect($state.current.name).toBe('A');
      done();
    });
  });

  describe('that return a rejected promise', () => {
    let count, futureStateDef, errors;

    beforeEach(() => {
      errors = [];
      router.stateService.defaultErrorHandler(err => errors.push(err));
      count = 0;
      futureStateDef = {
        name: 'A.**', url: '/a',
        lazyLoad: () => new Promise((resolve, reject) => {
          if (count++ < 2) {
              reject("nope");
          } else {
              resolve({ states: [{ name: 'A', url: '/a' }] });
          }
        })
      };

      $registry.register(futureStateDef)
    });

    it('should not remove the placeholder', (done) => {
      expect($state.get('A')).toBe(futureStateDef);

      $state.go('A').catch(() => {
        expect(errors).toEqual(['nope']);
        expect($state.get('A')).toBe(futureStateDef);
        done();
      });
    });

    it('should allow lazy loading to be retried', (done) => {
      expect($state.get('A')).toBe(futureStateDef);

      $state.go('A').catch(() => {
        expect(errors).toEqual(['nope']);
        expect($state.get('A')).toBe(futureStateDef);
        expect(count).toBe(1);

        $state.go('A').catch(() => {
          expect(errors).toEqual(['nope', 'nope']);
          expect($state.get('A')).toBe(futureStateDef);
          expect(count).toBe(2);

          // this time it should lazy load
          $state.go('A').then(() => {
            expect(errors).toEqual(['nope', 'nope']);
            expect($state.get('A')).toBeTruthy();
            expect($state.get('A')).not.toBe(futureStateDef);
            expect(count).toBe(3);
            expect($state.current.name).toBe('A');

            done();
          })
        })
      })
    });
  });

  describe('with a nested future state', () => {
    let count, futureStateDefA, futureStateDefB, errors;
    let lazyStateDefA = { name: 'A', url: '/a/:aid', params: {id: "adefault"} };
    let lazyStateDefB = { name: 'A.B', url: '/b/:bid', params: {id: "bdefault"} };
    beforeEach(() => {
      futureStateDefA = {
        name: 'A.**', url: '/a',
        lazyLoad: () => new Promise(resolve => { resolve({ states: [lazyStateDefA, futureStateDefB] }); })
      };

      futureStateDefB = {
        name: 'A.B.**', url: '/b',
        lazyLoad: () => new Promise(resolve => { resolve({ states: [lazyStateDefB] }); })
      };

      $registry.register(futureStateDefA);
    });

    it('should load and activate a nested future state', (done) => {
      expect($state.get('A')).toBe(futureStateDefA);

      $state.go('A.B', { aid: 'aid', bid: 'bid'}).then(() => {
        expect($state.current).toBe(lazyStateDefB);
        done();
      });
    });

    it('should load and activate a nested future state by url sync', (done) => {
      services.location.setUrl('/a/aid/b/bid');
      $urlRouter.sync();
      $transitions.onSuccess({}, (trans) => {
        expect($state.current.name).toBe('A.B');
        expect($state.params).toEqualValues({ aid: 'aid', bid: 'bid' });

        let prev1 = trans.redirectedFrom();

        expect(prev1).toBeDefined();
        expect(prev1.targetState().$state().name).toBe('A.B.**');
        expect(prev1.options().source).toBe('redirect');

        let prev2 = prev1.redirectedFrom();
        expect(prev2).toBeDefined();
        expect(prev2.targetState().$state().name).toBe('A.**');
        expect(prev2.options().source).toBe('url');

        let prev3 = prev2.redirectedFrom();
        expect(prev3).toBeNull();

        done();
      });
    });
  });
});
