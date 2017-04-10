import { UIRouter, TransitionService, StateService } from '../src/index';
import { tree2Array, awaitTransition } from './_testUtils';
import './_matchers';
import { TransitionOptions } from '../src/transition/interface';
import { LocationServices } from '../src/common/coreservices';
import { isFunction } from '../src/common/predicates';
import { StateRegistry } from '../src/state/stateRegistry';
import { Transition } from '../src/transition/transition';
import { Param } from '../src/params/param';
import { RejectType } from '../src/transition/rejectFactory';
import { TestingPlugin } from './_testingPlugin';
import { StateDeclaration } from '../src/state/interface';

describe('stateService', function () {
  let router: UIRouter;
  let $registry: StateRegistry;
  let $transitions: TransitionService;
  let $state: StateService;
  let $loc: LocationServices;

  const delay = (millis) => () =>
      new Promise(resolve => setTimeout(resolve, millis));

  const wait = (val?) =>
      new Promise((resolve) => setTimeout(() => resolve(val), 50));

  async function initStateTo(state, params = {}) {
    await $state.transitionTo(state, params);
    expect($state.current).toBe(state);
  }

  afterEach(() => router.dispose());

  beforeEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
    router = new UIRouter();
    router.plugin(TestingPlugin);

    $loc         = router.urlService;
    $state       = router.stateService;
    $registry    = router.stateRegistry;
    $transitions = router.transitionService;
  });

  describe('transitionTo', () => {
    beforeEach(() => {
      let stateTree = {
        first: {},
        second: {},
        third: {},
        A: {
          url: '/a',
          B: {
            url: '/b',
            C: {
              url: '/c',
              D: {
                url: '/d'
              }
            }
          }
        }
      };

      let states = tree2Array(stateTree, false);
      states.forEach(state => $registry.register(state));
    });

    it("should handle redirects", ((done) => {
      $transitions.onStart({ to: 'D'}, trans => {
        log.push('redirect');
        return trans.router.stateService.target('C');
      });
      $transitions.onStart({ to: 'C'}, trans => { cOpts = trans.options(); });

      let log = [], promise = $state.go("D");
      let cOpts: TransitionOptions = {};

      promise.then(() => {
        expect(log).toEqual(['redirect']);
        expect(cOpts.redirectedFrom).toBe(promise.transition);
        expect(cOpts.source).toBe("redirect");

        done();
      });
    }));

    it('should error after 20+ async redirects', (done) => {
      let errors = [];
      $transitions.onEnter({ entering: "D" }, trans => trans.router.stateService.target('D'));
      $transitions.onError({}, trans => { errors.push(trans.error()) });

      $state.defaultErrorHandler(function() {});

      $state.go("D").catch(err => {
        expect(errors.length).toBe(21);
        expect(err.message).toContain('Too many consecutive Transition redirects');
        done();
      });
    });

    it('synchronous redirects should not be allowed to cause an infinite redirect loop', (done) => {
      let errors = [];
      let count = 0;
      $transitions.onBefore({ entering: "D" }, trans => {
        if (count++ >= 1000) throw new Error(`Doh! 1000 redirects O_o`);
        return trans.router.stateService.target('D');
      });
      $transitions.onError({}, trans => { errors.push(trans.error()) });

      $state.defaultErrorHandler(function() {});

      $state.go("D").catch(err => {
        expect(count).toBe(21);
        expect(err.message).toContain('Too many consecutive Transition redirects');
        done();
      });
    });

    it("should not update the URL in response to synchronizing URL", ((done) => {
      $loc.url('/a/b/c');
      let url = spyOn($loc, 'url').and.callThrough();

      wait().then(() => {
        expect($state.current.name).toBe('C');
        let pushedUrls = url.calls.all().map(x => x.args[0]).filter(x => x !== undefined);
        expect(pushedUrls).toEqual([]);
        expect($loc.path()).toBe('/a/b/c');
        done();
      })
    }));

    it("should update the URL in response to synchronizing URL then redirecting", ((done) => {
      $transitions.onStart({ to: 'C' }, () => $state.target('D'));

      $loc.url('/a/b/c');
      let url = spyOn($loc, 'url').and.callThrough();

      wait().then(() => {
        expect($state.current.name).toBe('D');
        let pushedUrls = url.calls.all().map(x => x.args[0]).filter(x => x !== undefined);
        expect(pushedUrls).toEqual(['/a/b/c/d']);
        expect($loc.path()).toBe('/a/b/c/d');
        done();
      })
    }));
  });

  describe('.transitionTo()', function () {
    let A, B, C, D, DD;
    beforeEach(() => {
      A = { name: 'A', url: '/a' };
      B = { name: 'B', url: '/b' };
      C = { name: 'C', url: '/c' };
      D = { name: 'D', url: '/d', params: { x: null, y: null } };
      DD = { name: 'DD', url: '/dd', parent: D, params: { x: null, y: null, z: null } };

      [A, B, C, D, DD].forEach(state => $registry.register(state));
    });

    it('returns a promise for the target state', () => {
      let promise = $state.transitionTo(A, {});
      expect(isFunction(promise.then)).toBeTruthy();
      expect(promise.transition.to()).toBe(A);
    });

    // @todo this should fail:
    // $state.transitionTo('about.person.item', { id: 5 }); $q.flush();

    it('allows transitions by name', async (done) =>{
      await $state.transitionTo('A', {});
      expect($state.current).toBe(A);

      done();
    });

    describe("dynamic transitions", function () {
      let dynlog, paramsChangedLog;
      let dynamicstate, childWithParam, childNoParam;

      beforeEach(async function (done) {
        $loc.url("asdfasfdasf");
        dynlog = paramsChangedLog = "";
        dynamicstate = {
          name: 'dyn',
          url: '^/dynstate/:path/:pathDyn?search&searchDyn',
          params: {
            pathDyn: { dynamic: true },
            searchDyn: { dynamic: true }
          }
        };

        childWithParam = {
          name: 'dyn.child',
          url: '/child',
          params: {
            config: 'c1', // allow empty
            configDyn: { value: null, dynamic: true }
          }
        };

        childNoParam = {
          name: 'dyn.noparams',
          url: '/noparams'
        };

        router.stateRegistry.register(dynamicstate);
        router.stateRegistry.register(childWithParam);
        router.stateRegistry.register(childNoParam);

        function logChangedParams(prefix, suffix) {
          return (trans: Transition, state: StateDeclaration) => {
            trans.onSuccess({}, () => {
              let stateObject = state.$$state();
              let changed = Param.changed(stateObject.parameters({ inherit: true }), trans.params("to"), trans.params("from"))
                  .map(param => param.id + "=" + trans.params("to")[param.id])
                  .join(",");
              if (changed) {
                dynlog += prefix + changed + suffix + ";";
              }
            });
          };
        }

        $transitions.onEnter({}, (trans, state) => { dynlog += 'enter:' + state.name + ";" });
        $transitions.onExit({}, (trans, state) => { dynlog += 'exit:' + state.name + ";" });
        $transitions.onSuccess({}, () => { dynlog += 'success;' }, { priority: 1 });
        $transitions.onRetain({ retained: 'dyn' }, logChangedParams('[', ']'));
        $transitions.onRetain({ retained: 'dyn.child' }, logChangedParams('{', '}'));
        $transitions.onRetain({ retained: 'dyn.noparams' }, logChangedParams('(', ')'));

        await initStateTo(dynamicstate, { path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });

        expect(dynlog).toBe('enter:dyn;success;');
        expect($state.params).toEqualValues({ '#': null, path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });
        expect($loc.path()).toEqual('/dynstate/p1/pd1');
        expect($loc.search()).toEqualValues({ search: 's1', searchDyn: 'sd1' });
        dynlog = '';

        done();
      });

      afterEach((done) => {
        router.dispose();
        done();
      });

      describe('[ transition.dynamic() ]:', function() {
        it('is considered fully dynamic when only dynamic params have changed', () => {
          let promise = $state.go(".", {pathDyn: "pd2", searchDyn: 'sd2'});
          expect(promise.transition.dynamic()).toBeTruthy();
        });

        it('is not considered fully dynamic if any state is entered', function () {
          let promise = $state.go(childWithParam);
          expect(promise.transition.dynamic()).toBeFalsy();
        });

        it('is not considered fully dynamic if any state is exited', async function (done) {
          await initStateTo(childWithParam, { config: 'p1', path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });
          let promise = $state.go(dynamicstate);
          expect(promise.transition.dynamic()).toBeFalsy();

          done();
        });

        it('is not considered fully dynamic if any state is reloaded', function () {
          let promise = $state.go(dynamicstate, null, { reload: true });
          expect(promise.transition.dynamic()).toBeFalsy();
        });

        it('is not considered fully dynamic if any non-dynamic parameter changes', function () {
          let promise = $state.go(dynamicstate, { path: 'p2' });
          expect(promise.transition.dynamic()).toBeFalsy();
        });
      });

      describe('[ promises ]', function() {
        it('runs successful transition when fully dynamic', async (done) => {
          let promise = $state.go(dynamicstate, {searchDyn: 'sd2'});
          let transition = promise.transition;
          let transSuccess = false;
          transition.promise.then(function(result) { transSuccess = true; });
          await promise;

          expect(transition.dynamic()).toBeTruthy();
          expect(transSuccess).toBeTruthy();
          expect(dynlog).toBe('success;[searchDyn=sd2];');

          done();
        });

        it('resolves the $state.go() promise with the original/final state, when fully dynamic', async (done) => {
          await initStateTo(dynamicstate, { path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });

          let promise = $state.go(dynamicstate, { pathDyn: 'pd2', searchDyn: 'sd2' });
          let destState = await promise;

          expect(promise.transition.dynamic()).toBeTruthy();
          expect($state.current).toBe(dynamicstate);
          expect(destState).toBe(dynamicstate);

          done();
        });
      });

      describe('[ enter/exit ]', function() {
        it('does not exit nor enter any states when fully dynamic', async (done) => {
          let promise = $state.go(dynamicstate, { searchDyn: 'sd2' });
          await promise;

          expect(promise.transition.dynamic()).toBeTruthy();
          expect(promise.transition.treeChanges().entering.length).toBe(0);
          expect(promise.transition.treeChanges().exiting.length).toBe(0);
          expect(promise.transition.treeChanges().retained.length).toBe(2);
          expect(dynlog).toBe("success;[searchDyn=sd2];");
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd2' });

          done();
        });

        it('does not exit nor enter the state when only dynamic search params change', async (done) => {
          let promise = $state.go(dynamicstate, {searchDyn: 'sd2'});
          await promise;

          expect(promise.transition.dynamic()).toBeTruthy();
          expect(dynlog).toBe("success;[searchDyn=sd2];");
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd2' });

          done();
        });

        it('does not exit nor enter the state when only dynamic path params change', async (done) => {
          let promise = $state.go(dynamicstate, {pathDyn: 'pd2'});
          await promise;

          expect(promise.transition.dynamic()).toBeTruthy();
          expect(dynlog).toBe("success;[pathDyn=pd2];");
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd2', search: 's1', searchDyn: 'sd1' });

          done();
        });

        it('exits and enters a state when a non-dynamic search param changes', async (done) => {
          let promise = $state.go(dynamicstate, {search: 's2'});
          await promise;

          expect(promise.transition.dynamic()).toBeFalsy();
          expect(dynlog).toBe("exit:dyn;enter:dyn;success;");
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd1', search: 's2', searchDyn: 'sd1' });

          done();
        });

        it('exits and enters a state when a non-dynamic path param changes', async (done) => {
          let promise = $state.go(dynamicstate, {path: 'p2'});
          await promise;

          expect(promise.transition.dynamic()).toBeFalsy();
          expect(dynlog).toBe("exit:dyn;enter:dyn;success;");
          expect($state.params).toEqualValues({ path: 'p2', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });

          done();
        });

        it('does not exit nor enter a state when only dynamic params change (triggered via url)', (done) => {
          awaitTransition(router).then(() => {
            expect(dynlog).toBe('success;[searchDyn=sd2];');
            done();
          });

          $loc.url('/dynstate/p1/pd1?search=s1&searchDyn=sd2');
        });

        it('exits and enters a state when any non-dynamic params change (triggered via url)', (done) => {
          awaitTransition(router).then(() => {
            expect(dynlog).toBe('exit:dyn;enter:dyn;success;');
            done();
          });

          $loc.url('/dynstate/p1/pd1?search=s2&searchDyn=sd2');
        });

        it('does not exit nor enter a state when only dynamic params change (triggered via $state transition)', async (done) => {
          await $state.go('.', {searchDyn: 'sd2'}, { inherit: true });
          expect(dynlog).toBe('success;[searchDyn=sd2];');

          done();
        });
      });

      describe('[ global $stateParams service ]', function() {
        it('updates the global $state.params object', async (done) => {
          await $state.go(dynamicstate, {searchDyn: 'sd2'});
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd2' });

          done();
        });

        it('updates $stateParams and $location.search when only dynamic params change (triggered via url)', async (done) => {
          let dereg = $transitions.onBefore({}, (trans) => {
            trans.promise.then(expects, expects);

            function expects() {
              expect($state.params['search']).toBe('s1');
              expect($state.params['searchDyn']).toBe('sd2');
              expect($loc.search()).toEqual({search: 's1', searchDyn: 'sd2'});

              dereg();
              done();
            }
          });

          $loc.url('/dynstate/p1/pd1?search=s1&searchDyn=sd2'); // {search: 's1', searchDyn: 'sd2'});
        });

        it('updates $stateParams and $location.search when only dynamic params change (triggered via $state transition)', async (done) => {
          await $state.go('.', {searchDyn: 'sd2'});

          expect($state.params['search']).toBe('s1');
          expect($state.params['searchDyn']).toBe('sd2');
          expect($loc.path()).toEqual('/dynstate/p1/pd1');
          expect($loc.search()).toEqualValues({ search: 's1', searchDyn: 'sd2' });

          done();
        });
      });
    });

    describe("(with dynamic params because reloadOnSearch=false)", function () {
      let RS;

      beforeEach((done) => {
        RS = { name: 'RS', url: '^/search?term', reloadOnSearch: false };
        $registry.register(RS);
        initStateTo(RS).then(() => expect($state.current.name).toBe('RS')).then(done);
      });

      describe("and only query params changed", function () {

        let entered = false;
        beforeEach(() => {
          $transitions.onEnter({entering: 'RS'}, function () { entered = true });
        });

        it('doesn\'t re-enter state (triggered by url change)', function (done) {
          $loc.url($loc.path() + "?term=hello");
          awaitTransition(router).then(() => {
            expect($loc.search()).toEqual({term: 'hello'});
            expect(entered).toBeFalsy();
            done();
          })
        });

        it('doesn\'t re-enter state (triggered by $state transition)', async (done) => {
          let promise = $state.go($state.current, {term: "hello"});
          let success = false, transition = promise.transition;
          transition.promise.then(function () { success = true; });
          await promise;

          expect($state.current).toBe(RS);
          expect(entered).toBeFalsy();
          expect(success).toBeTruthy();
          expect($loc.path()).toEqual('/search');
          expect($loc.search()).toEqualValues({ term: 'hello' });

          done();
        });

        it('updates $stateParams', async function (done) {
          await $state.go("RS", { term: 'hello' });

          expect($state.params).toEqualValues({term: 'hello'});
          expect(entered).toBeFalsy();

          done();
        });

        it('updates URL when (triggered by $state transition)', async (done) => {
          await $state.go(".", {term: 'goodbye'});

          expect($state.params).toEqualValues({term: 'goodbye'});
          expect($loc.path()).toEqual('/search');
          expect($loc.search()).toEqualValues({ term: 'goodbye' });
          expect(entered).toBeFalsy();

          done();
        });
      });
    });

    it('ignores non-applicable state parameters', async(done) => {
      await $state.transitionTo('A', { w00t: 'hi mom!' });

      expect($state.current).toBe(A);

      done();
    });

    it('is ignored when passing the current state and identical parameters', async(done) => {
      let enterlog = "";
      $transitions.onEnter({ entering: 'A'}, (trans, state) => { enterlog += state.name + ";" });
      await initStateTo(A);
      expect(enterlog).toBe('A;');

      let promise = $state.transitionTo(A, {}); // no-op
      expect(promise).toBeDefined(); // but we still get a valid promise
      let value = await promise;

      expect(value).toBe(A);
      expect($state.current).toBe(A);
      expect(enterlog).toBe('A;');

      done();
    });

    it('aborts pending transitions (last call wins)', async (done) => {
      $state.defaultErrorHandler(() => null);
      await initStateTo(A);

      let superseded = $state.transitionTo(B, {}).catch(err => err);
      await $state.transitionTo(C, {});

      let result = await superseded;
      expect($state.current).toBe(C);
      expect(result).toBeTruthy();

      done();
    });

    it('aborts pending transitions even when going back to the current state', async(done) => {
      $state.defaultErrorHandler(() => null);
      await initStateTo(A);

      let superseded = $state.transitionTo(B, {}).catch(err => err);
      await $state.transitionTo(A, {});
      let result = await superseded;

      expect($state.current).toBe(A);
      expect(result.type).toBe(RejectType.SUPERSEDED);

      done();
    });

    it('can be manually aborted', async(done) => {
      $state.defaultErrorHandler(() => null);

      await initStateTo(A);

      router.transitionService.onStart({}, trans => {
        if (trans.$id === 1) return new Promise(resolve => setTimeout(resolve, 50)) as any;
      });

      let promise = $state.transitionTo(B, {});
      let transition = promise.transition;

      setTimeout(() => transition.abort());

      const expects = (result) => {
        expect($state.current).toBe(A);
        expect(result.type).toBe(RejectType.ABORTED);

        done();
      };

      promise.then(expects, expects);
    });

    it('aborts pending transitions when superseded from callbacks', async(done) => {
      // router.trace.enable(1);
      $state.defaultErrorHandler(() => null);
      $registry.register({
        name: 'redir',
        url: "redir",
        onEnter: (trans) => {
          trans.router.stateService.go('A')
        }
      });
      let result = await $state.transitionTo('redir').catch(err => err);
      await router.globals.transition.promise;

      expect($state.current.name).toBe('A');
      expect(result.type).toBe(RejectType.SUPERSEDED);

      done();
    });

    it('does not abort pending transition when a new transition is cancelled by onBefore hook', (done) => {
      router.transitionService.onBefore({}, (t) => {
        if (t.$id === 1) return false;
        return (new Promise(resolve => setTimeout(resolve, 100))) as any;
      });

      let promise1 = $state.transitionTo('A'); // takes 100 ms
      let promise2 = $state.transitionTo('A'); // is cancelled
      let promise2Error;

      promise1.then(() => {
        expect($state.current.name).toBe('A');
        expect(promise2Error).toBeDefined();
        done();
      });

      promise2.catch((err) => promise2Error = err);
    });

    it('triggers onEnter and onExit callbacks', async(done) => {
      let log = "";
      await initStateTo(A);
      $transitions.onSuccess({}, (trans) =>       { log += trans.to().name + ";" });
      $transitions.onEnter({}, (trans, state) =>  { log += state.name + ".onEnter;" });
      $transitions.onExit({}, (trans, state) =>   { log += state.name + ".onExit;" });

      await $state.transitionTo(D, {});
      await $state.transitionTo(DD, {});
      await $state.transitionTo(A, {});

      expect(log).toBe(
          'A.onExit;' +
          'D.onEnter;' +
          'D;' +
          'DD.onEnter;' +
          'DD;' +
          'DD.onExit;' +
          'D.onExit;' +
          'A.onEnter;' +
          'A;');

      done();
    });

    // test for #3081
    it('injects resolve values from the exited state into onExit', async(done) => {
      $registry.register({
        name: 'design',
        url: '/design',
        resolve: { cc: () => 'cc resolve' },
        onExit: function (trans, state) {
          expect(trans.from().name).toBe('design');
          expect(trans.to().name).toBe('A');
          expect(state).toBe($registry.get('design'));
          expect(trans.injector(null, 'from').get('cc')).toBe('cc resolve');
        }
      });

      await $state.go("design");
      await $state.go("A");

      done();
    });

    it('doesn\'t transition to parent state when child has no URL', async (done) => {
      $registry.register({ name: 'about', url: '/abougx' });
      $registry.register({ name: 'about.sidebar' });
      await $state.transitionTo('about.sidebar');
      expect($state.current.name).toEqual('about.sidebar');

      done();
    });

    it('notifies on failed relative state resolution', async (done) => {
      await $state.transitionTo(DD);

      let actual: any;
      let message = "Could not resolve '^.Z' from state 'DD'";
      await $state.transitionTo("^.Z", null, { relative: $state.$current }).catch(function (err) {
        actual = err;
      });
      expect(actual.detail).toEqual(message);

      done();
    });

    it('updates the location #fragment, if specified', async(done) => {
      await $state.transitionTo('DD', { '#': 'frag' });

      expect($loc.path()).toBe('/d/dd');
      expect($loc.hash()).toBe('frag');

      done();
    });

    it('runs a transition when the location #fragment is updated', async(done) => {
      let transitionCount = 0;
      $transitions.onSuccess({}, () => { transitionCount++; });

      await $state.transitionTo('A', { '#': 'frag' });
      expect($loc.hash()).toBe('frag');
      expect(transitionCount).toBe(1);

      await $state.transitionTo('A', { '#': 'blarg' });
      expect($loc.hash()).toBe('blarg');
      expect(transitionCount).toBe(2);

      done();
    });

    it('injects $transition$ into resolves', async(done) => {
      let log = "";
      $registry.register({
        name: 'about',
        url: "/about",
        resolve: {
          stateInfo: function ($transition$) {
            return [$transition$.from().name, $transition$.to().name];
          }
        },
        onEnter: function ($transition$) {
          let stateInfo = $transition$.injector().get('stateInfo');
          log = stateInfo.join(' => ');
        }
      });

      await $state.transitionTo('A');
      await $state.transitionTo('about');
      expect(log).toBe('A => about');

      done();
    });
  });

  describe('defaultErrorHandler', () => {
    let count, doh: Error, spy: jasmine.Spy;

    const expectDoh = () => {
      expect(count).toBe(1);
      expect(spy).toHaveBeenCalledWith(doh);
    };

    const expectNone = () => {
      expect(count).toBe(1);
      expect(spy).not.toHaveBeenCalled();
    };


    beforeEach(() => {
      spy = jasmine.createSpy("defaultErrorHandler", function(err) {});
      $state.defaultErrorHandler((err) => spy(err.detail));
      $registry.register({ name: 'a' });
      $registry.register({ name: 'a.b' });
      doh = new Error('doh');
      count = 0;
    });

    // thrown error

    it('should not be called when an onCreate hook throws', (done) => {
      $transitions.onCreate({}, () => { count++; throw doh; });
      expect(() => $state.go('a')).toThrow();
      expectNone();
      done();
    });

    it('should be called when an onBefore hook throws', (done) => {
      $transitions.onBefore({}, () => { count++; throw doh; });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    it('should be called when an onStart hook throws', (done) => {
      $transitions.onStart({}, () => { count++; throw doh; });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    it('should be called when an onEnter hook throws', (done) => {
      $transitions.onEnter({}, () => { count++; throw doh; });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    it('should be called when an onRetain hook throws', (done) => {
      $transitions.onRetain({}, () => { count++; throw doh; });
      $state.go('a').then(() => $state.go('a.b')).then(expectDoh, expectDoh).then(done);
    });

    it('should be called when an onExit hook throws', (done) => {
      $transitions.onExit({}, () => { count++; throw doh; });
      $state.go('a.b').then(() => $state.go('a')).then(expectDoh, expectDoh).then(done);
    });

    it('should be called when an onFinish hook throws', (done) => {
      $transitions.onFinish({}, () => { count++; throw doh; });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    // rejected promise

    it('should be called when an onCreate hook rejects a promise', (done) => {
      $transitions.onCreate({}, () => {
        count++; return Promise.reject(doh); });
      $state.go('a').then(delay(50), delay(50)).then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onBefore hook', (done) => {
      $transitions.onBefore({}, () => { count++; return Promise.reject(doh) });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onStart hook', (done) => {
      $transitions.onStart({}, () => { count++; return Promise.reject(doh) });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onEnter hook', (done) => {
      $transitions.onEnter({}, () => { count++; return Promise.reject(doh) });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onRetain hook', (done) => {
      $transitions.onRetain({}, () => { count++; return Promise.reject(doh) });
      $state.go('a').then(() => $state.go('a.b')).then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onExit hook', (done) => {
      $transitions.onExit({}, () => { count++; return Promise.reject(doh) });
      $state.go('a.b').then(() => $state.go('a')).then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onFinish hook', (done) => {
      $transitions.onFinish({}, () => { count++; return Promise.reject(doh) });
      $state.go('a').then(expectDoh, expectDoh).then(done);
    });

    // onSuccess

    it('should be called when an onSuccess hook throws', (done) => {
      $transitions.onSuccess({}, () => { count++; throw doh; });
      $state.go('a').then(delay(50), delay(50)).then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onSuccess hook', (done) => {
      $transitions.onSuccess({}, () => {
        count++; return Promise.reject(doh) });
      $state.go('a').then(delay(50), delay(50)).then(expectDoh, expectDoh).then(done);
    });

    // onError

    it('should be called when an onError hook throws', (done) => {
      $transitions.onStart({}, () => { throw doh; });
      $transitions.onError({}, () => { count++; throw doh; });
      $state.go('a').then(delay(50), delay(50)).then(expectDoh, expectDoh).then(done);
    });

    it('should be called when a rejected promise is returned from an onError hook', (done) => {
      $transitions.onStart({}, () => { throw doh; });
      $transitions.onError({}, () => { count++; return Promise.reject(doh) });
      $state.go('a').then(delay(50), delay(50)).then(expectDoh, expectDoh).then(done);
    });

    // ABORT

    it('should be not called when a hook aborts the transition', (done) => {
      $transitions.onFinish({}, () => { count++; return false; });
      $state.go('a').then(expectNone, expectNone).then(done);
    });

    // REDIRECT

    it('should be not called when a hook redirects the transition', (done) => {
      $transitions.onStart({ to: 'a' } , (trans) => { count++; return trans.router.stateService.target('a.b'); });
      $state.go('a').then(expectNone, expectNone).then(done);
    });

  });
});