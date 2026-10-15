'use client';

import {useState, type FormEvent, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';

export function OperationsForm({url, children, submitLabel, className}: {url: string; children: ReactNode; submitLabel: string; className?: string}) {
  const t = useTranslations('adminOperations');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload: Record<string, string | boolean> = Object.fromEntries([...values.entries()].flatMap(([key, value]) => {
      if (typeof value !== 'string') return [];
      if ((key === 'startsAt' || key === 'expiresAt') && value) return [[key, new Date(`${value}:00+03:00`).toISOString()]];
      return [[key, value]];
    }));
    for (const checkbox of form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) payload[checkbox.name] = checkbox.checked;
    try {
      const response = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)});
      const result = await response.json() as {error?: string};
      if (!response.ok) throw new Error(result.error === 'LAST_MANAGER' ? t('lastManager') : t('genericError'));
      setMessage(t('saved')); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : t('failed')); }
    finally { setBusy(false); }
  }
  return <form className={className ?? 'admin-form'} onSubmit={submit}>{children}<button className="button button-dark" type="submit" disabled={busy}>{busy ? t('saving') : submitLabel}</button>{message && <p role="status" className="admin-form-message">{message}</p>}</form>;
}
