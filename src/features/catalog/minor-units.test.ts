import {describe, expect, it} from 'vitest';
import {minorUnitString} from './minor-units';

describe('minorUnitString', () => {
  it('preserves decimal text and accepts only exact numeric values at the database boundary', () => {
    expect(minorUnitString('9007199254740993')).toBe('9007199254740993');
    expect(minorUnitString(72000000)).toBe('72000000');
    expect(() => minorUnitString(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => minorUnitString('-1')).toThrow(TypeError);
  });
});
