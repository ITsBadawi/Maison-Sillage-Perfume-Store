import {redirect} from 'next/navigation';
import {getCurrentStaffRoles,getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {OperationsForm} from '@/components/admin/operations-form';
import {getTranslations} from 'next-intl/server';
type Brand={nameAr:string;nameEn:string;logoPath:string;heroImagePath:string;accentColor:string;contactPhone:string};
export default async function BrandPage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;const t=await getTranslations('adminOperations');const [user,roles,supabase]=await Promise.all([getCurrentUser(),getCurrentStaffRoles(),createSupabaseServerClient()]);
  if(!user)redirect(`/${locale}/auth/login`);if(!roles.includes('manager'))redirect(`/${locale}/admin`);
  const {data,error}=await supabase!.rpc('admin_get_store_brand');const brand=(data??{}) as Brand;
  return <main className="admin-page" dir={locale==='ar'?'rtl':'ltr'}><a href={`/${locale}/admin`}>{t('back')}</a><p className="eyebrow">{t('eyebrow')}</p><h1>{t('brandTitle')}</h1>{error?<p className="admin-error">{t('loadError')}</p>:<section className="admin-panel"><OperationsForm url="/api/admin/operations/brand" submitLabel={t('save')}>
    <label>{t('nameAr')}<input name="nameAr" defaultValue={brand.nameAr??''} required/></label><label>{t('nameEn')}<input name="nameEn" defaultValue={brand.nameEn??''} required/></label>
    <label>{locale==='ar'?'مسار الشعار':'Logo path'}<input name="logoPath" defaultValue={brand.logoPath??''}/></label><label>{locale==='ar'?'مسار صورة الواجهة':'Hero image path'}<input name="heroImagePath" defaultValue={brand.heroImagePath??''}/></label><label>{locale==='ar'?'اللون الأساسي':'Accent color'}<input name="accentColor" type="color" defaultValue={brand.accentColor??'#b68b54'}/></label><label>{locale==='ar'?'هاتف التواصل':'Contact phone'}<input name="contactPhone" defaultValue={brand.contactPhone??''}/></label>
  </OperationsForm></section>}</main>;
}
