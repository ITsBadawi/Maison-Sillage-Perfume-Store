'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

export function RecoveryForm({mode, locale}: {mode: 'forgot' | 'reset'; locale: 'ar' | 'en'}) {
  const t = useTranslations('auth'); const router = useRouter();
  const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const client = getSupabaseBrowserClient();
    if (!client) {setNotice(t('unavailable')); setBusy(false); return;}
    const values = new FormData(event.currentTarget);
    try {
      if (mode === 'forgot') {
        const email = String(values.get('email') ?? '').trim();
        const {error} = await client.auth.resetPasswordForEmail(email, {redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/${locale}/auth/reset-password`)}`});
        if (error) throw error;
        setNotice(t('resetEmailSent'));
      } else {
        const password = String(values.get('password') ?? '');
        const {error} = await client.auth.updateUser({password});
        if (error) throw error;
        router.replace('/account', {locale}); router.refresh();
      }
    } catch { setNotice(t('tryAgain')); } finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    {mode === 'forgot' ? <label>{t('email')}<input name="email" type="email" autoComplete="email" required /></label> : <label>{t('newPassword')}<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>}
    {notice && <p role="status">{notice}</p>}
    <button className="button button-dark" disabled={busy}>{busy ? t('working') : t(mode === 'forgot' ? 'sendReset' : 'resetPassword')}</button>
  </form>;
}
