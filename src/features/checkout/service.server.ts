import 'server-only';

import {createHmac, createHash, timingSafeEqual} from 'node:crypto';
import {getServerEnv} from '@/lib/env.server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import type {CheckoutItems, PlaceOrderInput} from './schemas';

export class CheckoutError extends Error {
  constructor(public readonly code: string) { super(code); }
}

const databaseBusinessCodes = new Set([
  'AUTH_REQUIRED','EMAIL_UNCONFIRMED','INVALID_ITEMS','INVALID_ADDRESS','INVALID_IDEMPOTENCY',
  'IDEMPOTENCY_CONFLICT','QUOTE_EXPIRED','INVALID_QUOTE','SHIPPING_ZONE_INVALID','INVALID_QUANTITY',
  'STOCK_CHANGED','PRODUCT_UNAVAILABLE','DUPLICATE_VARIANT','COUPON_INVALID','COUPON_LIMIT_REACHED','PRICE_CHANGED','RATE_LIMITED',
]);
function rpcError(error: {message: string; code?: string}) {
  if (databaseBusinessCodes.has(error.message)) return new CheckoutError(error.message);
  if (error.code === '23505') return new CheckoutError('IDEMPOTENCY_CONFLICT');
  if (error.code === '28000') return new CheckoutError('AUTH_REQUIRED');
  if (error.code === '42501') return new CheckoutError('EMAIL_UNCONFIRMED');
  return new CheckoutError('CHECKOUT_UNAVAILABLE');
}

type QuotePayload = {
  userId: string;
  items: Array<{variantId: string; quantity: number; unitPriceMinor: string}>;
  shippingZoneId: string;
  couponCode: string | null;
  subtotalMinor: string;
  discountMinor: string;
  shippingMinor: string;
  totalMinor: string;
  currencyCode: string;
  currencyExponent: number;
  shippingZone: {nameAr: string; nameEn: string};
  expiresAt: string;
};

function quoteSecret(): string {
  const secret = getServerEnv().QUOTE_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new CheckoutError('CHECKOUT_UNAVAILABLE');
  return secret;
}

