import {z} from 'zod';
import {getOrder, CheckoutError} from '@/features/checkout/service.server';
import {jsonError, jsonSuccess} from '@/features/checkout/http.server';

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    const validId = z.string().uuid().safeParse(id);
    if (!validId.success) throw new CheckoutError('ORDER_NOT_FOUND');
    return jsonSuccess(await getOrder(validId.data));
  } catch (error) { return jsonError(error); }
}
