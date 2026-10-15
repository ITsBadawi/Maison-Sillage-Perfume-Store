import {NextResponse} from 'next/server';
import {requireAdmin} from '@/features/admin/http.server';
import {isSameOrigin} from '@/lib/security/same-origin';

const imageTypes = new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);
const maxImageBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error:'INVALID_ORIGIN'},{status:403});
  const access=await requireAdmin(['manager','inventory_manager']);
  if ('response' in access) return access.response;
  let form:FormData;
  try { form=await request.formData(); } catch { return NextResponse.json({error:'INVALID_FORM'},{status:400}); }
  const file=form.get('image');
  if (!(file instanceof File)) return NextResponse.json({error:'IMAGE_REQUIRED'},{status:400});
  const extension=imageTypes.get(file.type);
  if (!extension) return NextResponse.json({error:'IMAGE_TYPE_NOT_ALLOWED'},{status:415});
  if (file.size===0 || file.size>maxImageBytes) return NextResponse.json({error:'IMAGE_SIZE_INVALID'},{status:413});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const validSignature=extension==='jpg'
    ? bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff
    : extension==='png'
      ? bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a
      : bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!validSignature) return NextResponse.json({error:'IMAGE_TYPE_NOT_ALLOWED'},{status:415});
  const path=`products/${crypto.randomUUID()}.${extension}`;
  const content=new Blob([bytes],{type:file.type});
  const {data,error}=await access.supabase.storage.from('catalog-images').upload(path,content,{contentType:file.type,cacheControl:'31536000',upsert:false});
  if (error) return NextResponse.json({error:'IMAGE_UPLOAD_FAILED'},{status:502});
  const {data:{publicUrl}}=access.supabase.storage.from('catalog-images').getPublicUrl(data.path);
  return NextResponse.json({path:data.path,url:publicUrl},{status:201});
}
