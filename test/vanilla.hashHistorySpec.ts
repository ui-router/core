import { UIRouter, services, UrlMatcher} from '../src/index';
import * as vanilla from '../src/vanilla';

describe('hashHistory implementation', () => {

  let router;
  let $state;
  let makeMatcher;
  let locationProvider = services.location;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.hashLocationPlugin);
    $state = router.stateService;
    router.stateRegistry.stateQueue.autoFlush($state);

    makeMatcher = (url, config?) => {
      return new UrlMatcher(url, router.urlMatcherFactory.paramTypes, config)
    };

    router.stateRegistry.register({
      url: '/path/:urlParam?queryParam',
      name: 'path'
    });
  });

  it('reports html5Mode to be false', () => {
    expect(services.locationConfig.html5Mode()).toBe(false);
  });

  it('returns the correct url query', (done) => {
    return $state.go('path', {urlParam: 'bar'}).then(() => {
      expect(window.location.toString().includes('#/path/bar')).toBe(true);
      expect(locationProvider.path()).toBe('/path/bar');
      expect(locationProvider.search()).toEqual({'':''});
      return $state.go('path', {urlParam: 'bar', queryParam: 'query'});
    }).then(() => {
      expect(window.location.toString().includes('#/path/bar?queryParam=query')).toBe(true);
      expect(locationProvider.path()).toBe('/path/bar');
      expect(locationProvider.search()).toEqual({queryParam:'query'});
    }).then(done);
  });

});