'use client';

export type GuestCartItem = {variantId: string; quantity: number};
const KEY = 'maison-sillage-cart';

export function readGuestCart(): GuestCartItem[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const byId = new Map<string, number>();
    for (const item of raw) {
      if (typeof item?.variantId === 'string' && /^[0-9a-f-]{36}$/i.test(item.variantId) && Number.isInteger(item.quantity) && item.quantity >= 1) {
        byId.set(item.variantId, Math.min(10, (byId.get(item.variantId) ?? 0) + Math.min(item.quantity, 10)));
      }
    }
    return [...byId].slice(0, 20).map(([variantId, quantity]) => ({variantId, quantity}));
  } catch { return []; }
}

export function writeGuestCart(items: GuestCartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.map(({variantId, quantity}) => ({variantId, quantity}))));
}

export function addGuestCartItem(variantId: string, quantity = 1) {
  const items = readGuestCart();
  const existing = items.find((item) => item.variantId === variantId);
  if (existing) existing.quantity = Math.min(10, existing.quantity + quantity);
  else if (items.length < 20) items.push({variantId, quantity: Math.min(10, quantity)});
  writeGuestCart(items);
}

export function clearGuestCart() { localStorage.removeItem(KEY); }
