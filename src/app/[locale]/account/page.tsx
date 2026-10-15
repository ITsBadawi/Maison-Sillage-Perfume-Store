import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {getCurrentUser} from '@/lib/auth/current-user';
import {SignOutButton} from '@/components/auth/sign-out-button';
import {AccountNav} from '@/components/account/account-nav';
import {AccountSettings} from '@/components/account/account-settings';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export default async function AccountPage({params}: {params: Promise<{locale: 'ar' | 'en'}>}) {
  const {locale} = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/account`)}`);
  const t = await getTranslations({locale, namespace: 'auth'});
  const client = await createSupabaseServerClient();
  const [{data: profile}, {data: addresses}] = await Promise.all([
    client!.from('profiles').select('full_name,phone,preferred_locale').eq('id', user.id).maybeSingle(),
    client!.from('customer_addresses').select('id,recipient_name,phone,city,district,street,landmark').eq('user_id', user.id).order('created_at'),
  ]);
  return <main className="auth-page"><div className="auth-panel">
    <h1>{t('account')}</h1><p>{t('signedInAs')} <bdi>{user.email}</bdi></p>
    <AccountNav />
    {profile && <AccountSettings profile={profile} addresses={addresses ?? []} />}
    <SignOutButton />
  </div></main>;
}
