import { UrlMatcher, UrlMatcherFactory, UrlRouter, StateService, UIRouter } from "../src/index";
import { TestingPlugin } from "./_testingPlugin";
import { LocationServices } from "../src/common/coreservices";
import { UrlService } from "../src/url/urlService";
import { StateRegistry } from "../src/state/stateRegistry";
import { noop } from "../src/common/common";
import { UrlRule, MatchResult } from "../src/url/interface";

declare var jasmine;
var _anything = jasmine.anything();

describe("UrlRouter", function () {
  var router: UIRouter;
  var urlRouter: UrlRouter,
      urlService: UrlService,
      urlMatcherFactory: UrlMatcherFactory,
      stateService: StateService,
      stateRegistry: StateRegistry,
      locationService: LocationServices;

  const matcher = (...strings: string[]) =>
      strings.reduce((prev: UrlMatcher, str) =>
          prev ? prev.append(urlMatcherFactory.compile(str)) : urlMatcherFactory.compile(str), undefined);

  beforeEach(function() {
    router = new UIRouter();
    router.plugin(TestingPlugin);

    urlRouter = router.urlRouter;
    urlService = router.urlService;
    urlMatcherFactory = router.urlMatcherFactory;
    stateService = router.stateService;
    stateRegistry = router.stateRegistry;
    locationService = router.locationService;
  });

  it("should throw on non-function rules", function () {
    expect(function() { urlRouter.rule(null); }).toThrowError(/invalid rule/);
    expect(function() { urlRouter.otherwise(null); }).toThrowError(/must be a/);
  });

  it("should execute rewrite rules", function () {
    urlRouter.rule(urlRouter.urlRuleFactory.create(/\/baz/, "/b4z"));

    locationService.url("/foo");
    expect(locationService.path()).toBe("/foo");

    locationService.url("/baz");
    expect(locationService.path()).toBe("/b4z");
  });

  it("should keep otherwise last", function () {
    urlRouter.otherwise('/otherwise');

    locationService.url("/lastrule");
    expect(locationService.path()).toBe("/otherwise");

    urlRouter.when('/lastrule', noop);

    locationService.url("/lastrule");
    expect(locationService.path()).toBe("/lastrule");
  });

  it('`rule` should return a deregistration function', function() {
    var count = 0;
    var rule: UrlRule = {
      match: () => count++,
      handler: match => match,
      matchPriority: () => 0,
      $id: 0,
      priority: 0,
      type: "OTHER",
    };

    let dereg = urlRouter.rule(rule as any);

    urlRouter.sync();
    expect(count).toBe(1);
    urlRouter.sync();
    expect(count).toBe(2);

    dereg();
    urlRouter.sync();
    expect(count).toBe(2);
  });

  it('`removeRule` should remove a previously registered rule', function() {
    var count = 0;
    var rule: UrlRule = {
      match: () => count++,
      handler: match => match,
      matchPriority: () => 0,
      $id: 0,
      priority: 0,
      type: "OTHER",
    };
    urlRouter.rule(rule as any);

    urlRouter.sync();
    expect(count).toBe(1);
    urlRouter.sync();
    expect(count).toBe(2);

    urlRouter.removeRule(rule);
    urlRouter.sync();
    expect(count).toBe(2);
  });

  it('`when` should return the new rule', function() {
    let calls = 0;
    locationService.url('/foo');
    let rule = urlRouter.when('/foo', function() { calls++; });

    urlRouter.sync();
    expect(calls).toBe(1);

    expect(typeof rule.match).toBe('function');
    expect(typeof rule.handler).toBe('function');
  });

  describe("location updates", function() {
    it('can push location changes', function () {
      spyOn(router.locationService, "url");
      urlRouter.push(matcher("/hello/:name"), { name: "world" });
      expect(router.locationService.url).toHaveBeenCalledWith("/hello/world", undefined);
    });

    it('can push a replacement location', function () {
      spyOn(router.locationService, "url");
      urlRouter.push(matcher("/hello/:name"), { name: "world" }, { replace: true });
      expect(router.locationService.url).toHaveBeenCalledWith("/hello/world", true);
    });

    it('can push location changes with no parameters', function () {
      spyOn(router.locationService, "url");
      urlRouter.push(urlMatcherFactory.compile("/hello/:name", { params: { name: "" } }));
      expect(router.locationService.url).toHaveBeenCalledWith("/hello/", undefined);
    });

    it('can push location changes that include a #fragment', function () {
      // html5mode disabled
      urlRouter.push(matcher('/hello/:name'), { name: 'world', '#': 'frag' });
      expect(urlService.path()).toBe('/hello/world');
      expect(urlService.hash()).toBe('frag');
    });

    it('can read and sync a copy of location URL', function () {
      urlService.url('/old');

      spyOn(router.locationService, 'path').and.callThrough();
      urlRouter.update(true);
      expect(router.locationService.path).toHaveBeenCalled();

      urlService.url('/new');
      urlRouter.update();

      expect(urlService.path()).toBe('/old');
    });
  });

  describe("URL generation", function() {
    it("should return null when UrlMatcher rejects parameters", function () {
      urlMatcherFactory.type("custom", <any> { is: val => val === 1138 });
      var urlmatcher = matcher("/foo/{param:custom}");

      expect(urlRouter.href(urlmatcher, { param: 1138 })).toBe('#/foo/1138');
      expect(urlRouter.href(urlmatcher, { param: 5 })).toBeNull();
    });

    it('should return URLs with #fragments', function () {
      expect(urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' })).toBe('#/hello/world#frag');
    });
  });

  describe('Url Rule priority', () => {

    var matchlog: string[];
    beforeEach(() => matchlog = []);
    const log = (id) => () => (matchlog.push(id), null);

    it("should prioritize a path with a static string over a param 1", () => {
      var spy = spyOn(stateService, "transitionTo");
      let A = stateRegistry.register({ name: 'A', url: '/:pA' });
      let B = stateRegistry.register({ name: 'B', url: '/BBB' });

      urlService.url("/AAA");
      expect(spy).toHaveBeenCalledWith(A, { pA: 'AAA' }, _anything);

      urlService.url("/BBB");
      expect(spy).toHaveBeenCalledWith(B, { }, _anything);
    });

    it("should prioritize a path with a static string over a param 2", () => {
      var spy = spyOn(stateService, "transitionTo");
      stateRegistry.register({ name: 'foo', url: '/foo' });
      let A = stateRegistry.register({ name: 'foo.A', url: '/:pA' });
      let B = stateRegistry.register({ name: 'B', url: '/foo/BBB' });

      urlService.url("/foo/AAA");
      expect(spy).toHaveBeenCalledWith(A, { pA: 'AAA' }, _anything);

      urlService.url("/foo/BBB");
      expect(spy).toHaveBeenCalledWith(B, { }, _anything);
    });

    it("should prioritize a path with a static string over a param 3", () => {
      urlRouter.when(matcher('/foo', '/:p1', '/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/AAA', '/tail'), log('AAA'));
      urlRouter.when(matcher('/foo', '/BBB/tail'), log('BBB'));

      urlService.url("/foo/AAA/tail");
      expect(matchlog).toEqual(['AAA']);

      urlService.url("/foo/BBB/tail");
      expect(matchlog).toEqual(['AAA', 'BBB']);

      urlService.url("/foo/XXX/tail");
      expect(matchlog).toEqual(['AAA', 'BBB', 'p1']);
    });

    it("should prioritize a path with a static string over a param 4", () => {
      urlRouter.when(matcher('/foo', '/:p1/:p2', '/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/:p1/AAA', '/tail'), log('AAA'));

      urlService.url("/foo/xyz/AAA/tail");
      expect(matchlog).toEqual(['AAA']);

      urlService.url("/foo/xyz/123/tail");
      expect(matchlog).toEqual(['AAA', 'p1']);
    });

    it("should prioritize a path with a static string over a param 5", () => {
      urlRouter.when(matcher('/foo/:p1/:p2/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/:p1/AAA', '/tail'), log('AAA'));

      urlService.url("/foo/xyz/AAA/tail");
      expect(matchlog).toEqual(['AAA']);

      urlService.url("/foo/xyz/123/tail");
      expect(matchlog).toEqual(['AAA', 'p1']);
    });

    it("should prioritize a path with a static string over a param 6", () => {
      urlRouter.when(matcher('/foo/:p1/:p2/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/:p1/AAA', '/:p2'), log('AAA'));

      urlService.url("/foo/xyz/AAA/tail");
      expect(matchlog).toEqual(['AAA']);

      urlService.url("/foo/xyz/123/tail");
      expect(matchlog).toEqual(['AAA', 'p1']);
    });

    it("should prioritize a rule with a higher priority", () => {
      urlRouter.when(matcher('/foo', '/:p1', '/:p2'), log(1), { priority: 1 });
      urlRouter.when(matcher('/foo/123/456'), log(2));
      urlService.url("/foo/123/456");

      expect(matchlog).toEqual([1]);
    });

    describe('rules which sort identically', () => {
      it("should prioritize the rule with the highest number of matched param values", () => {
        urlRouter.when(matcher('/foo/:p1/:p2'), log(1));
        urlRouter.when(matcher('/foo/:p1/:p2?query'), log(2));

        urlService.url("/foo/123/456");
        expect(matchlog).toEqual([1]);

        urlService.url("/foo/123/456?query=blah");
        expect(matchlog).toEqual([1, 2]);
      })
    });
  });

  describe('match', () => {
    let A, B, CCC;
    beforeEach(() => {
      A = stateRegistry.register({ name: 'A', url: '/:pA' });
      B = stateRegistry.register({ name: 'B', url: '/BBB' });
      CCC = urlService.rules.when('/CCC', '/DDD');
    });

    it("should return the best match for a URL 1", () => {
      let match: MatchResult = urlRouter.match({ path: '/BBB' });
      expect(match.rule.type).toBe("STATE");
      expect(match.rule['state']).toBe(B)
    });

    it("should return the best match for a URL 2", () => {
      let match: MatchResult = urlRouter.match({ path: '/EEE' });
      expect(match.rule.type).toBe("STATE");
      expect(match.rule['state']).toBe(A);
      expect(match.match).toEqual({ pA: 'EEE' });
    });

    it("should return the best match for a URL 3", () => {
      let match: MatchResult = urlRouter.match({ path: '/CCC' });
      expect(match.rule.type).toBe("URLMATCHER");
      expect(match.rule).toBe(CCC);
    });
  });
});

describe('UrlRouter.deferIntercept', () => {
  var $ur, $url;
  beforeEach(function() {
    var router = new UIRouter();
    router.urlRouter.deferIntercept();
    router.plugin(TestingPlugin);
    $ur = router.urlRouter;
    $url = router.urlService;
  });

  it("should allow location changes to be deferred", function () {
    var log = [];

    $ur.rule($ur.urlRuleFactory.create(/.*/, () => log.push($url.path())));

    $url.url('/foo');

    expect(log).toEqual([]);

    $ur.listen();
    $ur.sync();

    expect(log).toEqual(["/foo"]);
  });
});
