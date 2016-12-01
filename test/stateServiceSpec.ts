import { UIRouter, TransitionService, StateService } from "../src/index";
import * as vanilla from "../src/vanilla";
import { tree2Array } from "./_testUtils";
import "./_matchers";
import { TransitionOptions } from "../src/transition/interface";
import { LocationServices, services } from "../src/common/coreservices";
import { isFunction } from "../src/common/predicates";
import { StateRegistry } from "../src/state/stateRegistry";
import { State } from "../src/state/stateObject";
import { Transition } from "../src/transition/transition";
import { Param } from "../src/params/param";
import { RejectType } from "../src/transition/rejectFactory";

describe('stateService', function () {
  let router: UIRouter;
  let $registry: StateRegistry;
  let $transitions: TransitionService;
  let $state: StateService;
  let $loc: LocationServices;

  const wait = (val?) =>
      new Promise((resolve) => setTimeout(() => resolve(val)));

  async function initStateTo(state, params = {}) {
    await $state.transitionTo(state, params);
    expect($state.current).toBe(state);
  }

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.hashLocationPlugin);
    $loc = services.location;
    $state = router.stateService;
    $registry = router.stateRegistry;
    $transitions = router.transitionService;
    router.stateRegistry.stateQueue.autoFlush($state);
  });

  describe('transitionTo', () => {
    beforeEach(() => {
      var stateTree = {
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
      $transitions.onStart({ to: 'D'}, trans => (log.push('redirect'), trans.router.stateService.target('C')));
      $transitions.onStart({ to: 'C'}, trans => { cOpts = trans.options(); });

      var log = [], transition = $state.go("D").transition;
      var cOpts: TransitionOptions = {};

      wait().then(() => {
        expect(log).toEqual(['redirect']);
        expect(cOpts.redirectedFrom).toBe(transition);
        expect(cOpts.source).toBe("redirect");
      })
      .then(done, done);
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
      $loc.setUrl('/a/b/c');
      var setUrl = spyOn($loc, 'setUrl').and.callThrough();
      router.urlRouter.sync();

      wait().then(() => {
        expect($state.current.name).toBe('C');
        let pushedUrls = setUrl.calls.all().map(x => x.args[0]).filter(x => x !== undefined);
        expect(pushedUrls).toEqual([]);
        expect($loc.path()).toBe('/a/b/c');
        done();
      })
    }));

    it("should update the URL in response to synchronizing URL then redirecting", ((done) => {
      $transitions.onStart({ to: 'C' }, () => $state.target('D'));

      $loc.setUrl('/a/b/c');
      var setUrl = spyOn($loc, 'setUrl').and.callThrough();
      router.urlRouter.sync();

      wait().then(() => {
        expect($state.current.name).toBe('D');
        let pushedUrls = setUrl.calls.all().map(x => x.args[0]).filter(x => x !== undefined);
        expect(pushedUrls).toEqual(['/a/b/c/d']);
        expect($loc.path()).toBe('/a/b/c/d');
        done();
      })
    }));
  });

  describe('.transitionTo()', function () {
    var A, B, C, D, DD;
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
      var dynlog, paramsChangedLog;
      var dynamicstate, childWithParam, childNoParam;
      var cleanup;

      beforeEach(async function (done) {
        $loc.setUrl("asdfasfdasf");
        dynlog = paramsChangedLog = "";
        cleanup = [];
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

        const logChangedParams = (prefix, suffix) =>
            (trans: Transition, state: State) => {
              trans.promise.then(() => {
                let changed = Param.changed(state.parameters({ inherit: true }), trans.params("to"), trans.params("from"))
                    .map(param => param.id + "=" + trans.params("to")[param.id])
                    .join(",");
                if (changed) {
                  dynlog += prefix + changed + suffix + ";";
                }
              });
            };

        cleanup.push($transitions.onEnter({}, (trans, state) => dynlog += 'enter:' + state.name + ";"));
        cleanup.push($transitions.onExit({}, (trans, state) => dynlog += 'exit:' + state.name + ";"));
        cleanup.push($transitions.onSuccess({}, () => dynlog += 'success;'));
        cleanup.push($transitions.onRetain({retained: 'dyn'},          logChangedParams('[', ']')));
        cleanup.push($transitions.onRetain({retained: 'dyn.child'},    logChangedParams('{', '}')));
        cleanup.push($transitions.onRetain({retained: 'dyn.noparams'}, logChangedParams('(', ')')));

        await initStateTo(dynamicstate, { path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });
        expect(dynlog).toBe('enter:dyn;success;');
        expect($state.params).toEqualValues({ '#': null, path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });
        expect($loc.path()).toEqual('/dynstate/p1/pd1');
        expect($loc.search()).toEqualValues({ search: 's1', searchDyn: 'sd1' });
        dynlog = '';

        done();
      });

      afterEach((done) => {
        cleanup.forEach(fn => fn());
        if (router.globals.transition) {
          router.globals.transition.promise.then(done, done)
        } else {
          done();
        }
      });

      describe('[ transition.dynamic() ]:', function() {
        it('is considered fully dynamic when only dynamic params have changed', () => {
          var promise = $state.go(".", {pathDyn: "pd2", searchDyn: 'sd2'});
          expect(promise.transition.dynamic()).toBeTruthy();
        });

        it('is not considered fully dynamic if any state is entered', function () {
          var promise = $state.go(childWithParam);
          expect(promise.transition.dynamic()).toBeFalsy();
        });

        it('is not considered fully dynamic if any state is exited', async function (done) {
          await initStateTo(childWithParam, { config: 'p1', path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });
          var promise = $state.go(dynamicstate);
          expect(promise.transition.dynamic()).toBeFalsy();

          done();
        });

        it('is not considered fully dynamic if any state is reloaded', function () {
          var promise = $state.go(dynamicstate, null, { reload: true });
          expect(promise.transition.dynamic()).toBeFalsy();
        });

        it('is not considered fully dynamic if any non-dynamic parameter changes', function () {
          var promise = $state.go(dynamicstate, { path: 'p2' });
          expect(promise.transition.dynamic()).toBeFalsy();
        });
      });

      describe('[ promises ]', function() {
        it('runs successful transition when fully dynamic', async (done) => {
          var promise = $state.go(dynamicstate, {searchDyn: 'sd2'});
          var transition = promise.transition;
          var transSuccess = false;
          transition.promise.then(function(result) { transSuccess = true; });
          await promise;

          expect(transition.dynamic()).toBeTruthy();
          expect(transSuccess).toBeTruthy();
          expect(dynlog).toBe('success;[searchDyn=sd2];');

          done();
        });

        it('resolves the $state.go() promise with the original/final state, when fully dynamic', async (done) => {
          await initStateTo(dynamicstate, { path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });

          var promise = $state.go(dynamicstate, { pathDyn: 'pd2', searchDyn: 'sd2' });
          var destState = await promise;

          expect(promise.transition.dynamic()).toBeTruthy();
          expect($state.current).toBe(dynamicstate);
          expect(destState).toBe(dynamicstate);

          done();
        });
      });

      describe('[ enter/exit ]', function() {
        it('does not exit nor enter any states when fully dynamic', async (done) => {
          var promise = $state.go(dynamicstate, { searchDyn: 'sd2' });
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
          var promise = $state.go(dynamicstate, {searchDyn: 'sd2'});
          await promise;

          expect(promise.transition.dynamic()).toBeTruthy();
          expect(dynlog).toBe("success;[searchDyn=sd2];");
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd2' });

          done();
        });

        it('does not exit nor enter the state when only dynamic path params change', async (done) => {
          var promise = $state.go(dynamicstate, {pathDyn: 'pd2'});
          await promise;

          expect(promise.transition.dynamic()).toBeTruthy();
          expect(dynlog).toBe("success;[pathDyn=pd2];");
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd2', search: 's1', searchDyn: 'sd1' });

          done();
        });

        it('exits and enters a state when a non-dynamic search param changes', async (done) => {
          var promise = $state.go(dynamicstate, {search: 's2'});
          await promise;

          expect(promise.transition.dynamic()).toBeFalsy();
          expect(dynlog).toBe("exit:dyn;enter:dyn;success;");
          expect($state.params).toEqualValues({ path: 'p1', pathDyn: 'pd1', search: 's2', searchDyn: 'sd1' });

          done();
        });

        it('exits and enters a state when a non-dynamic path param changes', async (done) => {
          var promise = $state.go(dynamicstate, {path: 'p2'});
          await promise;

          expect(promise.transition.dynamic()).toBeFalsy();
          expect(dynlog).toBe("exit:dyn;enter:dyn;success;");
          expect($state.params).toEqualValues({ path: 'p2', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });

          done();
        });

        // it('does not exit nor enter a state when only dynamic params change (triggered via url)', async (done) => {
        //   $loc.search({ search: 's1', searchDyn: 'sd2' });
        //   $rootScope.$broadcast("$locationChangeSuccess");
        //   $q.flush();
        //   expect(dynlog).toBe('success;[searchDyn=sd2];')
        //
        //   done();
        // });

        // it('exits and enters a state when any non-dynamic params change (triggered via url)', async (done) => {
        //   $location.search({ search: 's2', searchDyn: 'sd2' });
        //   $rootScope.$broadcast("$locationChangeSuccess");
        //   $q.flush();
        //   expect(dynlog).toBe('exit:dyn;enter:dyn;success;')
        //
        //   done();
        // });

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

        // it('updates $stateParams and $location.search when only dynamic params change (triggered via url)', function () {
        //   $location.search({search: 's1', searchDyn: 'sd2'});
        //   $rootScope.$broadcast("$locationChangeSuccess");
        //   $q.flush();
        //   expect($stateParams.search).toBe('s1');
        //   expect($stateParams.searchDyn).toBe('sd2');
        //   expect($location.search()).toEqual({search: 's1', searchDyn: 'sd2'});
        // });

        it('updates $stateParams and $location.search when only dynamic params change (triggered via $state transition)', async (done) => {
          await $state.go('.', {searchDyn: 'sd2'});

          expect($state.params['search']).toBe('s1');
          expect($state.params['searchDyn']).toBe('sd2');
          expect($loc.path()).toEqual('/dynstate/p1/pd1');
          expect($loc.search()).toEqualValues({ search: 's1', searchDyn: 'sd2' });

          done();
        });
      });
    //
    //   describe('[ uiOnParamsChanged ]', function() {
    //     it('should be called when dynamic parameter values change', function() {
    //       $state.go('.', { searchDyn: 'sd2' }); $q.flush();
    //       expect(paramsChangedLog).toBe('searchDyn;');
    //     });
    //
    //     it('should not be called if a non-dynamic parameter changes (causing the controller\'s state to exit/enter)', function() {
    //       $state.go('.', { search: 's2', searchDyn: 'sd2' }); $q.flush();
    //       expect(paramsChangedLog).toBe('');
    //     });
    //
    //     it('should not be called, when entering a new state, if no parameter values change', function() {
    //       $state.go(childNoParam); $q.flush();
    //       expect(paramsChangedLog).toBe('');
    //     });
    //
    //     it('should be called, when entering a new state, if any dynamic parameter value changed', function() {
    //       $state.go(childNoParam, { searchDyn: 'sd2' }); $q.flush();
    //       expect(paramsChangedLog).toBe('searchDyn;');
    //     });
    //
    //     it('should be called, when entering a new state, if a new parameter value is added', function() {
    //       $state.go(childWithParam, { config: 'c2' }); $q.flush();
    //       expect(paramsChangedLog).toBe('config,configDyn;');
    //     });
    //
    //     it('should be called, when reactivating the uiOnParamsChanged state, if a dynamic parameter changed', function() {
    //       initStateTo(childNoParam, { path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });
    //       dynlog = paramsChangedLog = "";
    //
    //       $state.go(dynamicstate, { pathDyn: 'pd2' }); $q.flush();
    //       expect(paramsChangedLog).toBe('pathDyn;');
    //     });
    //
    //     it('should not be called, when reactivating the uiOnParamsChanged state "dyn", if any of dyns non-dynamic parameters changed', function() {
    //       initStateTo(childNoParam, { path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1' });
    //       dynlog = paramsChangedLog = "";
    //
    //       $state.go(dynamicstate, { path: 'p2' }); $q.flush();
    //       expect(paramsChangedLog).toBe('');
    //     });
    //
    //     it('should be called with an object containing only the changed params', function() {
    //       $state.go(dynamicstate, { pathDyn: 'pd2' }); $q.flush();
    //       expect(dynlog).toBe('success;[pathDyn=pd2];');
    //
    //       $state.go(dynamicstate, { pathDyn: 'pd3', searchDyn: 'sd2' }); $q.flush();
    //       expect(dynlog).toBe('success;[pathDyn=pd2];success;[pathDyn=pd3,searchDyn=sd2];');
    //     });
    //
    //     it('should be called on all active controllers that have a uiOnParamsChanged', function() {
    //       initStateTo(childWithParam, { path: 'p1', pathDyn: 'pd1', search: 's1', searchDyn: 'sd1', config: 'p1', configDyn: 'c1' });
    //       dynlog = paramsChangedLog = "";
    //
    //       $state.go(childWithParam, { pathDyn: 'pd2' }); $q.flush();
    //       expect(dynlog).toBe('success;[pathDyn=pd2];{pathDyn=pd2};');
    //
    //       dynlog = paramsChangedLog = "";
    //       $state.go(childWithParam, { pathDyn: 'pd2', searchDyn: 'sd2', configDyn: 'cd2' }); $q.flush();
    //       expect(dynlog).toBe('success;[configDyn=cd2,searchDyn=sd2];{configDyn=cd2,searchDyn=sd2};');
    //     });
    //   });

    });

    describe("(with dynamic params because reloadOnSearch=false)", function () {
      var RS;

      beforeEach((done) => {
        RS = { name: 'RS', url: '^/search?term', reloadOnSearch: false };
        $registry.register(RS);
        initStateTo(RS).then(() => expect($state.current.name).toBe('RS')).then(done);
      });

      describe("and only query params changed", function () {

        var entered = false;
        beforeEach(() => {
          $transitions.onEnter({entering: 'RS'}, function () { entered = true });
        });

        // it('doesn\'t re-enter state (triggered by url change)', function () {
        //   $location.search({term: 'hello'});
        //   $rootScope.$broadcast("$locationChangeSuccess");
        //   $q.flush();
        //   expect($location.search()).toEqual({term: 'hello'});
        //   expect(entered).toBeFalsy();
        // });

        it('doesn\'t re-enter state (triggered by $state transition)', async (done) => {
          var promise = $state.go($state.current, {term: "hello"});
          var success = false, transition = promise.transition;
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

    it('is a no-op when passing the current state and identical parameters', async(done) => {
      let enterlog = "";
      $transitions.onEnter({ entering: 'A'}, (trans, state) => enterlog += state.name + ";");
      await initStateTo(A);
      expect(enterlog).toBe('A;');

      var promise = $state.transitionTo(A, {}); // no-op
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

      var superseded = $state.transitionTo(B, {}).catch(err => err);
      await $state.transitionTo(C, {});

      var result = await superseded;
      expect($state.current).toBe(C);
      expect(result).toBeTruthy();

      done();
    });

    it('aborts pending transitions even when going back to the current state', async(done) => {
      $state.defaultErrorHandler(() => null);
      await initStateTo(A);

      var superseded = $state.transitionTo(B, {}).catch(err => err);
      await $state.transitionTo(A, {});
      var result = await superseded;

      expect($state.current).toBe(A);
      expect(result.type).toBe(RejectType.SUPERSEDED);

      done();
    });

    it('aborts pending transitions when superseded from callbacks', async(done) => {
      $state.defaultErrorHandler(() => null);
      $registry.register({
        name: 'redir',
        url: "redir",
        onEnter: (trans) => { trans.router.stateService.go('A') }
      });
      let result = await $state.transitionTo('redir').catch(err => err);
      await router.globals.transition.promise;

      expect($state.current.name).toBe('A');
      expect(result.type).toBe(RejectType.SUPERSEDED);

      done();
    });

    it('triggers onEnter and onExit callbacks', async(done) => {
      var log = "";
      await initStateTo(A);
      $transitions.onSuccess({}, (trans) =>       log += trans.to().name + ";");
      $transitions.onEnter({}, (trans, state) =>  log += state.name + ".onEnter;");
      $transitions.onExit({}, (trans, state) =>   log += state.name + ".onExit;");

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
          expect(state.self).toBe($registry.get('design'));
          expect(trans.getResolveValue('cc', 'from')).toBe('cc resolve');
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

      var actual: any;
      var message = "Could not resolve '^.Z' from state 'DD'";
      await $state.transitionTo("^.Z", null, { relative: $state.$current }).catch(function (err) {
        actual = err;
      });
      expect(actual.detail).toEqual(message);

      done();
    });

    // it('uses the templateProvider to get template dynamically', ((done) =>{
    //   $state.transitionTo('dynamicTemplate', { type: "Acme" });
    //   $q.flush();
    //   expect(template).toEqual("AcmeFooTemplate");
    // }));

    // it('uses the controllerProvider to get controller dynamically', ((done) =>{
    //   $state.transitionTo('dynamicController', { type: "Acme" });
    //   $q.flush();
    //   expect(ctrlName).toEqual("AcmeController");
    // }));

    it('updates the location #fragment, if specified', async(done) => {
      await $state.transitionTo('DD', { '#': 'frag' });

      expect($loc.path()).toBe('/d/dd');
      expect($loc.hash()).toBe('frag');

      done();
    });

    it('runs a transition when the location #fragment is updated', async(done) => {
      var transitionCount = 0;
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
      var log = "";
      $registry.register({
        name: 'about',
        url: "/about",
        resolve: {
          stateInfo: function ($transition$) {
            return [$transition$.from().name, $transition$.to().name];
          }
        },
        onEnter: function ($transition$) {
          let stateInfo = $transition$.getResolveValue('stateInfo');
          log = stateInfo.join(' => ');
        }
      });

      await $state.transitionTo('A');
      await $state.transitionTo('about');
      expect(log).toBe('A => about');

      done();
    });
  });
});