import {redirect} from 'next/navigation';
import {getCurrentStaffRoles,getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {OperationsForm} from '@/components/admin/operations-form';
import {getTranslations} from 'next-intl/server';
type Zone={id:string;slug:string;nameAr:string;nameEn:string;feeMinor:string;active:boolean};
export default async function ShippingPage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;const t=await getTranslations('adminOperations');const [user,roles,supabase]=await Promise.all([getCurrentUser(),getCurrentStaffRoles(),createSupabaseServerClient()]);
  if(!user)redirect(`/${locale}/auth/login`);if(!roles.includes('manager'))redirect(`/${locale}/admin`);
  const {data,error}=await supabase!.rpc('admin_list_shipping_zones');const zones=(data??[]) as Zone[];
  const fields=(z?:Zone)=><>{z&&<input type="hidden" name="id" value={z.id}/>}<label>{t('zoneSlug')}<input name="slug" defaultValue={z?.slug??''} pattern="[a-z0-9]+(-[a-z0-9]+)*" required/></label><label>{t('nameAr')}<input name="nameAr" defaultValue={z?.nameAr??''} required/></label><label>{t('nameEn')}<input name="nameEn" defaultValue={z?.nameEn??''} required/></label><label>{t('fee')}<input name="feeMinor" inputMode="numeric" defaultValue={z?.feeMinor??'0'} required/></label><label className="admin-check"><input name="active" type="checkbox" defaultChecked={z?.active??false}/>{t('active')}</label></>;
  return <main className="admin-page" dir={locale==='ar'?'rtl':'ltr'}><a href={`/${locale}/admin`}>{t('back')}</a><p className="eyebrow">{t('eyebrow')}</p><h1>{t('shipping')}</h1><details className="admin-panel"><summary>{t('create')}</summary><OperationsForm url="/api/admin/operations/shipping" submitLabel={t('create')}>{fields()}</OperationsForm></details>{error?<p className="admin-error">{t('loadError')}</p>:zones.length?zones.map((z)=><section className="admin-panel" key={z.id}><h2>{z.nameEn} · {z.slug}</h2><OperationsForm url="/api/admin/operations/shipping" submitLabel={t('save')}>{fields(z)}</OperationsForm></section>):<p className="admin-empty">{t('empty')}</p>}</main>;
}
