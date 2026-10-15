import {redirect} from 'next/navigation';
import {getCurrentStaffRoles, getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {AdminJsonForm} from '@/components/admin/admin-json-form';

export default async function AdminSettings({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const [user, roles, supabase] = await Promise.all([getCurrentUser(), getCurrentStaffRoles(), createSupabaseServerClient()]);
  if (!user) redirect(`/${locale}/auth/login`);
  if (!roles.includes('manager')) redirect(`/${locale}/admin`);
  const {data, error} = await supabase!.rpc('admin_get_telegram_settings');
  const settings = data as {enabled?: boolean; chatId?: string; includeCustomerDetails?: boolean} | null;
  return <main className="admin-page"><a href={`/${locale}/admin`}>← Admin</a><p className="eyebrow">MANAGER SETTINGS</p><h1>Notifications</h1>
    <section className="admin-panel"><h2>Telegram delivery</h2><p>The bot token stays in the server environment. This page only stores the destination and message detail preference.</p>
      {error ? <p className="admin-error">Unable to load settings.</p> : <AdminJsonForm url="/api/admin/settings/telegram" submitLabel="Save notification settings">
        <label className="admin-check"><input name="enabled" type="checkbox" defaultChecked={settings?.enabled}/> Notifications enabled</label>
        <label>Telegram chat ID or channel<input name="chatId" defaultValue={settings?.chatId ?? ''} maxLength={120}/></label>
        <label className="admin-check"><input name="includeCustomerDetails" type="checkbox" defaultChecked={settings?.includeCustomerDetails}/> Include customer contact details in staff messages</label>
      </AdminJsonForm>}
    </section>
  </main>;
}
