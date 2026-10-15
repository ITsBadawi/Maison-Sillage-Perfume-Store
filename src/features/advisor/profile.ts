import type {PreferenceAnswer, ScentDimension} from './schemas';
import {scentDimensions} from './schemas';

export interface ProfileDimension {
  target: number;
  evidenceWeight: number;
  weight: number;
}

export interface ReadyPreferenceProfile {
  status: 'ready';
  dimensions: Partial<Record<ScentDimension, ProfileDimension>>;
  measuredDimensions: ScentDimension[];
}

export interface InsufficientPreferenceProfile {
  status: 'insufficient-dimensions';
  measuredDimensions: ScentDimension[];
}

export type PreferenceProfile = ReadyPreferenceProfile | InsufficientPreferenceProfile;

export function buildPreferenceProfile(answers: readonly PreferenceAnswer[]): PreferenceProfile {
  const dimensions: Partial<Record<ScentDimension, ProfileDimension>> = {};
  const measuredDimensions: ScentDimension[] = [];

  for (const dimension of scentDimensions) {
    let evidenceWeight = 0;
    let weightedTarget = 0;

    for (const answer of answers) {
      const target = answer.targetVector[dimension];
      if (target === undefined) continue;
      const weight = answer.dimensionWeights?.[dimension] ?? 1;
      if (weight === 0) continue;
      evidenceWeight += weight;
      weightedTarget += target * weight;
    }

    if (evidenceWeight === 0) continue;
    measuredDimensions.push(dimension);
    dimensions[dimension] = {
      target: weightedTarget / evidenceWeight,
      evidenceWeight,
      weight: Math.min(evidenceWeight, 3),
    };
  }

  if (measuredDimensions.length < 3) {
    return {status: 'insufficient-dimensions', measuredDimensions};
  }

  return {status: 'ready', dimensions, measuredDimensions};
}
