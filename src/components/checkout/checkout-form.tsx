'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Link} from '@/i18n/navigation';
import {clearGuestCart, readGuestCart} from '@/features/cart/guest-cart';
import {formatCatalogPrice} from '@/features/catalog/format-price';

type CartItem = {variantId: string; quantity: number; unitPriceMinor: string; sizeMl: number; product: {nameAr: string; nameEn: string; brand: string}};
type Zone = {id: string; name_ar: string; name_en: string; fee_minor: number};
type Quote = {quoteHash: string; quote: {subtotalMinor: string; discountMinor: string; shippingMinor: string; totalMinor: string; currencyCode: string; expiresAt: string}};
type State = {items: CartItem[]; zones: Zone[]};
const money = (minor: string, locale: string) => formatCatalogPrice(minor, locale as 'ar' | 'en');

export function CheckoutForm() {
  const t = useTranslations('checkout');
  const cartText = useTranslations('cart');
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [zoneId, setZoneId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [mergeAdjusted, setMergeAdjusted] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  useEffect(() => {
    void Promise.all([fetch('/api/cart', {cache: 'no-store'}), fetch('/api/checkout/zones', {cache: 'no-store'})]).then(async ([cartResponse, zoneResponse]) => {
      if (cartResponse.status === 401) { setSignedOut(true); return; }
      const guestItems = readGuestCart();
      if (guestItems.length) {
        const merged = await fetch('/api/cart/merge', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(guestItems)});
        const mergeBody = await merged.json() as {ok: boolean; data?: {adjusted: boolean}};
        if (!merged.ok || !mergeBody.ok) { setError('unavailable'); return; }
        setMergeAdjusted(mergeBody.data?.adjusted ?? false);
        clearGuestCart();
      }
      const [cart, zones] = await Promise.all([fetch('/api/cart', {cache: 'no-store'}).then((response) => response.json()), zoneResponse.json()]) as [{ok: boolean; data: {items: CartItem[]}}, {ok: boolean; data: Zone[]}];
      if (!cart.ok || !zones.ok) { setError('unavailable'); return; }
      setState({items: cart.data.items, zones: zones.data});
      setZoneId(zones.data[0]?.id ?? '');
    }).catch(() => setError('unavailable'));
  }, []);
  const itemPayload = useMemo(() => state?.items.map(({variantId, quantity}) => ({variantId, quantity})) ?? [], [state]);

  async function updateQuote() {
    setError(''); setQuote(null); setBusy(true);
    try {
      const response = await fetch('/api/checkout/quote', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({items: itemPayload, shippingZoneId: zoneId, couponCode: couponCode.trim() || undefined})});
      const body = await response.json() as {ok: boolean; data?: Quote; error?: {code: string}};
      if (!response.ok || !body.data) { setError(body.error?.code ?? 'unavailable'); return; }
      setQuote(body.data); setIdempotencyKey(crypto.randomUUID());
    } catch { setError('unavailable'); } finally { setBusy(false); }
  }

  async function place(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) { setError('quoteRequired'); return; }
    const form = new FormData(event.currentTarget);
    const payload = {items: itemPayload, shippingZoneId: zoneId, couponCode: couponCode.trim() || undefined,
      quoteHash: quote.quoteHash, address: {recipientName: form.get('recipientName'), phone: form.get('phone'), city: form.get('city'), district: form.get('district'), street: form.get('street'), landmark: form.get('landmark')}, notes: form.get('notes')};
    setBusy(true); setError('');
    try {
      const key = idempotencyKey || crypto.randomUUID();
      setIdempotencyKey(key);
      const response = await fetch('/api/orders', {method: 'POST', headers: {'content-type': 'application/json', 'idempotency-key': key}, body: JSON.stringify(payload)});
      const body = await response.json() as {ok: boolean; data?: {orderId: string}; error?: {code: string}};
      if (!response.ok || !body.data) { setError(body.error?.code ?? 'unavailable'); if (['QUOTE_EXPIRED','PRICE_CHANGED','STOCK_CHANGED'].includes(body.error?.code ?? '')) setQuote(null); return; }
      router.push(`/orders/${body.data.orderId}`);
    } catch { setError('unavailable'); } finally { setBusy(false); }
  }
    if (signedOut) return <main className="commerce-page"><h1>{t('title')}</h1><p>{t('AUTH_REQUIRED')}</p><Link className="button button-dark" href={`/auth/login?returnTo=${encodeURIComponent(`/${locale}/checkout`)}`}>{cartText('checkout')}</Link></main>;
  if (!state) return <main className="commerce-page"><p aria-live="polite">{error ? t('unavailable') : cartText('loading')}</p></main>;
  if (!state.items.length) return <main className="commerce-page"><h1>{t('title')}</h1><p>{t('empty')}</p><Link href="/cart">{cartText('title')}</Link></main>;
  return <main className="commerce-page">
    <p className="eyebrow">MAISON SILLAGE</p><h1>{t('title')}</h1><p>{t('intro')}</p>
    {mergeAdjusted && <p role="status">{cartText('mergeAdjusted')} <Link href="/cart">{cartText('title')}</Link></p>}
    <form className="checkout-layout" onSubmit={place}>
      <div className="checkout-fields">
        <label>{t('recipientName')}<input name="recipientName" autoComplete="name" required minLength={2} maxLength={100} onChange={() => setIdempotencyKey('')} /></label>
        <label>{t('phone')}<input name="phone" type="tel" autoComplete="tel" placeholder="+964…" required pattern="\+[1-9][0-9]{7,14}" onChange={() => setIdempotencyKey('')} /></label>
        <label>{t('city')}<input name="city" autoComplete="address-level2" required minLength={2} maxLength={80} onChange={() => setIdempotencyKey('')} /></label>
        <label>{t('district')}<input name="district" autoComplete="address-level3" required minLength={2} maxLength={120} onChange={() => setIdempotencyKey('')} /></label>
        <label>{t('street')}<input name="street" autoComplete="street-address" required minLength={5} maxLength={250} onChange={() => setIdempotencyKey('')} /></label>
        <label>{t('landmark')}<input name="landmark" maxLength={150} onChange={() => setIdempotencyKey('')} /></label>
        <label>{t('notes')}<textarea name="notes" maxLength={500} rows={3} onChange={() => setIdempotencyKey('')} /></label>
        <label>{t('zone')}<select value={zoneId} required onChange={(event) => {setZoneId(event.target.value);setQuote(null);setIdempotencyKey('');}}>{state.zones.map((zone) => <option key={zone.id} value={zone.id}>{locale === 'ar' ? zone.name_ar : zone.name_en}</option>)}</select></label>
        <label>{t('coupon')}<input value={couponCode} maxLength={64} onChange={(event) => {setCouponCode(event.target.value);setQuote(null);setIdempotencyKey('');}} /></label>
        <button type="button" className="button button-outline" onClick={() => void updateQuote()} disabled={busy}>{busy ? t('working') : t('apply')}</button>
        <p className="cod-note">{t('payment')}</p>
        {error && <p className="commerce-error" role="alert">{t(CHECKOUT_KEYS.includes(error as CheckoutErrorKey) ? error as CheckoutErrorKey : 'unavailable')}</p>}
        <button className="button button-dark" type="submit" disabled={busy || !quote}>{busy ? t('working') : t('place')}</button>
      </div>
      <aside className="checkout-summary"><h2>{t('summary')}</h2>
        {state.items.map((item) => <div className="summary-line" key={item.variantId}><span>{locale === 'ar' ? item.product.nameAr : item.product.nameEn} × {item.quantity}</span><span>{money((BigInt(item.unitPriceMinor)*BigInt(item.quantity)).toString(), locale)}</span></div>)}
        <div className="summary-line"><span>{t('subtotal')}</span><span>{quote ? money(quote.quote.subtotalMinor, locale) : '—'}</span></div>
        <div className="summary-line"><span>{t('discount')}</span><span>{quote ? money(quote.quote.discountMinor, locale) : '—'}</span></div>
        <div className="summary-line"><span>{t('shipping')}</span><span>{quote ? money(quote.quote.shippingMinor, locale) : '—'}</span></div>
        <div className="summary-line summary-grand"><span>{t('total')}</span><strong>{quote ? money(quote.quote.totalMinor, locale) : '—'}</strong></div>
      </aside>
    </form>
  </main>;
}

const CHECKOUT_KEYS = ['quoteRequired','QUOTE_EXPIRED','STOCK_CHANGED','PRICE_CHANGED','COUPON_INVALID','COUPON_LIMIT_REACHED','RATE_LIMITED','AUTH_REQUIRED','EMAIL_UNCONFIRMED','INVALID_BODY','IDEMPOTENCY_CONFLICT','PRODUCT_UNAVAILABLE','SHIPPING_ZONE_INVALID','QUOTE_INVALID','unavailable'] as const;
type CheckoutErrorKey = typeof CHECKOUT_KEYS[number];
