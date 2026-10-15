import {AdvisorProductSchema, MatchOptionsSchema, type AdvisorProduct, type MatchOptions, type MoneyMinor} from './schemas';
import type {ReadyPreferenceProfile} from './profile';
import {scoreProduct} from './score';

export type {AdvisorProduct} from './schemas';

export interface MatchedProduct {
  productId: string;
  variantId: string;
  priceMinor: MoneyMinor;
  score: number;
  exactScore: number;
  priority: number;
}

function asBigInt(value: MoneyMinor): bigint {
  return BigInt(value);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function eligibleVariants(product: AdvisorProduct, maxPrice: bigint | undefined) {
  return product.variants
    .filter((variant) => variant.active && variant.stockAvailable > 0 && (maxPrice === undefined || asBigInt(variant.priceMinor) <= maxPrice))
    .sort((left, right) => {
      const priceOrder = asBigInt(left.priceMinor) < asBigInt(right.priceMinor) ? -1
        : asBigInt(left.priceMinor) > asBigInt(right.priceMinor) ? 1 : 0;
      return priceOrder || compareIds(left.id, right.id);
    });
}

export function matchProducts(
  profile: ReadyPreferenceProfile,
  products: readonly AdvisorProduct[],
  rawOptions: MatchOptions = {},
): MatchedProduct[] {
  const options = MatchOptionsSchema.parse(rawOptions);
  if (options.limit === 0) return [];
  const maxPrice = options.maxPriceMinor === undefined ? undefined : asBigInt(options.maxPriceMinor);
  const excludedNotes = new Set(options.excludedNoteIds);
  const matches: MatchedProduct[] = [];

  for (const input of products) {
    const product = AdvisorProductSchema.parse(input);
    if (
      product.status !== 'published'
      || !product.recommendationEnabled
      || !product.nameAr.trim()
      || !product.nameEn.trim()
      || !product.primaryImage?.altAr.trim()
      || !product.primaryImage.altEn.trim()
      || product.noteIds.some((noteId) => excludedNotes.has(noteId))
    ) continue;

    const variant = eligibleVariants(product, maxPrice)[0];
    if (!variant) continue;
    const productScore = scoreProduct(profile, product.attributes);
    matches.push({
      productId: product.id,
      variantId: variant.id,
      priceMinor: variant.priceMinor,
      score: productScore.score,
      exactScore: productScore.exactScore,
      priority: product.priority,
    });
  }

  const ranked = matches.sort((left, right) => right.exactScore - left.exactScore
    || left.priority - right.priority
    || compareIds(left.productId, right.productId));
  const unique: MatchedProduct[] = [];
  const seenProductIds = new Set<string>();

  for (const match of ranked) {
    if (seenProductIds.has(match.productId)) continue;
    seenProductIds.add(match.productId);
    unique.push(match);
    if (unique.length === options.limit) break;
  }

  return unique;
}
