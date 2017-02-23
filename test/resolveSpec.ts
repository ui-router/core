import { ResolveContext, StateObject, PathNode, Resolvable, copy } from "../src/index";
import { services } from "../src/common/coreservices";
import * as vanilla from "../src/vanilla";
import { tree2Array } from "./_testUtils";
import { UIRouter } from "../src/router";

import Spy = jasmine.Spy;
import { TestingPlugin } from "./_testingPlugin";
import { StateService } from "../src/state/stateService";
import { TransitionService } from "../src/transition/transitionService";
import { StateRegistry } from "../src/state/stateRegistry";
import { tail } from "../src/common/common";

///////////////////////////////////////////////

let router: UIRouter, states, statesMap: { [key:string]: StateObject } = {};
let $state: StateService;
let $transitions: TransitionService;
let $registry: StateRegistry;
let vals, counts, expectCounts;
let asyncCount;

function invokeLater(fn: Function, ctx: ResolveContext) {
  return new Resolvable("", fn, services.$injector.annotate(fn)).get(ctx)
}

function getStates() {
  return {
    A: { resolve: { _A: function () { return "A"; }, _A2: function() { return "A2"; }},
      B: { resolve: { _B: function () { return "B"; }, _B2: function() { return "B2"; }},
        C: { resolve: { _C: function (_A, _B) { return _A + _B + "C"; }, _C2: function() { return "C2"; }},
          D: { resolve: { _D: function (_D2) { return "D1" + _D2; }, _D2: function () { return "D2"; }} }
        }
      },
      E: { resolve: { _E: function() { return "E"; } },
        F: { resolve: { _E: function() { return "_E"; }, _F: function(_E) { return _E + "F"; }} }
      },
      G: { resolve: { _G: function() { return "G"; } },
        H: { resolve: { _G: function(_G) { return _G + "_G"; }, _H: function(_G) { return _G + "H"; } } }
      },
      I: { resolve: { _I: function(_I) { return "I"; } } }
    },
    J: {
      resolve: {
        _J: function() { counts['_J']++; return "J"; },
        _J2: function(_J) { counts['_J2']++; return _J + "J2"; }
      },
      resolvePolicy: {
        _J: { when: 'EAGER' }
      },
      K: { resolve: { _K: function(_J2) { counts['_K']++; return _J2 + "K"; }},
        L: { resolve: { _L: function(_K) { counts['_L']++; return _K + "L"; }},
          M: { resolve: { _M: function(_L) { counts['_M']++; return _L + "M"; }} }
        }
      },
      N: {
        resolve: [
          { token: "_N", resolveFn: (_J) => _J + "N", deps: ['_J'], policy: {when: 'EAGER'} },
          { token: "_N2", resolveFn: (_J) => _J + "N2", deps: ['_J'] },
          { token: "_N3", resolveFn: (_J) => _J + "N3", deps: ['_J'] },
        ]
      }
    },
    O: { resolve: { _O: function(_O2) { return _O2 + "O"; }, _O2: function(_O) { return _O + "O2"; } } },
    P: { resolve: { $state: function($state) { return $state } },
      Q: { resolve: { _Q: function($state) { counts._Q++; vals._Q = $state; return "foo"; }}}
    },
    PAnnotated: { resolve: { $state: ['$state', function($state) { return $state }] } }
  };
}

function makePath(names: string[]): PathNode[] {
  return names.map(name => new PathNode(statesMap[name]));
}

function getResolvedData(pathContext: ResolveContext) {
  return pathContext.getTokens().filter(t => t !== '$stateParams')
      .map(token => pathContext.getResolvable(token))
      .reduce((acc, resolvable) => { acc[resolvable.token] = resolvable.data; return acc; }, {});
}

