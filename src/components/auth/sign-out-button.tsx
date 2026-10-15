'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

export function SignOutButton() {
  const t = useTranslations('auth');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    const {error} = await client.auth.signOut();
    setBusy(false);
    if (error) return;
    router.replace('/', {locale});
    router.refresh();
  }

  return <button className="text-link" type="button" onClick={signOut} disabled={busy}>{t('signOut')}</button>;
}
