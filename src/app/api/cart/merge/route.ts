import {checkoutItemsSchema} from '@/features/checkout/schemas';
import {mergeGuestCart, CheckoutError} from '@/features/checkout/service.server';
import {jsonError, jsonSuccess, readJson} from '@/features/checkout/http.server';

export async function POST(request: Request) {
  try {
    const input = checkoutItemsSchema.safeParse(await readJson(request));
    if (!input.success) throw new CheckoutError('INVALID_BODY');
    return jsonSuccess(await mergeGuestCart(input.data));
  } catch (error) { return jsonError(error); }
}