describe('Resolvables system:', function () {

  afterEach(() => router.dispose());
  beforeEach(function () {
    router = new UIRouter();
    router.plugin(TestingPlugin);
    $state = router.stateService;
    $transitions = router.transitionService;
    $registry = router.stateRegistry;

    counts = { _J: 0, _J2: 0, _K: 0, _L: 0, _M: 0, _Q: 0 };
    vals = { _Q: null };
    expectCounts = copy(counts);

    tree2Array(getStates(), false).forEach(state => $registry.register(state));
    statesMap = $registry.get()
        .reduce((acc, state) => (acc[state.name] = state.$$state(), acc), statesMap);
  });

  describe('Path.getResolvables', function () {
    it('should return Resolvables from the deepest element and all ancestors', () => {
      let path = makePath([ "A", "B", "C" ]);
      let ctx = new ResolveContext(path);
      let tokens = ctx.getTokens().sort();
      expect(tokens).toEqual( [ "_A", "_A2", "_B", "_B2", "_C", "_C2" ] );
    });
  });

  describe('Path.resolvePath()', function () {
    it('should resolve all resolves in a Path', done => {
      let path = makePath([ "A", "B" ]);
      let ctx = new ResolveContext(path);
      ctx.resolvePath().then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _A: "A", _A2: "A2", _B: "B", _B2: "B2" });
      }).then(done);
    });

    it('should resolve only eager resolves when run with "eager" policy', done => {
      let path = makePath([ "J", "N" ]);
      let ctx = new ResolveContext(path);
      ctx.resolvePath("EAGER").then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _J: "J", _N: "JN" });
      }).then(done);
    });

    it('should resolve only eager resolves when run with "eager" policy', done => {
      let path = makePath([ "J", "K" ]);
      let ctx = new ResolveContext(path);
      ctx.resolvePath("EAGER").then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _J: "J" });
      }).then(done);
    });

    it('should resolve lazy and eager resolves when run with "lazy" policy', done => {
      let path = makePath([ "J", "N" ]);
      let ctx = new ResolveContext(path);
      ctx.resolvePath("LAZY").then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _J: "J", _J2: "JJ2", _N: "JN", _N2: "JN2", _N3: "JN3"});
      }).then(done);
    });
  });

  describe('Resolvable.resolve()', function () {
    it('should resolve one Resolvable, and its deps', done => {
      let path = makePath([ "A", "B", "C" ]);
      let ctx = new ResolveContext(path);
      ctx.getResolvable("_C").resolve(ctx).then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _A: "A", _B: "B",_C: "ABC" });
      }).then(done);
    });
  });

  describe('PathElement.invokeLater()', function () {
    it('should resolve only the required deps, then inject the fn', done => {
      let path = makePath([ "A", "B", "C", "D" ]);
      let ctx = new ResolveContext(path);
      let result;

      let onEnter1 = function (_C2) { result = _C2; };
      invokeLater(onEnter1, ctx).then(function () {
        expect(result).toBe("C2");
        expect(getResolvedData(ctx)).toEqualData({_C2: "C2"});
      }).then(done);
    });
  });

  describe('PathElement.invokeLater()', function () {
    it('should resolve the required deps on demand', done => {
      let path = makePath([ "A", "B", "C", "D" ]);
      let ctx = new ResolveContext(path);

      let result;
      let cOnEnter1 = function (_C2) { result = _C2; };
      let cOnEnter2 = function (_C) { result = _C; };

      invokeLater(cOnEnter1, ctx).then(() => {
        expect(result).toBe("C2");
        expect(getResolvedData(ctx)).toEqualData({_C2: "C2"});
      }).then(() => invokeLater(cOnEnter2, ctx)).then(() => {
        expect(result).toBe("ABC");
        expect(getResolvedData(ctx)).toEqualData({_A: "A", _B: "B", _C: "ABC", _C2: "C2"});
      }).then(done);
    });
  });

  describe('invokeLater', function () {
    it('should Error if the onEnter dependency cannot be injected', done => {
      let path = makePath([ "A", "B", "C" ]);
      let ctx = new ResolveContext(path);

      let cOnEnter = function (_D) { throw new Error("Shouldn't get here. " + _D) };
      invokeLater(cOnEnter, ctx).catch(function (err) {
        expect(err.message).toContain('Could not find Dependency Injection token: "_D"');
        done();
      });
    });
  });


  describe('Resolvables', function () {
    it('should be able to inject deps from the same PathElement', done => {
      let path = makePath([ "A", "B", "C", "D" ]);
      let ctx = new ResolveContext(path);

      let result;
      let dOnEnter = function (_D) {
        result = _D;
      };

      invokeLater(dOnEnter, ctx).then(function () {
        expect(result).toBe("D1D2");
        expect(getResolvedData(ctx)).toEqualData({_D: "D1D2", _D2: "D2"});
      }).then(done);
    });
  });

  describe('Resolvables', function () {
    it('should allow PathElement to override parent deps Resolvables of the same name', done => {
      let path = makePath([ "A", "E", "F" ]);
      let ctx = new ResolveContext(path);

      let result;
      let fOnEnter = function (_F) {
        result = _F;
      };

      invokeLater(fOnEnter, ctx).then(function () {
        expect(result).toBe("_EF");
      }).then(done);
    });
  });

  // State H has a resolve named _G which takes _G as an injected parameter. injected _G should come from state "G"
  // It also has a resolve named _H which takes _G as an injected parameter. injected _G should come from state "H"
  describe('Resolvables', function () {
    it('of a particular name should be injected from the parent PathElements for their own name', done => {
      let path = makePath([ "A", "G", "H" ]);
      let hOnEnter = (_H) => { result = _H; };
      let result;
      let ctx = new ResolveContext(path);

      ctx.getResolvable("_G").get(ctx).then(data => {
        expect(data).toBe("G_G");
      }).then(() => invokeLater(hOnEnter, ctx)).then(() => {
        expect(result).toBe("G_GH");
      }).then(done);
    });
  });

  describe('Resolvables', function () {
    it('should fail to inject same-name deps to self if no parent PathElement contains the name.', done => {
      let path = makePath([ "A", "I" ]);
      let ctx = new ResolveContext(path);

      // let iPathElement = path.elements[1];
      let iOnEnter = function (_I) { throw new Error("Shouldn't get here. " + _I)  };
      let promise = invokeLater(iOnEnter, ctx);
      promise.catch(function (err) {
        expect(err.message).toContain('Could not find Dependency Injection token: "_I"');
        done();
      });
    });
  });

  xdescribe('Resolvables', function () {
    it('should fail to inject circular dependency', done => {
      var path = makePath([ "O" ]);
      let ctx = new ResolveContext(path);

      var iOnEnter = function (_O) { throw new Error("Shouldn't get here. " + _O)  };
      invokeLater(iOnEnter, ctx).catch(function (err) {
        expect(err.message).toContain("[$injector:unpr] Unknown provider: _IProvider ");
        done();
      });
    });
  });

  describe('Resolvables', function () {
    it('should not re-resolve', done => {
      let path = makePath([ "J", "K" ]);
      let ctx = new ResolveContext(path);

      let result;
      function checkCounts() {
        expect(result).toBe("JJ2K");
        expect(counts['_J']).toBe(1);
        expect(counts['_J2']).toBe(1);
        expect(counts['_K']).toBe(1);
      }

      let onEnterCount = 0;
      let kOnEnter = function (_K) {
        result = _K;
        onEnterCount++;
      };
      invokeLater(kOnEnter, ctx)
          .then(checkCounts)
          .then(() => invokeLater(kOnEnter, ctx))
          .then(checkCounts)
          .then(done)
    });
  });

  describe('Pre-Resolved Path', function () {
    it('from previous resolve operation should be re-useable when used in another resolve operation', done => {
      let path = makePath([ "J", "K" ]);
      let ctx1 = new ResolveContext(path);
      let path2 = path.concat(makePath([ "L", "M" ]));
      let ctx2 = new ResolveContext(path2);

      expect(counts["_J"]).toBe(0);
      expect(counts["_J2"]).toBe(0);

      ctx1.resolvePath().then(function () {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        asyncCount++;
      }).then(() => ctx2.resolvePath()).then(() => {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        expect(counts["_L"]).toBe(1);
        expect(counts["_M"]).toBe(1);
      }).then(done);
    });
  });

  describe('Path.slice()', function () {
    it('should create a partial path from an original path', done => {
      let path = makePath([ "J", "K", "L" ]);
      let ctx1 = new ResolveContext(path);
      ctx1.resolvePath().then(function () {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        expect(counts["_L"]).toBe(1);
      }).then(() => {
        let slicedPath = path.slice(0, 2);
        expect(slicedPath.length).toBe(2);
        expect(slicedPath[0].state).toBe(path[0].state);
        expect(slicedPath[1].state).toBe(path[1].state);
      }).then(() => {
        let path2 = path.concat(makePath([ "L", "M" ]));
        let ctx2 = new ResolveContext(path2);
        return ctx2.resolvePath();
      }).then(() => {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        expect(counts["_L"]).toBe(2);
        expect(counts["_M"]).toBe(1);
      }).then(done);
    });
  });

  // Test for #2641
  it("should not re-resolve data, when redirecting to a child", (done) => {
    $transitions.onStart({to: "J"}, ($transition$) => {
      var ctx = new ResolveContext($transition$.treeChanges().to);
      return invokeLater(function (_J) {}, ctx).then(function() {
        expect(counts._J).toEqualData(1);
        return $state.target("K");
      });
    });

    $state.go("J").then(() => {
      expect($state.current.name).toBe("K");
      expect(counts._J).toEqualData(1);
      done();
    });
  });

  // Test for #2796
  it("should not re-resolve data, when redirecting to self with dynamic parameter update", (done) => {
    let resolveCount = 0;

    $registry.register({
      name: 'dynamic',
      url: '/dynamic/{param}',
      params: {
        param: { dynamic: true }
      },
      resolve: {
        data: () => {
          new Promise(resolve => resolve('Expensive data ' + resolveCount++))
        }
      }
    });

    $transitions.onEnter({entering: "dynamic"}, trans => {
      if (trans.params()['param'] === 'initial')
        return $state.target("dynamic", { param: 'redirected' });
    });

    $state.go("dynamic", { param: 'initial'}).then(() => {
      expect($state.current.name).toBe("dynamic");
      expect($state.params['param']).toBe('redirected');
      expect(resolveCount).toBe(1);
      done();
    });
  });

  describe('NOWAIT Resolve Policy', () => {
    it('should allow a transition to complete before the resolve is settled', async (done) => {
      let resolve, resolvePromise = new Promise(_resolve => { resolve = _resolve; });

      $registry.register({
        name: 'nowait',
        resolve: {
          nowait: () => resolvePromise
        },
        resolvePolicy: { async: 'NOWAIT' }
      });

      $transitions.onSuccess({  }, trans => {
        expect(trans.injector().get('nowait') instanceof Promise).toBeTruthy();
        expect(trans.injector().getAsync('nowait') instanceof Promise).toBeTruthy();
        expect(trans.injector().getAsync('nowait')).toBe(trans.injector().get('nowait'));

        let resolvable = tail(trans.treeChanges('to')).resolvables[0];
        expect(resolvable.token).toBe('nowait');
        expect(resolvable.resolved).toBe(false);
        expect(resolvable.data).toBeUndefined();

        trans.injector().get('nowait').then(result => {
          expect(result).toBe('foobar');
          done();
        });

        resolve('foobar')
      });

      $state.go('nowait');
    });

    it('should wait for WAIT resolves and not wait for NOWAIT resolves', async (done) => {
      let resolve, resolvePromise = new Promise(_resolve => { resolve = _resolve; });

      $registry.register({
        name: 'nowait',
        resolve: [
          { token: 'nowait', policy: { async: 'NOWAIT' }, resolveFn: () => resolvePromise },
          { token: 'wait', policy: { async: 'WAIT' }, resolveFn: () => new Promise(resolve => resolve('should wait')) },
        ]
      });

      $transitions.onSuccess({  }, trans => {
        expect(trans.injector().get('nowait') instanceof Promise).toBeTruthy();
        expect(trans.injector().get('wait')).toBe('should wait');

        let resolvable = tail(trans.treeChanges('to')).resolvables[0];
        expect(resolvable.token).toBe('nowait');
        expect(resolvable.resolved).toBe(false);
        expect(resolvable.data).toBeUndefined();

        trans.injector().get('nowait').then(result => {
          expect(result).toBe('foobar');
          done();
        });

        resolve('foobar')
      });

      $state.go('nowait');
    });
  });
});


