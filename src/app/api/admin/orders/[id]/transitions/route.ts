import {NextResponse} from 'next/server';
import {requireAdmin} from '@/features/admin/http.server';
import {transitionSchema} from '@/features/admin/schemas';
import {isSameOrigin} from '@/lib/security/same-origin';

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!isSameOrigin(request)) return NextResponse.json({error: 'INVALID_ORIGIN'}, {status: 403});
  const access = await requireAdmin(['manager', 'orders_manager']);
  if ('response' in access) return access.response;
  const {id} = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error: 'ORDER_NOT_FOUND'}, {status: 404});
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({error: 'INVALID_JSON'}, {status: 400}); }
  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({error: 'INVALID_TRANSITION', fields: parsed.error.flatten().fieldErrors}, {status: 400});
  const {data, error} = await access.supabase.rpc('admin_transition_order', {
    p_order_id: id, p_to_status: parsed.data.toStatus, p_expected_version: parsed.data.expectedVersion,
    p_reason: parsed.data.reason, p_confirm_cash_collected: parsed.data.confirmCashCollected,
  });
  if (error) return NextResponse.json({error: error.message}, {status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 409});
  return NextResponse.json(data);
}
