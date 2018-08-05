import { UIRouter } from '../src/router';
import { TestingPlugin } from './_testingPlugin';
import { UrlService } from '../src/url/urlService';

describe('Facades delegating to the UrlService classes', () => {
  let router: UIRouter;

  beforeEach(() => {
    router = new UIRouter();
    router.plugin(TestingPlugin);
  });

  function expectProxyCall(getProxyObject, getProxiedObject, proxiedFnName: string, args = []) {
    const spy = spyOn(getProxiedObject(), proxiedFnName).and.stub();
    const proxyObject = getProxyObject();
    proxyObject[proxiedFnName].apply(proxyObject, args);
    expect(spy).toHaveBeenCalled();
  }

  // UrlService -> LocationService

  it('should pass url() through to LocationService', () => {
    expectProxyCall(() => router.urlService, () => router.locationService, 'url');
  });

  it('should pass path() through to LocationService', () => {
    expectProxyCall(() => router.urlService, () => router.locationService, 'path');
  });

  it('should pass search() through to LocationService', () => {
    expectProxyCall(() => router.urlService, () => router.locationService, 'search');
  });

  it('should pass hash() through to LocationService', () => {
    expectProxyCall(() => router.urlService, () => router.locationService, 'hash');
  });

  it('should pass onChange() through to LocationService', () => {
    expectProxyCall(() => router.urlService, () => router.locationService, 'onChange');
  });

  // UrlRouter -> UrlService

  it('should pass sync() through to UrlService', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService, 'sync');
  });

  it('should pass listen() through to UrlService', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService, 'listen');
  });

  it('should pass deferIntercept() through to UrlService', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService, 'deferIntercept');
  });

  // UrlService -> LocationConfig

  it('should pass config.port() through to LocationConfig', () => {
    expectProxyCall(() => router.urlService.config, () => router.locationConfig, 'port');
  });

  it('should pass config.protocol() through to LocationConfig', () => {
    expectProxyCall(() => router.urlService.config, () => router.locationConfig, 'protocol');
  });

  it('should pass config.host() through to LocationConfig', () => {
    expectProxyCall(() => router.urlService.config, () => router.locationConfig, 'host');
  });

  it('should pass config.baseHref() through to LocationConfig', () => {
    expectProxyCall(() => router.urlService.config, () => router.locationConfig, 'baseHref');
  });

  it('should pass config.html5Mode() through to LocationConfig', () => {
    expectProxyCall(() => router.urlService.config, () => router.locationConfig, 'html5Mode');
  });

  it('should pass config.hashPrefix() through to LocationConfig', () => {
    expectProxyCall(() => router.urlService.config, () => router.locationConfig, 'hashPrefix');
  });

  // UrlService.ConfigApi -> UrlMatcherFactory

  it('should pass config.type() through to UrlRouter', () => {
    expectProxyCall(() => router.urlService.config, () => router.urlMatcherFactory, 'type', ['foo']);
  });

  it('should pass config.caseInsensitive() through to UrlRouter', () => {
    expectProxyCall(() => router.urlService.config, () => router.urlMatcherFactory, 'caseInsensitive');
  });

  it('should pass config.strictMode() through to UrlRouter', () => {
    expectProxyCall(() => router.urlService.config, () => router.urlMatcherFactory, 'strictMode');
  });

  it('should pass config.defaultSquashPolicy() through to UrlRouter', () => {
    expectProxyCall(() => router.urlService.config, () => router.urlMatcherFactory, 'defaultSquashPolicy');
  });

  // UrlRouter -> UrlRules

  it('should pass rules.sort() through to UrlRouter', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService.rules, 'sort');
  });

  it('should pass rules.when() through to UrlRouter', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService.rules, 'when', ['foo', 'bar']);
  });

  it('should pass rules.otherwise() through to UrlRouter', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService.rules, 'otherwise', ['foo']);
  });

  it('should pass rules.initial() through to UrlRouter', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService.rules, 'initial', ['foo']);
  });

  it('should pass rules.rules() through to UrlRouter', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService.rules, 'rules');
  });

  it('should pass rules.rule() through to UrlRouter', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService.rules, 'rule', [{}]);
  });

  it('should pass rules.removeRule() through to UrlRouter', () => {
    expectProxyCall(() => router.urlRouter, () => router.urlService.rules, 'removeRule', [{}]);
  });
});
