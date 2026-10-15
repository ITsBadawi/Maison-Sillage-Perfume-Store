export type CheckoutItem = {variantId: string; unitPriceMinor: bigint; quantity: number};
export type CheckoutCoupon =
  | {type: 'percent'; value: number; maxDiscountMinor?: bigint; minSubtotalMinor: bigint}
  | {type: 'fixed'; valueMinor: bigint; minSubtotalMinor: bigint};

export type CheckoutCalculationInput = {
  items: CheckoutItem[];
  shippingMinor: bigint;
  coupon?: CheckoutCoupon;
  currencyCode?: string;
  currencyExponent?: number;
};

export type CheckoutTotals = {
  subtotalMinor: bigint;
  discountMinor: bigint;
  shippingMinor: bigint;
  totalMinor: bigint;
  currencyCode: string;
  currencyExponent: number;
};

const MAX_DISTINCT_SKUS = 20;
const MAX_QUANTITY_PER_SKU = 10;

function isNonNegativeMoney(value: bigint): boolean {
  return typeof value === 'bigint' && value >= BigInt('0');
}

/** Calculates an advisory quote only; the database transaction must reprice and enforce stock/coupon limits. */
export function calculateCheckout(input: CheckoutCalculationInput): CheckoutTotals {
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > MAX_DISTINCT_SKUS) {
    throw new RangeError('Checkout requires 1 to 20 distinct SKU lines');
  }
  const variantIds = new Set(input.items.map(({variantId}) => variantId));
  if (variantIds.size !== input.items.length || input.items.some(({variantId}) => !variantId.trim())) {
    throw new RangeError('Each SKU must appear exactly once');
  }
  if (!isNonNegativeMoney(input.shippingMinor)) throw new RangeError('Shipping must be a non-negative integer amount');

  let subtotalMinor = BigInt('0');
  for (const item of input.items) {
    if (!isNonNegativeMoney(item.unitPriceMinor)) throw new RangeError('Unit price must be non-negative');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_SKU) {
      throw new RangeError('Quantity must be an integer from 1 to 10');
    }
    subtotalMinor += item.unitPriceMinor * BigInt(item.quantity);
  }

  let discountMinor = BigInt('0');
  if (input.coupon) {
    const coupon = input.coupon;
    if (!isNonNegativeMoney(coupon.minSubtotalMinor)) throw new RangeError('Coupon minimum must be non-negative');
    if (subtotalMinor < coupon.minSubtotalMinor) throw new RangeError('Subtotal does not meet coupon minimum');

    if (coupon.type === 'percent') {
      if (!Number.isInteger(coupon.value) || coupon.value < 1 || coupon.value > 100) {
        throw new RangeError('Coupon percentage must be an integer from 1 to 100');
      }
      if (coupon.maxDiscountMinor !== undefined && !isNonNegativeMoney(coupon.maxDiscountMinor)) {
        throw new RangeError('Maximum discount must be non-negative');
      }
      discountMinor = subtotalMinor * BigInt(coupon.value) / BigInt('100');
      if (coupon.maxDiscountMinor !== undefined && discountMinor > coupon.maxDiscountMinor) {
        discountMinor = coupon.maxDiscountMinor;
      }
    } else {
      if (!isNonNegativeMoney(coupon.valueMinor) || coupon.valueMinor === BigInt('0')) {
        throw new RangeError('Fixed coupon amount must be positive');
      }
      discountMinor = coupon.valueMinor > subtotalMinor ? subtotalMinor : coupon.valueMinor;
    }
  }

  const currencyCode = input.currencyCode ?? 'IQD';
  const currencyExponent = input.currencyExponent ?? 3;
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new RangeError('Currency code must be a three-letter uppercase code');
  if (!Number.isInteger(currencyExponent) || currencyExponent < 0 || currencyExponent > 9) {
    throw new RangeError('Currency exponent must be an integer from 0 to 9');
  }

  return {
    subtotalMinor,
    discountMinor,
    shippingMinor: input.shippingMinor,
    totalMinor: subtotalMinor - discountMinor + input.shippingMinor,
    currencyCode,
    currencyExponent,
  };
}

