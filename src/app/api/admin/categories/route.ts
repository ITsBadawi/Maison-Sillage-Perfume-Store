import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAdmin} from '@/features/admin/http.server';
import {isSameOrigin} from '@/lib/security/same-origin';

const categorySchema = z.object({id:z.union([z.string().uuid(),z.literal('')]).optional(),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),nameAr:z.string().trim().min(1).max(100),nameEn:z.string().trim().min(1).max(100),active:z.boolean().default(true)});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error:'INVALID_ORIGIN'},{status:403});
  const access=await requireAdmin(['manager','inventory_manager']);
  if ('response' in access) return access.response;
  let body:unknown;
  try { body=await request.json(); } catch { return NextResponse.json({error:'INVALID_JSON'},{status:400}); }
  const parsed=categorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({error:'INVALID_CATEGORY',fields:parsed.error.flatten().fieldErrors},{status:400});
  const c=parsed.data;
  const {data,error}=await access.supabase.rpc('admin_save_category',{p_id:c.id || null,p_slug:c.slug,p_name_ar:c.nameAr,p_name_en:c.nameEn,p_active:c.active});
  if (error) return NextResponse.json({error:error.message},{status:error.code==='42501'?403:409});
  return NextResponse.json({id:data},{status:200});
}
