import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isSameOrigin} from '@/lib/security/same-origin';

const schema = z.object({full_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(32).nullable(), preferred_locale: z.enum(['ar', 'en'])});
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ok: false}, {status: 403});
  const user = await getCurrentUser();
  const client = await createSupabaseServerClient();
  if (!user || !client) return NextResponse.json({ok: false}, {status: 401});
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ok: false}, {status: 400});
  const {error} = await client.from('profiles').update(parsed.data).eq('id', user.id);
  return NextResponse.json({ok: !error}, {status: error ? 503 : 200});
}
