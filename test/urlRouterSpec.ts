import { UrlMatcher, UrlMatcherFactory, UrlRouter, StateService, UIRouter } from "../src/index";
import { TestingPlugin } from "./_testingPlugin";
import { LocationServices } from "../src/common/coreservices";
import { UrlService } from "../src/url/urlService";

declare var inject;

describe("UrlRouter", function () {
  var router: UIRouter;
  var $ur: UrlRouter,
      $url: UrlService,
      $umf: UrlMatcherFactory,
      $s: StateService,
      location: LocationServices,
      match;

  beforeEach(function() {
    router = new UIRouter();
    router.plugin(TestingPlugin);
    $ur = router.urlRouter;
    $url = router.urlService;
    $umf = router.urlMatcherFactory;
    $s = router.stateService;
    location = router.locationService;
  });

  beforeEach(function () {
    let rule1 = $ur.urlRuleFactory.fromRegExp(/\/baz/, "/b4z");
    // let rule1 = $ur.urlRuleFactory.fromMatchFn($url => /baz/.test($url.path()) && $url.path().replace('baz', 'b4z'));
    $ur.addRule(rule1);

    $ur.when('/foo/:param', function ($match) {
      match = ['/foo/:param', $match];
    });

    $ur.when('/bar', function ($match) {
      match = ['/bar', $match];
    });
  });


  it("should throw on non-function rules", function () {
    expect(function() { $ur.addRule(null); }).toThrowError(/invalid rule/);
    expect(function() { $ur.otherwise(null); }).toThrowError(/must be a/);
  });

  it("should execute rewrite rules", function () {
    location.url("/foo");
    expect(location.path()).toBe("/foo");

    location.url("/baz");
    expect(location.path()).toBe("/b4z");
  });

  it("should keep otherwise last", function () {
    $ur.otherwise('/otherwise');

    location.url("/lastrule");
    expect(location.path()).toBe("/otherwise");

    $ur.when('/lastrule', function($match) {
      match = ['/lastrule', $match];
    });

    location.url("/lastrule");
    expect(location.path()).toBe("/lastrule");
  });

  it('addRule should return a deregistration function', function() {
    var count = 0, rule = {
      match: () => count++,
      handler: match => match,
      priority: 0,
      type: "OTHER",
    };

    let dereg = $ur.addRule(rule as any);

    $ur.sync();
    expect(count).toBe(1);
    $ur.sync();
    expect(count).toBe(2);

    dereg();
    $ur.sync();
    expect(count).toBe(2);
  });

  it('removeRule should remove a previously registered rule', function() {
    var count = 0, rule = {
      match: () => count++,
      handler: match => match,
      priority: 0,
      type: "OTHER",
    };
    $ur.addRule(rule as any);

    $ur.sync();
    expect(count).toBe(1);
    $ur.sync();
    expect(count).toBe(2);

    $ur.removeRule(rule);
    $ur.sync();
    expect(count).toBe(2);
  });

  it('when should return a deregistration function', function() {
    let calls = 0;
    location.url('/foo');
    let dereg = $ur.when('/foo', function() { calls++; });

    $ur.sync();
    expect(calls).toBe(1);

    dereg();
    $ur.sync();
    expect(calls).toBe(1);
  });

  describe("location updates", function() {
    it('can push location changes', function () {
      spyOn(router.locationService, "url");
      $ur.push($umf.compile("/hello/:name"), { name: "world" });
      expect(router.locationService.url).toHaveBeenCalledWith("/hello/world", undefined);
    });

    it('can push a replacement location', function () {
      spyOn(router.locationService, "url");
      $ur.push($umf.compile("/hello/:name"), { name: "world" }, { replace: true });
      expect(router.locationService.url).toHaveBeenCalledWith("/hello/world", true);
    });

    it('can push location changes with no parameters', function () {
      spyOn(router.locationService, "url");
      $ur.push($umf.compile("/hello/:name", { params: { name: "" } }));
      expect(router.locationService.url).toHaveBeenCalledWith("/hello/", undefined);
    });

    it('can push location changes that include a #fragment', function () {
      // html5mode disabled
      $ur.push($umf.compile('/hello/:name'), { name: 'world', '#': 'frag' });
      expect($url.path()).toBe('/hello/world');
      expect($url.hash()).toBe('frag');
    });

    it('can read and sync a copy of location URL', function () {
      $url.url('/old');

      spyOn(router.locationService, 'path').and.callThrough();
      $ur.update(true);
      expect(router.locationService.path).toHaveBeenCalled();

      $url.url('/new');
      $ur.update();

      expect($url.path()).toBe('/old');
    });
  });

  describe("URL generation", function() {
    it("should return null when UrlMatcher rejects parameters", function () {
      $umf.type("custom", <any> { is: val => val === 1138 });
      var matcher = $umf.compile("/foo/{param:custom}");

      expect($ur.href(matcher, { param: 1138 })).toBe('#/foo/1138');
      expect($ur.href(matcher, { param: 5 })).toBeNull();
    });

    it('should return URLs with #fragments', function () {
      expect($ur.href($umf.compile('/hello/:name'), { name: 'world', '#': 'frag' })).toBe('#/hello/world#frag');
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

    $ur.addRule($ur.urlRuleFactory.create(/.*/, () => log.push($url.path())));

    $url.url('/foo');

    expect(log).toEqual([]);

    $ur.listen();
    $ur.sync();

    expect(log).toEqual(["/foo"]);
  });
});
