export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export type CodStatus = 'uncollected' | 'collected' | 'not_due';

export type TransitionInput = {
  from: OrderStatus;
  to: OrderStatus;
  reason?: string;
  confirmCashCollected?: boolean;
  expectedVersion?: number;
  currentVersion?: number;
};

export type TransitionPlan = {
  allowed: boolean;
  errorCode?: 'INVALID_ORDER_TRANSITION' | 'VERSION_CONFLICT';
  codStatus?: CodStatus;
  releaseStock: boolean;
  releaseCoupon: boolean;
  collectCash: boolean;
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: 'confirmed',
  confirmed: 'preparing',
  preparing: 'shipped',
  shipped: 'delivered',
};

/** Pure decision helper; RPC remains authoritative for actor role, row locks, version and once-only writes. */
export function planOrderTransition(input: TransitionInput): TransitionPlan {
  const denied = (errorCode: TransitionPlan['errorCode'] = 'INVALID_ORDER_TRANSITION'): TransitionPlan => ({
    allowed: false, errorCode, releaseStock: false, releaseCoupon: false, collectCash: false,
  });

  if (input.expectedVersion !== undefined && input.currentVersion !== undefined && input.expectedVersion !== input.currentVersion) {
    return denied('VERSION_CONFLICT');
  }

  if (NEXT_STATUS[input.from] === input.to) {
    if (input.to === 'delivered') {
      if (input.confirmCashCollected !== true) return denied();
      return {allowed: true, codStatus: 'collected', releaseStock: false, releaseCoupon: false, collectCash: true};
    }
    return {allowed: true, codStatus: 'uncollected', releaseStock: false, releaseCoupon: false, collectCash: false};
  }

  if (input.to === 'cancelled' && ['new', 'confirmed', 'preparing'].includes(input.from) && input.reason?.trim()) {
    return {allowed: true, codStatus: 'not_due', releaseStock: true, releaseCoupon: true, collectCash: false};
  }

  if (input.from === 'shipped' && input.to === 'returned' && input.reason?.trim()) {
    return {allowed: true, codStatus: 'not_due', releaseStock: false, releaseCoupon: false, collectCash: false};
  }

  return denied();
}
