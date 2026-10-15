import {NextResponse} from 'next/server';
import {stat} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {requireAdmin} from '@/features/admin/http.server';
import {productSchema} from '@/features/admin/schemas';
import {isSameOrigin} from '@/lib/security/same-origin';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error: 'INVALID_ORIGIN'}, {status: 403});
  const access = await requireAdmin(['manager', 'inventory_manager']);
  if ('response' in access) return access.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({error: 'INVALID_JSON'}, {status: 400}); }
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({error: 'INVALID_PRODUCT', fields: parsed.error.flatten().fieldErrors}, {status: 400});
  const p = parsed.data;
  if (p.imagePath) {
    const localPrefix='assets/products/';
    if (p.imagePath.startsWith(localPrefix)) {
      const publicRoot=resolve(process.cwd(),'public');
      const imageFile=resolve(publicRoot,p.imagePath);
      const relativePath=relative(publicRoot,imageFile);
      if (isAbsolute(relativePath) || relativePath==='..' || relativePath.startsWith(`..${sep}`)) return NextResponse.json({error:'INVALID_IMAGE_PATH'},{status:400});
      try { if (!(await stat(join(publicRoot,relativePath))).isFile()) return NextResponse.json({error:'INVALID_IMAGE_PATH'},{status:400}); }
      catch { return NextResponse.json({error:'INVALID_IMAGE_PATH'},{status:400}); }
    } else if (/^products\/[0-9a-f-]+\.(jpg|png|webp)$/.test(p.imagePath)) {
      const [folder,fileName]=p.imagePath.split('/');
      const {data,error}=await access.supabase.storage.from('catalog-images').list(folder,{search:fileName,limit:2});
      if (error || !data?.some((file)=>file.name===fileName)) return NextResponse.json({error:'INVALID_IMAGE_PATH'},{status:400});
    } else return NextResponse.json({error:'INVALID_IMAGE_PATH'},{status:400});
  }
  const {data, error} = await access.supabase.rpc('admin_save_product', {
    p_product_id: p.productId ?? null, p_expected_version: p.expectedVersion ?? null, p_slug: p.slug, p_brand: p.brand,
    p_name_ar: p.nameAr, p_name_en: p.nameEn, p_short_description_ar: p.shortDescriptionAr,
    p_short_description_en: p.shortDescriptionEn, p_description_ar: p.descriptionAr, p_description_en: p.descriptionEn, p_status: p.status,
    p_category_id:p.categoryId ?? null, p_gender:p.gender, p_family:p.family, p_seasons:p.seasons, p_occasions:p.occasions,
    p_concentration:p.concentration,p_longevity_min:p.longevityHoursMin ?? null,p_longevity_max:p.longevityHoursMax ?? null,p_projection:p.projection ?? null,
    p_featured:p.featured,p_recommendation_enabled:p.recommendationEnabled,p_priority:p.priority,
    p_image_path:p.imagePath,p_image_alt_ar:p.imageAltAr,p_image_alt_en:p.imageAltEn,p_notes:p.notes,p_attributes:p.attributes,
  });
  if (error) return NextResponse.json({error: error.message}, {status: error.code === '42501' ? 403 : 409});
  return NextResponse.json(data, {status: p.productId ? 200 : 201});
}
