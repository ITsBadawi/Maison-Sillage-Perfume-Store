import {z} from 'zod';
import {mutateCart, CheckoutError} from '@/features/checkout/service.server';
import {jsonError, jsonSuccess, sameOrigin} from '@/features/checkout/http.server';

export async function DELETE(request: Request, {params}: {params: Promise<{variantId: string}>}) {
  try {
    if (!sameOrigin(request)) throw new CheckoutError('CSRF_REJECTED');
    const {variantId} = await params;
    const validId = z.string().uuid().safeParse(variantId);
    if (!validId.success) throw new CheckoutError('INVALID_BODY');
    await mutateCart(validId.data, null);
    return jsonSuccess({removed: true});
  } catch (error) { return jsonError(error); }
}
