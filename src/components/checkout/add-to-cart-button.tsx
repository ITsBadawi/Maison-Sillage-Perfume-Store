'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {addGuestCartItem} from '@/features/cart/guest-cart';

export function AddToCartButton({variantId}: {variantId: string}) {
  const t = useTranslations('cart');
  const [state, setState] = useState<'idle'|'working'|'added'|'error'>('idle');
  async function add() {
    setState('working');
    try {
      const response = await fetch('/api/cart/items', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({variantId, quantity: 1})});
      if (response.status === 401) { addGuestCartItem(variantId); setState('added'); return; }
      setState(response.ok ? 'added' : 'error');
    } catch { setState('error'); }
  }
  return <div className="cart-add-wrap"><button className="button button-dark" type="button" onClick={add} disabled={state === 'working'}>{state === 'added' ? t('added') : t('add')}</button>{state === 'error' && <p role="alert">{t('error')}</p>}</div>;
}
