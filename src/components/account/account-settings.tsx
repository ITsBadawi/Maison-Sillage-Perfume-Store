'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';

type Address = {id: string; recipient_name: string; phone: string; city: string; district: string; street: string; landmark: string};
type Profile = {full_name: string; phone: string | null; preferred_locale: 'ar' | 'en'};
const blank = {recipient_name: '', phone: '', city: '', district: '', street: '', landmark: ''};

export function AccountSettings({profile, addresses}: {profile: Profile; addresses: Address[]}) {
  const t = useTranslations('account');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [addressList, setAddressList] = useState(addresses);
  const [editing, setEditing] = useState<Address | null>(null);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try { const response = await fetch('/api/account/profile', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({full_name: name, phone: phone || null, preferred_locale: profile.preferred_locale})}); setNotice(response.ok ? t('saved') : t('saveError')); }
    catch { setNotice(t('saveError')); } finally { setBusy(false); }
  }
  async function saveAddress(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const response = await fetch(editing ? `/api/account/addresses/${editing.id}` : '/api/account/addresses', {method: editing ? 'PUT' : 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(draft)});
      if (!response.ok) { setNotice(t('saveError')); return; }
      const result = await response.json() as {data: Address};
      setAddressList((current) => editing ? current.map((item) => item.id === editing.id ? {...item, ...draft} : item) : [...current, result.data]);
      setEditing(null); setDraft(blank); setNotice(t('saved'));
    } catch { setNotice(t('saveError')); } finally { setBusy(false); }
  }
  async function removeAddress(id: string) {
    const response = await fetch(`/api/account/addresses/${id}`, {method: 'DELETE'});
    if (response.ok) setAddressList((current) => current.filter((item) => item.id !== id)); else setNotice(t('saveError'));
  }
  return <section className="account-settings">
    <h2>{t('profile')}</h2>
    <form className="auth-form" onSubmit={saveProfile}><label>{t('profileName')}<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label><label>{t('profilePhone')}<input maxLength={32} value={phone} onChange={(e) => setPhone(e.target.value)} /></label><button className="button button-dark" disabled={busy}>{t('save')}</button></form>
    <h2>{t('addresses')}</h2>
    {addressList.map((address) => <article className="account-list" key={address.id}><b>{address.recipient_name}</b><span>{address.phone} · {address.city}, {address.district} · {address.street}{address.landmark && ` · ${address.landmark}`}</span><button type="button" className="plain-action" onClick={() => {setEditing(address); setDraft({recipient_name: address.recipient_name, phone: address.phone, city: address.city, district: address.district, street: address.street, landmark: address.landmark});}}>{t('edit')}</button><button type="button" className="plain-action" onClick={() => void removeAddress(address.id)}>{t('delete')}</button></article>)}
    {!addressList.length && <p>{t('noAddresses')}</p>}
    <form className="auth-form" onSubmit={saveAddress}><h3>{editing ? t('editAddress') : t('addAddress')}</h3>{(['recipient_name','phone','city','district','street','landmark'] as const).map((field) => <label key={field}>{t(`addressFields.${field}`)}<input required={field !== 'landmark'} maxLength={field === 'street' ? 250 : field === 'landmark' ? 150 : 120} value={draft[field]} onChange={(e) => setDraft({...draft, [field]: e.target.value})} /></label>)}<button className="button button-dark" disabled={busy}>{t('save')}</button>{editing && <button type="button" className="plain-action" onClick={() => {setEditing(null); setDraft(blank);}}>{t('cancel')}</button>}</form>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
