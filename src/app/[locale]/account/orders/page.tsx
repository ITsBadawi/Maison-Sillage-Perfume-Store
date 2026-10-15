import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {AccountNav} from '@/components/account/account-nav';
import {getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {formatMoneyMinor} from '@/features/catalog/format-price';

export default async function OrdersPage({params}: {params: Promise<{locale: 'ar' | 'en'}>}) {
  const {locale} = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/account/orders`)}`);
  const t = await getTranslations({locale, namespace: 'account'});
  const client = await createSupabaseServerClient();
  const {data: orders, error} = await client!.from('orders')
    .select('id,public_number,status,total_minor,currency_code,currency_exponent,created_at')
    .eq('user_id', user.id).order('created_at', {ascending: false}).limit(50);
  return <main className="account-page">
    <AccountNav /><h1>{t('orders')}</h1>
    {error ? <p role="alert">{t('loadError')}</p>
      : !orders?.length ? <p>{t('emptyOrders')}</p>
      : <ul className="account-list">{orders.map((order) => <li key={order.id}>
        <Link href={`/account/orders/${order.id}`}>{order.public_number}</Link>
        <span>{t('status.' + order.status)}</span>
        <span>{formatMoneyMinor(String(order.total_minor), locale, order.currency_code, order.currency_exponent)}</span>
      </li>)}</ul>}
  </main>;
}
