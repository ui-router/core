import { StateMatcher, StateBuilder, UrlMatcher, extend } from "../src/index";
import { ParamTypes } from "../src/params/paramTypes";
import { UIRouter } from "../src/router";
import { State } from "../src/state/stateObject";

let paramTypes = new ParamTypes();
describe('StateBuilder', function() {
  let states, router, registry, matcher, urlMatcherFactory, builder;

  beforeEach(function() {
    router = new UIRouter();

    registry = router.stateRegistry;
    urlMatcherFactory = router.urlMatcherFactory;
    matcher = registry.matcher;
    builder = registry['builder'];
    builder.builder('views', (state, parent) => { return state.views || { $default: {} }; });

    registry.register({ name: 'home' });
    registry.register({ name: 'home.about' });
    registry.register({ name: 'home.about.people' });
    registry.register({ name: 'home.about.people.person' });
    registry.register({ name: 'home.about.company' });
    registry.register({ name: 'other' });
    registry.register({ name: 'other.foo' });
    registry.register({ name: 'other.foo.bar' });

    registry.register({ name: 'home.withData', data: { val1: "foo", val2: "bar" } });
    registry.register({ name: 'home.withData.child', data: { val2: "baz" } });

    states = registry.get().reduce((acc, state) => (acc[state.name] = state, acc), {});
  });

  beforeEach(function() {
    // builder.builder('resolve', uiRouter.ng1ResolveBuilder);
  });

  describe('interface', function() {
    describe('name()', function() {
      it('should return dot-separated paths', function() {
        expect(builder.name(states['home.about.people'])).toBe('home.about.people');
        expect(builder.name(states['home.about'])).toBe('home.about');
        expect(builder.name(states['home'])).toBe('home');
      });

      it('should concatenate parent names', function() {
        expect(builder.name({ name: "bar", parent: "foo" })).toBe("foo.bar");
        expect(builder.name({ name: "bar", parent: { name: "foo" } })).toBe("foo.bar");
      });
    });

    describe('parentName()', function() {
      it('should parse dot-separated paths', function() {
        expect(builder.parentName(states['other.foo.bar'])).toBe('other.foo');
      });
      it('should always return parent name as string', function() {
        expect(builder.parentName(states['other.foo'])).toBe('other');
      });
      it('should return empty string if state has no parent', function() {
        expect(builder.parentName(states[''])).toBe("");
      });
      it('should error if parent: is specified *AND* the state name has a dot (.) in it', function() {
        let errorState = { name: 'home.error', parent: 'home' };
        expect(() => builder.parentName(errorState)).toThrowError();
      });
    });
  });

  describe('state building', function() {
    it('should build parent property', function() {
      let about = State.create({ name: 'home.about' });
      expect(builder.builder('parent')(about)).toBe(states['home'].$$state());
    });

    it('should inherit parent data', function() {
      let state = State.create(states['home.withData.child']);
      expect(builder.builder('data')(state)).toEqualData({ val1: "foo", val2: "baz" });

      state = State.create(states['home.withData']);
      expect(builder.builder('data')(state)).toEqualData({ val1: "foo", val2: "bar" });
    });

    it('should compile a UrlMatcher for ^ URLs', function() {
      let url = new UrlMatcher('/', paramTypes, null);
      spyOn(urlMatcherFactory, 'compile').and.returnValue(url);
      spyOn(urlMatcherFactory, 'isMatcher').and.returnValue(true);

      expect(builder.builder('url')({ url: "^/foo" })).toBe(url);
      expect(urlMatcherFactory.compile).toHaveBeenCalledWith("/foo", {
        params: {},
        paramMap: jasmine.any(Function)
      });
      expect(urlMatcherFactory.isMatcher).toHaveBeenCalledWith(url);
    });

    it('should concatenate URLs from root', function() {
      let root = states[''].$$state();
      spyOn(root.url, 'append').and.callThrough();

      let childstate = State.create({ name: 'asdf', url: "/foo" });
      builder.builder('url')(childstate);
      
      expect(root.url.append).toHaveBeenCalled();
      let args = root.url.append.calls.argsFor(0);
      expect(args[0].pattern).toBe('/foo')
    });

    it('should pass through empty URLs', function() {
      expect(builder.builder('url')({ url: null })).toBeNull();
    });

    it('should pass through custom UrlMatchers', function() {
      let root = states[''].$$state();
      let url = new UrlMatcher("/", paramTypes, null);
      spyOn(urlMatcherFactory, 'isMatcher').and.returnValue(true);
      spyOn(root.url, 'append').and.returnValue(url);
      expect(builder.builder('url')({ url: url })).toBe(url);
      expect(urlMatcherFactory.isMatcher).toHaveBeenCalledWith(url);
      expect(root.url.append).toHaveBeenCalledWith(url);
    });

    it('should throw on invalid UrlMatchers', function() {
      spyOn(urlMatcherFactory, 'isMatcher').and.returnValue(false);

      expect(function() {
        builder.builder('url')({ toString: function() { return "foo"; }, url: { foo: "bar" } });
      }).toThrowError(Error, "Invalid url '[object Object]' in state 'foo'");

      expect(urlMatcherFactory.isMatcher).toHaveBeenCalledWith({ foo: "bar" });
    });
  });

  describe('state definitions with prototypes', () => {
    function fooResolve() {}
    let proto = {
      name: 'name_',
      abstract: true,
      resolve: { foo: fooResolve},
      resolvePolicy: {},
      url: 'name/',
      params: { foo: 'foo' },
      // views: {},
      data: { foo: 'foo' },
      onExit: function () { },
      onRetain: function () { },
      onEnter: function () { },
      lazyLoad: function () { },
      redirectTo: 'target_',
    };

    MyStateClass.prototype = proto;
    function MyStateClass () { }

    let nestedProto = {
      parent: "name_",
      name: 'nested',
    };

    MyNestedStateClass.prototype = nestedProto;
    function MyNestedStateClass () { }

    let router, myBuiltState: State, myNestedBuiltState: State;
    beforeEach(() => {
      router = new UIRouter();
      myNestedBuiltState = router.stateRegistry.register(new MyNestedStateClass());
      myBuiltState = router.stateRegistry.register(new MyStateClass());
    });

    it('should use `parent` from the prototype', () => {
      expect(myNestedBuiltState.parent).toBe(myBuiltState);
    });

    it('should use `name` from the prototype', () => {
      expect(myBuiltState.name).toBe(proto.name);
    });

    it('should use `abstract` from the prototype', () => {
      expect(myBuiltState.abstract).toBe(proto.abstract);
    });

    it('should use `resolve` from the prototype', () => {
      expect(myBuiltState.resolvables.length).toBe(1);
      expect(myBuiltState.resolvables[0].token).toBe('foo');
      expect(myBuiltState.resolvables[0].resolveFn).toBe(fooResolve);
    });

    it('should use `resolvePolicy` from the prototype', () => {
      expect(myBuiltState.resolvePolicy).toBe(proto.resolvePolicy);
    });

    it('should use `url` from the prototype', () => {
      expect(myBuiltState.url.pattern).toBe(proto.url);
    });

    it('should use `params` from the prototype', () => {
      expect(myBuiltState.parameter('foo')).toBeTruthy();
      expect(myBuiltState.parameter('foo').config.value).toBe('foo');
    });

    // ui-router-core doesn't have views builder
    // it('should use `views` from the prototype', () => {
    //   expect(myState.views).toBe(proto.views);
    //   expect(built.views).toBe(proto.views);
    // });

    it('should use `data` from the prototype', () => {
      expect(myBuiltState.data.foo).toBe(proto.data.foo);
    });

    it('should use `onExit` from the prototype', () => {
      expect(myBuiltState.onExit).toBe(proto.onExit);
    });

    it('should use `onRetain` from the prototype', () => {
      expect(myBuiltState.onRetain).toBe(proto.onRetain);
    });

    it('should use `onEnter` from the prototype', () => {
      expect(myBuiltState.onEnter).toBe(proto.onEnter);
    });

    it('should use `lazyLoad` from the prototype', () => {
      expect(myBuiltState.lazyLoad).toBe(proto.lazyLoad);
    });
    
    it('should use `redirectTo` from the prototype', () => {
      expect(myBuiltState.redirectTo).toBe(proto.redirectTo);
    });
  })
});
