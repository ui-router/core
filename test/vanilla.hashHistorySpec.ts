import { UIRouter, UrlMatcher } from "../src/index";
import * as vanilla from "../src/vanilla";
import { UrlMatcherFactory } from "../src/url/urlMatcherFactory";
import { StateService } from "../src/state/stateService";
import { UrlService } from "../src/url/urlService";

describe('hashHistory implementation', () => {

  let router: UIRouter;
  let $state: StateService;
  let $umf: UrlMatcherFactory;
  let $url: UrlService;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.hashLocationPlugin);
    $state = router.stateService;
    $umf = router.urlMatcherFactory;
    $url = router.urlService;

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
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({});

    await $state.go('path', { urlParam: 'bar', queryParam: 'query' });

    expect(window.location.toString().includes('#/path/bar?queryParam=query')).toBe(true);
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({ queryParam: 'query' });

    done();
  });

});