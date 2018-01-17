import { UIRouter } from '../src/index';
import * as vanilla from '../src/vanilla';
import { UrlMatcherFactory } from '../src/url/urlMatcherFactory';
import { StateService } from '../src/state/stateService';
import { UrlService } from '../src/url/urlService';
import { resetBrowserUrl } from './_testUtils';

const origin = window.location.origin;

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
      name: 'path',
    });
  });

  it('reports html5Mode to be true', () => {
    expect(router.urlService.config.html5Mode()).toBe(true);
  });

  it('sets and returns the correct path', () => {
    $url.url('/path/bar');
    expect(window.location.pathname).toBe('/path/bar');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({});
  });

  it('returns a slash when an empty path is set', () => {
    const base = $url.config.baseHref();
    $url.url('');
    expect(window.location.pathname).toBe(base);
    expect($url.path()).toBe('/');
  });

  it('sets and returns a path with a single slash', () => {
    const base = $url.config.baseHref();
    $url.url('/');
    expect(window.location.pathname).toBe(base);
    expect($url.path()).toBe('/');
  });

  it('returns the correct search', () => {
    $url.url('/path/bar?queryParam=query');
    expect(window.location.pathname).toBe('/path/bar');
    expect(window.location.search).toBe('?queryParam=query');
    expect($url.path()).toBe('/path/bar');
    expect($url.search()).toEqual({ queryParam: 'query' });
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
      const base = '/base/';
      beforeEach(() => applyBaseTag(base));

      it('reports html5Mode to be true', () => {
        expect(router.urlService.config.html5Mode()).toBe(true);
      });

      it('handles bar correctly', () => {
        $url.url('bar');
        expect(window.location.pathname).toBe(`${base}bar`);
        expect($url.path()).toBe('/bar');
      });

      it('handles /bar correctly', () => {
        $url.url('/bar');
        expect(window.location.pathname).toBe(`${base}bar`);
        expect($url.path()).toBe('/bar');
      });

      it('handles /path/bar correctly', () => {
        $url.url('/path/bar');
        expect(window.location.pathname).toBe(`${base}path/bar`);
        expect($url.path()).toBe('/path/bar');
      });

      it('handles / correctly', () => {
        $url.url('/');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles "" correctly', () => {
        $url.url('foobar');
        expect(window.location.pathname).toBe(`${base}foobar`);
        $url.url('');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles ?queryParam=query correctly', () => {
        $url.url('/path/bar?queryParam=query');
        expect(window.location.pathname).toBe(`${base}path/bar`);
        expect(window.location.search).toBe('?queryParam=query');
        expect($url.path()).toBe('/path/bar');
        expect($url.search()).toEqual({ queryParam: 'query' });
      });
    });

    describe('/debug.html', () => {
      const base = '/debug.html';
      beforeEach(() => applyBaseTag(base));

      it('handles bar correctly', () => {
        $url.url('bar');
        expect(window.location.pathname).toBe('/bar');
        expect($url.path()).toBe('/bar');
      });

      it('handles /bar correctly', () => {
        $url.url('/bar');
        expect(window.location.pathname).toBe('/bar');
        expect($url.path()).toBe('/bar');
      });

      it('handles /path/bar correctly', () => {
        $url.url('/path/bar');
        expect(window.location.pathname).toBe('/path/bar');
        expect($url.path()).toBe('/path/bar');
      });

      it('handles / correctly', () => {
        $url.url('/');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles "" correctly', () => {
        $url.url('foobar');
        expect(window.location.pathname).toBe('/foobar');
        $url.url('');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles ?queryParam=query correctly', () => {
        $url.url('/path/bar?queryParam=query');
        expect(window.location.pathname).toBe('/path/bar');
        expect(window.location.search).toBe('?queryParam=query');
        expect($url.path()).toBe('/path/bar');
        expect($url.search()).toEqual({ queryParam: 'query' });
      });
    });

    describe(origin + '/debug.html', () => {
      const base = '/debug.html';
      beforeEach(() => applyBaseTag(origin + base));

      it('handles bar correctly', () => {
        $url.url('bar');
        expect(window.location.pathname).toBe('/bar');
        expect($url.path()).toBe('/bar');
      });

      it('handles /bar correctly', () => {
        $url.url('/bar');
        expect(window.location.pathname).toBe('/bar');
        expect($url.path()).toBe('/bar');
      });

      it('handles /path/bar correctly', () => {
        $url.url('/path/bar');
        expect(window.location.pathname).toBe('/path/bar');
        expect($url.path()).toBe('/path/bar');
      });

      it('handles / correctly', () => {
        $url.url('/');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles "" correctly', () => {
        $url.url('foobar');
        expect(window.location.pathname).toBe('/foobar');
        $url.url('');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles ?queryParam=query correctly', () => {
        $url.url('/path/bar?queryParam=query');
        expect(window.location.pathname).toBe('/path/bar');
        expect(window.location.search).toBe('?queryParam=query');
        expect($url.path()).toBe('/path/bar');
        expect($url.search()).toEqual({ queryParam: 'query' });
      });
    });

    describe(origin + '/base/debug.html', () => {
      const base = '/base/debug.html';
      beforeEach(() => applyBaseTag(origin + base));

      it('handles bar correctly', () => {
        $url.url('bar');
        expect(window.location.pathname).toBe('/base/bar');
        expect($url.path()).toBe('/bar');
      });

      it('handles /bar correctly', () => {
        $url.url('/bar');
        expect(window.location.pathname).toBe('/base/bar');
        expect($url.path()).toBe('/bar');
      });

      it('handles /path/bar correctly', () => {
        $url.url('/path/bar');
        expect(window.location.pathname).toBe('/base/path/bar');
        expect($url.path()).toBe('/path/bar');
      });

      it('handles / correctly', () => {
        $url.url('/');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles "" correctly', () => {
        $url.url('foobar');
        expect(window.location.pathname).toBe('/base/foobar');
        $url.url('');
        expect(window.location.pathname).toBe(base);
        expect($url.path()).toBe('/');
      });

      it('handles ?queryParam=query correctly', () => {
        $url.url('/path/bar?queryParam=query');
        expect(window.location.pathname).toBe('/base/path/bar');
        expect(window.location.search).toBe('?queryParam=query');
        expect($url.path()).toBe('/path/bar');
        expect($url.search()).toEqual({ queryParam: 'query' });
      });
    });

    describe('window.location.pathname exactly', () => {
      beforeEach(() => applyBaseTag(window.location.pathname));

      it('returns the correct url, /', () => {
        expect($url.path()).toBe('/');
      });
    });
  });
});
