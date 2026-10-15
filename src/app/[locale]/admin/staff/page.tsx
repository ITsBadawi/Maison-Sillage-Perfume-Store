import {redirect} from 'next/navigation';
import {getCurrentStaffRoles,getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {OperationsForm} from '@/components/admin/operations-form';
import {getTranslations} from 'next-intl/server';
type Staff={userId:string;email:string;role:'manager'|'orders_manager'|'inventory_manager';active:boolean};
export default async function StaffPage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;const t=await getTranslations('adminOperations');const [user,roles,supabase]=await Promise.all([getCurrentUser(),getCurrentStaffRoles(),createSupabaseServerClient()]);
  if(!user)redirect(`/${locale}/auth/login`);if(!roles.includes('manager'))redirect(`/${locale}/admin`);
  const {data,error}=await supabase!.rpc('admin_list_staff');const staff=(data??[]) as Staff[];
  const fields=(s?:Staff)=><><label>{t('email')}<input name="email" type="email" defaultValue={s?.email??''} required readOnly={!!s}/></label><label>{t('role')}<select name="role" defaultValue={s?.role??'orders_manager'}><option value="manager">{t('manager')}</option><option value="orders_manager">{t('ordersManager')}</option><option value="inventory_manager">{t('inventoryManager')}</option></select></label><label className="admin-check"><input name="active" type="checkbox" defaultChecked={s?.active??true}/>{t('active')}</label></>;
  return <main className="admin-page" dir={locale==='ar'?'rtl':'ltr'}><a href={`/${locale}/admin`}>{t('back')}</a><p className="eyebrow">{t('eyebrow')}</p><h1>{t('staff')}</h1><section className="admin-panel"><h2>{t('assign')}</h2><p>{t('disable')}</p><OperationsForm url="/api/admin/operations/staff" submitLabel={t('assign')}>{fields()}</OperationsForm></section>{error?<p className="admin-error">{t('loadError')}</p>:staff.length?staff.map((s)=><section className="admin-panel" key={s.userId}><h2>{s.email}</h2><OperationsForm url="/api/admin/operations/staff" submitLabel={t('save')}>{fields(s)}</OperationsForm></section>):<p className="admin-empty">{t('empty')}</p>}</main>;
}
