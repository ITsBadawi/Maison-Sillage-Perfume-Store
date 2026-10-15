import {redirect} from 'next/navigation';
import {getCurrentStaffRoles, getCurrentUser} from '@/lib/auth/current-user';
import {hasAnyRole} from '@/features/admin/schemas';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getTranslations} from 'next-intl/server';

export default async function AdminHome({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const [user, roles, supabase, t] = await Promise.all([getCurrentUser(), getCurrentStaffRoles(), createSupabaseServerClient(), getTranslations('adminOperations')]);
  if (!user) redirect(`/${locale}/auth/login`);
  if (!hasAnyRole(roles, ['manager', 'orders_manager', 'inventory_manager'])) redirect(`/${locale}`);
  const manager = roles.includes('manager');
  const orderStaff = hasAnyRole(roles, ['manager', 'orders_manager']);
  const inventoryStaff = hasAnyRole(roles, ['manager', 'inventory_manager']);
  const [{count: openCount}, {count: productCount}] = supabase ? await Promise.all([
    orderStaff ? supabase.from('orders').select('id', {count: 'exact', head: true}).not('status', 'in', '(delivered,cancelled,returned)') : Promise.resolve({count: null}),
    inventoryStaff ? supabase.from('products').select('id', {count: 'exact', head: true}) : Promise.resolve({count: null}),
  ]) : [{count: null}, {count: null}];
  return <main className="admin-page" dir={locale==='ar'?'rtl':'ltr'}>
    <p className="eyebrow">MAISON SILLAGE · {t('eyebrow')}</p><h1>{locale==='ar'?'إدارة المتجر':'Store admin'}</h1>
    <p>{locale==='ar'?'صلاحية الحساب:':'Signed in with'} {roles.join(', ')} {locale==='ar'?'':'access.'}</p>
    <nav className="admin-nav">
      {orderStaff && <a href={`/${locale}/admin/orders`}>Orders <strong>{openCount ?? '—'}</strong></a>}
      {inventoryStaff && <a href={`/${locale}/admin/products`}>Products & inventory <strong>{productCount ?? '—'}</strong></a>}
      {manager && <><a href={`/${locale}/admin/settings`}>{locale==='ar'?'الإعدادات':'Settings'} <span>Telegram</span></a>
        <a href={`/${locale}/admin/coupons`}>{t('coupons')}</a><a href={`/${locale}/admin/quiz`}>{t('quiz')}</a>
        <a href={`/${locale}/admin/staff`}>{t('staff')}</a><a href={`/${locale}/admin/shipping`}>{t('shipping')}</a><a href={`/${locale}/admin/brand`}>{t('brandTitle')}</a></>}
    </nav>
  </main>;
}
