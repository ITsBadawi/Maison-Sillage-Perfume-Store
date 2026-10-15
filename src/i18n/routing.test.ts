import {describe, expect, it} from 'vitest';
import {routing} from './routing';

describe('locale routing', () => {
  it('supports Arabic and English with explicit locale prefixes', () => {
    expect(routing.locales).toEqual(['ar', 'en']);
    expect(routing.localePrefix).toBe('always');
    expect(routing.defaultLocale).toBe('ar');
  });
});
