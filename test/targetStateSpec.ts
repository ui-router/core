import { TargetState, UIRouter } from '../src/index';
import { StateObject, StateRegistry } from '../src/state';

describe('TargetState object', function() {
  let registry: StateRegistry;
  beforeEach(() => {
    registry = new UIRouter().stateRegistry;
    registry.register({ name: 'foo' });
    registry.register({ name: 'foo.bar' });
    registry.register({ name: 'baz' });
  });

  it('should be callable and return the correct values', function() {
    let state: StateObject = registry.get('foo.bar').$$state();
    let ref = new TargetState(registry, state.name, null);
    expect(ref.identifier()).toBe('foo.bar');
    expect(ref.$state()).toBe(state);
    expect(ref.params()).toEqual({});
  });

  it('should validate state definition', function() {
    let ref = new TargetState(registry, 'notfound', {}, { relative: {} });
    expect(ref.valid()).toBe(false);
    expect(ref.error()).toBe("Could not resolve 'notfound' from state '[object Object]'");

    ref = new TargetState(registry, 'notfound', null);
    expect(ref.valid()).toBe(false);
    expect(ref.error()).toBe("No such state 'notfound'");
  });

  describe('.withState', function() {
    it('should replace the target state', () => {
      let ref = new TargetState(registry, 'foo');
      let newRef = ref.withState('baz');
      expect(newRef.identifier()).toBe('baz');
      expect(newRef.$state()).toBe(registry.get('baz').$$state());
    });

    it('should find a relative target state using the existing options.relative', () => {
      let ref = new TargetState(registry, 'baz', null, { relative: 'foo' });
      let newRef = ref.withState('.bar');
      expect(newRef.identifier()).toBe('.bar');
      expect(newRef.state()).toBe(registry.get('foo.bar'));
      expect(newRef.$state()).toBe(registry.get('foo.bar').$$state());
    });
  });

  describe('.withOptions', function() {
    it('should merge options with current options when replace is false or unspecified', () => {
      let ref = new TargetState(registry, 'foo', {}, { location: false });
      let newRef = ref.withOptions({ inherit: false });
      expect(newRef.options()).toEqual({ location: false, inherit: false });
    });

    it('should replace all options when replace is true', () => {
      let ref = new TargetState(registry, 'foo', {}, { location: false });
      let newRef = ref.withOptions({ inherit: false }, true);
      expect(newRef.options()).toEqual({ inherit: false });
    });
  });

  describe('.withParams', function() {
    it('should merge params with current params when replace is false or unspecified', () => {
      let ref = new TargetState(registry, 'foo', { param1: 1 }, { });
      let newRef = ref.withParams({ param2: 2 });
      expect(newRef.params()).toEqual({ param1: 1, param2: 2 });
    });

    it('should replace all params when replace is true', () => {
      let ref = new TargetState(registry, 'foo', { param1: 1 }, { });
      let newRef = ref.withParams({ param2: 2 }, true);
      expect(newRef.params()).toEqual({ param2: 2 });
    });
  });
});
