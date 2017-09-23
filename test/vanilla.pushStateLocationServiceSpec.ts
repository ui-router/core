import { UIRouter } from "../src/index";
import * as vanilla from "../src/vanilla";
import { UrlMatcherFactory } from "../src/url/urlMatcherFactory";
import { StateService } from "../src/state/stateService";
import { UrlService } from "../src/url/urlService";
import { resetBrowserUrl } from './_testUtils';

describe('pushStateLocationService', () => {
  afterEach(() => resetBrowserUrl());

  let router: UIRouter;
  let $state: StateService;
  let $umf: UrlMatcherFactory;
  let $url: UrlService;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.pushStateLocationPlugin);
    $state = router.stateService;
    $umf = router.urlMatcherFactory;
    $url = router.urlService;

    router.stateRegistry.register({
      url: '/path/:urlParam?queryParam',
      name: 'path'
    });
  });

  it('reports html5Mode to be true', () => {
    expect(router.urlService.config.html5Mode()).toBe(true);
  });

  it('returns the correct path', async(done) => {
    await $state.go('path', { urlParam: 'bar' });

    expect(window.location.pathname).toBe('/path/bar');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({});

    done();
  });

  it('returns the correct search', async(done) => {
    await $state.go('path', { urlParam: 'bar', queryParam: 'query' });

    expect(window.location.pathname).toBe('/path/bar');
    expect(window.location.search).toBe('?queryParam=query');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({ queryParam: 'query' });

    done();
  });


  describe('with base tag', () => {
    let baseTag: HTMLBaseElement;
    const applyBaseTag = (href: string) => {
      baseTag = document.createElement('base');
      baseTag.href = href;
      document.head.appendChild(baseTag);
    };

    afterEach(() => baseTag.parentElement.removeChild(baseTag));

    describe('/base/', () => {
      beforeEach(() => applyBaseTag("/base/"));

      it('reports html5Mode to be true', () => {
        expect(router.urlService.config.html5Mode()).toBe(true);
      });

      it('returns the correct url', async(done) => {
        await $state.go('path', { urlParam: 'bar' });

        expect(window.location.pathname).toBe('/base/path/bar');
        expect($url.path()).toBe('/path/bar');
        expect($url.search()).toEqual({});

        done();
      });

      it('returns the correct search', async(done) => {
        await $state.go('path', { urlParam: 'bar', queryParam: 'query' });

        expect(window.location.pathname).toBe('/base/path/bar');
        expect(window.location.search).toBe('?queryParam=query');
        expect($url.path()).toBe('/path/bar');
        expect($url.search()).toEqual({ queryParam: 'query' });

        done();
      });
    });

    describe('/debug.html', () => {
      beforeEach(() => applyBaseTag("/debug.html"));

      it('returns the correct url', async(done) => {
        await $state.go('path', { urlParam: 'bar' });

        expect(window.location.pathname).toBe('/path/bar');
        expect($url.path()).toBe('/path/bar');

        done();
      });
    });

    describe('http://localhost:8080/debug.html', () => {
      beforeEach(() => applyBaseTag("http://localhost:8080/debug.html"));

      it('returns the correct url', async(done) => {
        await $state.go('path', { urlParam: 'bar' });

        expect(window.location.pathname).toBe('/path/bar');
        expect($url.path()).toBe('/path/bar');

        done();
      });
    });

    describe('http://localhost:8080/base/debug.html', () => {
      beforeEach(() => applyBaseTag("http://localhost:8080/base/debug.html"));

      it('returns the correct url', async(done) => {
        await $state.go('path', { urlParam: 'bar' });

        expect(window.location.pathname).toBe('/base/path/bar');
        expect($url.path()).toBe('/path/bar');

        done();
      });
    });

    describe('window.location.pathname exactly', () => {
      beforeEach(() => applyBaseTag(window.location.pathname));

      it('returns the correct url', () => {
        expect($url.path()).toBe('/');
      });
    });
  });
});
