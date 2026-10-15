-- Defense in depth for direct PostgREST calls and account-level order rate limiting.
create or replace function private.consume_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limit_buckets(bucket_key, window_start, count, expires_at)
  values (p_bucket_key, v_window, 1, v_window + make_interval(secs => p_window_seconds * 2))
  on conflict(bucket_key, window_start) do update set count = private.rate_limit_buckets.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function private.consume_rate_limit(text, integer, integer) from public, anon, authenticated;

create or replace function private.validate_customer_order_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if char_length(btrim(new.recipient_name)) not between 2 and 100
     or new.phone !~ '^\+[1-9][0-9]{7,14}$'
     or char_length(btrim(coalesce(new.address_snapshot->>'city',''))) not between 2 and 80
     or char_length(btrim(coalesce(new.address_snapshot->>'district',''))) not between 2 and 120
     or char_length(btrim(coalesce(new.address_snapshot->>'street',''))) not between 5 and 250
     or char_length(coalesce(new.address_snapshot->>'landmark','')) > 150
     or char_length(new.notes) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;
  if not private.consume_rate_limit('order:' || new.user_id::text, 5, 60) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_customer_order_insert() from public, anon, authenticated;
create trigger orders_validate_customer_insert before insert on public.orders
  for each row execute function private.validate_customer_order_insert();
