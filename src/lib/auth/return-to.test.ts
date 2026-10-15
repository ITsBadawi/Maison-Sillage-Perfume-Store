import {describe, expect, it} from 'vitest';
import {safeReturnTo} from './return-to';

describe('safeReturnTo', () => {
  it('keeps a same-locale internal destination with its query', () => {
    expect(safeReturnTo('/ar/checkout?step=address', 'ar')).toBe('/ar/checkout?step=address');
  });

  it('rejects external and malformed redirects', () => {
    expect(safeReturnTo('//evil.example', 'en')).toBe('/en/account');
    expect(safeReturnTo('https://evil.example', 'en')).toBe('/en/account');
    expect(safeReturnTo('/en\\evil.example', 'en')).toBe('/en/account');
    expect(safeReturnTo('/ar/checkout', 'en')).toBe('/en/account');
  });
});
