import {describe, expect, it} from 'vitest';
import {buildPreferenceProfile} from './profile';
import {matchProducts, type AdvisorProduct} from './filters';

const profile = buildPreferenceProfile([
  {targetVector: {woody: 80}},
  {targetVector: {fresh: 20}},
  {targetVector: {warm: 70}},
]);

if (profile.status !== 'ready') throw new Error('fixture should have three measured dimensions');

function product(overrides: Partial<AdvisorProduct> = {}): AdvisorProduct {
  return {
    id: 'product-a',
    status: 'published',
    recommendationEnabled: true,
    priority: 0,
    nameAr: 'عطر أ',
    nameEn: 'Perfume A',
    primaryImage: {altAr: 'صورة العطر', altEn: 'Perfume image'},
    attributes: {woody: 80, floral: 50, fresh: 20, sweet: 50, warm: 70, smoky: 10, bold: 50, calm: 50, classic: 50, modern: 50, day: 50, night: 50},
    noteIds: ['oud'],
    variants: [
      {id: 'large', active: true, stockAvailable: 2, priceMinor: '90000'},
      {id: 'small', active: true, stockAvailable: 1, priceMinor: '50000'},
    ],
    ...overrides,
  };
}

describe('matchProducts', () => {
  it('excludes unpublished, disabled, incomplete, out-of-stock, over-budget, and explicitly excluded products', () => {
    const products = [
      product(),
      product({id: 'draft', status: 'draft'}),
      product({id: 'disabled', recommendationEnabled: false}),
      product({id: 'unnamed-ar', nameAr: ''}),
      product({id: 'no-image', primaryImage: null}),
      product({id: 'no-stock', variants: [{id: 'empty', active: true, stockAvailable: 0, priceMinor: '100'}]}),
      product({id: 'inactive', variants: [{id: 'inactive', active: false, stockAvailable: 1, priceMinor: '100'}]}),
      product({id: 'over-budget', variants: [{id: 'expensive', active: true, stockAvailable: 1, priceMinor: '50001'}]}),
      product({id: 'excluded', noteIds: ['oud', 'rose']}),
    ];

    const results = matchProducts(profile, products, {maxPriceMinor: '50000', excludedNoteIds: ['rose']});

    expect(results.map((item) => item.productId)).toEqual(['product-a']);
  });

  it('chooses the cheapest eligible variant once per product and limits results to three distinct products', () => {
    const products = [
      product({id: 'b'}),
      product({id: 'a'}),
      product({id: 'c'}),
      product({id: 'd'}),
    ];

    const results = matchProducts(profile, products);

    expect(results).toHaveLength(3);
    expect(results.map(({productId, variantId, priceMinor}) => ({productId, variantId, priceMinor}))).toEqual([
      {productId: 'a', variantId: 'small', priceMinor: '50000'},
      {productId: 'b', variantId: 'small', priceMinor: '50000'},
      {productId: 'c', variantId: 'small', priceMinor: '50000'},
    ]);
  });

  it('uses priority only for equal raw scores, then product ID for deterministic ties', () => {
    const products = [
      product({id: 'z', priority: 0}),
      product({id: 'a', priority: 2}),
      product({id: 'm', priority: 2}),
    ];

    expect(matchProducts(profile, products).map((item) => item.productId)).toEqual(['z', 'a', 'm']);
    expect(matchProducts(profile, [...products].reverse()).map((item) => item.productId)).toEqual(['z', 'a', 'm']);
  });

  it('keeps raw score ahead of priority when rounded scores match and emits duplicate product IDs once', () => {
    const best = product({id: 'best', priority: 9});
    const nearTie = product({
      id: 'near-tie', priority: 0,
      attributes: {...product().attributes, warm: 71},
    });

    const results = matchProducts(profile, [nearTie, best, best]);

    expect(results.map(({productId, score}) => ({productId, score}))).toEqual([
      {productId: 'best', score: 100},
      {productId: 'near-tie', score: 100},
    ]);
  });
});
