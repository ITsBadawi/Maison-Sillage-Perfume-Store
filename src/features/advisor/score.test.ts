import {describe, expect, it} from 'vitest';
import {buildPreferenceProfile} from './profile';
import {scoreProduct} from './score';

describe('scoreProduct', () => {
  it('returns the hand-calculated manual example without letting priority change the score', () => {
    const profile = buildPreferenceProfile([
      {targetVector: {woody: 80}},
      {targetVector: {fresh: 20}},
      {targetVector: {warm: 70}},
    ]);
    if (profile.status !== 'ready') throw new Error('fixture should have three measured dimensions');

    expect(scoreProduct(profile, {woody: 90, floral: 50, fresh: 30, sweet: 50, warm: 50, smoky: 10, bold: 50, calm: 50, classic: 50, modern: 50, day: 50, night: 50}).score).toBe(87);
    expect(scoreProduct(profile, {woody: 20, floral: 50, fresh: 80, sweet: 50, warm: 10, smoky: 10, bold: 50, calm: 50, classic: 50, modern: 50, day: 50, night: 50}).score).toBe(40);
  });
});
