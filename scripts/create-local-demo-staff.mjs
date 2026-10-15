import {randomBytes} from 'node:crypto';
import {existsSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if ((process.env.APP_ENV && process.env.APP_ENV !== 'local') || !url || !key || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('This script runs only against a configured local Supabase project.');
}

const client = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
const path = resolve('demo-credentials.local.json');
if (existsSync(path)) throw new Error('Demo credential file already exists; keep it or remove it intentionally before recreating accounts.');
const staff = [
  {email: 'manager@demo.maison-sillage.test', role: 'manager', name: 'Demo Manager'},
  {email: 'orders@demo.maison-sillage.test', role: 'orders_manager', name: 'Demo Orders Manager'},
  {email: 'inventory@demo.maison-sillage.test', role: 'inventory_manager', name: 'Demo Inventory Manager'},
];
const credentials = [];
const createdIds = [];

try {
  for (const member of staff) {
    const password = `${randomBytes(20).toString('base64url')}aA1!`;
    const {data, error} = await client.auth.admin.createUser({
      email: member.email, password, email_confirm: true, user_metadata: {full_name: member.name},
    });
    if (error || !data.user) throw new Error(`Could not create ${member.role} demo user: ${error?.message ?? 'no user returned'}`);
    createdIds.push(data.user.id);
    const {error: roleError} = await client.from('staff_roles').insert({user_id: data.user.id, role: member.role, active: true});
    if (roleError) throw new Error(`Could not assign ${member.role}: ${roleError.message}`);
    credentials.push({role: member.role, email: member.email, password});
  }
  writeFileSync(path, JSON.stringify(credentials, null, 2), {encoding: 'utf8', flag: 'wx', mode: 0o600});
} catch (error) {
  for (const id of createdIds) await client.auth.admin.deleteUser(id);
  throw error;
}

process.stdout.write(`Created three local staff accounts. Credentials saved to ${path}\n`);
