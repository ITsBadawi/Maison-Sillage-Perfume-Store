'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';

export function FavoriteAction({productId, initialFavorite, returnTo}: {productId: string; initialFavorite: boolean; returnTo: string}) {
  const t = useTranslations('catalog');
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [removedFromList, setRemovedFromList] = useState(false);

  async function toggleFavorite() {
    setPending(true);
    setMessage('');
    setRequiresSignIn(false);
    try {
      const response = await fetch(`/api/favorites/${productId}`, {method: isFavorite ? 'DELETE' : 'PUT'});
      if (response.status === 401) {
        setRequiresSignIn(true);
        return;
      }
      if (!response.ok) {
        setMessage(t('favoriteError'));
        return;
      }
      setIsFavorite(!isFavorite);
      if (initialFavorite && isFavorite) setRemovedFromList(true);
      setMessage(t(!isFavorite ? 'favoriteSaved' : 'favoriteRemoved'));
    } catch {
      setMessage(t('favoriteError'));
    } finally {
      setPending(false);
    }
  }

  if (removedFromList) return null;
  return <div className="catalog-favorite-action">
    <button type="button" className="favorite-toggle" aria-pressed={isFavorite} onClick={toggleFavorite} disabled={pending}>
      <span aria-hidden="true">{isFavorite ? '♥' : '♡'}</span> {pending ? t('favoriteWorking') : t(isFavorite ? 'removeFavorite' : 'saveFavorite')}
    </button>
    {requiresSignIn && <p role="status"><Link href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>{t('favoriteAuth')}</Link></p>}
    {message && <p role={message === t('favoriteError') ? 'alert' : 'status'}>{message}</p>}
  </div>;
}
