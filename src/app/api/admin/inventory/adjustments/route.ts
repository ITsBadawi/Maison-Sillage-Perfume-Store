import {NextResponse} from 'next/server';
import {requireAdmin} from '@/features/admin/http.server';
import {adjustmentSchema} from '@/features/admin/schemas';
import {isSameOrigin} from '@/lib/security/same-origin';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error: 'INVALID_ORIGIN'}, {status: 403});
  const access = await requireAdmin(['manager', 'inventory_manager']);
  if ('response' in access) return access.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({error: 'INVALID_JSON'}, {status: 400}); }
  const parsed = adjustmentSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({error: 'INVALID_ADJUSTMENT', fields: parsed.error.flatten().fieldErrors}, {status: 400});
  const {data, error} = await access.supabase.rpc('admin_adjust_inventory', {
    p_variant_id: parsed.data.variantId, p_delta: parsed.data.delta,
    p_reason: parsed.data.reason, p_event_key: parsed.data.eventKey,
  });
  if (error) return NextResponse.json({error: error.message}, {status: error.code === '42501' ? 403 : 409});
  return NextResponse.json({stockAvailable: data});
}
