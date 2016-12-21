import { UrlMatcher } from "../src/index";
import { UIRouter } from "../src/router";
import { UrlService } from "../src/url/urlService";
import * as vanilla from "../src/vanilla";

describe('browserHistory implementation', () => {

  let router: UIRouter;
  let urlService: UrlService;
  let makeMatcher;

  let mockHistory, mockLocation;

  // Replace the history and location
  function mockPushState(_router) {
    let plugin: any = _router.getPlugin('vanilla.pushStateLocation');

    mockHistory = {
      replaceState: (a, b, url) => mockLocation.href = url,
      pushState: (a, b, url) => mockLocation.href = url
    };

    mockLocation = {
      _href: "/",
      pathname: "/",
      search: "",
      get href() {
        return this._href
      },
      set href(val) {
        this._href = val;
        var [pathname, search] = val.split("?");
        this.pathname = pathname;
        this.search = search ? "?" + search : "";
      }
    };

    plugin.service._history = mockHistory;
    plugin.service._location = mockLocation;

    return plugin.service;
  }

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.pushStateLocationPlugin);
    urlService = router.urlService;
    makeMatcher = (url, config?) => {
      return new UrlMatcher(url, router.urlMatcherFactory.paramTypes, config)
    };

    router.stateRegistry.register({
      url: '/path/:urlParam?queryParam',
      name: 'path'
    });
  });

  it('uses history.pushState when setting a url', () => {
    let service = mockPushState(router);
    expect(router.urlService.config.html5Mode()).toBe(true);
    let stub = spyOn(service._history, 'pushState');
    router.urlRouter.push(makeMatcher('/hello/:name'), { name: 'world' }, {});
    expect(stub.calls.first().args[2]).toBe('/hello/world');
  });

  it('uses history.replaceState when setting a url with replace', () => {
    let service = mockPushState(router);
    let stub = spyOn(service._history, 'replaceState');
    router.urlRouter.push(makeMatcher('/hello/:name'), { name: 'world' }, { replace: true });
    expect(stub.calls.first().args[2]).toBe('/hello/world');
  });

  it('returns the correct url query', async(done) => {
    let service = mockPushState(router);
    expect(router.urlService.config.html5Mode()).toBe(true);

    await router.stateService.go('path', { urlParam: 'bar' });

    expect(mockLocation.href.includes('/path/bar')).toBe(true);
    expect(mockLocation.href.includes('#')).toBe(false);

    expect(urlService.path()).toBe('/path/bar');
    expect(urlService.search()).toEqual({});

    await router.stateService.go('path', { urlParam: 'bar', queryParam: 'query' });

    expect(mockLocation.href.includes('/path/bar?queryParam=query')).toBe(true);
    expect(mockLocation.href.includes('#')).toBe(false);

    expect(urlService.path()).toBe('/path/bar');
    expect(urlService.search()).toEqual({ queryParam: 'query' });

    done();
  });

});