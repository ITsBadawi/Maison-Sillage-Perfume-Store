'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {CatalogVariant} from '@/features/catalog/types';
import {addGuestCartItem} from '@/features/cart/guest-cart';

export function ProductPurchaseAction({variants, inStock}: {variants: CatalogVariant[]; inStock: boolean}) {
  const t = useTranslations('cart');
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<'idle' | 'saving' | 'added' | 'unavailable' | 'error'>('idle');

  async function addToCart() {
    setState('saving');
    try {
      const response = await fetch('/api/cart/items', {
        method: 'PUT',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({variantId, quantity}),
      });
      if (response.status === 401) {
        addGuestCartItem(variantId, quantity);
        return setState('added');
      }
      if (response.status === 422) return setState('unavailable');
      if (!response.ok) return setState('error');
      setState('added');
    } catch {
      setState('error');
    }
  }

  if (!inStock || variants.length === 0) return <p className="purchase-unavailable">{t('unavailable')}</p>;

  return <div className="product-purchase">
    <label htmlFor="catalog-variant">{t('size')}</label>
    <select id="catalog-variant" value={variantId} onChange={(event) => setVariantId(event.target.value)}>
      {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.size_ml} ml</option>)}
    </select>
    <label htmlFor="catalog-quantity">{t('quantity')}</label>
    <select id="catalog-quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
      {Array.from({length: 10}, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
    </select>
    <button type="button" className="button button-dark" onClick={addToCart} disabled={state === 'saving'}>{state === 'saving' ? t('adding') : t('add')}</button>
    {state === 'added' && <p role="status">{t('added')} <Link href="/cart">{t('viewCart')}</Link></p>}
    {state === 'unavailable' && <p className="purchase-error" role="alert">{t('unavailable')}</p>}
    {state === 'error' && <p className="purchase-error" role="alert">{t('addError')}</p>}
  </div>;
}
