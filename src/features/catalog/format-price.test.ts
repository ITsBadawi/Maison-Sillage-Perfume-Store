import {describe, expect, it} from 'vitest';
import {formatCatalogPrice, formatMoneyMinor} from './format-price';

describe('formatCatalogPrice', () => {
  it('formats whole IQD amounts from decimal strings without converting the amount to Number', () => {
    const expected = new Intl.NumberFormat('en-IQ', {style:'currency',currency:'IQD',maximumFractionDigits:0}).format(BigInt('123456789012345'));
    expect(formatCatalogPrice('123456789012345000', 'en')).toBe(expected);
  });

  it('preserves non-zero minor subunits using the locale decimal separator', () => {
    expect(formatCatalogPrice('1234', 'en')).toContain('1');
    expect(formatCatalogPrice('1234', 'ar')).toContain('١');
  });

  it('formats historical order currency amounts without Number precision loss', () => {
    expect(formatMoneyMinor('12345678901234567', 'en', 'USD', 2)).toContain('123,456,789,012,345');
  });
});
