import { curry } from '../src/common';

describe('curry', () => {
  let original: jasmine.Spy;
  beforeEach(() => {
    original = jasmine.createSpy('original', function(a, b, c) {});
  });

  it('should accept a function and return a new function', () => {
    expect(typeof curry(original)).toBe('function');
  });

  it('should return a function that invokes original only when all arguments are supplied', () => {
    const curried1 = curry(original);
    curried1(1, 2, 3);
    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(1, 2, 3);
  });

  it('should pass extra arguments through to original function', () => {
    const curried1 = curry(original);
    curried1(1, 2, 3, 4);
    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(1, 2, 3, 4);
  });

  it('should keep returning functions that return functions if no arguments are supplied', () => {
    const curried1 = curry(original);
    expect(typeof curried1).toBe('function');

    const curried2 = curried1();
    expect(typeof curried2).toBe('function');

    const curried3 = curried2();
    expect(typeof curried3).toBe('function');

    const curried4 = curried3();
    expect(typeof curried4).toBe('function');

    const curried5 = curried4();
    expect(typeof curried5).toBe('function');

    const curried6 = curried5();
    expect(typeof curried6).toBe('function');

    expect(original).toHaveBeenCalledTimes(0);
  });

  it('should keep returning functions that return functions until all arguments are supplied', () => {
    const curried1 = curry(original);
    const curried2 = curried1(1);
    const curried3 = curried2(2);
    const result = curried3(3);

    expect(result).toBeUndefined();
    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(1, 2, 3);
  });
});
