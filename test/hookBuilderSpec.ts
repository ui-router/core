import { UIRouter, TransitionService, StateService, State, PathNode } from "../src/index";
import { tree2Array } from "./_testUtils";
import { TransitionHookPhase } from "../src/transition/interface";
import { TestingPlugin } from "./_testingPlugin";

describe('HookBuilder:', function() {
  let uiRouter: UIRouter = null;
  let $trans: TransitionService = null;
  let $state: StateService = null;
  let root: State = null;

  let log = "";
  let hookNames = [ "onBefore", "onStart", "onExit", "onRetain", "onEnter", "onFinish", "onSuccess", "onError" ];
  const hook = (name) => () => log += `${name};`;

  beforeEach(() => {
    log = "";
    uiRouter = new UIRouter();
    uiRouter.plugin(TestingPlugin);

    $trans = uiRouter.transitionService;
    $state = uiRouter.stateService;
    root = uiRouter.stateRegistry.root();

    let statetree = {
      A: {
        B: {
          C: {
            D: {

            }
          }
        }
      }
    };

    tree2Array(statetree, true).forEach(state => uiRouter.stateRegistry.register(state));
  });

  let trans, trans2, hb, hb2, callback;
  beforeEach(function() {
    // Clean out the default UIRouter onBefore hooks
    uiRouter.transitionService.getHooks("onBefore").length = 0;

    // Transition from 'A' to 'A.B.C'
    let A = $state.target('A', null).$state();
    let path = [new PathNode(root), new PathNode(A)];
    trans = $trans.create(path, $state.target("A.B.C", null));
    hb = trans.hookBuilder();
    expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).length).toBe(0);

    // Transition from 'A.B.C' to 'A'
    A = $state.target('A', null).$state();
    let B = $state.target('A.B', null).$state();
    let C = $state.target('A.B.C', null).$state();
    let fromPath = [new PathNode(root), new PathNode(A), new PathNode(B), new PathNode(C)];
    trans2 = $trans.create(fromPath, $state.target("A", null));
    hb2 = trans2.hookBuilder();

    callback = hook('hook');
    expect(typeof callback).toBe('function')
  });

  const getFn = x => x['registeredHook']['callback'];

  describe('HookMatchCriteria', function() {

    describe('.to', function() {
      it("should match a transition with same to state", function() {
        trans.onBefore({to: "A.B.C"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });

      it("should not match a transition with a different to state", function() {
        trans.onBefore({to: "A.B"}, callback);
        trans.onBefore({to: "A.B.C.D"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([]);
      });

      it("should match a transition using a glob", function() {
        trans.onBefore({to: "A.B.*"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });

      it("should match a transition using a function", function() {
        let deregister = trans.onBefore({to: (state) => state.name === 'A.B'}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([]);

        trans.onBefore({to: (state) => state.name === 'A.B.C'}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });
    });


    describe('.from', function() {
      it("should match a transition with same from state", function() {
        trans.onBefore({from: "A"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });

      it("should not match a transition with a different from state", function() {
        trans.onBefore({from: "A.B"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([]);
      });

      it("should match a transition using a function", function() {
        let deregister = trans.onBefore({from: (state) => state.name === 'A.B'}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([]);

        trans.onBefore({from: (state) => state.name === 'A'}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });
    });


    describe('.to and .from', function() {
      it("should match a transition with same to and from state", function() {
        trans.onBefore({from: "A", to: "A.B.C"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });

      it("should not match a transition with a different to or from state", function() {
        trans.onBefore({from: "A", to: "A.B.C.D"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([]);
      });
    });


    describe('.entering', function() {
      it("should match a transition that will enter the 'entering' state", function() {
        trans.onBefore({entering: "A.B.C"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });
    });


    describe('.retained', function() {
      it("should match a transition where the state is already entered, and will not exit", function() {
        trans.onBefore({retained: "A"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });

      it("should not match a transition that will not retain the state", function() {
        trans.onBefore({retained: "A.B"}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([]);
      });
    });


    describe('.exiting', function() {
      it("should match a transition that will exit the 'exiting' state", function() {
        trans2.onBefore({exiting: "A.B.C"}, callback);
        expect(hb2.buildHooksForPhase(TransitionHookPhase.BEFORE).map(getFn)).toEqual([callback]);
      });
    });
  });

  describe('built TransitionHooks', function() {
    beforeEach(function() {
      // Deregister all built-in TransitionService hooks for clean slate for these tests
      Object.keys($trans._deregisterHookFns).forEach(key => $trans._deregisterHookFns[key]());
    });

    describe('should have the correct state context', function() {
      const hookTypeByName = name =>
          $trans._pluginapi.getTransitionEventTypes().filter(type => type.name === name)[0];

      const context = hook =>
          hook.stateContext && hook.stateContext.name;

      it('; onBefore should not have a state context', function() {
        trans.onBefore({}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.BEFORE).map(context)).toEqual([null]);
      });

      it('; onStart should not have a state context', function() {
        trans.onStart({}, callback);
        expect(hb.buildHooks(hookTypeByName('onStart')).map(context)).toEqual([null]);
      });

      it('; onEnter should be bound to the entering state(s)', function() {
        trans.onEnter({}, callback);
        expect(hb.buildHooks(hookTypeByName('onEnter')).map(context)).toEqual(["A.B", "A.B.C"]);
      });

      it('; onRetain should be bound to the retained state(s)', function() {
        trans.onRetain({}, callback);
        expect(hb.buildHooks(hookTypeByName('onRetain')).map(context)).toEqual(["", "A"]);
      });

      it('; onExit should be bound to the exiting state(s)', function() {
        trans2.onExit({}, callback);
        expect(hb2.buildHooks(hookTypeByName('onExit')).map(context)).toEqual(["A.B.C", "A.B"]);
      });

      it('; onFinish should not have a state context', function() {
        trans.onFinish({}, callback);
        expect(hb.buildHooks(hookTypeByName('onFinish')).map(context)).toEqual([null]);
      });

      it('; onSuccess should not have a state context', function() {
        trans.onSuccess({}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.SUCCESS).map(context)).toEqual([null]);
      });

      it('; onError should not have a state context', function() {
        trans.onStart({}, () => { throw new Error('shuckydarn') });
        trans.onError({}, callback);
        expect(hb.buildHooksForPhase(TransitionHookPhase.ERROR).map(context)).toEqual([null]);
      });

    });
  });
});
