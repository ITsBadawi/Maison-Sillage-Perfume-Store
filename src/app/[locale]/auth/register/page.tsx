import {getTranslations} from 'next-intl/server';
import {AuthForm} from '@/components/auth/auth-form';
import {Link} from '@/i18n/navigation';
import {safeReturnTo} from '@/lib/auth/return-to';

export default async function RegisterPage({params, searchParams}: {
  params: Promise<{locale: 'ar' | 'en'}>;
  searchParams: Promise<{returnTo?: string}>;
}) {
  const {locale} = await params;
  const {returnTo: requested} = await searchParams;
  const returnTo = safeReturnTo(requested, locale);
  const t = await getTranslations({locale, namespace: 'auth'});
  return <main className="auth-page"><div className="auth-panel">
    <h1>{t('createAccount')}</h1><p>{t('registerIntro')}</p>
    <AuthForm mode="register" locale={locale} returnTo={returnTo} />
    <p className="auth-alternate">{t('haveAccount')} <Link href="/auth/login">{t('signIn')}</Link></p>
  </div></main>;
}
