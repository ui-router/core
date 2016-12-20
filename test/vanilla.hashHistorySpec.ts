import { UIRouter, UrlMatcher } from "../src/index";
import * as vanilla from "../src/vanilla";

describe('hashHistory implementation', () => {

  let router;
  let $state;
  let locationProvider;
  let makeMatcher;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.hashLocationPlugin);
    $state = router.stateService;
    router.stateRegistry.stateQueue.autoFlush($state);
    locationProvider = router.urlService;

    makeMatcher = (url, config?) => {
      return new UrlMatcher(url, router.urlMatcherFactory.paramTypes, config)
    };

    router.stateRegistry.register({
      url: '/path/:urlParam?queryParam',
      name: 'path'
    });
  });

  it('reports html5Mode to be false', () => {
    expect(router.urlService.config.html5Mode()).toBe(false);
  });

  it('returns the correct url query', async(done) => {
    await $state.go('path', { urlParam: 'bar' });

    expect(window.location.toString().includes('#/path/bar')).toBe(true);
    expect(locationProvider.path()).toBe('/path/bar');
    expect(locationProvider.search()).toEqual({});

    await $state.go('path', { urlParam: 'bar', queryParam: 'query' });

    expect(window.location.toString().includes('#/path/bar?queryParam=query')).toBe(true);
    expect(locationProvider.path()).toBe('/path/bar');
    expect(locationProvider.search()).toEqual({ queryParam: 'query' });

    done();
  });

});