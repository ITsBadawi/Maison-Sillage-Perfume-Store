-- Transactional admin operations. Roles are always derived from auth.uid().
create policy products_admin_read on public.products for select to authenticated
  using (private.has_staff_role(array['manager','orders_manager','inventory_manager']::public.staff_role[]));
create policy orders_admin_read on public.orders for select to authenticated
  using (private.has_staff_role(array['manager','orders_manager']::public.staff_role[]));
create policy items_admin_read on public.order_items for select to authenticated
  using (private.has_staff_role(array['manager','orders_manager']::public.staff_role[]));
create policy history_admin_read on public.order_status_history for select to authenticated
  using (private.has_staff_role(array['manager','orders_manager']::public.staff_role[]));

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid, p_delta integer, p_reason text, p_event_key text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_stock integer; v_existing public.inventory_movements%rowtype;
begin
  if not private.has_staff_role(array['manager','inventory_manager']::public.staff_role[]) then
    raise exception using errcode='42501', message='ADMIN_FORBIDDEN';
  end if;
  if p_delta=0 or length(btrim(p_reason)) not between 3 and 250 or length(p_event_key) not between 8 and 120 then
    raise exception using errcode='22023', message='INVALID_ADJUSTMENT';
  end if;
  select * into v_existing from public.inventory_movements where event_key=p_event_key;
  if found then
    if v_existing.variant_id<>p_variant_id or v_existing.delta<>p_delta or v_existing.reason<>'manual_adjustment' then
      raise exception using errcode='P0001', message='EVENT_KEY_CONFLICT';
    end if;
    select stock_available into v_stock from public.product_variants where id=p_variant_id;
    return v_stock;
  end if;
  select stock_available into v_stock from public.product_variants where id=p_variant_id for update;
  if not found then raise exception using errcode='P0002', message='VARIANT_NOT_FOUND'; end if;
  if v_stock+p_delta<0 then raise exception using errcode='P0001', message='STOCK_WOULD_BE_NEGATIVE'; end if;
  update public.product_variants set stock_available=v_stock+p_delta where id=p_variant_id returning stock_available into v_stock;
  insert into public.inventory_movements(variant_id,delta,reason,actor_id,event_key)
    values(p_variant_id,p_delta,'manual_adjustment',auth.uid(),p_event_key);
  return v_stock;
end $$;

create or replace function public.admin_transition_order(
  p_order_id uuid, p_to_status public.order_status, p_expected_version integer,
  p_reason text default '', p_confirm_cash_collected boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_item record; v_valid boolean := false;
begin
  if not private.has_staff_role(array['manager','orders_manager']::public.staff_role[]) then
    raise exception using errcode='42501', message='ADMIN_FORBIDDEN';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception using errcode='P0002', message='ORDER_NOT_FOUND'; end if;
  if v_order.version<>p_expected_version then raise exception using errcode='P0001', message='VERSION_CONFLICT'; end if;
  v_valid := (v_order.status='new' and p_to_status='confirmed')
    or (v_order.status='confirmed' and p_to_status='preparing')
    or (v_order.status='preparing' and p_to_status='shipped')
    or (v_order.status='shipped' and p_to_status='delivered' and p_confirm_cash_collected);
  if p_to_status='cancelled' and v_order.status in ('new','confirmed','preparing') and length(btrim(coalesce(p_reason,'')))>0 then v_valid:=true; end if;
  if p_to_status='returned' and v_order.status='shipped' and length(btrim(coalesce(p_reason,'')))>0 then v_valid:=true; end if;
  if not v_valid then raise exception using errcode='P0001', message='INVALID_ORDER_TRANSITION'; end if;
  if p_to_status='cancelled' then
    for v_item in select variant_id,quantity from public.order_items where order_id=p_order_id order by variant_id loop
      update public.product_variants set stock_available=stock_available+v_item.quantity where id=v_item.variant_id;
      insert into public.inventory_movements(variant_id,delta,reason,order_id,actor_id,event_key)
        values(v_item.variant_id,v_item.quantity,'cancel_release',p_order_id,auth.uid(),
          'cancel:'||p_order_id::text||':'||v_item.variant_id::text);
    end loop;
    update public.coupon_redemptions set state='released' where order_id=p_order_id and state='used';
  end if;
  update public.orders set status=p_to_status,
    cod_status=case when p_to_status in ('cancelled','returned') then 'not_due'::public.cod_status
                    when p_to_status='delivered' then 'collected'::public.cod_status else cod_status end,
    collected_at=case when p_to_status='delivered' then now() else collected_at end,
    collected_by=case when p_to_status='delivered' then auth.uid() else collected_by end,
    version=version+1
    where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,reason)
    values(p_order_id,v_order.status,p_to_status,auth.uid(),coalesce(p_reason,''));
  return jsonb_build_object('id',p_order_id,'status',p_to_status,'version',v_order.version+1);
