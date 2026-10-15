import {describe, expect, it} from 'vitest';
import {buildPreferenceProfile} from './profile';

describe('buildPreferenceProfile', () => {
  it('averages each measured dimension by answer weight and caps repeated evidence at three', () => {
    const profile = buildPreferenceProfile([
      {targetVector: {woody: 80, fresh: 20}, dimensionWeights: {woody: 2, fresh: 1}},
      {targetVector: {woody: 20}, dimensionWeights: {woody: 2}},
      {targetVector: {woody: 100}},
      {targetVector: {warm: 70}},
    ]);

    expect(profile).toEqual({
      status: 'ready',
      dimensions: {
        woody: {target: 60, evidenceWeight: 5, weight: 3},
        fresh: {target: 20, evidenceWeight: 1, weight: 1},
        warm: {target: 70, evidenceWeight: 1, weight: 1},
      },
      measuredDimensions: ['woody', 'fresh', 'warm'],
    });
  });

  it('does not treat missing dimensions as negative evidence and requires three measured dimensions', () => {
    const profile = buildPreferenceProfile([
      {targetVector: {woody: 80}},
      {targetVector: {fresh: 20}},
      {targetVector: {warm: 70}, dimensionWeights: {warm: 0}},
    ]);

    expect(profile).toEqual({status: 'insufficient-dimensions', measuredDimensions: ['woody', 'fresh']});
  });
});
