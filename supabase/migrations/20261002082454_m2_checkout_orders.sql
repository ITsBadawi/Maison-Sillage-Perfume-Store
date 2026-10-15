-- Atomic COD checkout: quote comparison, idempotency, stock/coupon locks, and all order records.
create or replace function public.quote_checkout(p_items jsonb, p_shipping_zone_id uuid, p_coupon_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_zone public.shipping_zones%rowtype;
  v_coupon public.coupons%rowtype;
  v_item record;
  v_result jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_shipping bigint;
  v_code text := nullif(upper(btrim(p_coupon_code)), '');
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if not coalesce((select email_confirmed_at is not null from auth.users where id = v_user_id), false) then
    raise exception using errcode = '42501', message = 'EMAIL_UNCONFIRMED';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception using errcode = '22023', message = 'INVALID_ITEMS'; end if;
  select * into v_zone from public.shipping_zones where id = p_shipping_zone_id and active;
  if not found then raise exception using errcode = 'P0001', message = 'SHIPPING_ZONE_INVALID'; end if;
  v_shipping := v_zone.fee_minor;
  for v_item in
    select pv.id, pv.price_minor, pv.stock_available, ci.quantity
    from jsonb_to_recordset(p_items) as ci("variantId" uuid, quantity integer)
    join public.product_variants pv on pv.id = ci."variantId" and pv.active
    join public.products p on p.id = pv.product_id and p.status = 'published'
    order by pv.id
  loop
    if v_item.quantity not between 1 and 10 then raise exception using errcode = '22023', message = 'INVALID_QUANTITY'; end if;
    if v_item.stock_available < v_item.quantity then raise exception using errcode = 'P0001', message = 'STOCK_CHANGED'; end if;
    v_subtotal := v_subtotal + v_item.price_minor * v_item.quantity;
    v_result := v_result || jsonb_build_array(jsonb_build_object('variantId', v_item.id, 'quantity', v_item.quantity, 'unitPriceMinor', v_item.price_minor::text));
  end loop;
  if jsonb_array_length(v_result) <> jsonb_array_length(p_items) or
     (select count(distinct x."variantId") from jsonb_to_recordset(p_items) as x("variantId" uuid, quantity integer)) <> jsonb_array_length(p_items) then
    raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
  end if;
  if v_code is not null then
    select * into v_coupon from public.coupons where code_normalized = v_code;
    if not found or not v_coupon.active or now() < v_coupon.starts_at or now() >= v_coupon.expires_at or v_subtotal < v_coupon.min_subtotal_minor then
      raise exception using errcode = 'P0001', message = 'COUPON_INVALID';
    end if;
    if v_coupon.type = 'percent' then
      v_discount := floor(v_subtotal::numeric * v_coupon.value / 100)::bigint;
      if v_coupon.max_discount_minor is not null then v_discount := least(v_discount, v_coupon.max_discount_minor); end if;
    else v_discount := least(v_subtotal, v_coupon.value::bigint); end if;
    if v_coupon.total_limit is not null and (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id and state='used') >= v_coupon.total_limit then raise exception using errcode = 'P0001', message = 'COUPON_LIMIT_REACHED'; end if;
    if v_coupon.per_customer_limit is not null and (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id and user_id=v_user_id and state='used') >= v_coupon.per_customer_limit then raise exception using errcode = 'P0001', message = 'COUPON_LIMIT_REACHED'; end if;
  end if;
  return jsonb_build_object('items', v_result, 'shippingZoneId', p_shipping_zone_id, 'couponCode', v_code,
    'subtotalMinor', v_subtotal::text, 'discountMinor', v_discount::text, 'shippingMinor', v_shipping::text,
    'totalMinor', (v_subtotal-v_discount+v_shipping)::text, 'currencyCode', 'IQD', 'currencyExponent', 3,
    'shippingZone', jsonb_build_object('nameAr',v_zone.name_ar,'nameEn',v_zone.name_en),
    'expiresAt', (now()+interval '5 minutes'));
end;
$$;
revoke all on function public.quote_checkout(jsonb, uuid, text) from public, anon;
grant execute on function public.quote_checkout(jsonb, uuid, text) to authenticated;

create or replace function public.place_order(
  p_idempotency_key uuid,
  p_request_hash text,
  p_items jsonb,
  p_quote jsonb,
  p_address jsonb,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.orders%rowtype;
  v_zone public.shipping_zones%rowtype;
  v_coupon public.coupons%rowtype;
  v_variant record;
  v_order_id uuid;
  v_public_number text;
  v_coupon_id uuid;
  v_code text;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_shipping bigint;
  v_total bigint;
  v_quote_subtotal bigint;
  v_quote_discount bigint;
  v_quote_shipping bigint;
  v_quote_total bigint;
  v_coupon_uses bigint;
  v_customer_uses bigint;
  v_item jsonb;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if not coalesce((select email_confirmed_at is not null from auth.users where id = v_user_id), false) then
    raise exception using errcode = '42501', message = 'EMAIL_UNCONFIRMED';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'INVALID_ITEMS';
  end if;
  if jsonb_typeof(p_address) <> 'object' or char_length(coalesce(p_notes, '')) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;
  if char_length(p_request_hash) <> 64 or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing from public.orders where user_id = v_user_id and idempotency_key = p_idempotency_key::text;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('orderId', v_existing.id, 'publicNumber', v_existing.public_number,
      'totalMinor', v_existing.total_minor::text, 'currency', v_existing.currency_code, 'status', v_existing.status, 'replayed', true);
  end if;

  if (p_quote->>'expiresAt')::timestamptz <= now() then raise exception using errcode = '22023', message = 'QUOTE_EXPIRED'; end if;
  if (p_quote->>'shippingZoneId')::uuid is null then raise exception using errcode = '22023', message = 'INVALID_QUOTE'; end if;
  select * into v_zone from public.shipping_zones where id = (p_quote->>'shippingZoneId')::uuid and active for update;
  if not found then raise exception using errcode = '22023', message = 'SHIPPING_ZONE_INVALID'; end if;
  v_shipping := v_zone.fee_minor;

  -- Lock every requested variant in the same deterministic order before reading its price/stock.
  for v_variant in
    select pv.id, pv.product_id, pv.sku, pv.size_ml, pv.price_minor, pv.stock_available,
           p.name_ar, p.name_en, ci.quantity
    from jsonb_to_recordset(p_items) as ci("variantId" uuid, quantity integer)
    join public.product_variants pv on pv.id = ci."variantId" and pv.active
    join public.products p on p.id = pv.product_id and p.status = 'published'
    order by pv.id
    for update of pv
  loop
    if v_variant.quantity not between 1 and 10 then raise exception using errcode = '22023', message = 'INVALID_QUANTITY'; end if;
    if v_variant.stock_available < v_variant.quantity then raise exception using errcode = 'P0001', message = 'STOCK_CHANGED'; end if;
    v_subtotal := v_subtotal + v_variant.price_minor * v_variant.quantity;
  end loop;
  if (select count(*) from jsonb_to_recordset(p_items) as ci("variantId" uuid, quantity integer)) <>
     (select count(*) from jsonb_to_recordset(p_items) as ci("variantId" uuid, quantity integer) join public.product_variants pv on pv.id = ci."variantId" and pv.active join public.products p on p.id = pv.product_id and p.status = 'published') then
    raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
  end if;
  if (select count(distinct x."variantId") from jsonb_to_recordset(p_items) as x("variantId" uuid, quantity integer)) <>
     jsonb_array_length(p_items) then raise exception using errcode = '22023', message = 'DUPLICATE_VARIANT'; end if;

  v_code := nullif(upper(btrim(p_quote->>'couponCode')), '');
  if v_code is not null then
    select * into v_coupon from public.coupons where code_normalized = v_code for update;
    if not found or not v_coupon.active or now() < v_coupon.starts_at or now() >= v_coupon.expires_at then
      raise exception using errcode = 'P0001', message = 'COUPON_INVALID';
    end if;
    select count(*) into v_coupon_uses from public.coupon_redemptions where coupon_id = v_coupon.id and state = 'used';
    select count(*) into v_customer_uses from public.coupon_redemptions where coupon_id = v_coupon.id and user_id = v_user_id and state = 'used';
    if v_coupon.total_limit is not null and v_coupon_uses >= v_coupon.total_limit then raise exception using errcode = 'P0001', message = 'COUPON_LIMIT_REACHED'; end if;
    if v_coupon.per_customer_limit is not null and v_customer_uses >= v_coupon.per_customer_limit then raise exception using errcode = 'P0001', message = 'COUPON_LIMIT_REACHED'; end if;
    if v_subtotal < v_coupon.min_subtotal_minor then raise exception using errcode = 'P0001', message = 'COUPON_INVALID'; end if;
    if v_coupon.type = 'percent' then
      v_discount := floor(v_subtotal::numeric * v_coupon.value / 100)::bigint;
      if v_coupon.max_discount_minor is not null then v_discount := least(v_discount, v_coupon.max_discount_minor); end if;
    else
      v_discount := least(v_subtotal, v_coupon.value::bigint);
    end if;
    v_coupon_id := v_coupon.id;
  end if;
  v_total := v_subtotal - v_discount + v_shipping;
  v_quote_subtotal := (p_quote->>'subtotalMinor')::bigint;
  v_quote_discount := (p_quote->>'discountMinor')::bigint;
  v_quote_shipping := (p_quote->>'shippingMinor')::bigint;
  v_quote_total := (p_quote->>'totalMinor')::bigint;
  if v_quote_subtotal <> v_subtotal or v_quote_discount <> v_discount or v_quote_shipping <> v_shipping or v_quote_total <> v_total then
    raise exception using errcode = 'P0001', message = 'PRICE_CHANGED';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as ci("variantId" uuid, quantity integer)
    left join jsonb_to_recordset(p_quote->'items') as qi("variantId" uuid, quantity integer, "unitPriceMinor" bigint)
      on qi."variantId" = ci."variantId" and qi.quantity = ci.quantity
    join public.product_variants pv on pv.id = ci."variantId"
    where qi."variantId" is null or qi."unitPriceMinor" <> pv.price_minor
  ) then raise exception using errcode = 'P0001', message = 'PRICE_CHANGED'; end if;

  v_order_id := gen_random_uuid();
  v_public_number := 'MS-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 10));
  insert into public.orders(id, public_number, user_id, recipient_name, phone, address_snapshot, shipping_zone_id,
    subtotal_minor, discount_minor, shipping_minor, total_minor, coupon_id, coupon_snapshot, notes, idempotency_key, request_hash)
  values (v_order_id, v_public_number, v_user_id, p_address->>'recipientName', p_address->>'phone', p_address,
    v_zone.id, v_subtotal, v_discount, v_shipping, v_total, v_coupon_id,
    case when v_coupon_id is null then null else jsonb_build_object('code', v_coupon.code_normalized, 'type', v_coupon.type, 'value', v_coupon.value) end,
    coalesce(p_notes, ''), p_idempotency_key::text, p_request_hash);

  for v_variant in
    select pv.id, pv.product_id, pv.sku, pv.size_ml, pv.price_minor, p.name_ar, p.name_en, ci.quantity
    from jsonb_to_recordset(p_items) as ci("variantId" uuid, quantity integer)
    join public.product_variants pv on pv.id = ci."variantId"
    join public.products p on p.id = pv.product_id
    order by pv.id
  loop
    update public.product_variants set stock_available = stock_available - v_variant.quantity where id = v_variant.id;
    insert into public.order_items(order_id, product_id, variant_id, name_ar_snapshot, name_en_snapshot, sku_snapshot,
      size_ml_snapshot, unit_price_minor, quantity, line_total_minor)
    values (v_order_id, v_variant.product_id, v_variant.id, v_variant.name_ar, v_variant.name_en, v_variant.sku,
      v_variant.size_ml, v_variant.price_minor, v_variant.quantity, v_variant.price_minor * v_variant.quantity);
    insert into public.inventory_movements(variant_id, delta, reason, order_id, event_key)
    values (v_variant.id, -v_variant.quantity, 'order_reserve', v_order_id, 'order:' || v_order_id::text || ':' || v_variant.id::text);
  end loop;
  insert into public.order_status_history(order_id, from_status, to_status, actor_id, reason)
  values (v_order_id, null, 'new', v_user_id, 'Customer placed COD order');
  if v_coupon_id is not null then
    insert into public.coupon_redemptions(coupon_id, order_id, user_id, state) values (v_coupon_id, v_order_id, v_user_id, 'used');
  end if;
  insert into private.notification_outbox(order_id, event_type) values (v_order_id, 'order_created');
  return jsonb_build_object('orderId', v_order_id, 'publicNumber', v_public_number,
    'totalMinor', v_total::text, 'currency', 'IQD', 'status', 'new', 'replayed', false);
end;
$$;

revoke all on function public.place_order(uuid, text, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb, jsonb, jsonb, text) to authenticated;
