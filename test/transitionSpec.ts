import { PathNode } from "../src/path/node";
import {
    UIRouter, RejectType, Rejection, pluck, services, TransitionService, StateService, Resolvable, Transition
} from "../src/index";
import { tree2Array, PromiseResult } from "./_testUtils";
import { TestingPlugin } from "./_testingPlugin";
import { equals } from "../src/common/common";

describe('transition', function () {

  let router: UIRouter;
  let $transitions: TransitionService;
  let $state: StateService;

  function makeTransition(from, to, options?): Transition {
    let fromState = $state.target(from).$state();
    let fromPath = fromState.path.map(state => new PathNode(state));
    return $transitions.create(fromPath, $state.target(to, null, options));
  }

  const _delay = (millis) =>
      new Promise(resolve => setTimeout(resolve, millis));
  const delay = (millis) => () => _delay(millis);

  const tick = (val?) =>
      new Promise((resolve) => setTimeout(() => resolve(val)));

  // Use this in a .then(go('from', 'to')) when you want to run a transition you expect to succeed
  const go = (from, to, options?) =>
      () => makeTransition(from, to, options).run().then(tick);

  // Use this in a .then(goFail('from', 'to')) when you want to run a transition you expect to fail
  const goFail = (from, to, options?) =>
      () => makeTransition(from, to, options).run().catch(tick);

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(TestingPlugin);
    $state = router.stateService;
    $transitions = router.transitionService;

    let stateTree = {
      first: {},
      second: {},
      third: {},
      A: {
        B: {
          C: {
            D: {}
          },
          E: {
            F: {}
          }
        },
        G: {
          H: {
            I: {}
          }
        }
      }
    };

    let states = tree2Array(stateTree, false);
    states.forEach(state => router.stateRegistry.register(state));
  });

  describe('service', () => {
    describe('async event hooks:', () => {
      it('$transition$.promise should resolve on success', (done) => {
        let result = new PromiseResult();
        $transitions.onStart({ from: "*", to: "second" }, function($transition$) {
          result.setPromise($transition$.promise);
        });

        Promise.resolve()
            .then(go("", "second"))
            .then(() => expect(result.called()).toEqual({ resolve: true, reject: false, complete: true }))
            .then(done);
      });

      it('$transition$.promise should reject on error', (done) => {
        let result = new PromiseResult();

        $transitions.onStart({ from: "*", to: "third" }, function($transition$) {
          result.setPromise($transition$.promise);
          throw new Error("transition failed");
        });

        Promise.resolve()
            .then(goFail("", "third"))
            .then(() => {
              expect(result.called()).toEqual({resolve: false, reject: true, complete: true});
              expect(result.get().reject instanceof Rejection).toBeTruthy();
              expect(result.get().reject.message).toEqual("The transition errored");
              expect(result.get().reject.detail.message).toEqual("transition failed");
            })
            .then(done);
      });

      it('$transition$.promise should reject on error in synchronous hooks', ((done) => {
        let result = new PromiseResult();

        $transitions.onBefore({ from: "*", to: "third" }, function($transition$) {
          result.setPromise($transition$.promise);
          throw new Error("transition failed");
        });

        Promise.resolve()
            .then(goFail("", "third"))
            .then(() => {
              expect(result.called()).toEqual({ resolve: false, reject: true, complete: true });
              expect(result.get().reject instanceof Rejection).toBeTruthy();
              expect(result.get().reject.message).toEqual("The transition errored");
              expect(result.get().reject.detail.message).toEqual("transition failed");
            })
            .then(done);
      }));

      it('should receive the transition as the first parameter', ((done) => {
        let t = null;

        $transitions.onStart({ from: "*", to: "second" }, function(trans) {
          t = trans;
        });

        let tsecond = makeTransition("", "second");
        tsecond.run()
            .then(tick)
            .then(() => expect(t).toBe(tsecond))
            .then(done);
      }));

      // Test for #2972 and https://github.com/ui-router/react/issues/3
      it('should reject transitions that are superseded by a new transition', ((done) => {
        $state.defaultErrorHandler(function() {});
        router.stateRegistry.register({
          name: 'slowResolve',
          resolve: {
            foo: delay(50)
          }
        });

        let results = { success: 0, error: 0 };
        let success = () => results.success++;
        let error = () => results.error++;
        $transitions.onBefore({}, trans => { trans.promise.then(success, error) });

        $state.go('slowResolve');

        _delay(20)
            .then(() =>
                $state.go('slowResolve').transition.promise )
            .then(delay(50))
            .then(() =>
                expect(results).toEqual({ success: 1, error: 1 }))
            .then(done)
      }));

      describe('.onCreate()', function() {
        beforeEach(() => $state.defaultErrorHandler(() => {}));

        it('should pass the transition', () => {
          let log = "";
          $transitions.onCreate({}, t => log += `${t.from().name};${t.to().name};`);

          log += "create;";
          makeTransition('first', 'second');
          log += "created;";

          expect(log).toBe('create;first;second;created;');
        });

        it('should run in priority order', (() => {
          let log = "";
          $transitions.onCreate({}, t => (log += "2;", null), { priority: 2 });
          $transitions.onCreate({}, t => (log += "3;", null), { priority: 3 });
          $transitions.onCreate({}, t => (log += "1;", null), { priority: 1 });

          log += "create;";
          makeTransition('first', 'second');
          log += "created;";

          expect(log).toBe('create;3;2;1;created;');
        }));

        it('should ignore return values', ((done) => {
          $transitions.onCreate({}, t => false);
          $transitions.onCreate({}, t => new Promise(resolve => resolve(false)));

          let trans = makeTransition('first', 'second');
          trans.run().then(() => {
            expect($state.current.name).toBe('second');
            done();
          });
        }));

        it('should fail on error', () => {
          $transitions.onCreate({}, () => { throw "doh" });
          expect(() => makeTransition('first', 'second')).toThrow();
        });
      });

      describe('.onBefore()', function() {
        beforeEach(() => $state.defaultErrorHandler(() => {}));

        it('should stop running remaining hooks if hook modifies transition synchronously', ((done) => {
          let counter = 0;
          let increment = (amount) => {
            return () => {
              counter += amount;
              return false;
            };
          };

          $transitions.onBefore({}, increment(1), { priority: 2 });
          $transitions.onBefore({}, increment(100), { priority: 1 });

          Promise.resolve()
            .then(goFail('first', 'second'))
            .then(() => expect(counter).toBe(1))
            .then(goFail('second', 'third'))
            .then(() => expect(counter).toBe(2))
            .then(done);
        }));

        it('should stop running remaining hooks when synchronous result throws or returns false|TargetState', ((done) => {
          let current = null;

          $transitions.onBefore({}, (t) => { current = t.to().name; });
          $transitions.onBefore({ to: 'first' }, () => {
            throw Error('first-error');
          }, { priority: 1 });
          $transitions.onBefore({ to: 'second' }, () => false, { priority: 3 });
          $transitions.onBefore({ to: 'third' }, () => $state.target('A'), { priority: 2 });

          Promise.resolve()
            .then(goFail('A', 'first'))
            .then((res: any) => {
              expect(res.type).toBe(RejectType.ERROR);
              expect(current).toBe(null);
            })
            .then(goFail('A', 'second'))
            .then((res: any) => {
              expect(res.type).toBe(RejectType.ABORTED);
              expect(current).toBe(null);
            })
            .then(goFail('A', 'third'))
            .then((res: any) => {
              expect(res.type).toBe(RejectType.SUPERSEDED);
              expect(current).toBe(null);
            })
            .then(go('A', 'B'))
            .then(() => expect(current).toBe('B'))
            .then(done);
        }));
      });

      describe('.onStart()', function() {
        it('should fire matching events when transition starts', ((done) => {
          let t = null;
          $transitions.onStart({ from: "first", to: "second" }, function($transition$) {
            t = $transition$;
          });

          Promise.resolve()
              .then(go("first", "third"))
              .then(() => expect(t).toBeNull())
              .then(go("first", "second"))
              .then(() => expect(t).not.toBeNull())
              .then(done);
        }));

        it('should get Transition as an argument, and a null state', ((done) => {
          let args = { trans: undefined, state: undefined };
          $transitions.onStart({ from: "*", to: "third" }, <any> function(trans, state) {
            args.trans = trans;
            args.state = state;
          });

          let transition = makeTransition("", "third");
          let result = new PromiseResult(transition.promise);
          transition.run()
              .then(tick)
              .then(() => {
                expect(result.called()).toEqual({ resolve: true, reject: false, complete: true });
                expect(typeof args.trans.from).toBe('function');
                expect(args.state).toBeNull()
              })
              .then(done);
        }));
      });

      describe('.onEnter()', function() {
        it('should get Transition and the state being entered as arguments', ((done) => {
          let states = [];
          let args = { trans: undefined, state: undefined, third: undefined };

          $transitions.onEnter({ entering: "*" }, <any> function(trans, state, third) {
            states.push(state);
            args.trans = trans;
            args.third = third;
          });

          Promise.resolve()
              .then(go("", "D"))
              .then(() => {
                expect(pluck(states, 'name')).toEqual(['A', 'B', 'C', 'D']);
                expect(typeof args.trans.from).toBe('function');
                expect(args.third).toBeUndefined();
              })
              .then(done)
        }));

        it('should be called on only states being entered', ((done) => {
          $transitions.onEnter({ entering: "**" }, function(trans, state) { states.push(state); });

          let states = [];
          Promise.resolve()
              .then(go("B", "D"))
              .then(() => expect(pluck(states, 'name')).toEqual([ 'C', 'D' ]))
              .then(() => states = [])
              .then(go("H", "D"))
              .then(() => expect(pluck(states, 'name')).toEqual([ 'B', 'C', 'D' ]))
              .then(done)
        }));

        it('should be called only when from state matches and the state being enter matches to', ((done) => {
          $transitions.onEnter({ from: "*", entering: "C" }, function(trans, state) { states.push(state); });
          $transitions.onEnter({ from: "B", entering: "C" }, function(trans, state) { states2.push(state); });

          let states = [], states2 = [];
          Promise.resolve()
              .then(go("A", "D"))
              .then(() => {
                expect(pluck(states, 'name')).toEqual([ 'C' ]);
                expect(pluck(states2, 'name')).toEqual([ ]);
              })

              .then(() => { states = []; states2 = []; })
              .then(go("B", "D"))
              .then(() => {
                expect(pluck(states, 'name')).toEqual([ 'C' ]);
                expect(pluck(states2, 'name')).toEqual([ 'C' ]);
              })

              .then(done);
        }));
      });

      describe('.onExit()', function() {
        it('should get Transition, the state being exited, and Injector as arguments', ((done) => {
          let args = { trans: undefined, state: undefined, third: undefined };

          $transitions.onExit({ exiting: "**" }, <any> function(trans, state, third) {
            states.push(state);
            args.trans = trans;
            args.third = third;
          });

          let states = [];
          Promise.resolve()
              .then(go("D", "H"))
              .then(() => {
                expect(pluck(states, 'name')).toEqual([ 'D', 'C', 'B' ]);
                expect(typeof args.trans.from).toBe('function');
                expect(args.third).toBeUndefined();
              })
              .then(done);

        }));

        it('should be called on only states being exited', ((done) => {
          $transitions.onExit({ exiting: "*" }, function(trans, state) { states.push(state); });

          let states = [];
          Promise.resolve()
              .then(go("D", "B"))
              .then(() => expect(pluck(states, 'name')).toEqual([ 'D', 'C' ]))
              .then(() => states = [])
              .then(go("H", "D"))
              .then(() => expect(pluck(states, 'name')).toEqual([ 'H', 'G' ]))
              .then(done);
        }));

        it('should be called only when the to state matches and the state being exited matches the from state', ((done) => {
          $transitions.onExit({ exiting: "D", to: "*" }, function(trans, state) { states.push(state); });
          $transitions.onExit({ exiting: "D", to: "C" }, function(trans, state) { states2.push(state); });

          let states = [], states2 = [];
          Promise.resolve()
              .then(go("D", "B"))
              .then(() => {
                expect(pluck(states, 'name')).toEqual([ 'D' ]);
                expect(pluck(states2, 'name')).toEqual([ ]);
              })
              .then(() => { states = []; states2 = []; })
              .then(go("D", "C"))
              .then(() => {
                expect(pluck(states, 'name')).toEqual([ 'D' ]);
                expect(pluck(states2, 'name')).toEqual([ 'D' ]);
              })
              .then(done);
        }));

        // test for #3081
        it('should inject resolve values from the exited state', ((done) => {
          router.stateRegistry.register({
            name: 'design',
            url: '/design',
            resolve: { cc: () => 'cc resolve' },
            onExit: (trans, state) => {
              expect(state).toBe(router.stateRegistry.get('design'));
              expect(trans.injector(null, 'from').get('cc')).toBe('cc resolve');
              done();
            }
          });
          const $state = router.stateService;

          Promise.resolve()
              .then(() => $state.go("design"))
              .then(() => $state.go("A"));
        }));
      });

      describe('.onSuccess()', function() {
        beforeEach(() => $state.defaultErrorHandler(function() {}));

        it('should only be called if the transition succeeds', ((done) => {
          $transitions.onSuccess({ from: "*", to: "*" }, function(trans) { states.push(trans.to().name); });
          $transitions.onEnter({ from: "A", entering: "C" }, function() { return false; });

          let states = [];
          Promise.resolve()
              .then(goFail("A", "C"))
              .then(() => expect(states).toEqual([ ]))
              .then(() => states = [])
              .then(go("B", "C"))
              .then(() => expect(states).toEqual([ 'C' ]))
              .then(done);
        }));

        it('should call all .onSuccess() even when callbacks fail (throw errors, etc)', ((done) => {
          $transitions.onSuccess({ from: "*", to: "*" }, () => false);
          $transitions.onSuccess({ from: "*", to: "*" }, () => $state.target('A'));
          $transitions.onSuccess({ from: "*", to: "*" }, function() { throw new Error("oops!"); });
          $transitions.onSuccess({ from: "*", to: "*" }, function(trans) { states.push(trans.to().name); });

          let states = [];
          Promise.resolve()
              .then(go("B", "C"))
              .then(() => expect(states).toEqual([ 'C' ]))
              .then(done);
        }));
      });

      describe('.onError()', function() {
        it('should be called if the transition aborts.', ((done) => {
          $transitions.onEnter({ from: "A", entering: "C" }, function() { return false; });
          $transitions.onError({ }, function(trans) { states.push(trans.to().name); });

          let states = [];
          Promise.resolve()
              .then(goFail("A", "D"))
              .then(() => expect(states).toEqual([ 'D' ]))
              .then(done);
        }));

        it('should be called if any part of the transition fails.', ((done) => {
          $transitions.onEnter({ from: "A", entering: "C" }, function() { throw new Error("oops!");  });
          $transitions.onError({ }, function(trans) { states.push(trans.to().name); });

          let states = [];
          Promise.resolve()
              .then(goFail("A", "D"))
              .then(() => expect(states).toEqual([ 'D' ]))
              .then(done);
        }));

        it('should be called for only handlers matching the transition.', ((done) => {
          $transitions.onEnter({ from: "A", entering: "C" }, function() { throw new Error("oops!");  });
          $transitions.onError({ from: "*", to: "*" }, function() { hooks.push("splatsplat"); });
          $transitions.onError({ from: "A", to: "C" }, function() { hooks.push("AC"); });
          $transitions.onError({ from: "A", to: "D" }, function() { hooks.push("AD"); });

          let hooks = [];
          Promise.resolve()
              .then(goFail("A", "D"))
              .then(() => expect(hooks).toEqual([ 'splatsplat', 'AD' ]))
              .then(done);
        }));

        it('should call all error handlers when transition fails.', ((done) => {
          let count = 0;

          $state.defaultErrorHandler(() => {});
          $transitions.onStart({}, () => false);
          $transitions.onError({}, () => {
            count += 1;
            return false;
          });
          $transitions.onError({}, () => {
            count += 10;
            $state.target('A');
          });
          $transitions.onError({}, function() {
            count += 100;
            throw new Error("oops!");
          });
          $transitions.onError({}, () => {
            count += 1000;
          });

          Promise.resolve()
              .then(goFail("B", "C"))
              .then(() => expect(count).toBe(1111))
              .then(done);
        }));
      });

      // Test for #2866
      it('should have access to the failure reason in transition.error().', ((done) => {
        let error = new Error("oops!");
        let transError;
        $transitions.onEnter({ from: "A", entering: "C" }, function() { throw error;  });
        $transitions.onError({ }, function(trans) { transError = trans.error(); });

        Promise.resolve()
            .then(goFail("A", "D"))
            .then(() => expect(transError.detail).toBe(error))
            .then(done);
      }));

      it("return value of 'false' should reject the transition with ABORT status", ((done) => {
        let states = [], rejection, transition = makeTransition("", "D");
        $transitions.onEnter({ entering: "*" }, function(trans, state) { states.push(state); });
        $transitions.onEnter({ from: "*", entering: "C" }, function() { return false; });

        transition.promise.catch(function(err) { rejection = err; });
        transition.run()
            .catch(tick)
            .then(() => {
              expect(pluck(states, 'name')).toEqual([ 'A', 'B', 'C' ]);
              expect(rejection.type).toEqual(RejectType.ABORTED);
            })
            .then(done);
      }));

      it("return value of type Transition should abort the transition with SUPERSEDED status", ((done) => {
        let states = [], rejection, transition = makeTransition("A", "D");
        $transitions.onEnter({ entering: "*" }, function(trans, state) { states.push(state); });
        $transitions.onEnter({ from: "*", entering: "C" }, () => $state.target("B"));
        transition.promise.catch(function(err) { rejection = err; });

        transition.run()
            .catch(tick)
            .then(() => {
              expect(pluck(states, 'name')).toEqual([ 'B', 'C' ]);
              expect(rejection.type).toEqual(RejectType.SUPERSEDED);
              expect(rejection.detail.name()).toEqual("B");
              expect(rejection.redirected).toEqual(true);
            })
            .then(done);
      }));

      it("hooks which start a new transition should cause the old transition to be rejected.", ((done) => {
        let current = null;
        function currenTransition() {
          return current;
        }

        let states = [], rejection, transition2, transition2success,
            transition = current = makeTransition("A", "D", { current: currenTransition });

        $transitions.onEnter({ entering: "*", to: "*" }, function(trans, state) { states.push(state); });
        $transitions.onEnter({ from: "A", entering: "C" }, function() {
          transition2 = current = makeTransition("A", "G", { current: currenTransition }); // similar to using $state.go() in a controller, etc.
          transition2.run();
        });

        transition.promise.catch(function(err) { rejection = err; });
        transition.run()
            .then(tick, tick)
            .then(() => {
              // .onEnter() from A->C should have set transition2.
              transition2.promise.then(function() { transition2success = true; });
            })
            .then(tick, tick)
            .then(() => {
              expect(pluck(states, 'name')).toEqual([ 'B', 'C', 'G' ]);
              expect(rejection instanceof Rejection).toBeTruthy();
              expect(rejection.type).toEqual(RejectType.SUPERSEDED);
              expect(rejection.detail.to().name).toEqual("G");
              expect(rejection.detail.from().name).toEqual("A");
              expect(rejection.redirected).toBeUndefined();

              expect(transition2success).toBe(true);
            })
            .then(done);
      }));

      it("hooks which return a promise should resolve the promise before continuing", (done) => {
        let log = [], transition = makeTransition("A", "D");
        $transitions.onEnter({ from: "*", entering: "*" }, function(trans, state) {
          log.push("#"+state.name);

          return new Promise<void>((resolve) =>
              setTimeout(() => {
                log.push("^" + state.name);
                resolve();
              })
          );
        });

        transition.run()
            .then(tick, tick)
            .then(() => expect(log.join('')).toBe("#B^B#C^C#D^D"))
            .then(done);
      });

      it("hooks which return a promise should resolve the promise before continuing", ((done) => {
        let log = [], transition = makeTransition("A", "D");
        let $q = services.$q;
        let defers = { B: $q.defer(), C: $q.defer(), D: $q.defer() };
        function resolveDeferredFor(name) {
          log.push("^" + name);
          defers[name].resolve("ok, go ahead!");
          return tick();
        }

        $transitions.onEnter({ entering: '**' }, function waitWhileEnteringState(trans, state) {
          log.push("#"+state.name);
          return defers[state.name].promise;
        });

        transition.promise.then(function() { log.push("DONE"); });
        transition.run();

        tick().then(() => expect(log.join(';')).toBe("#B"))

            .then(() => resolveDeferredFor("B"))
            .then(() => expect(log.join(';')).toBe("#B;^B;#C"))

            .then(() => resolveDeferredFor("C"))
            .then(() => expect(log.join(';')).toBe("#B;^B;#C;^C;#D"))

            .then(() => resolveDeferredFor("D"))
            .then(() => expect(log.join(';')).toBe("#B;^B;#C;^C;#D;^D;DONE"))

            .then(done, done);
      }));

      it("hooks can add resolves to a $transition$ and they will be available to be injected elsewhere", ((done) => {
        let log = [], transition = makeTransition("A", "D");
        let $q = services.$q;
        let defer = $q.defer();

        $transitions.onEnter({ entering: '**'}, function logEnter(trans, state) {
          log.push("Entered#"+state.name);
        }, { priority: -1 });

        $transitions.onEnter({ entering: "B" }, function addResolves($transition$: Transition) {
          log.push("adding resolve");
          let resolveFn = function () { log.push("resolving"); return defer.promise; };
          $transition$.addResolvable(new Resolvable('newResolve', resolveFn));
        });

        $transitions.onEnter({ entering: "C" }, function useTheNewResolve(trans) {
          log.push(trans.injector().get('newResolve'));
        });

        transition.promise.then(function() { log.push("DONE!"); });

        transition.run();

        tick().then(() => expect(log.join(';')).toBe("adding resolve;Entered#B;resolving"))
            .then(() => defer.resolve("resolvedval"))
            .then(tick, tick)
            .then(() => expect(log.join(';')).toBe("adding resolve;Entered#B;resolving;resolvedval;Entered#C;Entered#D;DONE!"))
            .then(done, done);
      }));
    });

    describe('redirected transition', () => {
      let urlRedirect;
      beforeEach(() => {
        urlRedirect = router.stateRegistry.register({ name: 'urlRedirect', url: '/urlRedirect', redirectTo: 'redirectTarget' });
        router.stateRegistry.register({ name: 'redirectTarget', url: '/redirectTarget' });
      });

      it("should not replace the current url when redirecting a state.go transition", async (done) => {
        let spy = spyOn(router.urlService, "url").and.callThrough();

        await $state.go("urlRedirect");
        expect(router.urlService.path()).toBe("/redirectTarget");
        expect(spy).toHaveBeenCalledWith("/redirectTarget", false);
        done();
      });

      it("should replace the current url when redirecting a url sync", (done) => {
        let url = spyOn(router.urlService, "url").and.callThrough();
        let transitionTo = spyOn(router.stateService, "transitionTo").and.callThrough();

        router.transitionService.onSuccess({}, () => {
          expect(transitionTo).toHaveBeenCalledWith(urlRedirect, {}, { inherit: true, source: 'url' });

          expect(url.calls.count()).toEqual(2);
          expect(url.calls.argsFor(0)).toEqual(["/urlRedirect"]);
          expect(url.calls.argsFor(1)).toEqual(["/redirectTarget", true]);

          done();
        });

        router.urlService.url('/urlRedirect');
      });

    });
  });

  describe('Transition() instance', function() {
    describe('.entering', function() {
      it('should return the path elements being entered', (() => {
        let t = makeTransition("", "A");
        expect(pluck(t.entering(), 'name')).toEqual([ "A" ]);

        t = makeTransition("", "D");
        expect(pluck(t.entering(), 'name')).toEqual([ "A", "B", "C", "D" ]);
      }));

      it('should not include already entered elements', (() => {
        let t = makeTransition("B", "D");
        expect(pluck(t.entering(), 'name')).toEqual([ "C", "D" ]);
      }));
    });

    describe('.exiting', function() {
      it('should return the path elements being exited', (() => {
        let t = makeTransition("D", "C");
        expect(pluck(t.exiting(), 'name')).toEqual([ 'D' ]);

        t = makeTransition("D", "A");
        expect(pluck(t.exiting(), 'name')).toEqual([ "D", "C", "B" ]);
      }));
    });

    describe('.is', function() {
      it('should match globs', (() => {
        let t = makeTransition("", "first");

        expect(t.is({ to: "first" })).toBe(true);
        expect(t.is({ from: "" })).toBe(true);
        expect(t.is({ to: "first", from: "" })).toBe(true);

        expect(t.is({ to: ["first", "second"] })).toBe(true);
        expect(t.is({ to: ["first", "second"], from: ["", "third"] })).toBe(true);
        expect(t.is({ to: "first", from: "**" })).toBe(true);

        expect(t.is({ to: "second" })).toBe(false);
        expect(t.is({ from: "first" })).toBe(false);
        expect(t.is({ to: "first", from: "second" })).toBe(false);

        expect(t.is({ to: ["", "third"] })).toBe(false);
        expect(t.is({ to: "**", from: "first" })).toBe(false);
      }));

      it('should match using functions', (() => {
        let t = makeTransition("", "first");

        expect(t.is({ to: function(state) { return state.name === "first"; } })).toBe(true);
        expect(t.is({ from: function(state) { return state.name === ""; } })).toBe(true);
        expect(t.is({
          to: function(state) { return state.name === "first"; },
          from: function(state) { return state.name === ""; }
        })).toBe(true);

        expect(t.is({
          to: function(state) { return state.name === "first"; },
          from: "**"
        })).toBe(true);

        expect(t.is({ to: function(state) { return state.name === "second"; } })).toBe(false);
        expect(t.is({ from: function(state) { return state.name === "first"; } })).toBe(false);
        expect(t.is({
          to: function(state) { return state.name === "first"; },
          from: function(state) { return state.name === "second"; }
        })).toBe(false);

//        expect(t.is({ to: ["", "third"] })).toBe(false);
//        expect(t.is({ to: "**", from: "first" })).toBe(false);
      }));
    });
  });

  describe('inherited params', () => {
    it('should inherit params when trans options `inherit: true`', async(done) => {
      router.stateRegistry.register({ name: 'foo', url: '/:path?query1&query2' });

      await $state.go('foo', { path: 'abc', query1: 'def', query2: 'ghi' });
      expect(router.globals.params).toEqualValues({ path: 'abc', query1: 'def', query2: 'ghi' });

      await $state.go('foo', { query2: 'jkl' });
      expect(router.globals.params).toEqualValues({ path: 'abc', query1: 'def', query2: 'jkl' });

      done();
    });

    it('should not inherit params when param declaration has inherit: false', async(done) => {
      router.stateRegistry.register({
        name: 'foo',
        url: '/:path?query1&query2',
        params: {
          query1: { inherit: false, value: null }
        }
      });

      await $state.go('foo', { path: 'abc', query1: 'def', query2: 'ghi' });
      expect(router.globals.params).toEqualValues({ path: 'abc', query1: 'def', query2: 'ghi' });

      await $state.go('foo', { query2: 'jkl' });
      expect(router.globals.params).toEqualValues({ path: 'abc', query1: null, query2: 'jkl' });

      done();
    });

    it('should not inherit params whose type has inherit: false', async(done) => {
      router.urlService.config.type('inherit', {
        inherit: true, encode: x=>x, decode: x=>x, is: () => true, equals: equals, pattern: /.*/, raw: false,
      });

      router.urlService.config.type('noinherit', {
        inherit: false, encode: x=>x, decode: x=>x, is: () => true, equals: equals, pattern: /.*/, raw: false,
      });

      router.stateRegistry.register({
        name: 'foo',
        url: '/?{query1:inherit}&{query2:noinherit}',
      });

      await $state.go('foo', { query1: 'abc', query2: 'def' });
      expect(router.globals.params).toEqualValues({ query1: 'abc', query2: 'def' });

      await $state.go('foo');
      expect(router.globals.params).toEqualValues({ query1: 'abc', query2: undefined });

      done();
    });

    it('should not inherit the "hash" param value', async(done) => {
      router.stateRegistry.register({ name: 'hash', url: '/hash' });
      router.stateRegistry.register({ name: 'other', url: '/other' });

      await $state.go('hash', { "#": "abc" });
      expect(router.globals.params).toEqualValues({ "#": "abc" });
      expect(router.urlService.hash()).toBe('abc');

      await $state.go('hash');
      expect(router.globals.params).toEqualValues({ "#": null });
      expect(router.urlService.hash()).toBe('');

      await $state.go('other', { "#": "def" });
      expect(router.globals.params).toEqualValues({ "#": "def" });
      expect(router.urlService.hash()).toBe('def');

      await $state.go('hash');
      expect(router.globals.params).toEqualValues({ "#": null });
      expect(router.urlService.hash()).toBe('');

      done();
    });
  });
});
