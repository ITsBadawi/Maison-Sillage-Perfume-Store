'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {readGuestCart, clearGuestCart} from '@/features/cart/guest-cart';

type Props = {
  mode: 'login' | 'register';
  locale: 'ar' | 'en';
  returnTo: string;
};

export function AuthForm({mode, locale, returnTo}: Props) {
  const t = useTranslations('auth');
  const router = useRouter();
  const localizedDestination = returnTo.slice(locale.length + 1) || '/';
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function mergeSavedBag() {
    const guestItems = readGuestCart();
    if (!guestItems.length) return;
    const merged = await fetch('/api/cart/merge', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(guestItems)});
    if (merged.ok) clearGuestCart();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) {
      setNotice(t('unavailable'));
      return;
    }
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');
    const fullName = String(values.get('fullName') ?? '').trim();
    setBusy(true);
    setNotice('');
    try {
      if (mode === 'login') {
        const {error} = await client.auth.signInWithPassword({email, password});
        if (error) throw error;
        await mergeSavedBag();
        router.replace(localizedDestination, {locale});
        router.refresh();
      } else {
        const {data, error} = await client.auth.signUp({
          email,
          password,
          options: {
            data: {full_name: fullName},
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          await mergeSavedBag();
          router.replace(localizedDestination, {locale});
          router.refresh();
        } else {
          setNotice(t('checkEmail'));
        }
      }
    } catch {
      setNotice(t('tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === 'register' && <label>{t('fullName')}<input name="fullName" autoComplete="name" required minLength={2} maxLength={100} /></label>}
      <label>{t('email')}<input name="email" type="email" autoComplete="email" required /></label>
      <label>{t('password')}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} /></label>
      {notice && <p role="status" className="auth-notice">{notice}</p>}
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? t('working') : mode === 'login' ? t('signIn') : t('createAccount')}</button>
    </form>
  );
}
