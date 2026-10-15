'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {clearGuestCart, readGuestCart, writeGuestCart, type GuestCartItem} from '@/features/cart/guest-cart';
import {formatCatalogPrice} from '@/features/catalog/format-price';

type CartItem = {variantId: string; quantity: number; unitPriceMinor: string; sizeMl: number; product: {nameAr: string; nameEn: string; brand: string}};
type Cart = {items: CartItem[]};

export function CartView() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const [cart, setCart] = useState<Cart | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const refresh = useCallback(async () => {
    try {
      let response = await fetch('/api/cart', {cache: 'no-store'});
      if (response.status === 401) {
        const guestItems = readGuestCart();
        if (!guestItems.length) { setCart({items: []}); setGuest(true); setFailed(false); return; }
        const resolved = await fetch('/api/cart/resolve', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(guestItems)});
        const body = await resolved.json() as {ok: boolean; data?: Cart};
        if (!resolved.ok || !body.data) { setFailed(true); return; }
        setCart(body.data); setGuest(true); setFailed(false); return;
      }
      const savedGuestItems = readGuestCart();
      if (response.ok && savedGuestItems.length) {
        const merged = await fetch('/api/cart/merge', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(savedGuestItems)});
        if (!merged.ok) { setFailed(true); return; }
        clearGuestCart();
        response = await fetch('/api/cart', {cache: 'no-store'});
      }
      const body = await response.json() as {ok: boolean; data?: Cart};
      if (!response.ok || !body.ok || !body.data) { setFailed(true); return; }
      setCart(body.data); setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  async function update(id: string, quantity: number | null) {
    setBusy(id);
    try {
      if (guest) {
        const items: GuestCartItem[] = readGuestCart().flatMap((item) => item.variantId !== id ? [item] : quantity === null ? [] : [{variantId: id, quantity}]);
        writeGuestCart(items); await refresh(); return;
      }
      if (quantity === null) await fetch(`/api/cart/items/${id}`, {method: 'DELETE'});
      else await fetch('/api/cart/items', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({variantId: id, quantity})});
      await refresh();
    } finally { setBusy(null); }
  }
  const subtotal = cart?.items.reduce((sum, item) => sum + BigInt(item.unitPriceMinor) * BigInt(item.quantity), BigInt(0)) ?? BigInt(0);
  return <main className="commerce-page">
    <p className="eyebrow">MAISON SILLAGE</p><h1>{t('title')}</h1>
    {failed && <p role="alert">{t('error')} <Link href={`/auth/login?returnTo=${encodeURIComponent(`/${locale}/cart`)}`}>{t('continue')}</Link></p>}
    {!cart && !failed && <p aria-live="polite">{t('loading')}</p>}
    {cart && !cart.items.length && <div className="commerce-empty"><p>{t('empty')}</p><Link className="button button-dark" href="/shop">{t('continue')}</Link></div>}
    {cart && cart.items.length > 0 && <>
      <div className="cart-lines">{cart.items.map((item) => <article className="cart-line" key={item.variantId}>
        <div className="cart-item-copy"><p className="eyebrow">{item.product.brand} · {item.sizeMl} ml</p><h2>{locale === 'ar' ? item.product.nameAr : item.product.nameEn}</h2><p>{formatCatalogPrice(item.unitPriceMinor, locale as 'ar' | 'en')}</p></div>
        <label>{t('quantity')}<select value={item.quantity} disabled={busy === item.variantId} onChange={(event) => void update(item.variantId, Number(event.target.value))}>{Array.from({length: 10}, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
        <button className="plain-action" disabled={busy === item.variantId} onClick={() => void update(item.variantId, null)}>{t('remove')}</button>
      </article>)}</div>
      <aside className="cart-total"><span>{t('subtotal')}</span><strong>{formatCatalogPrice(subtotal.toString(), locale as 'ar' | 'en')}</strong><Link className="button button-dark" href={guest ? `/auth/login?returnTo=${encodeURIComponent(`/${locale}/checkout`)}` : '/checkout'}>{t('checkout')}</Link></aside>
    </>}
  </main>;
}
