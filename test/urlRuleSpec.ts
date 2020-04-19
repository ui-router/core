import { StateDeclaration, UIRouter, UrlMatcher, UrlRule } from '../src';
import { UrlRuleFactory } from '../src/url';
import { TestingPlugin } from './_testingPlugin';

const setup = () => {
  const router = new UIRouter();
  router.plugin(TestingPlugin);
  return new UrlRuleFactory(router);
};

describe('UrlRuleFactory', () => {
  it('.compile() should create a UrlMatcher from a string', () => {
    const factory = setup();
    const rule: UrlMatcher = factory.compile('/foo/bar/baz');
    expect(rule instanceof UrlMatcher).toBeTruthy();
    expect(rule.exec('/foo/bar/baz')).toBeTruthy();
  });

  describe('.create()', () => {
    it('should create a UrlRule from a string', () => {
      const factory = setup();
      const rule: UrlRule = factory.create('/foo/bar/baz');
      expect(rule.type).toBe('URLMATCHER');
      expect(rule.match({ path: '/foo/bar/baz' })).toBeTruthy();
      expect(rule.match({ path: '/nope/bar/baz' })).toBeFalsy();
    });

    it('should create a UrlRule from a UrlMatcher', () => {
      const factory = setup();
      const matcher: UrlMatcher = factory.compile('/foo/bar/baz');
      const rule = factory.create(matcher);
      expect(rule.type).toBe('URLMATCHER');
      expect(rule.match({ path: '/foo/bar/baz' })).toBeTruthy();
      expect(rule.match({ path: '/nope/bar/baz' })).toBeFalsy();
    });

    it('should create a UrlRule from a StateObject', () => {
      const factory = setup();
      const { stateRegistry } = factory.router;

      const stateDecl: StateDeclaration = { name: 'state', url: '/foo/bar/baz' };
      stateRegistry.register(stateDecl);

      const rule = factory.create(stateRegistry.get('state').$$state());
      expect(rule.type).toBe('STATE');
      expect(rule.match({ path: '/foo/bar/baz' })).toBeTruthy();
      expect(rule.match({ path: '/nope/bar/baz' })).toBeFalsy();
    });

    it('should create a UrlRule from a StateDeclaration', () => {
      const factory = setup();
      const { stateRegistry } = factory.router;

      const stateDecl: StateDeclaration = { name: 'state', url: '/foo/bar/baz' };
      stateRegistry.register(stateDecl);

      const rule = factory.create(stateRegistry.get('state'));
      expect(rule.type).toBe('STATE');
      expect(rule.match({ path: '/foo/bar/baz' })).toBeTruthy();
      expect(rule.match({ path: '/nope/bar/baz' })).toBeFalsy();
    });

    it('should create a UrlRule from a RegExp', () => {
      const factory = setup();
      const rule = factory.create(new RegExp('/foo/bar/baz'));
      expect(rule.type).toBe('REGEXP');
      expect(rule.match({ path: '/foo/bar/baz' })).toBeTruthy();
      expect(rule.match({ path: '/nope/bar/baz' })).toBeFalsy();
    });

    it('should create a UrlRule from a UrlRuleMatchFn', () => {
      const factory = setup();
      const rule = factory.create((url) => url.path === '/foo/bar/baz');
      expect(rule.type).toBe('RAW');
      expect(rule.match({ path: '/foo/bar/baz' })).toBeTruthy();
      expect(rule.match({ path: '/nope/bar/baz' })).toBeFalsy();
    });
  });
});
