import {getTranslations} from 'next-intl/server';
import {RecoveryForm} from '@/components/auth/recovery-form';
export default async function ResetPasswordPage({params}: {params: Promise<{locale: 'ar' | 'en'}>}) {
  const {locale} = await params; const t = await getTranslations({locale, namespace: 'auth'});
  return <main className="auth-page"><div className="auth-panel"><h1>{t('resetPassword')}</h1><RecoveryForm mode="reset" locale={locale} /></div></main>;
}
