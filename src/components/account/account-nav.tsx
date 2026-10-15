import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';

export function AccountNav() {
  const t = useTranslations('account');
  return <nav className="account-nav" aria-label={t('navigation')}>
    <Link href="/account">{t('overview')}</Link>
    <Link href="/account/orders">{t('orders')}</Link>
    <Link href="/account/favorites">{t('favorites')}</Link>
  </nav>;
}
