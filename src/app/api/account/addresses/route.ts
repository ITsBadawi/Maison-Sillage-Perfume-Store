import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isSameOrigin} from '@/lib/security/same-origin';

const schema = z.object({recipient_name: z.string().trim().min(2).max(100), phone: z.string().trim().min(8).max(32), city: z.string().trim().min(2).max(80), district: z.string().trim().min(2).max(120), street: z.string().trim().min(5).max(250), landmark: z.string().trim().max(150).default('')});
export async function GET() {
  const user = await getCurrentUser(); const client = await createSupabaseServerClient();
  if (!user || !client) return NextResponse.json({ok: false}, {status: 401});
  const {data, error} = await client.from('customer_addresses').select('id,recipient_name,phone,city,district,street,landmark').eq('user_id', user.id).order('created_at');
  return NextResponse.json({ok: !error, data: data ?? []}, {status: error ? 503 : 200});
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ok: false}, {status: 403});
  const user = await getCurrentUser(); const client = await createSupabaseServerClient();
  if (!user || !client) return NextResponse.json({ok: false}, {status: 401});
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ok: false}, {status: 400});
  const {data, error} = await client.from('customer_addresses').insert({...parsed.data, user_id: user.id}).select('id,recipient_name,phone,city,district,street,landmark').single();
  return NextResponse.json({ok: !error, data}, {status: error ? 503 : 201});
}