end $$;

revoke all on function public.admin_adjust_inventory(uuid,integer,text,text) from public,anon;
revoke all on function public.admin_transition_order(uuid,public.order_status,integer,text,boolean) from public,anon;
grant execute on function public.admin_adjust_inventory(uuid,integer,text,text) to authenticated;
grant execute on function public.admin_transition_order(uuid,public.order_status,integer,text,boolean) to authenticated;

create or replace function public.admin_save_product(
  p_product_id uuid, p_expected_version integer, p_slug text, p_brand text,
  p_name_ar text, p_name_en text, p_short_description_ar text, p_short_description_en text,
  p_description_ar text, p_description_en text, p_status public.product_status
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  if not private.has_staff_role(array['manager','inventory_manager']::public.staff_role[]) then
    raise exception using errcode='42501', message='ADMIN_FORBIDDEN';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_brand) not between 1 and 120
     or length(p_name_ar) not between 1 and 160 or length(p_name_en) not between 1 and 160
     or length(coalesce(p_short_description_ar,''))>300 or length(coalesce(p_short_description_en,''))>300
     or length(coalesce(p_description_ar,''))>6000 or length(coalesce(p_description_en,''))>6000 then
    raise exception using errcode='22023', message='INVALID_PRODUCT';
  end if;
  if p_product_id is null then
    insert into public.products(slug,brand,name_ar,name_en,short_description_ar,short_description_en,description_ar,description_en,status)
      values(p_slug,btrim(p_brand),btrim(p_name_ar),btrim(p_name_en),coalesce(p_short_description_ar,''),coalesce(p_short_description_en,''),coalesce(p_description_ar,''),coalesce(p_description_en,''),p_status)
      returning id,version into v_id,v_version;
  else
    update public.products set slug=p_slug,brand=btrim(p_brand),name_ar=btrim(p_name_ar),name_en=btrim(p_name_en),
      short_description_ar=coalesce(p_short_description_ar,''),short_description_en=coalesce(p_short_description_en,''),
      description_ar=coalesce(p_description_ar,''),description_en=coalesce(p_description_en,''),status=p_status,version=version+1
      where id=p_product_id and version=p_expected_version and status<>'archived'
      returning id,version into v_id,v_version;
    if not found then raise exception using errcode='P0001', message='VERSION_CONFLICT_OR_ARCHIVED'; end if;
  end if;
  return jsonb_build_object('id',v_id,'version',v_version);
end $$;

