import { ParamTypes } from '../src/index';

describe('parameters', () => {
  let types;

  beforeEach(() => types = new ParamTypes());

  describe('date type', () => {
    let dateType;
    beforeEach(() => dateType = types.type('date'));

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
});
