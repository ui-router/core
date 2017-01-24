import { StateMatcher } from "../src/index";
import { UIRouter } from "../src/router";

describe('StateMatcher', function() {
  let router: UIRouter;
  beforeEach(() => router = new UIRouter());

  it('should find states by name', function() {
    let registry = router.stateRegistry;
    let matcher = registry.matcher;
    expect(matcher.find('home')).toBeUndefined();

    let home = { name: 'home' }, _home = registry.register(home);
    expect(matcher.find('home')).toBe(_home);
    expect(matcher.find(home)).toBe(_home);

    expect(matcher.find('home.about')).toBeUndefined();

    let about = { name: 'home.about' }, _about = registry.register(about);
    expect(matcher.find('home.about')).toBe(_about);

    expect(matcher.find('')).toBe(registry.root());
    expect(matcher.find(undefined)).toBeUndefined();
    expect(matcher.find('asdfasdf')).toBeUndefined();
    expect(matcher.find(null)).toBeUndefined();
  });

  it('should determine whether a path is relative', function() {
    let matcher = new StateMatcher({});
    expect(matcher.isRelative('.')).toBe(true);
    expect(matcher.isRelative('.foo')).toBe(true);
    expect(matcher.isRelative('^')).toBe(true);
    expect(matcher.isRelative('^foo')).toBe(true);
    expect(matcher.isRelative('^.foo')).toBe(true);
    expect(matcher.isRelative('foo')).toBe(false);
  });

  it('should resolve relative paths', function() {
    let states = ['other', 'other.foo', 'other.foo.bar', 'home.error',
      'home', 'home.about', 'home.about.company', 'home.about.people', 'home.about.people.person' ];
    states.forEach(statename => router.stateRegistry.register({ name: statename }));

    let matcher = router.stateRegistry.matcher;

    expect(matcher.find('.', 'home.about').name).toBe('home.about');
    expect(matcher.find('^', 'home.about').name).toBe('home');
    expect(matcher.find('^.company', 'home.about.people').name).toBe('home.about.company');
    expect(matcher.find('^.^.company', 'home.about.people.person').name).toBe('home.about.company');
    expect(matcher.find('^.foo', 'home')).toBeUndefined();
    expect(matcher.find('^.other.foo', 'home').name).toBe('other.foo');
    expect(function() { matcher.find('^.^', 'home'); }).toThrowError(Error, "Path '^.^' not valid for state 'home'");
  });
});
