import {notFound, redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {AccountNav} from '@/components/account/account-nav';
import {getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {formatMoneyMinor} from '@/features/catalog/format-price';

export default async function OrderDetailPage({params}: {params: Promise<{locale: 'ar' | 'en'; id: string}>}) {
  const {locale, id} = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/account/orders/${id}`)}`);
  const client = await createSupabaseServerClient();
  const {data: order} = await client!.from('orders')
    .select('id,public_number,status,total_minor,currency_code,currency_exponent,created_at,order_items(name_ar_snapshot,name_en_snapshot,quantity,unit_price_minor)')
    .eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!order) notFound();
  const t = await getTranslations({locale, namespace: 'account'});
  return <main className="account-page"><AccountNav />
    <h1>{t('orderNumber', {number: order.public_number})}</h1>
    <p>{t('status.' + order.status)}</p>
    <ul className="account-list">{order.order_items.map((item, index) => <li key={index}>
      <span>{locale === 'ar' ? item.name_ar_snapshot : item.name_en_snapshot}</span>
      <span>× {item.quantity}</span>
    </li>)}</ul>
    <p>{t('total')}: <strong>{formatMoneyMinor(String(order.total_minor), locale, order.currency_code, order.currency_exponent)}</strong></p>
    <p>{t('cashOnDelivery')}</p>
  </main>;
}
