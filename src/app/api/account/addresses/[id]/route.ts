import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isSameOrigin} from '@/lib/security/same-origin';

const schema = z.object({recipient_name: z.string().trim().min(2).max(100), phone: z.string().trim().min(8).max(32), city: z.string().trim().min(2).max(80), district: z.string().trim().min(2).max(120), street: z.string().trim().min(5).max(250), landmark: z.string().trim().max(150).default('')});
export async function PUT(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!isSameOrigin(request)) return NextResponse.json({ok: false}, {status: 403});
  const user = await getCurrentUser(); const client = await createSupabaseServerClient();
  if (!user || !client) return NextResponse.json({ok: false}, {status: 401});
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ok: false}, {status: 400});
  const {error} = await client.from('customer_addresses').update(parsed.data).eq('id', (await params).id).eq('user_id', user.id);
  return NextResponse.json({ok: !error}, {status: error ? 503 : 200});
}
export async function DELETE(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!isSameOrigin(request)) return NextResponse.json({ok: false}, {status: 403});
  const user = await getCurrentUser(); const client = await createSupabaseServerClient();
  if (!user || !client) return NextResponse.json({ok: false}, {status: 401});
  const {error} = await client.from('customer_addresses').delete().eq('id', (await params).id).eq('user_id', user.id);
  return NextResponse.json({ok: !error}, {status: error ? 503 : 200});
}