create or replace function public.admin_save_variant(
  p_product_id uuid, p_variant_id uuid, p_expected_product_version integer,
  p_sku text, p_size_ml numeric, p_price_minor bigint, p_compare_at_minor bigint,
  p_low_stock_threshold integer, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  if not private.has_staff_role(array['manager','inventory_manager']::public.staff_role[]) then
    raise exception using errcode='42501', message='ADMIN_FORBIDDEN';
  end if;
  if length(btrim(p_sku)) not between 1 and 80 or p_size_ml<=0 or p_price_minor<0
     or (p_compare_at_minor is not null and p_compare_at_minor<p_price_minor)
     or p_low_stock_threshold<0 then raise exception using errcode='22023', message='INVALID_VARIANT'; end if;
  update public.products set version=version+1 where id=p_product_id and version=p_expected_product_version and status<>'archived' returning version into v_version;
  if not found then raise exception using errcode='P0001', message='VERSION_CONFLICT_OR_ARCHIVED'; end if;
  if p_variant_id is null then
    insert into public.product_variants(product_id,sku,size_ml,price_minor,compare_at_minor,low_stock_threshold,active,stock_available)
      values(p_product_id,btrim(p_sku),p_size_ml,p_price_minor,p_compare_at_minor,p_low_stock_threshold,p_active,0) returning id into v_id;
  else
    update public.product_variants set sku=btrim(p_sku),size_ml=p_size_ml,price_minor=p_price_minor,
      compare_at_minor=p_compare_at_minor,low_stock_threshold=p_low_stock_threshold,active=p_active
      where id=p_variant_id and product_id=p_product_id returning id into v_id;
    if not found then raise exception using errcode='P0002', message='VARIANT_NOT_FOUND'; end if;
  end if;
  return jsonb_build_object('id',v_id,'productVersion',v_version);
end $$;

create or replace function public.admin_archive_product(p_product_id uuid, p_reason text, p_expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_version integer;
begin
  if not private.has_staff_role(array['manager','inventory_manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 3 and 250 then raise exception using errcode='22023', message='REASON_REQUIRED'; end if;
  update public.products set status='archived',version=version+1 where id=p_product_id and version=p_expected_version and status<>'archived' returning version into v_version;
  if not found then raise exception using errcode='P0001', message='VERSION_CONFLICT_OR_ARCHIVED'; end if;
  insert into private.audit_logs(actor_id,action,entity_type,entity_id,safe_metadata)
    values(auth.uid(),'archive','product',p_product_id,jsonb_build_object('reason',left(btrim(p_reason),250)));
  return v_version;
end $$;

revoke all on function public.admin_save_product(uuid,integer,text,text,text,text,text,text,text,text,public.product_status) from public,anon;
revoke all on function public.admin_save_variant(uuid,uuid,integer,text,numeric,bigint,bigint,integer,boolean) from public,anon;
revoke all on function public.admin_archive_product(uuid,text,integer) from public,anon;
grant execute on function public.admin_save_product(uuid,integer,text,text,text,text,text,text,text,text,public.product_status) to authenticated;
grant execute on function public.admin_save_variant(uuid,uuid,integer,text,numeric,bigint,bigint,integer,boolean) to authenticated;
grant execute on function public.admin_archive_product(uuid,text,integer) to authenticated;

create or replace function public.admin_list_products()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not private.has_staff_role(array['manager','orders_manager','inventory_manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'slug',p.slug,'brand',p.brand,'nameAr',p.name_ar,'nameEn',p.name_en,
    'shortDescriptionAr',p.short_description_ar,'shortDescriptionEn',p.short_description_en,
    'descriptionAr',p.description_ar,'descriptionEn',p.description_en,'status',p.status,'version',p.version,
    'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'sizeMl',v.size_ml,'priceMinor',v.price_minor::text,
       'compareAtMinor',v.compare_at_minor::text,'stockAvailable',v.stock_available,'lowStockThreshold',v.low_stock_threshold,'active',v.active) order by v.size_ml)
       from public.product_variants v where v.product_id=p.id),'[]'::jsonb)
  ) order by p.updated_at desc),'[]'::jsonb) into v_result from public.products p;
  return v_result;
end $$;

