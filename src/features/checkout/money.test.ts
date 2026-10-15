import {describe, expect, it} from 'vitest';
import {calculateCheckout} from './money';

describe('calculateCheckout', () => {
  it('floors percentage discounts, caps them, excludes shipping, and defaults IQD exponent to 3', () => {
    const quote = calculateCheckout({
      items: [{variantId: 'v1', unitPriceMinor: BigInt('10001'), quantity: 2}],
      shippingMinor: BigInt('900'),
      coupon: {type: 'percent', value: 20, maxDiscountMinor: BigInt('1000'), minSubtotalMinor: BigInt('1')},
    });
    expect(quote).toEqual({subtotalMinor: BigInt('20002'), discountMinor: BigInt('1000'), shippingMinor: BigInt('900'), totalMinor: BigInt('19902'), currencyCode: 'IQD', currencyExponent: 3});
  });

  it('caps fixed discount at subtotal and evaluates the minimum before discount', () => {
    expect(calculateCheckout({
      items: [{variantId: 'v1', unitPriceMinor: BigInt('1000'), quantity: 1}], shippingMinor: BigInt('400'),
      coupon: {type: 'fixed', valueMinor: BigInt('2000'), minSubtotalMinor: BigInt('1000')},
    }).discountMinor).toBe(BigInt('1000'));
    expect(() => calculateCheckout({
      items: [{variantId: 'v1', unitPriceMinor: BigInt('999'), quantity: 1}], shippingMinor: BigInt('0'),
      coupon: {type: 'fixed', valueMinor: BigInt('1'), minSubtotalMinor: BigInt('1000')},
    })).toThrow();
  });

  it('rejects negative money, invalid quantities, and more than 20 distinct SKUs', () => {
    expect(() => calculateCheckout({items: [{variantId: 'v1', unitPriceMinor: -BigInt('1'), quantity: 1}], shippingMinor: BigInt('0')})).toThrow();
    expect(() => calculateCheckout({items: [{variantId: 'v1', unitPriceMinor: BigInt('1'), quantity: 11}], shippingMinor: BigInt('0')})).toThrow();
    expect(() => calculateCheckout({items: Array.from({length: 21}, (_, index) => ({variantId: `v${index}`, unitPriceMinor: BigInt('1'), quantity: 1})), shippingMinor: BigInt('0')})).toThrow();
    expect(() => calculateCheckout({items: [{variantId: 'v1', unitPriceMinor: BigInt('1'), quantity: 1}, {variantId: 'v1', unitPriceMinor: BigInt('1'), quantity: 1}], shippingMinor: BigInt('0')})).toThrow();
  });

  it('rejects invalid coupon percentages and negative shipping', () => {
    expect(() => calculateCheckout({items: [{variantId: 'v1', unitPriceMinor: BigInt('100'), quantity: 1}], shippingMinor: -BigInt('1')})).toThrow();
    expect(() => calculateCheckout({items: [{variantId: 'v1', unitPriceMinor: BigInt('100'), quantity: 1}], shippingMinor: BigInt('0'), coupon: {type: 'percent', value: 101, minSubtotalMinor: BigInt('0')}})).toThrow();
  });
});


