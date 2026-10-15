import {z} from 'zod';
import {mutateCart, CheckoutError} from '@/features/checkout/service.server';
import {jsonError, jsonSuccess, readJson} from '@/features/checkout/http.server';

const schema = z.object({variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10)});

export async function PUT(request: Request) {
  try {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new CheckoutError('INVALID_BODY');
    await mutateCart(parsed.data.variantId, parsed.data.quantity);
    return jsonSuccess({updated: true});
  } catch (error) { return jsonError(error); }
}
