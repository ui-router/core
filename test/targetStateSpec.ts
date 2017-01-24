import { TargetState } from "../src/index";

describe('TargetState object', function() {
  it('should be callable and return the correct values', function() {
    let state: any = { name: "foo.bar" }, ref = new TargetState(state.name, state, {});
    expect(ref.identifier()).toBe("foo.bar");
    expect(ref.$state()).toBe(state);
    expect(ref.params()).toEqual({});
  });

  it('should validate state definition', function() {
    let ref = new TargetState("foo", null, {}, { relative: {} });
    expect(ref.valid()).toBe(false);
    expect(ref.error()).toBe("Could not resolve 'foo' from state '[object Object]'");

    ref = new TargetState("foo");
    expect(ref.valid()).toBe(false);
    expect(ref.error()).toBe("No such state 'foo'");

    ref = new TargetState("foo", <any> { name: "foo" });
    expect(ref.valid()).toBe(false);
    expect(ref.error()).toBe("State 'foo' has an invalid definition");
  });
});
