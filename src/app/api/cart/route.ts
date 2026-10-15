import {getCart} from '@/features/checkout/service.server';
import {jsonError, jsonSuccess} from '@/features/checkout/http.server';

export async function GET() {
  try { return jsonSuccess(await getCart()); } catch (error) { return jsonError(error); }
}