function sign(payload: QuotePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', quoteSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verify(token: string): QuotePayload {
  const [body, supplied, extra] = token.split('.');
  if (!body || !supplied || extra) throw new CheckoutError('QUOTE_INVALID');
  const expected = createHmac('sha256', quoteSecret()).update(body).digest();
  let actual: Buffer;
  try { actual = Buffer.from(supplied, 'base64url'); } catch { throw new CheckoutError('QUOTE_INVALID'); }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new CheckoutError('QUOTE_INVALID');
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as QuotePayload; }
  catch { throw new CheckoutError('QUOTE_INVALID'); }
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sortedItems(items: CheckoutItems) {
  return [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new CheckoutError('CHECKOUT_UNAVAILABLE');
  const {data, error} = await supabase.auth.getUser();
  if (error || !data.user) throw new CheckoutError('AUTH_REQUIRED');
  if (!data.user.email_confirmed_at) throw new CheckoutError('EMAIL_UNCONFIRMED');
  return {supabase, user: data.user};
}

async function enforceIpLimit(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, digest: string, endpoint: 'quote'|'checkout') {
  const {data, error} = await supabase.rpc('consume_checkout_ip_limit', {p_hmac_ip: digest, p_endpoint: endpoint});
  if (error) throw rpcError(error);
  if (data !== true) throw new CheckoutError('RATE_LIMITED');
}

export async function createQuote(input: {items: CheckoutItems; shippingZoneId: string; couponCode?: string}, ipDigest: string) {
  const {supabase, user} = await authenticatedClient();
  await enforceIpLimit(supabase, ipDigest, 'quote');
  const {data, error} = await supabase.rpc('quote_checkout', {
    p_items: sortedItems(input.items),
    p_shipping_zone_id: input.shippingZoneId,
    p_coupon_code: input.couponCode?.trim().toUpperCase() || null,
  });
  if (error) throw rpcError(error);
  const payload = {...data as Omit<QuotePayload, 'userId'>, userId: user.id};
  return {quote: payload, quoteHash: sign(payload)};
}

export async function getShippingZones() {
  const {supabase} = await authenticatedClient();
  const {data, error} = await supabase.from('shipping_zones').select('id,name_ar,name_en,fee_minor').eq('active', true).order('name_en');
  if (error) throw new CheckoutError('CHECKOUT_UNAVAILABLE');
  return data;
}

export async function placeOrder(input: PlaceOrderInput, idempotencyKey: string, ipDigest: string) {
  const {supabase, user} = await authenticatedClient();
  const normalized = {...input, items: sortedItems(input.items), couponCode: input.couponCode?.trim().toUpperCase() || null};
  const requestHash = canonicalHash({items: normalized.items, shippingZoneId: input.shippingZoneId,
    couponCode: normalized.couponCode, address: input.address, notes: input.notes, quoteHash: input.quoteHash});

  // Recover a completed operation before evaluating quote expiry, as required for safe retries.
  const {data: existing, error: lookupError} = await supabase.from('orders').select('id,public_number,total_minor,currency_code,status,request_hash')
    .eq('user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (lookupError) throw new CheckoutError('CHECKOUT_UNAVAILABLE');
  if (existing) {
    if (existing.request_hash !== requestHash) throw new CheckoutError('IDEMPOTENCY_CONFLICT');
    return {orderId: existing.id, publicNumber: existing.public_number, totalMinor: String(existing.total_minor), currency: existing.currency_code, status: existing.status, replayed: true};
  }

  const quote = verify(input.quoteHash);
  if (quote.userId !== user.id || quote.shippingZoneId !== input.shippingZoneId || quote.couponCode !== normalized.couponCode ||
      canonicalHash(quote.items.map(({variantId, quantity}) => ({variantId, quantity}))) !== canonicalHash(normalized.items)) {
    throw new CheckoutError('QUOTE_INVALID');
  }
  if (Date.parse(quote.expiresAt) <= Date.now()) throw new CheckoutError('QUOTE_EXPIRED');
  await enforceIpLimit(supabase, ipDigest, 'checkout');

  const addressSnapshot = {...input.address, landmark: input.address.landmark || ''};
  const {data, error} = await supabase.rpc('place_order', {
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_items: normalized.items,
    p_quote: quote,
    p_address: addressSnapshot,
    p_notes: input.notes || '',
  });
  if (error) throw rpcError(error);
  return data as {orderId: string; publicNumber: string; totalMinor: string; currency: string; status: string; replayed: boolean};
}

export async function getCart() {
  const {supabase, user} = await authenticatedClient();
  const {data: cart, error: cartError} = await supabase.from('carts').select('id').eq('user_id', user.id).maybeSingle();
  if (cartError) throw new CheckoutError('CART_UNAVAILABLE');
  if (!cart) return {items: []};
  const {data: items, error} = await supabase.from('cart_items').select('variant_id,quantity').eq('cart_id', cart.id);
  if (error) throw new CheckoutError('CART_UNAVAILABLE');
  if (!items?.length) return {items: []};
  const {data: variants, error: variantError} = await supabase.from('product_variants')
    .select('id,product_id,size_ml,price_minor,active,products!inner(name_ar,name_en,brand,status,product_images(storage_path,alt_ar,alt_en,sort_order))')
    .in('id', items.map((item) => item.variant_id)).eq('active', true);
  if (variantError) throw new CheckoutError('CART_UNAVAILABLE');
  const byId = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  return {items: items.flatMap((item) => {
    const variant = byId.get(item.variant_id);
    const product = variant?.products as unknown as {name_ar: string; name_en: string; brand: string; status: string; product_images: Array<{storage_path: string; alt_ar: string; alt_en: string; sort_order: number}>} | undefined;
    if (!variant || product?.status !== 'published') return [];
    const images = product.product_images;
    return [{variantId: variant.id, quantity: item.quantity, unitPriceMinor: String(variant.price_minor), sizeMl: variant.size_ml,
      product: {nameAr: product.name_ar, nameEn: product.name_en, brand: product.brand}, image: images?.sort((a, b) => a.sort_order-b.sort_order)[0] ?? null}];
  })};
}

export async function mutateCart(variantId: string, quantity: number | null) {
  const {supabase, user} = await authenticatedClient();
  const cartResult = await supabase.from('carts').select('id').eq('user_id', user.id).maybeSingle();
  if (cartResult.error) throw new CheckoutError('CART_UNAVAILABLE');
  let cart = cartResult.data;
  if (!cart && quantity !== null) {
    const created = await supabase.from('carts').insert({user_id: user.id}).select('id').single();
    if (created.error) throw new CheckoutError('CART_UNAVAILABLE');
    cart = created.data;
  }
  if (!cart) return;
  if (quantity === null) {
    const result = await supabase.from('cart_items').delete().eq('cart_id', cart.id).eq('variant_id', variantId);
    if (result.error) throw new CheckoutError('CART_UNAVAILABLE');
    return;
  }
  const check = await supabase.from('product_variants').select('id,active,products!inner(status)').eq('id', variantId).eq('active', true).eq('products.status', 'published').maybeSingle();
  if (check.error || !check.data) throw new CheckoutError('PRODUCT_UNAVAILABLE');
  const result = await supabase.from('cart_items').upsert({cart_id: cart.id, variant_id: variantId, quantity}, {onConflict: 'cart_id,variant_id'});
  if (result.error) throw new CheckoutError('CART_UNAVAILABLE');
}

export async function resolveGuestCart(items: CheckoutItems) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new CheckoutError('CART_UNAVAILABLE');
  const ids = items.map((item) => item.variantId);
  const {data: variants, error} = await supabase.from('product_variants')
    .select('id,product_id,size_ml,price_minor,active,products!inner(name_ar,name_en,brand,status,product_images(storage_path,alt_ar,alt_en,sort_order))')
    .in('id', ids).eq('active', true);
  if (error) throw new CheckoutError('CART_UNAVAILABLE');
  const byId = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  return {items: items.flatMap((item) => {
    const variant = byId.get(item.variantId);
    const product = variant?.products as unknown as {name_ar: string; name_en: string; brand: string; status: string; product_images: Array<{storage_path: string; alt_ar: string; alt_en: string; sort_order: number}>} | undefined;
    if (!variant || product?.status !== 'published') return [];
    const images = product.product_images;
    return [{variantId: variant.id, quantity: item.quantity, unitPriceMinor: String(variant.price_minor), sizeMl: variant.size_ml,
      product: {nameAr: product.name_ar, nameEn: product.name_en, brand: product.brand}, image: images?.sort((a, b) => a.sort_order-b.sort_order)[0] ?? null}];
  })};
}

export async function mergeGuestCart(items: CheckoutItems) {
  const {supabase, user} = await authenticatedClient();
  const current = await getCart();
  const currentQuantities = new Map(current.items.map((item) => [item.variantId, item.quantity]));
  const validGuest = await resolveGuestCart(items);
  const validIds = new Set(validGuest.items.map((item) => item.variantId));
  const merged = new Map<string, number>(current.items.map((item) => [item.variantId, item.quantity]));
  let adjusted = false;
  for (const item of items) {
    if (!validIds.has(item.variantId)) { adjusted = true; continue; }
    if (merged.has(item.variantId)) {
      const quantity = merged.get(item.variantId) ?? 0;
      if (quantity + item.quantity > 10) adjusted = true;
      merged.set(item.variantId, Math.min(10, quantity + item.quantity));
    } else if (merged.size < 20) merged.set(item.variantId, item.quantity);
    else adjusted = true;
  }
  const cartResult = await supabase.from('carts').select('id').eq('user_id', user.id).maybeSingle();
  if (cartResult.error) throw new CheckoutError('CART_UNAVAILABLE');
  let cart = cartResult.data;
  if (!cart) {
    const created = await supabase.from('carts').insert({user_id: user.id}).select('id').single();
    if (created.error) throw new CheckoutError('CART_UNAVAILABLE');
    cart = created.data;
  }
  for (const [variantId, quantity] of merged) {
    if (currentQuantities.get(variantId) === quantity) continue;
    const result = await supabase.from('cart_items').upsert({cart_id: cart.id, variant_id: variantId, quantity}, {onConflict: 'cart_id,variant_id'});
    if (result.error) throw new CheckoutError('CART_UNAVAILABLE');
  }
  return {cart: await getCart(), adjusted};
}

export async function listOrders() {
  const {supabase, user} = await authenticatedClient();
  const {data, error} = await supabase.from('orders').select('id,public_number,status,total_minor,currency_code,created_at')
    .eq('user_id', user.id).order('created_at', {ascending: false}).limit(50);
  if (error) throw new CheckoutError('ORDERS_UNAVAILABLE');
  return data;
}

export async function getOrder(id: string) {
  const {supabase, user} = await authenticatedClient();
  const {data, error} = await supabase.from('orders').select('id,public_number,status,cod_status,payment_method,recipient_name,phone,address_snapshot,shipping_zone_id,currency_code,currency_exponent,subtotal_minor,discount_minor,shipping_minor,total_minor,coupon_snapshot,notes,created_at')
    .eq('id', id).eq('user_id', user.id).maybeSingle();
  if (error) throw new CheckoutError('ORDERS_UNAVAILABLE');
  if (!data) throw new CheckoutError('ORDER_NOT_FOUND');
  const [items, history] = await Promise.all([
    supabase.from('order_items').select('name_ar_snapshot,name_en_snapshot,sku_snapshot,size_ml_snapshot,unit_price_minor,quantity,line_total_minor').eq('order_id', id),
    supabase.from('order_status_history').select('from_status,to_status,reason,created_at').eq('order_id', id).order('created_at'),
  ]);
  if (items.error || history.error) throw new CheckoutError('ORDERS_UNAVAILABLE');
  return {...data, items: items.data, history: history.data};
}
