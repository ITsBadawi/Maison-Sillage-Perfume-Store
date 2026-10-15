'use client';

import {useState, type FormEvent, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';

export function AdminJsonForm({url, children, submitLabel, className}: {url: string; children: ReactNode; submitLabel: string; className?: string}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const t = useTranslations('adminCore');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const values = new FormData(event.currentTarget);
    const payload: Record<string, string | boolean> = Object.fromEntries([...values.entries()].flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : []));
    for (const checkbox of event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) payload[checkbox.name] = checkbox.checked;
    try {
      const response = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)});
      if (!response.ok) throw new Error(t('saveError'));
      setMessage(t('saved'));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('saveError'));
    } finally { setBusy(false); }
  }

  return <form className={className ?? 'admin-form'} onSubmit={submit}>
    {children}<button className="button button-dark" type="submit" disabled={busy}>{busy ? t('saving') : submitLabel}</button>
    {message && <p role="status" className="admin-form-message">{message}</p>}
  </form>;
}
