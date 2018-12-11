import { UIRouter, UrlPlugin } from '../src/index';

describe('UrlPlugin api', function() {
  let router: UIRouter;

  beforeEach(() => {
    router = new UIRouter();
  });

  describe('(when no plugin is registered)', () => {
    it('should throw when urlService.listen() is called', () => {
      expect(() => router.urlService.listen()).toThrow();
    });

    it('should throw when urlService.sync() is called', () => {
      expect(() => router.urlService.sync()).toThrow();
    });

    /** LocationServices: url, path, search, hash, onChange */
    it('should throw when urlService.url() is called', () => {
      expect(() => router.urlService.hash()).toThrow();
    });

    it('should throw when urlService.path() is called', () => {
      expect(() => router.urlService.path()).toThrow();
    });

    it('should throw when urlService.search() is called', () => {
      expect(() => router.urlService.search()).toThrow();
    });

    it('should throw when urlService.hash() is called', () => {
      expect(() => router.urlService.hash()).toThrow();
    });

    it('should throw when urlService.onChange() is called', () => {
      expect(() => router.urlService.onChange(() => null)).toThrow();
    });

    /** LocationConfig: port, protocol, host, baseHref, html5Mode, hashPrefix */

    it('should throw when urlService.config.port() is called', () => {
      expect(() => router.urlService.config.port()).toThrow();
    });

    it('should throw when urlService.config.protocol() is called', () => {
      expect(() => router.urlService.config.protocol()).toThrow();
    });

    it('should throw when urlService.config.host() is called', () => {
      expect(() => router.urlService.config.host()).toThrow();
    });

    it('should throw when urlService.config.baseHref() is called', () => {
      expect(() => router.urlService.config.baseHref()).toThrow();
    });

    it('should throw when urlService.config.html5Mode() is called', () => {
      expect(() => router.urlService.config.html5Mode()).toThrow();
    });

    it('should throw when urlService.config.hashPrefix() is called', () => {
      expect(() => router.urlService.config.hashPrefix()).toThrow();
    });
  });

  describe('', () => {
    let urlPlugin: UrlPlugin;

    beforeEach(() => {
      class MyUrlPlugin implements UrlPlugin {
        name = 'MyUrlPlugin';

        baseHref = () => 'basehref';
        hash = () => 'hash';
        hashPrefix = (newprefix?: string) => 'prefix';
        host = () => 'localhost';
        html5Mode = () => false;
        onChange = (callback: Function) => null;
        path = () => '/';
        port = () => 80;
        protocol = () => 'http';
        search = () => ({});
        url = (newurl?: string, replace?: boolean, state?: any) => null;
        dispose(_router?: UIRouter) {}
      }

      urlPlugin = router.urlPlugin(MyUrlPlugin);
    });

    /** LocationServices: url, path, search, hash, onChange */
    it('should receive calls when urlService.url() is called', () => {
      spyOn(urlPlugin, 'url').and.callFake(() => null);
      router.urlService.url();
      expect(urlPlugin.url).toHaveBeenCalled();
    });

    it('should receive calls when urlService.path() is called', () => {
      spyOn(urlPlugin, 'path').and.callFake(() => null);
      router.urlService.path();
      expect(urlPlugin.path).toHaveBeenCalled();
    });

    it('should receive calls when urlService.search() is called', () => {
      spyOn(urlPlugin, 'search').and.callFake(() => null);
      router.urlService.search();
      expect(urlPlugin.search).toHaveBeenCalled();
    });

    it('should receive calls when urlService.hash() is called', () => {
      spyOn(urlPlugin, 'hash').and.callFake(() => null);
      router.urlService.hash();
      expect(urlPlugin.hash).toHaveBeenCalled();
    });

    it('should receive calls when urlService.onChange() is called', () => {
      spyOn(urlPlugin, 'onChange').and.callFake(() => null);
      router.urlService.onChange(null);
      expect(urlPlugin.onChange).toHaveBeenCalled();
    });

    /** LocationConfig: port, protocol, host, baseHref, html5Mode, hashPrefix */

    it('should receive calls when urlService.config.port() is called', () => {
      spyOn(urlPlugin, 'port').and.callFake(() => null);
      router.urlService.config.port();
      expect(urlPlugin.port).toHaveBeenCalled();
    });

    it('should receive calls when urlService.config.protocol() is called', () => {
      spyOn(urlPlugin, 'protocol').and.callFake(() => null);
      router.urlService.config.protocol();
      expect(urlPlugin.protocol).toHaveBeenCalled();
    });

    it('should receive calls when urlService.config.host() is called', () => {
      spyOn(urlPlugin, 'host').and.callFake(() => null);
      router.urlService.config.host();
      expect(urlPlugin.host).toHaveBeenCalled();
    });

    it('should receive calls when urlService.config.baseHref() is called', () => {
      spyOn(urlPlugin, 'baseHref').and.callFake(() => null);
      router.urlService.config.baseHref();
      expect(urlPlugin.baseHref).toHaveBeenCalled();
    });

    it('should receive calls when urlService.config.html5Mode() is called', () => {
      spyOn(urlPlugin, 'html5Mode').and.callFake(() => null);
      router.urlService.config.html5Mode();
      expect(urlPlugin.html5Mode).toHaveBeenCalled();
    });

    it('should receive calls when urlService.config.hashPrefix() is called', () => {
      spyOn(urlPlugin, 'hashPrefix').and.callFake(() => null);
      router.urlService.config.hashPrefix();
      expect(urlPlugin.hashPrefix).toHaveBeenCalled();
    });
  });
});
