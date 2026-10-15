import 'server-only';
import {NextResponse} from 'next/server';
import {getCurrentStaffRoles, getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {hasAnyRole, type StaffRole} from './schemas';

export async function requireAdmin(allowed: readonly StaffRole[]) {
  const [user, roles, supabase] = await Promise.all([getCurrentUser(), getCurrentStaffRoles(), createSupabaseServerClient()]);
  if (!user) return {response: NextResponse.json({error: 'AUTH_REQUIRED'}, {status: 401})} as const;
  if (!hasAnyRole(roles, allowed)) return {response: NextResponse.json({error: 'ADMIN_FORBIDDEN'}, {status: 403})} as const;
  if (!supabase) return {response: NextResponse.json({error: 'SERVICE_UNAVAILABLE'}, {status: 503})} as const;
  return {supabase} as const;
}
