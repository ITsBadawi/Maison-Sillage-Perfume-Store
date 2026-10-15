import {NextResponse} from 'next/server';
import {requireAdmin} from '@/features/admin/http.server';
import {variantSchema, iqdToMinor} from '@/features/admin/schemas';
import {isSameOrigin} from '@/lib/security/same-origin';

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!isSameOrigin(request)) return NextResponse.json({error: 'INVALID_ORIGIN'}, {status: 403});
  const access = await requireAdmin(['manager', 'inventory_manager']);
  if ('response' in access) return access.response;
  const {id} = await params;
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({error: 'INVALID_JSON'}, {status: 400}); }
  const parsed = variantSchema.safeParse({...raw as object, productId: id});
  if (!parsed.success) return NextResponse.json({error: 'INVALID_VARIANT', fields: parsed.error.flatten().fieldErrors}, {status: 400});
  const v = parsed.data;
  const {data, error} = await access.supabase.rpc('admin_save_variant', {
    p_product_id: id, p_variant_id: v.variantId ?? null, p_expected_product_version: v.expectedProductVersion,
    p_sku: v.sku, p_size_ml: v.sizeMl, p_price_minor: iqdToMinor(v.priceIqd).toString(),
    p_compare_at_minor: v.compareAtIqd === '' || v.compareAtIqd === undefined ? null : iqdToMinor(v.compareAtIqd).toString(),
    p_low_stock_threshold: v.lowStockThreshold, p_active: v.active,
  });
  if (error) return NextResponse.json({error: error.message}, {status: error.code === '42501' ? 403 : 409});
  return NextResponse.json(data, {status: v.variantId ? 200 : 201});
}
