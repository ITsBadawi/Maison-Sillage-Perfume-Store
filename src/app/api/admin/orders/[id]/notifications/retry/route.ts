import {NextResponse} from 'next/server';
import {requireAdmin} from '@/features/admin/http.server';
import {isSameOrigin} from '@/lib/security/same-origin';
import {z} from 'zod';

const retrySchema = z.object({force: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((value) => value === true || value === 'true'), reason: z.string().trim().max(250).default('')});

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!isSameOrigin(request)) return NextResponse.json({error: 'INVALID_ORIGIN'}, {status: 403});
  const access = await requireAdmin(['manager', 'orders_manager']);
  if ('response' in access) return access.response;
  const {id} = await params;
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({error: 'INVALID_JSON'}, {status: 400}); }
  const parsed = retrySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({error: 'INVALID_REQUEST'}, {status: 400});
  const {data, error} = await access.supabase.rpc('admin_retry_order_notification', {p_order_id: id, p_force: parsed.data.force, p_reason: parsed.data.reason});
  if (error) return NextResponse.json({error: error.message}, {status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 409});
  return NextResponse.json(data);
}
