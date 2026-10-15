create function public.consume_checkout_ip_limit(p_hmac_ip text, p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if p_endpoint not in ('quote','checkout') or p_hmac_ip !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT_KEY';
  end if;
  v_limit := case when p_endpoint = 'quote' then 30 else 20 end;
  return private.consume_rate_limit('ip:' || p_endpoint || ':' || p_hmac_ip, v_limit, 60);
end;
$$;
revoke all on function public.consume_checkout_ip_limit(text, text) from public, anon;
grant execute on function public.consume_checkout_ip_limit(text, text) to authenticated;
