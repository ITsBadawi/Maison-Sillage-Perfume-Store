import {redirect} from 'next/navigation';
import {getCurrentStaffRoles, getCurrentUser} from '@/lib/auth/current-user';
import {hasAnyRole} from '@/features/admin/schemas';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getTranslations} from 'next-intl/server';
import {formatMoneyMinor} from '@/features/catalog/format-price';

const statuses = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
type Status = typeof statuses[number];

export default async function AdminOrders({params, searchParams}: {params: Promise<{locale: 'ar'|'en'}>; searchParams: Promise<{status?: string}>}) {
  const [{locale}, query, user, roles, supabase] = await Promise.all([params, searchParams, getCurrentUser(), getCurrentStaffRoles(), createSupabaseServerClient()]);
  if (!user) redirect(`/${locale}/auth/login`);
  if (!hasAnyRole(roles, ['manager', 'orders_manager'])) redirect(`/${locale}/admin`);
  const t = await getTranslations({locale, namespace: 'adminCore'});
  let request = supabase!.from('orders').select('id,public_number,status,total_minor,currency_code,currency_exponent,created_at,recipient_name').order('created_at', {ascending: false}).limit(50);
  if (query.status && statuses.includes(query.status as Status)) request = request.eq('status', query.status);
  const {data: orders, error} = await request;
  return <main className="admin-page"><a href={`/${locale}/admin`}>← {t('admin')}</a><p className="eyebrow">{t('operations')}</p><h1>{t('orders')}</h1>
    <form className="admin-filter"><label>{t('statusLabel')} <select name="status" defaultValue={query.status ?? ''}><option value="">{t('allStatuses')}</option>{statuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}</select></label><button className="button button-dark">{t('filter')}</button></form>
    {error ? <p className="admin-error">{t('loadError')}</p> : orders?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('order')}</th><th>{t('customer')}</th><th>{t('statusLabel')}</th><th>{t('total')}</th><th>{t('placed')}</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.public_number}</td><td>{order.recipient_name}</td><td>{t(`status.${order.status as Status}`)}</td><td>{formatMoneyMinor(String(order.total_minor), locale, order.currency_code, order.currency_exponent)}</td><td>{new Date(order.created_at).toLocaleDateString(locale === 'ar' ? 'ar-IQ' : 'en-IQ')}</td><td><a href={`/${locale}/admin/orders/${order.id}`}>{t('open')}</a></td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noOrders')}</p>}
  </main>;
}