create or replace function public.admin_order_notification_status(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_status jsonb;
begin
  if not private.has_staff_role(array['manager','orders_manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  select jsonb_build_object('status',n.status,'attempts',n.attempts,'nextAttemptAt',n.next_attempt_at,
    'lastErrorCode',n.last_error_code,'sentAt',n.sent_at)
  into v_status from private.notification_outbox n where n.order_id=p_order_id and n.event_type='order_created';
  return v_status;
end $$;

create or replace function public.admin_retry_order_notification(
  p_order_id uuid, p_force boolean default false, p_reason text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.notification_outbox%rowtype; v_actor uuid := auth.uid();
begin
  if not private.has_staff_role(array['manager','orders_manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  select * into v_row from private.notification_outbox where order_id=p_order_id and event_type='order_created' for update;
  if not found then raise exception using errcode='P0002', message='NOTIFICATION_NOT_FOUND'; end if;
  if v_row.status='processing' then raise exception using errcode='P0001', message='NOTIFICATION_PROCESSING'; end if;
  if v_row.status='sent' and (not p_force or length(btrim(coalesce(p_reason,'')))<3) then
    raise exception using errcode='P0001', message='FORCE_AND_REASON_REQUIRED';
  end if;
  if v_row.status not in ('pending','failed','sent') then raise exception using errcode='P0001', message='NOTIFICATION_NOT_RETRYABLE'; end if;
  update private.notification_outbox set status='pending',attempts=0,next_attempt_at=now(),locked_until=null,
    last_error_code=null,sent_at=null,telegram_message_id=null where id=v_row.id;
  insert into private.audit_logs(actor_id,action,entity_type,entity_id,safe_metadata)
    values(v_actor,'notification_retry','order',p_order_id,jsonb_build_object('previousStatus',v_row.status,'reason',left(btrim(coalesce(p_reason,'')),250)));
  return jsonb_build_object('status','pending');
end $$;

revoke all on function public.admin_order_notification_status(uuid) from public,anon;
revoke all on function public.admin_retry_order_notification(uuid,boolean,text) from public,anon;
grant execute on function public.admin_order_notification_status(uuid), public.admin_retry_order_notification(uuid,boolean,text) to authenticated;
revoke all on function public.admin_list_products() from public,anon;
grant execute on function public.admin_list_products() to authenticated;

create or replace function public.admin_get_telegram_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  select jsonb_build_object('enabled',enabled,'chatId',coalesce(chat_id,''),'includeCustomerDetails',include_customer_details)
    into v_result from private.telegram_settings where id=true;
  return coalesce(v_result,'{}'::jsonb);
end $$;

create or replace function public.admin_update_telegram_settings(p_enabled boolean,p_chat_id text,p_include_customer_details boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_chat text := nullif(btrim(coalesce(p_chat_id,'')),'');
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if v_chat is not null and length(v_chat)>120 then raise exception using errcode='22023', message='INVALID_CHAT_ID'; end if;
  update private.telegram_settings set enabled=p_enabled,chat_id=v_chat,include_customer_details=p_include_customer_details where id=true;
  return public.admin_get_telegram_settings();
end $$;

revoke all on function public.admin_get_telegram_settings(), public.admin_update_telegram_settings(boolean,text,boolean) from public,anon;
grant execute on function public.admin_get_telegram_settings(), public.admin_update_telegram_settings(boolean,text,boolean) to authenticated;

create or replace function public.admin_list_coupons()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code_normalized,'type',c.type,'value',c.value,
    'maxDiscountMinor',c.max_discount_minor::text,'minSubtotalMinor',c.min_subtotal_minor::text,'startsAt',c.starts_at,'expiresAt',c.expires_at,
    'totalLimit',c.total_limit,'perCustomerLimit',c.per_customer_limit,'active',c.active,
    'usedCount',(select count(*) from public.coupon_redemptions r where r.coupon_id=c.id and r.state='used')) order by c.created_at desc),'[]'::jsonb)
    into v_result from public.coupons c;
  return v_result;
end $$;

create or replace function public.admin_save_coupon(
  p_coupon_id uuid,p_code text,p_type public.coupon_type,p_value integer,p_max_discount_minor bigint,
  p_min_subtotal_minor bigint,p_starts_at timestamptz,p_expires_at timestamptz,
  p_total_limit integer,p_per_customer_limit integer,p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text := upper(btrim(p_code));
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if v_code !~ '^[A-Z0-9_-]{3,40}$' or p_value<=0 or p_min_subtotal_minor<0 or p_starts_at>=p_expires_at
     or (p_type='percent' and p_value>100) or (p_max_discount_minor is not null and p_max_discount_minor<=0)
     or (p_total_limit is not null and p_total_limit<=0) or (p_per_customer_limit is not null and p_per_customer_limit<=0) then
    raise exception using errcode='22023', message='INVALID_COUPON';
  end if;
  if p_coupon_id is null then
    insert into public.coupons(code_normalized,type,value,max_discount_minor,min_subtotal_minor,starts_at,expires_at,total_limit,per_customer_limit,active)
      values(v_code,p_type,p_value,p_max_discount_minor,p_min_subtotal_minor,p_starts_at,p_expires_at,p_total_limit,p_per_customer_limit,p_active) returning id into v_id;
  else
    update public.coupons set code_normalized=v_code,type=p_type,value=p_value,max_discount_minor=p_max_discount_minor,
      min_subtotal_minor=p_min_subtotal_minor,starts_at=p_starts_at,expires_at=p_expires_at,total_limit=p_total_limit,
      per_customer_limit=p_per_customer_limit,active=p_active where id=p_coupon_id returning id into v_id;
    if not found then raise exception using errcode='P0002', message='COUPON_NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

revoke all on function public.admin_list_coupons() from public,anon;
revoke all on function public.admin_save_coupon(uuid,text,public.coupon_type,integer,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean) from public,anon;
grant execute on function public.admin_list_coupons(),public.admin_save_coupon(uuid,text,public.coupon_type,integer,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean) to authenticated;
