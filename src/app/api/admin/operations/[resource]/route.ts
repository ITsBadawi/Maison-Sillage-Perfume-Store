import {NextResponse} from 'next/server';
import {requireAdmin} from '@/features/admin/http.server';
import {isSameOrigin} from '@/lib/security/same-origin';
import {brandOperationSchema,couponOperationSchema,quizOperationSchema,shippingOperationSchema,staffOperationSchema} from '@/features/admin/operations-schemas';

function parseJson(value: string | undefined) {
  if (!value) return {};
  try { const result: unknown = JSON.parse(value); return result; } catch { return null; }
}

export async function POST(request: Request, {params}: {params: Promise<{resource: string}>}) {
  if (!isSameOrigin(request)) return NextResponse.json({error:'INVALID_ORIGIN'},{status:403});
  const {resource} = await params;
  const access = await requireAdmin(['manager']);
  if ('response' in access) return access.response;
  let raw: unknown; try { raw = await request.json(); } catch { return NextResponse.json({error:'INVALID_JSON'},{status:400}); }
  let data: Record<string, unknown>;
  if (resource === 'coupons' || resource === 'shipping' || resource === 'staff' || resource === 'brand') {
    const schema = resource === 'coupons' ? couponOperationSchema : resource === 'shipping' ? shippingOperationSchema : resource === 'staff' ? staffOperationSchema : brandOperationSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({error:'INVALID_BODY',fields:parsed.error.flatten().fieldErrors},{status:400});
    data = parsed.data as unknown as Record<string, unknown>;
  } else if (resource === 'quiz') {
    const parsed = quizOperationSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({error:'INVALID_BODY',fields:parsed.error.flatten().fieldErrors},{status:400});
    data = parsed.data;
  } else return NextResponse.json({error:'NOT_FOUND'},{status:404});
  const rpc = async (name: string, args?: Record<string, unknown>) => {
    const {data: result,error} = await access.supabase.rpc(name, args);
    if (error) return NextResponse.json({error:error.message},{status:error.code==='42501'?403:400});
    return NextResponse.json(result);
  };
  if (resource === 'coupons') return rpc('admin_save_coupon', {p_coupon_id:data.id,p_code:(data.code as string).toUpperCase(),p_type:data.type,p_value:data.value,p_max_discount_minor:data.maxDiscountMinor,p_min_subtotal_minor:data.minSubtotalMinor,p_starts_at:data.startsAt,p_expires_at:data.expiresAt,p_total_limit:data.totalLimit,p_per_customer_limit:data.perCustomerLimit,p_active:data.active});
  if (resource === 'shipping') return rpc('admin_save_shipping_zone', {p_zone_id:data.id,p_slug:data.slug,p_name_ar:data.nameAr,p_name_en:data.nameEn,p_fee_minor:data.feeMinor,p_active:data.active});
  if (resource === 'staff') return rpc('admin_set_staff_role', {p_email:data.email,p_role:data.role,p_active:data.active});
  if (resource === 'brand') return rpc('admin_update_store_brand',{p_name_ar:data.nameAr,p_name_en:data.nameEn,p_logo_path:data.logoPath,p_hero_image_path:data.heroImagePath,p_accent_color:data.accentColor,p_contact_phone:data.contactPhone});
  const action = data.action;
  if (action === 'draft') return rpc('admin_create_quiz_draft');
  if (action === 'publish') return rpc('admin_publish_quiz_version',{p_version_id:data.versionId});
  if (action === 'question') return rpc('admin_save_quiz_question',{p_question_id:data.questionId,p_version_id:data.versionId,p_key:data.key,p_title_ar:data.titleAr,p_title_en:data.titleEn,p_hint_ar:data.hintAr,p_hint_en:data.hintEn,p_kind:data.kind,p_required:data.required,p_sort_order:data.sortOrder,p_enabled:data.enabled});
  const targetVector=parseJson(data.targetVector as string), dimensionWeights=parseJson(data.dimensionWeights as string), filterPayload=parseJson(data.filterPayload as string);
  if (targetVector===null || dimensionWeights===null || filterPayload===null || typeof targetVector!=='object' || typeof dimensionWeights!=='object' || typeof filterPayload!=='object' || Array.isArray(targetVector) || Array.isArray(dimensionWeights) || Array.isArray(filterPayload)) return NextResponse.json({error:'INVALID_JSON_OBJECT'},{status:400});
  return rpc('admin_save_quiz_option',{p_option_id:data.optionId,p_question_id:data.questionId,p_label_ar:data.labelAr,p_label_en:data.labelEn,p_sort_order:data.sortOrder,p_target_vector:targetVector,p_dimension_weights:dimensionWeights,p_filter_payload:filterPayload});
}
