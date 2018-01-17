import { UrlMatcher, UrlMatcherFactory, UrlRouter, StateService, UIRouter } from '../src/index';
import { TestingPlugin } from './_testingPlugin';
import { LocationServices } from '../src/common/coreservices';
import { UrlService } from '../src/url/urlService';
import { StateRegistry } from '../src/state/stateRegistry';
import { noop } from '../src/common/common';
import { UrlRule, MatchResult } from '../src/url/interface';
import { pushStateLocationPlugin } from '../src/vanilla';

declare let jasmine;
const _anything = jasmine.anything();

describe('UrlRouter', function () {
  let router: UIRouter;
  let urlRouter: UrlRouter,
    urlService: UrlService,
    urlMatcherFactory: UrlMatcherFactory,
    stateService: StateService,
    stateRegistry: StateRegistry,
    locationService: LocationServices;

  const matcher = (...strings: string[]) =>
    strings.reduce((prev: UrlMatcher, str) =>
      prev ? prev.append(urlMatcherFactory.compile(str)) : urlMatcherFactory.compile(str), undefined);

  const matcherRule = (...strings: string[]) =>
    urlRouter.urlRuleFactory.create(matcher(...strings));

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

  it('should throw on non-function rules', function () {
    expect(function() { urlRouter.rule(null); }).toThrowError(/invalid rule/);
    expect(function() { urlRouter.otherwise(null); }).toThrowError(/must be a/);
  });

  it('should execute rewrite rules', function () {
    urlRouter.rule(urlRouter.urlRuleFactory.create(/\/baz/, '/b4z'));

    locationService.url('/foo');
    expect(locationService.path()).toBe('/foo');

    locationService.url('/baz');
    expect(locationService.path()).toBe('/b4z');
  });

  it('should keep otherwise last', function () {
    urlRouter.otherwise('/otherwise');

    locationService.url('/lastrule');
    expect(locationService.path()).toBe('/otherwise');

    urlRouter.when('/lastrule', noop);

    locationService.url('/lastrule');
    expect(locationService.path()).toBe('/lastrule');
  });

  describe('.initial(string)', () => {
    beforeEach(() => {
      router.stateRegistry.register({ name: 'foo', url: '/foo' });
      router.stateRegistry.register({ name: 'bar', url: '/bar' });
      router.stateRegistry.register({ name: 'otherwise', url: '/otherwise' });

      urlRouter.initial('/foo');
      urlRouter.otherwise('/otherwise');
    });

    it("should activate the initial path when initial path matches ''" , function () {
      locationService.url('');
      expect(locationService.path()).toBe('/foo');
    });

    it("should activate the initial path when initial path matches '/'" , function () {
      locationService.url('/');
      expect(locationService.path()).toBe('/foo');
    });

    it('should not activate the initial path after the initial transition' , function (done) {
      stateService.go('bar').then(() => {
        locationService.url('/');
        expect(locationService.path()).toBe('/otherwise');
        done();
      });
    });
  });

  describe('.initial({ state: "state" })', () => {
    let goSpy = null;
    beforeEach(() => {
      router.stateRegistry.register({ name: 'foo', url: '/foo' });
      router.stateRegistry.register({ name: 'bar', url: '/bar' });
      router.stateRegistry.register({ name: 'otherwise', url: '/otherwise' });

      urlRouter.initial({ state: 'foo' });
      urlRouter.otherwise({ state: 'otherwise' });

      goSpy = spyOn(stateService, 'transitionTo').and.callThrough();
    });

    it("should activate the initial path when initial path matches ''" , function () {
      locationService.url('');
      expect(goSpy).toHaveBeenCalledWith('foo', undefined, jasmine.anything());
    });

    it("should activate the initial path when initial path matches '/'" , function () {
      locationService.url('/');
      expect(goSpy).toHaveBeenCalledWith('foo', undefined, jasmine.anything());
    });

    it('should not activate the initial path after the initial transition' , function (done) {
      stateService.go('bar').then(() => {
        locationService.url('/');
        expect(goSpy).toHaveBeenCalledWith('otherwise', undefined, jasmine.anything());
        done();
      });
    });
  });


  it('`rule` should return a deregistration function', function() {
    let count = 0;
    const rule: UrlRule = {
      match: () => count++,
      handler: match => match,
      matchPriority: () => 0,
      $id: 0,
      priority: 0,
      type: 'OTHER',
    };

    const dereg = urlRouter.rule(rule as any);

    urlRouter.sync();
    expect(count).toBe(1);
    urlRouter.sync();
    expect(count).toBe(2);

    dereg();
    urlRouter.sync();
    expect(count).toBe(2);
  });

  it('`removeRule` should remove a previously registered rule', function() {
    let count = 0;
    const rule: UrlRule = {
      match: () => count++,
      handler: match => match,
      matchPriority: () => 0,
      $id: 0,
      priority: 0,
      type: 'OTHER',
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
    const rule = urlRouter.when('/foo', function() { calls++; });

    urlRouter.sync();
    expect(calls).toBe(1);

    expect(typeof rule.match).toBe('function');
    expect(typeof rule.handler).toBe('function');
  });

  describe('location updates', function() {
    it('can push location changes', function () {
      spyOn(router.urlService, 'url');
      urlRouter.push(matcher('/hello/:name'), { name: 'world' });
      expect(router.urlService.url).toHaveBeenCalledWith('/hello/world', undefined);
    });

    it('can push a replacement location', function () {
      spyOn(router.urlService, 'url');
      urlRouter.push(matcher('/hello/:name'), { name: 'world' }, { replace: true });
      expect(router.urlService.url).toHaveBeenCalledWith('/hello/world', true);
    });

    it('can push location changes with no parameters', function () {
      spyOn(router.urlService, 'url');
      urlRouter.push(urlMatcherFactory.compile('/hello/:name', { params: { name: '' } }));
      expect(router.urlService.url).toHaveBeenCalledWith('/hello/', undefined);
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

    // Test for https://github.com/ui-router/core/issues/94
    it('can read and reset URL including query parameters', function () {
      urlService.url('/old?param1=hey');

      expect(urlService.url()).toBe('/old?param1=hey');

      urlRouter.update(true); // save url
      urlService.url('/new');
      urlRouter.update(); // reset url

      expect(urlService.url()).toBe('/old?param1=hey');
    });

  });

  describe('URL generation', function() {
    it('should return null when UrlMatcher rejects parameters', function () {
      urlMatcherFactory.type('custom', <any> { is: val => val === 1138 });
      const urlmatcher = matcher('/foo/{param:custom}');

      expect(urlRouter.href(urlmatcher, { param: 1138 })).toBe('#/foo/1138');
      expect(urlRouter.href(urlmatcher, { param: 5 })).toBeNull();
    });

    it('should return URLs with #fragments', function () {
      expect(urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' })).toBe('#/hello/world#frag');
    });

    it('should return absolute URLs', function () {
      const actual = urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' }, { absolute: true });
      expect(actual).toBe('http://localhost/#/hello/world#frag');
    });

    describe('in html5mode', () => {
      let baseTag: HTMLBaseElement;
      const applyBaseTag = (href: string) => {
        baseTag = document.createElement('base');
        baseTag.href = href;
        document.head.appendChild(baseTag);
      };

      afterEach(() => baseTag.parentElement.removeChild(baseTag));

      beforeEach(() => {
        router.dispose(router.getPlugin('vanilla.memoryLocation'));
        router.plugin(pushStateLocationPlugin);
        router.urlService = new UrlService(router, false);
      });

      describe('with base="/base/"', () => {
        beforeEach(() => applyBaseTag('/base/'));

        it('should prefix the href with /base/', function () {
          expect(urlRouter.href(matcher('/foo'))).toBe('/base/foo');
        });

        it('should include #fragments', function () {
          expect(urlRouter.href(matcher('/foo'), { '#': 'hello' })).toBe('/base/foo#hello');
        });

        it('should return absolute URLs', function () {
          // don't use urlService var
          const cfg = router.urlService.config;
          const href = urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' }, { absolute: true });
          const prot = cfg.protocol();
          const host = cfg.host();
          const port = cfg.port();
          const portStr = (port === 80 || port === 443) ? '' : `:${port}`;
          expect(href).toBe(`${prot}://${host}${portStr}/base/hello/world#frag`);
        });
      });

      describe('with base="/base/index.html"', () => {
        beforeEach(() => applyBaseTag('/base/index.html'));

        it('should prefix the href with /base/ but not with index.html', function () {
          expect(urlRouter.href(matcher('/foo'))).toBe('/base/foo');
        });

        it('should include #fragments', function () {
          expect(urlRouter.href(matcher('/foo'), { '#': 'hello' })).toBe('/base/foo#hello');
        });

        it('should return absolute URLs', function () {
          // don't use urlService var
          const cfg = router.urlService.config;
          const href = urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' }, { absolute: true });
          const prot = cfg.protocol();
          const host = cfg.host();
          const port = cfg.port();
          const portStr = (port === 80 || port === 443) ? '' : `:${port}`;
          expect(href).toBe(`${prot}://${host}${portStr}/base/hello/world#frag`);
        });
      });

      describe('with base="http://localhost:8080/base/"', () => {
        beforeEach(() => applyBaseTag('http://localhost:8080/base/'));

        it('should prefix the href with /base/', function () {
          expect(urlRouter.href(matcher('/foo'))).toBe('/base/foo');
        });

        it('should include #fragments', function () {
          expect(urlRouter.href(matcher('/foo'), { '#': 'hello' })).toBe('/base/foo#hello');
        });

        it('should return absolute URLs', function () {
          // don't use urlService var
          const cfg = router.urlService.config;
          const href = urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' }, { absolute: true });
          const prot = cfg.protocol();
          const host = cfg.host();
          const port = cfg.port();
          const portStr = (port === 80 || port === 443) ? '' : `:${port}`;
          expect(href).toBe(`${prot}://${host}${portStr}/base/hello/world#frag`);
        });
      });

      describe('with base="http://localhost:8080/base"', () => {
        beforeEach(() => applyBaseTag('http://localhost:8080/base'));

        it('should not prefix the href with /base', function () {
          expect(urlRouter.href(matcher('/foo'))).toBe('/foo');
        });

        it('should return absolute URLs', function () {
          // don't use urlService var
          const cfg = router.urlService.config;
          const href = urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' }, { absolute: true });
          const prot = cfg.protocol();
          const host = cfg.host();
          const port = cfg.port();
          const portStr = (port === 80 || port === 443) ? '' : `:${port}`;
          expect(href).toBe(`${prot}://${host}${portStr}/hello/world#frag`);
        });
      });

      describe('with base="http://localhost:8080/base/index.html"', () => {
        beforeEach(() => applyBaseTag('http://localhost:8080/base/index.html'));

        it('should prefix the href with /base/', function () {
          expect(urlRouter.href(matcher('/foo'))).toBe('/base/foo');
        });

        it('should include #fragments', function () {
          expect(urlRouter.href(matcher('/foo'), { '#': 'hello' })).toBe('/base/foo#hello');
        });

        it('should return absolute URLs', function () {
          // don't use urlService var
          const cfg = router.urlService.config;
          const href = urlRouter.href(matcher('/hello/:name'), { name: 'world', '#': 'frag' }, { absolute: true });
          const prot = cfg.protocol();
          const host = cfg.host();
          const port = cfg.port();
          const portStr = (port === 80 || port === 443) ? '' : `:${port}`;
          expect(href).toBe(`${prot}://${host}${portStr}/base/hello/world#frag`);
        });
      });
    });
  });

  describe('Url Rule priority', () => {

    let matchlog: string[];
    beforeEach(() => matchlog = []);
    const log = (id) => () => (matchlog.push(id), null);

    it('should prioritize a path with a static string over a param 1', () => {
      const spy = spyOn(stateService, 'transitionTo');
      const A = stateRegistry.register({ name: 'A', url: '/:pA' });
      const B = stateRegistry.register({ name: 'B', url: '/BBB' });

      urlService.url('/AAA');
      expect(spy).toHaveBeenCalledWith(A, { pA: 'AAA' }, _anything);

      urlService.url('/BBB');
      expect(spy).toHaveBeenCalledWith(B, { }, _anything);
    });

    it('should prioritize a path with a static string over a param 2', () => {
      const spy = spyOn(stateService, 'transitionTo');
      stateRegistry.register({ name: 'foo', url: '/foo' });
      const A = stateRegistry.register({ name: 'foo.A', url: '/:pA' });
      const B = stateRegistry.register({ name: 'B', url: '/foo/BBB' });

      urlService.url('/foo/AAA');
      expect(spy).toHaveBeenCalledWith(A, { pA: 'AAA' }, _anything);

      urlService.url('/foo/BBB');
      expect(spy).toHaveBeenCalledWith(B, { }, _anything);
    });

    it('should prioritize a path with a static string over a param 3', () => {
      urlRouter.when(matcher('/foo', '/:p1', '/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/AAA', '/tail'), log('AAA'));
      urlRouter.when(matcher('/foo', '/BBB/tail'), log('BBB'));

      urlService.url('/foo/AAA/tail');
      expect(matchlog).toEqual(['AAA']);

      urlService.url('/foo/BBB/tail');
      expect(matchlog).toEqual(['AAA', 'BBB']);

      urlService.url('/foo/XXX/tail');
      expect(matchlog).toEqual(['AAA', 'BBB', 'p1']);
    });

    it('should prioritize a path with a static string over a param 4', () => {
      urlRouter.when(matcher('/foo', '/:p1/:p2', '/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/:p1/AAA', '/tail'), log('AAA'));

      urlService.url('/foo/xyz/AAA/tail');
      expect(matchlog).toEqual(['AAA']);

      urlService.url('/foo/xyz/123/tail');
      expect(matchlog).toEqual(['AAA', 'p1']);
    });

    it('should prioritize a path with a static string over a param 5', () => {
      urlRouter.when(matcher('/foo/:p1/:p2/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/:p1/AAA', '/tail'), log('AAA'));

      urlService.url('/foo/xyz/AAA/tail');
      expect(matchlog).toEqual(['AAA']);

      urlService.url('/foo/xyz/123/tail');
      expect(matchlog).toEqual(['AAA', 'p1']);
    });

    // Tests for https://github.com/ui-router/core/issues/66
    it('should sort shorter paths before longer paths, all else equal', () => {
      const cmp = (urlRouter as any)._sortFn;
      expect(cmp(matcherRule('/'), matcherRule('/a'))).toBeLessThan(0);
      expect(cmp(matcherRule('/a'), matcherRule('/a/b'))).toBeLessThan(0);
      expect(cmp(matcherRule('/a'), matcherRule('/a/:id'))).toBeLessThan(0);
      expect(cmp(matcherRule('/a/b'), matcherRule('/a/b/c'))).toBeLessThan(0);
    });

    it('should sort static strings before params', () => {
      const cmp = (urlRouter as any)._sortFn;
      expect(cmp(matcherRule('/a'), matcherRule('/:id'))).toBeLessThan(0);
      expect(cmp(matcherRule('/a/:id'), matcherRule('/:id2/:id3'))).toBeLessThan(0);
      expect(cmp(matcherRule('/a/:id/:id2'), matcherRule('/:id3/:id4/:id5'))).toBeLessThan(0);
      expect(cmp(matcherRule('/a/:id/b/c'), matcherRule('/d/:id2/e/:id3'))).toBeLessThan(0);
    });

    it('should sort same-level paths equally', () => {
      const cmp = (urlRouter as any)._sortFn;
      expect(cmp(matcherRule('/a'), matcherRule('/b'))).toBe(0);
      expect(cmp(matcherRule('/a/x'), matcherRule('/b/x'))).toBe(0);
      expect(cmp(matcherRule('/:id1'), matcherRule('/:id2'))).toBe(0);
      expect(cmp(matcherRule('/a/:id1'), matcherRule('/b/:id2'))).toBe(0);
    });

    it('should prioritize a path with a static string over a param 6', () => {
      urlRouter.when(matcher('/foo/:p1/:p2/tail'), log('p1'));
      urlRouter.when(matcher('/foo', '/:p1/AAA', '/:p2'), log('AAA'));

      urlService.url('/foo/xyz/AAA/tail');
      expect(matchlog).toEqual(['AAA']);

      urlService.url('/foo/xyz/123/tail');
      expect(matchlog).toEqual(['AAA', 'p1']);
    });

    it('should prioritize a rule with a higher priority', () => {
      urlRouter.when(matcher('/foo', '/:p1', '/:p2'), log('1'), { priority: 1 });
      urlRouter.when(matcher('/foo/123/456'), log('2'));
      urlService.url('/foo/123/456');

      expect(matchlog).toEqual(['1']);
    });

    describe('rules which sort identically', () => {
      it('should prioritize the rule with the highest number of matched param values', () => {
        urlRouter.when(matcher('/foo/:p1/:p2'), log('1'));
        urlRouter.when(matcher('/foo/:p1/:p2?query'), log('2'));

        urlService.url('/foo/123/456');
        expect(matchlog).toEqual(['1']);

        urlService.url('/foo/123/456?query=blah');
        expect(matchlog).toEqual(['1', '2']);
      });
    });
  });

  describe('match', () => {
    let A, B, CCC;
    beforeEach(() => {
      A = stateRegistry.register({ name: 'A', url: '/:pA' });
      B = stateRegistry.register({ name: 'B', url: '/BBB' });
      CCC = urlService.rules.when('/CCC', '/DDD');
    });

    it('should return the best match for a URL 1', () => {
      const match: MatchResult = urlRouter.match({ path: '/BBB' });
      expect(match.rule.type).toBe('STATE');
      expect(match.rule['state']).toBe(B);
    });

    it('should return the best match for a URL 2', () => {
      const match: MatchResult = urlRouter.match({ path: '/EEE' });
      expect(match.rule.type).toBe('STATE');
      expect(match.rule['state']).toBe(A);
      expect(match.match).toEqual({ pA: 'EEE' });
    });

    it('should return the best match for a URL 3', () => {
      const match: MatchResult = urlRouter.match({ path: '/CCC' });
      expect(match.rule.type).toBe('URLMATCHER');
      expect(match.rule).toBe(CCC);
    });
  });

  describe('lazy loaded state url', () => {
    // Test for https://github.com/ui-router/core/issues/19
    it('should obey rule priority ordering', (done) => {
      const registry = router.stateRegistry;
      let loadedState;
      const lazyLoad = () => {
        loadedState = registry.register({ name: 'lazy', url: '/lazy' });
        return null;
      };

      registry.register({ name: 'lazy.**', url: '/lazy', lazyLoad: lazyLoad });
      registry.register({ name: 'param', url: '/:param' });

      router.transitionService.onSuccess({}, trans => {
        expect(trans.$to()).toBe(loadedState);
        expect(trans.redirectedFrom().to().name).toBe('lazy.**');

        done();
      });

      router.urlService.url('/lazy');
    });
  });
});

describe('UrlRouter.deferIntercept', () => {
  let $ur, $url;
  beforeEach(function() {
    const router = new UIRouter();
    router.urlRouter.deferIntercept();
    router.plugin(TestingPlugin);
    $ur = router.urlRouter;
    $url = router.urlService;
  });

  it('should allow location changes to be deferred', function () {
    const log = [];

    $ur.rule($ur.urlRuleFactory.create(/.*/, () => log.push($url.path())));

    $url.url('/foo');

    expect(log).toEqual([]);

    $ur.listen();
    $ur.sync();

    expect(log).toEqual(['/foo']);
  });
});
