import {redirect} from 'next/navigation';
import {getCurrentStaffRoles,getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {OperationsForm} from '@/components/admin/operations-form';
import {getTranslations} from 'next-intl/server';

type Coupon={id:string;code:string;type:'percent'|'fixed';value:number;maxDiscountMinor:string|null;minSubtotalMinor:string;startsAt:string;expiresAt:string;totalLimit:number|null;perCustomerLimit:number|null;active:boolean;usedCount:number};
function baghdadDateInput(value?:string){if(!value)return '';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map((p)=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}
export default async function CouponsPage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params; const t=await getTranslations('adminOperations');
  const [user,roles,supabase]=await Promise.all([getCurrentUser(),getCurrentStaffRoles(),createSupabaseServerClient()]);
  if(!user)redirect(`/${locale}/auth/login`); if(!roles.includes('manager'))redirect(`/${locale}/admin`);
  const {data,error}=await supabase!.rpc('admin_list_coupons'); const rows=(data??[]) as Coupon[];
  const fields=(c?:Coupon)=><>
    {c&&<input type="hidden" name="id" value={c.id}/>}<label>{t('code')}<input name="code" defaultValue={c?.code??''} required minLength={3} maxLength={40}/></label>
    <label>{t('type')}<select name="type" defaultValue={c?.type??'percent'}><option value="percent">{t('percent')}</option><option value="fixed">{t('fixed')}</option></select></label>
    <label>{t('value')}<input name="value" type="number" min="1" defaultValue={c?.value??''} required/></label>
    <label>{t('maxDiscount')}<input name="maxDiscountMinor" inputMode="numeric" defaultValue={c?.maxDiscountMinor??''}/></label><label>{t('minSubtotal')}<input name="minSubtotalMinor" inputMode="numeric" defaultValue={c?.minSubtotalMinor??'0'} required/></label>
    <label>{t('startsAt')}<input name="startsAt" type="datetime-local" defaultValue={baghdadDateInput(c?.startsAt)} required/></label><label>{t('expiresAt')}<input name="expiresAt" type="datetime-local" defaultValue={baghdadDateInput(c?.expiresAt)} required/></label>
    <label>{t('totalLimit')}<input name="totalLimit" type="number" min="1" defaultValue={c?.totalLimit??''}/></label><label>{t('perCustomerLimit')}<input name="perCustomerLimit" type="number" min="1" defaultValue={c?.perCustomerLimit??''}/></label>
    <label className="admin-check"><input name="active" type="checkbox" defaultChecked={c?.active??false}/>{t('active')}</label>
  </>;
  return <main className="admin-page" dir={locale==='ar'?'rtl':'ltr'}><a href={`/${locale}/admin`}>{t('back')}</a><p className="eyebrow">{t('eyebrow')}</p><h1>{t('coupons')}</h1>
    <details className="admin-panel"><summary>{t('create')}</summary><OperationsForm url="/api/admin/operations/coupons" submitLabel={t('create')}>{fields()}</OperationsForm></details>
    {error?<p className="admin-error">{t('loadError')}</p>:rows.length?rows.map((c)=><section className="admin-panel" key={c.id}><h2>{c.code} · {c.usedCount}</h2><OperationsForm url="/api/admin/operations/coupons" submitLabel={t('save')}>{fields(c)}</OperationsForm></section>):<p className="admin-empty">{t('empty')}</p>}
  </main>;
}
