create or replace function public.claim_order_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chat_id text;
  v_include_details boolean;
  v_result jsonb;
begin
  select ts.chat_id, ts.include_customer_details into v_chat_id, v_include_details
  from private.telegram_settings ts where ts.id = true and ts.enabled = true;
  if v_chat_id is null or v_chat_id = '' then return '[]'::jsonb; end if;

  with picked as (
    select n.id
    from private.notification_outbox n
    where n.event_type = 'order_created'
      and n.attempts < 5
      and ((n.status = 'pending' and n.next_attempt_at <= now())
        or (n.status = 'processing' and n.locked_until <= now()))
    order by n.created_at
    for update skip locked
    limit 20
  ), claimed as (
    update private.notification_outbox n
    set status = 'processing', attempts = n.attempts + 1, locked_until = now() + interval '2 minutes'
    from picked p where n.id = p.id
    returning n.id, n.order_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outbox_id', c.id,
    'chat_id', v_chat_id,
    'include_customer_details', v_include_details,
    'order', jsonb_build_object(
      'id', o.id,
      'public_number', o.public_number,
      'created_at', o.created_at,
      'total_minor', o.total_minor::text,
      'currency_code', o.currency_code,
      'currency_exponent', o.currency_exponent,
      'recipient_name', o.recipient_name,
      'phone', o.phone,
      'address_snapshot', o.address_snapshot,
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'name_en_snapshot', oi.name_en_snapshot, 'name_ar_snapshot', oi.name_ar_snapshot,
        'quantity', oi.quantity, 'line_total_minor', oi.line_total_minor::text
      ) order by oi.id), '[]'::jsonb) from public.order_items oi where oi.order_id = o.id)
    )
  ) order by o.created_at), '[]'::jsonb) into v_result
  from claimed c join public.orders o on o.id = c.order_id;
  return v_result;
end;
$$;

create or replace function public.complete_order_notification(p_id uuid, p_message_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.notification_outbox
  set status = 'sent', telegram_message_id = p_message_id, sent_at = now(), locked_until = null, last_error_code = null
  where id = p_id and status = 'processing';
$$;

create or replace function public.fail_order_notification(
  p_id uuid, p_error_code text, p_retry_after_seconds integer default null, p_permanent boolean default false
)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.notification_outbox
  set status = case when attempts >= 5 or p_permanent then 'failed' else 'pending' end,
      next_attempt_at = now() + make_interval(secs => case
        when p_retry_after_seconds is not null then greatest(1, least(86400, p_retry_after_seconds))
        when attempts = 1 then 60
        when attempts = 2 then 300
        when attempts = 3 then 900
        else 3600 end),
      locked_until = null,
      last_error_code = left(coalesce(nullif(p_error_code,''),'telegram_delivery_failed'),80)
  where id = p_id and status = 'processing';
$$;

revoke all on function public.claim_order_notifications(), public.complete_order_notification(uuid, text), public.fail_order_notification(uuid,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.claim_order_notifications(), public.complete_order_notification(uuid, text), public.fail_order_notification(uuid,text,integer,boolean) to service_role;
