import {getTranslations} from 'next-intl/server';
import {AuthForm} from '@/components/auth/auth-form';
import {Link} from '@/i18n/navigation';
import {safeReturnTo} from '@/lib/auth/return-to';

export default async function LoginPage({params, searchParams}: {
  params: Promise<{locale: 'ar' | 'en'}>;
  searchParams: Promise<{returnTo?: string}>;
}) {
  const {locale} = await params;
  const {returnTo: requested} = await searchParams;
  const returnTo = safeReturnTo(requested, locale);
  const t = await getTranslations({locale, namespace: 'auth'});
  return <main className="auth-page"><div className="auth-panel">
    <h1>{t('signIn')}</h1><p>{t('welcome')}</p>
    <AuthForm mode="login" locale={locale} returnTo={returnTo} />
    <p><Link href="/auth/forgot-password">{t('forgotPassword')}</Link></p>
    <p className="auth-alternate">{t('newHere')} <Link href="/auth/register">{t('createAccount')}</Link></p>
  </div></main>;
}
