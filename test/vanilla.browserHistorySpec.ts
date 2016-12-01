
import {services, UrlMatcher} from '../src/index';
import { UIRouter } from "../src/router";
import * as vanilla from "../src/vanilla"

describe('browserHistory implementation', () => {

  let router;
  let makeMatcher;
  let locationProvider = services.location;

  // for phantomJS
  function mockHistoryObject() {
    (window as any).history = {
      replaceState: () => null,
      pushState: () => null
    };
  }

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.pushStateLocationPlugin);
    router.stateRegistry.stateQueue.autoFlush(router.stateService);
    makeMatcher = (url, config?) => {
      return new UrlMatcher(url, router.urlMatcherFactory.paramTypes, config)
    };

    router.stateRegistry.register({
      url: '/path/:urlParam?queryParam',
      name: 'path'
    });
  });

  it('uses history.pushState when setting a url', () => {
    mockHistoryObject();
    expect(services.locationConfig.html5Mode()).toBe(true);
    let stub = spyOn(history, 'pushState');
    router.urlRouter.push(makeMatcher('/hello/:name'), { name: 'world' });
    expect(stub.calls.first().args[2]).toBe('/hello/world');
  });

  it('uses history.replaceState when setting a url with replace', () => {
    mockHistoryObject();
    let stub = spyOn(history, 'replaceState');
    router.urlRouter.push(makeMatcher('/hello/:name'), { name: 'world' }, { replace: true });
    expect(stub.calls.first().args[2]).toBe('/hello/world');
  });

  it('returns the correct url query', () => {
    expect(services.locationConfig.html5Mode()).toBe(true);
    return router.stateService.go('path', {urlParam: 'bar'}).then(() => {
      expect(window.location.toString().includes('/path/bar')).toBe(true);
      expect(window.location.toString().includes('/#/path/bar')).toBe(false);
      expect(locationProvider.path()).toBe('/path/bar');
      expect(locationProvider.search()).toEqual({'':''});
      return router.stateService.go('path', {urlParam: 'bar', queryParam: 'query'});
    }).then(() => {
      expect(window.location.toString().includes('/path/bar?queryParam=query')).toBe(true);
      expect(window.location.toString().includes('/#/path/bar?queryParam=query')).toBe(false);
      expect(locationProvider.path()).toBe('/path/bar');
      expect(locationProvider.search()).toEqual({queryParam:'query'});
    });
  });

});