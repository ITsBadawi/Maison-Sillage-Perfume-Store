import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {LanguageSwitcher} from './language-switcher';

export function SiteHeader({brandName}: {brandName?: string}) {
  const t = useTranslations();
  return <header className="site-header">
    <Link href="/" className="wordmark" aria-label={t('nav.home')}>{brandName ?? 'MAISON SILLAGE'}</Link>
    <nav className="desktop-nav" aria-label={t('nav.label')}>
      <Link href="/shop">{t('nav.shop')}</Link><Link href="/#story">{t('nav.story')}</Link><Link href="/advisor">{t('nav.advisor')}</Link><Link href="/cart">{t('nav.cart')}</Link><Link href="/account">{t('nav.account')}</Link>
    </nav>
    <LanguageSwitcher />
  </header>;
}
