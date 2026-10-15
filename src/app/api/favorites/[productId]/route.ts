import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isSameOrigin} from '@/lib/security/same-origin';

const idSchema = z.uuid();

function error(status: number, code: string) {
  return NextResponse.json({ok: false, error: {code}}, {status});
}

async function mutate(request: NextRequest, rawId: string, operation: 'add' | 'remove') {
  if (!isSameOrigin(request)) return error(403, 'CSRF_REJECTED');
  const user = await getCurrentUser();
  if (!user) return error(401, 'AUTH_REQUIRED');
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return error(400, 'INVALID_PRODUCT_ID');
  const client = await createSupabaseServerClient();
  if (!client) return error(503, 'SERVICE_UNAVAILABLE');

  if (operation === 'add') {
    const {data: product, error: productError} = await client.from('products')
      .select('id').eq('id', parsed.data).eq('status', 'published').maybeSingle();
    if (productError || !product) return error(404, 'PRODUCT_NOT_FOUND');
    const {error: writeError} = await client.from('favorites')
      .insert({user_id: user.id, product_id: parsed.data});
    if (writeError && writeError.code !== '23505') return error(503, 'SAVE_FAILED');
  } else {
    const {error: writeError} = await client.from('favorites')
      .delete().eq('user_id', user.id).eq('product_id', parsed.data);
    if (writeError) return error(503, 'SAVE_FAILED');
  }

  return NextResponse.json({ok: true});
}

export async function PUT(request: NextRequest, {params}: {params: Promise<{productId: string}>}) {
  return mutate(request, (await params).productId, 'add');
}

export async function DELETE(request: NextRequest, {params}: {params: Promise<{productId: string}>}) {
  return mutate(request, (await params).productId, 'remove');
}
