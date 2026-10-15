import {notFound, redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {getCurrentStaffRoles, getCurrentUser} from '@/lib/auth/current-user';
import {hasAnyRole} from '@/features/admin/schemas';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {formatMoneyMinor} from '@/features/catalog/format-price';
import {AdminJsonForm} from '@/components/admin/admin-json-form';

const nextStatuses: Record<string, string[]> = {new: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['shipped', 'cancelled'], shipped: ['delivered', 'returned']};
type Status = 'new'|'confirmed'|'preparing'|'shipped'|'delivered'|'cancelled'|'returned';

export default async function AdminOrderDetail({params}: {params: Promise<{locale: 'ar'|'en'; id: string}>}) {
  const {locale, id} = await params;
  const [user, roles, supabase] = await Promise.all([getCurrentUser(), getCurrentStaffRoles(), createSupabaseServerClient()]);
  if (!user) redirect(`/${locale}/auth/login`);
  if (!hasAnyRole(roles, ['manager', 'orders_manager'])) redirect(`/${locale}/admin`);
  const {data: order, error} = await supabase!.from('orders').select('id,public_number,status,cod_status,recipient_name,phone,address_snapshot,notes,total_minor,currency_code,currency_exponent,version,created_at,order_items(id,name_ar_snapshot,name_en_snapshot,sku_snapshot,size_ml_snapshot,quantity,line_total_minor),order_status_history(from_status,to_status,reason,created_at)').eq('id', id).maybeSingle();
  if (error || !order) notFound();
  const [{data: notification}, t] = await Promise.all([
    supabase!.rpc('admin_order_notification_status', {p_order_id: id}),
    getTranslations({locale, namespace: 'adminCore'}),
  ]);
  const address = order.address_snapshot && typeof order.address_snapshot === 'object' ? order.address_snapshot as Record<string, unknown> : {};
  const dateLocale = locale === 'ar' ? 'ar-IQ' : 'en-IQ';
  return <main className="admin-page"><a href={`/${locale}/admin/orders`}>← {t('orders')}</a><p className="eyebrow">{t('orderDetail')}</p><h1>{order.public_number}</h1>
    <div className="admin-detail-grid"><section className="admin-panel"><h2>{t('fulfilment')}</h2>
      <p>{t('statusLabel')}: <strong>{t(`status.${order.status as Status}`)}</strong> · {t('cash')}: {t(`cashStatus.${order.cod_status as 'uncollected'|'collected'|'not_due'}`)}</p>
      <p>{t('customer')}: {order.recipient_name} · <span dir="ltr">{order.phone}</span></p>
      <p>{t('address')}: {[address.city, address.district, address.street, address.landmark].filter((value): value is string => typeof value === 'string' && value.length > 0).join('، ')}</p>
      <p>{t('notes')}: {order.notes || '—'}</p>
      <p>{t('total')}: {formatMoneyMinor(String(order.total_minor), locale, order.currency_code, order.currency_exponent)}</p>
      {nextStatuses[order.status]?.length ? <AdminJsonForm url={`/api/admin/orders/${id}/transitions`} submitLabel={t('updateStatus')}>
        <input type="hidden" name="expectedVersion" value={order.version}/><label>{t('nextStatus')}<select name="toStatus">{nextStatuses[order.status].map((status) => <option key={status} value={status}>{t(`status.${status as Status}`)}</option>)}</select></label>
        <label>{t('reason')}<input name="reason" maxLength={250}/></label>
        <label className="admin-check"><input type="checkbox" name="confirmCashCollected"/> {t('confirmCash')}</label>
      </AdminJsonForm> : <p>{t('finalStatus')}</p>}</section>
      <section className="admin-panel"><h2>{t('notification')}</h2>{notification ? <><p>{t('statusLabel')}: {t(`notificationStatus.${notification.status as 'pending'|'processing'|'sent'|'failed'}`)} · {t('attempts')}: {notification.attempts}</p><p>{t('lastIssue')}: {notification.lastErrorCode ?? '—'}</p><p>{t('nextAttempt')}: {notification.nextAttemptAt ? new Date(notification.nextAttemptAt).toLocaleString(dateLocale) : '—'}</p>{notification.status !== 'sent' && <AdminJsonForm url={`/api/admin/orders/${id}/notifications/retry`} submitLabel={t('retryNotification')}><input type="hidden" name="force" value="false"/></AdminJsonForm>}{notification.status === 'sent' && <AdminJsonForm url={`/api/admin/orders/${id}/notifications/retry`} submitLabel={t('forceResend')}><input type="hidden" name="force" value="true"/><label>{t('reason')}<input name="reason" minLength={3} required/></label></AdminJsonForm>}</> : <p>{t('noNotification')}</p>}</section>
    </div>
    <section className="admin-panel"><h2>{t('items')}</h2><ul className="admin-item-list">{order.order_items.map((item) => <li key={item.id}>{locale === 'ar' ? item.name_ar_snapshot : item.name_en_snapshot} · {item.sku_snapshot} · {item.size_ml_snapshot} ml × {item.quantity} · {formatMoneyMinor(String(item.line_total_minor), locale, order.currency_code, order.currency_exponent)}</li>)}</ul></section>
    <section className="admin-panel"><h2>{t('history')}</h2><ol className="admin-history">{order.order_status_history.map((item, index) => <li key={`${item.created_at}-${index}`}>{item.from_status ? t(`status.${item.from_status as Status}`) : t('created')} → {t(`status.${item.to_status as Status}`)} · {item.reason || '—'} · {new Date(item.created_at).toLocaleString(dateLocale)}</li>)}</ol></section>
  </main>;
}
