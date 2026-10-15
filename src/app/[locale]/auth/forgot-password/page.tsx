import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {RecoveryForm} from '@/components/auth/recovery-form';
export default async function ForgotPasswordPage({params}: {params: Promise<{locale: 'ar' | 'en'}>}) {
  const {locale} = await params; const t = await getTranslations({locale, namespace: 'auth'});
  return <main className="auth-page"><div className="auth-panel"><h1>{t('forgotPassword')}</h1><RecoveryForm mode="forgot" locale={locale} /><p><Link href="/auth/login">{t('signIn')}</Link></p></div></main>;
}
