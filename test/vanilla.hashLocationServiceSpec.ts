import { UIRouter } from '../src/index';
import * as vanilla from '../src/vanilla';
import { UrlMatcherFactory } from '../src/url/urlMatcherFactory';
import { StateService } from '../src/state/stateService';
import { UrlService } from '../src/url/urlService';
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
      name: 'path',
    });
  });

  it('reports html5Mode to be false', () => {
    expect(router.urlService.config.html5Mode()).toBe(false);
  });

  it('sets and returns the correct path', () => {
    $url.url('/path/bar');
    expect(window.location.hash).toBe('#/path/bar');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({});
  });

  it('sets and returns an empty path', () => {
    $url.url('');
    expect(window.location.hash).toBe('');
    expect($url.path()).toBe('');
  });

  it('sets and returns a path with a single slash', () => {
    $url.url('/');
    expect(window.location.hash).toBe('#/');
    expect($url.path()).toBe('/');
  });

  it('returns the correct search', () => {
    $url.url('/path/bar?queryParam=query');
    expect(window.location.hash).toBe('#/path/bar?queryParam=query');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({ queryParam: 'query' });
  });
});
