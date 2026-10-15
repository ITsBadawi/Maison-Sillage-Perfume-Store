import type {ScentVector} from './schemas';
import type {ReadyPreferenceProfile} from './profile';

export interface ProductScore {
  exactScore: number;
  score: number;
}

export function scoreProduct(profile: ReadyPreferenceProfile, product: ScentVector): ProductScore {
  let weightedDistance = 0;
  let totalWeight = 0;

  for (const [dimension, evidence] of Object.entries(profile.dimensions)) {
    if (!evidence) continue;
    const weight = evidence.weight;
    weightedDistance += weight * Math.abs(evidence.target - product[dimension as keyof ScentVector]);
    totalWeight += weight;
  }

  const exactScore = Math.max(0, Math.min(100, 100 - weightedDistance / totalWeight));
  return {exactScore, score: Math.round(exactScore)};
}
