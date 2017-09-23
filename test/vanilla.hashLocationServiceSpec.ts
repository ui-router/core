import { UIRouter } from "../src/index";
import * as vanilla from "../src/vanilla";
import { UrlMatcherFactory } from "../src/url/urlMatcherFactory";
import { StateService } from "../src/state/stateService";
import { UrlService } from "../src/url/urlService";
import { resetBrowserUrl } from './_testUtils';


describe('hashLocationService', () => {
  afterEach(() => resetBrowserUrl());

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

  it('returns the correct url path', async(done) => {
    await $state.go('path', { urlParam: 'bar' });

    expect(window.location.hash).toBe('#/path/bar');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({});

    done();
  });

  it('returns the correct url search', async(done) => {
    await $state.go('path', { urlParam: 'bar', queryParam: 'query' });

    expect(window.location.hash).toBe('#/path/bar?queryParam=query');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({ queryParam: 'query' });

    done();
  });

});
