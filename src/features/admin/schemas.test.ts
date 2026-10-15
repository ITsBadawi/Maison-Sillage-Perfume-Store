import {describe, expect, it} from 'vitest';
import {adjustmentSchema, hasAnyRole, iqdToMinor, productSchema, transitionSchema, variantSchema} from './schemas';

describe('admin boundaries', () => {
  it('grants each staff view only to its declared role families', () => {
    expect(hasAnyRole(['inventory_manager'], ['manager', 'inventory_manager'])).toBe(true);
    expect(hasAnyRole(['orders_manager'], ['manager', 'inventory_manager'])).toBe(false);
    expect(hasAnyRole(['customer'], ['manager', 'orders_manager'])).toBe(false);
  });

  it('rejects zero or unreasoned inventory adjustments', () => {
    const common = {variantId: '00000000-0000-4000-8000-000000000001', eventKey: 'manual:001'};
    expect(adjustmentSchema.safeParse({...common, delta: 0, reason: 'count'}).success).toBe(false);
    expect(adjustmentSchema.safeParse({...common, delta: -2, reason: 'cycle count'}).success).toBe(true);
    expect(adjustmentSchema.safeParse({...common, delta: 2, reason: '  '}).success).toBe(false);
  });

  it('requires optimistic versions when editing products and variants', () => {
    const product = {productId: '00000000-0000-4000-8000-000000000001', slug: 'rose', brand: 'Maison', nameAr: 'ورد', nameEn: 'Rose'};
    expect(productSchema.safeParse(product).success).toBe(false);
    expect(productSchema.safeParse({...product, expectedVersion: 4}).success).toBe(true);
    expect(variantSchema.safeParse({productId: product.productId, expectedProductVersion: 4, sku: 'ROSE-50', sizeMl: 50, priceIqd: '120', lowStockThreshold: 2, active: true}).success).toBe(true);
  });

  it('converts major IQD input to minor units without floating point rounding', () => {
    expect(iqdToMinor('125000')).toBe(BigInt('125000000'));
    expect(iqdToMinor('1.025')).toBe(BigInt('1025'));
    expect(() => iqdToMinor('1.0001')).toThrow(TypeError);
    expect(variantSchema.safeParse({productId:'00000000-0000-4000-8000-000000000001',expectedProductVersion:1,sku:'X',sizeMl:1,priceIqd:'100',compareAtIqd:'99.999',lowStockThreshold:0}).success).toBe(false);
  });

  it('accepts only known order targets and requires a positive version', () => {
    expect(transitionSchema.safeParse({toStatus: 'delivered', expectedVersion: 2, confirmCashCollected: true}).success).toBe(true);
    expect(transitionSchema.safeParse({toStatus: 'new', expectedVersion: 2}).success).toBe(false);
    expect(transitionSchema.safeParse({toStatus: 'cancelled', expectedVersion: 0, reason: 'duplicate'}).success).toBe(false);
  });
});
