import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../supabase/server';

/** Verify the access token with Supabase Auth before treating a request as signed in. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

/** Return only active staff roles read from the database for the current request. */
export async function getCurrentStaffRoles(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return [];

  const { data, error } = await supabase
    .from('staff_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('active', true);

  return error ? [] : data.map(({ role }) => role);
}
