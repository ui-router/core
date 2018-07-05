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

  const customTypeBase: ParamTypeDefinition = {
    encode: val => (val ? 'true' : 'false'),
    decode: str => (str === 'true' ? true : str === 'false' ? false : undefined),
    equals: (a, b) => a === b,
    is: val => typeof val === 'boolean',
    pattern: /(?:true|false)/,
  };

  describe('from a custom type', () => {
    let router: UIRouter = null;
    let state: StateObject = null;

    const customTypeA: ParamTypeDefinition = Object.assign({}, customTypeBase, {
      dynamic: true,
      inherit: true,
      raw: true,
    });

    const customTypeB: ParamTypeDefinition = Object.assign({}, customTypeBase, {
      dynamic: false,
      inherit: false,
      raw: false,
    });

    const customTypeC: ParamTypeDefinition = Object.assign({}, customTypeBase);

    describe('with as a simple path parameter', () => {
      beforeEach(() => {
        router = new UIRouter();
        router.urlService.config.type('customTypeA', customTypeA);
        router.urlService.config.type('customTypeB', customTypeB);
        router.urlService.config.type('customTypeC', customTypeC);

        state = router.stateRegistry.register({
          name: 'state',
          url: '/{paramA:customTypeA}/{paramB:customTypeB}/{paramC:customTypeC}',
        });
      });

      it('should use `dynamic` from the custom type customTypeA', () => {
        expect(state.parameter('paramA').dynamic).toBe(true);
      });

      it('should use `dynamic` from the custom type customTypeB', () => {
        expect(state.parameter('paramB').dynamic).toBe(false);
      });

      it('should use default value `dynamic`: false for custom type customTypeC', () => {
        expect(state.parameter('paramC').dynamic).toBe(false);
      });

      it('should use `inherit` from the custom type customTypeA', () => {
        expect(state.parameter('paramA').inherit).toBe(true);
      });

      it('should use `inherit` from the custom type customTypeB', () => {
        expect(state.parameter('paramB').inherit).toBe(false);
      });

      it('should use default value `inherit`: true for the custom type customTypeC', () => {
        expect(state.parameter('paramC').inherit).toBe(true);
      });

      it('should use `raw` from the custom type customTypeA', () => {
        expect(state.parameter('paramA').raw).toBe(true);
      });

      it('should use `raw` from the custom type customTypeB', () => {
        expect(state.parameter('paramB').raw).toBe(false);
      });

      it('should use default value `raw`: false for the custom type customTypeC', () => {
        expect(state.parameter('paramC').raw).toBe(false);
      });
    });

    describe('as an array path parameter', () => {
      beforeEach(() => {
        router = new UIRouter();
        router.urlService.config.type('customTypeA', customTypeA);
        router.urlService.config.type('customTypeB', customTypeB);
        router.urlService.config.type('customTypeC', customTypeC);

        state = router.stateRegistry.register({
          name: 'state',
          url: '/{paramA[]:customTypeA}/{paramB[]:customTypeB}/{paramC[]:customTypeC}',
        });
      });

      it('should use `dynamic` from the custom type customTypeA', () => {
        expect(state.parameter('paramA[]').dynamic).toBe(true);
      });

      it('should use `dynamic` from the custom type customTypeB', () => {
        expect(state.parameter('paramB[]').dynamic).toBe(false);
      });

      it('should use default value `dynamic`: false for custom type customTypeC', () => {
        expect(state.parameter('paramC[]').dynamic).toBe(false);
      });

      it('should use `inherit` from the custom type customTypeA', () => {
        expect(state.parameter('paramA[]').inherit).toBe(true);
      });

      it('should use `inherit` from the custom type customTypeB', () => {
        expect(state.parameter('paramB[]').inherit).toBe(false);
      });

      it('should use default value `inherit`: true for the custom type customTypeC', () => {
        expect(state.parameter('paramC[]').inherit).toBe(true);
      });

      it('should use `raw` from the custom type customTypeA', () => {
        expect(state.parameter('paramA[]').raw).toBe(true);
      });

      it('should use `raw` from the custom type customTypeB', () => {
        expect(state.parameter('paramB[]').raw).toBe(false);
      });

      it('should use default value `raw`: false for the custom type customTypeC', () => {
        expect(state.parameter('paramC[]').raw).toBe(false);
      });
    });
  });

  describe('parameters on a state with a dynamic flag', () => {
    let router: UIRouter;
    beforeEach(() => (router = new UIRouter()));

    it('should use the states dynamic flag for each param', () => {
      const state = router.stateRegistry.register({
        name: 'state',
        dynamic: true,
        url: '/:param1/:param2',
      });

      expect(state.parameter('param1').dynamic).toBe(true);
      expect(state.parameter('param2').dynamic).toBe(true);
    });

    it('should prefer the dynamic: true flag from the state over the dynamic flag on a custom type', () => {
      router.urlService.config.type('dynFalse', { ...customTypeBase, dynamic: false });
      router.urlService.config.type('dynTrue', { ...customTypeBase, dynamic: true });

      const state = router.stateRegistry.register({
        name: 'state',
        dynamic: true,
        url: '/{param1:dynFalse}/{param2:dynTrue}',
      });

      expect(state.parameter('param1').dynamic).toBe(true);
      expect(state.parameter('param2').dynamic).toBe(true);
    });

    it('should prefer the dynamic: false flag from the state over the dynamic flag on a custom type', () => {
      router.urlService.config.type('dynFalse', { ...customTypeBase, dynamic: false });
      router.urlService.config.type('dynTrue', { ...customTypeBase, dynamic: true });

      const state = router.stateRegistry.register({
        name: 'state',
        dynamic: false,
        url: '/{param1:dynFalse}/{param2:dynTrue}',
      });

      expect(state.parameter('param1').dynamic).toBe(false);
      expect(state.parameter('param2').dynamic).toBe(false);
    });

    it('should prefer the dynamic flag from a param declaration', () => {
      const state = router.stateRegistry.register({
        name: 'state',
        dynamic: true,
        url: '/{param1}',
        params: {
          param1: { dynamic: false },
        },
      });

      expect(state.parameter('param1').dynamic).toBe(false);
    });

    it('should prefer the dynamic flag from a param definition over both the state and custom type flag', () => {
      router.urlService.config.type('dynTrue', { ...customTypeBase, dynamic: true });

      const state = router.stateRegistry.register({
        name: 'state',
        dynamic: true,
        url: '/{param1:dynTrue}',
        params: {
          param1: { dynamic: false },
        },
      });

      expect(state.parameter('param1').dynamic).toBe(false);
    });
  });
});
