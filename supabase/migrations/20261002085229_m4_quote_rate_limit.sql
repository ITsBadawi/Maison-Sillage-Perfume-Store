-- Add an account-level quote limit without changing the atomic quote/pricing implementation.
alter function public.quote_checkout(jsonb, uuid, text) rename to quote_checkout_unlimited;
revoke all on function public.quote_checkout_unlimited(jsonb, uuid, text) from public, anon, authenticated;

create function public.quote_checkout(p_items jsonb, p_shipping_zone_id uuid, p_coupon_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if not private.consume_rate_limit('quote:' || v_user_id::text, 30, 60) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  return public.quote_checkout_unlimited(p_items, p_shipping_zone_id, p_coupon_code);
end;
$$;
revoke all on function public.quote_checkout(jsonb, uuid, text) from public, anon;
grant execute on function public.quote_checkout(jsonb, uuid, text) to authenticated;
