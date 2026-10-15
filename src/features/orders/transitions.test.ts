import {describe, expect, it} from 'vitest';
import {planOrderTransition} from './transitions';

describe('planOrderTransition', () => {
  it('allows only the next fulfillment state and treats final states as immutable', () => {
    expect(planOrderTransition({from: 'new', to: 'confirmed'}).allowed).toBe(true);
    expect(planOrderTransition({from: 'new', to: 'preparing'}).allowed).toBe(false);
    expect(planOrderTransition({from: 'delivered', to: 'returned'}).allowed).toBe(false);
  });

  it('requires a reason to cancel and plans one-time stock and coupon release', () => {
    expect(planOrderTransition({from: 'confirmed', to: 'cancelled'}).allowed).toBe(false);
    expect(planOrderTransition({from: 'confirmed', to: 'cancelled', reason: 'Customer requested'})).toMatchObject({allowed: true, releaseStock: true, releaseCoupon: true, codStatus: 'not_due'});
  });

  it('requires cash confirmation for delivery and marks COD collected', () => {
    expect(planOrderTransition({from: 'shipped', to: 'delivered'}).allowed).toBe(false);
    expect(planOrderTransition({from: 'shipped', to: 'delivered', confirmCashCollected: true})).toMatchObject({allowed: true, codStatus: 'collected', collectCash: true});
  });

  it('requires a reason for failed delivery and makes COD not due without releasing stock', () => {
    expect(planOrderTransition({from: 'shipped', to: 'returned', reason: '   '} ).allowed).toBe(false);
    expect(planOrderTransition({from: 'shipped', to: 'returned', reason: 'Recipient unavailable'})).toMatchObject({allowed: true, codStatus: 'not_due', releaseStock: false, releaseCoupon: false});
  });
});
