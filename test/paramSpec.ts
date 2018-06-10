import { ParamTypes, UIRouter } from '../src/index';
import { ParamTypeDefinition } from '../src/params';
import { StateObject } from '../src/state';

describe('parameters', () => {
  let types;

  beforeEach(() => (types = new ParamTypes()));

  describe('date type', () => {
    let dateType;
    beforeEach(() => (dateType = types.type('date')));

    it('should compare dates', () => {
      const date1 = new Date('2010-01-01');
      const date2 = new Date('2010-01-01');

      const date3 = new Date('2010-02-01');

      expect(dateType.equals(date1, date2)).toBeTruthy();
      expect(dateType.equals(date1, date3)).toBeFalsy();
    });

    it('should compare year/month/day only', () => {
      const date1 = new Date('2010-01-01');
      date1.setHours(1);
      const date2 = new Date('2010-01-01');
      date2.setHours(2);
      const date3 = new Date('2010-02-01');
      date3.setHours(3);

      // Failing test case for #2484
      expect(dateType.equals(date1, date2)).toBeTruthy();
      expect(dateType.equals(date1, date3)).toBeFalsy();
    });
  });

  describe('from a custom type', () => {
    let router: UIRouter = null;
    let state: StateObject = null;

    const customTypeA: ParamTypeDefinition = {
      encode: val => (val ? 'true' : 'false'),
      decode: str => (str === 'true' ? true : str === 'false' ? false : undefined),
      dynamic: false,
      equals: (a, b) => a === b,
      inherit: true,
      is: val => typeof val === 'boolean',
      pattern: /(?:true|false)/,
      raw: true,
    };

    const customTypeB: ParamTypeDefinition = {
      encode: val => (val ? 'true' : 'false'),
      decode: str => (str === 'true' ? true : str === 'false' ? false : undefined),
      dynamic: true,
      equals: (a, b) => a === b,
      inherit: false,
      is: val => typeof val === 'boolean',
      pattern: /(?:true|false)/,
      raw: false,
    };

    describe('as a simple path parameter', () => {
      beforeEach(() => {
        router = new UIRouter();
        router.urlService.config.type('customTypeA', customTypeA);
        router.urlService.config.type('customTypeB', customTypeB);

        state = router.stateRegistry.register({
          name: 'state',
          url: '/{paramA:customTypeA}/{paramB:customTypeB}',
        });
      });

      it('should use `dynamic` from the custom type', () => {
        expect(state.parameter('paramA').dynamic).toEqual(customTypeA.dynamic);
        expect(state.parameter('paramB').dynamic).toEqual(customTypeB.dynamic);
      });

      it('should use `inherit` from the custom type', () => {
        expect(state.parameter('paramA').inherit).toEqual(customTypeA.inherit);
        expect(state.parameter('paramB').inherit).toEqual(customTypeB.inherit);
      });

      it('should use `raw` from the custom type', () => {
        expect(state.parameter('paramA').raw).toEqual(customTypeA.raw);
        expect(state.parameter('paramB').raw).toEqual(customTypeB.raw);
      });
    });

    describe('as an array path parameter', () => {
      beforeEach(() => {
        router = new UIRouter();
        router.urlService.config.type('customTypeA', customTypeA);
        router.urlService.config.type('customTypeB', customTypeB);

        state = router.stateRegistry.register({
          name: 'state',
          url: '/{paramA[]:customTypeA}/{paramB[]:customTypeB}',
        });
      });

      it('should use `dynamic` from the custom type', () => {
        expect(state.parameter('paramA[]').dynamic).toEqual(customTypeA.dynamic);
        expect(state.parameter('paramB[]').dynamic).toEqual(customTypeB.dynamic);
      });

      it('should use `inherit` from the custom type', () => {
        expect(state.parameter('paramA[]').inherit).toEqual(customTypeA.inherit);
        expect(state.parameter('paramB[]').inherit).toEqual(customTypeB.inherit);
      });

      // Test for https://github.com/ui-router/core/issues/178
      it('should use `raw` from the custom type', () => {
        expect(state.parameter('paramA[]').raw).toEqual(customTypeA.raw);
        expect(state.parameter('paramB[]').raw).toEqual(customTypeB.raw);
      });
    });
  });
});
