import {quoteRequestSchema} from '@/features/checkout/schemas';
import {createQuote, CheckoutError} from '@/features/checkout/service.server';
import {getClientIpDigest, jsonError, jsonSuccess, readJson} from '@/features/checkout/http.server';

export async function POST(request: Request) {
  try {
    const parsed = quoteRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new CheckoutError('INVALID_BODY');
    return jsonSuccess(await createQuote(parsed.data, getClientIpDigest(request)));
  } catch (error) { return jsonError(error); }
}
