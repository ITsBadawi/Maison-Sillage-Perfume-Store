import {getShippingZones} from '@/features/checkout/service.server';
import {jsonError, jsonSuccess} from '@/features/checkout/http.server';

export async function GET() {
  try { return jsonSuccess(await getShippingZones()); } catch (error) { return jsonError(error); }
}
