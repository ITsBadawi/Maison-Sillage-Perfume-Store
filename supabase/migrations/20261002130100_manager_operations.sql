-- Manager-only operational controls. Every SECURITY DEFINER entry point checks
-- the active database role; route-level checks are only an early rejection.

create or replace function public.admin_list_shipping_zones()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'slug',slug,'nameAr',name_ar,'nameEn',name_en,'feeMinor',fee_minor::text,'active',active) order by slug) from public.shipping_zones),'[]'::jsonb);
end $$;

create or replace function public.admin_get_store_brand()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  return (select jsonb_build_object('nameAr',store_name_ar,'nameEn',store_name_en,'logoPath',coalesce(logo_path,''),'heroImagePath',coalesce(hero_image_path,''),'accentColor',accent_color,'contactPhone',coalesce(contact_phone,'')) from private.store_settings where id=true);
end $$;

create or replace function public.get_public_store_brand()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nameAr',store_name_ar,'nameEn',store_name_en,'accentColor',accent_color,'logoPath',coalesce(logo_path,''),'heroImagePath',coalesce(hero_image_path,''))
  from private.store_settings where id=true;
$$;

create or replace function public.admin_update_store_brand(p_name_ar text,p_name_en text,p_logo_path text,p_hero_image_path text,p_accent_color text,p_contact_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_logo text:=nullif(btrim(coalesce(p_logo_path,'')),''); v_hero text:=nullif(btrim(coalesce(p_hero_image_path,'')),''); v_phone text:=nullif(btrim(coalesce(p_contact_phone,'')),'');
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if length(btrim(p_name_ar)) not between 1 and 120 or length(btrim(p_name_en)) not between 1 and 120 or (p_accent_color !~ '^#[0-9A-Fa-f]{6}$') or length(coalesce(v_logo,''))>500 or length(coalesce(v_hero,''))>500 or length(coalesce(v_phone,''))>32 then raise exception using errcode='22023',message='INVALID_BRAND_SETTINGS'; end if;
  update private.store_settings set store_name_ar=btrim(p_name_ar),store_name_en=btrim(p_name_en),logo_path=v_logo,hero_image_path=v_hero,accent_color=p_accent_color,contact_phone=v_phone where id=true;
  return public.admin_get_store_brand();
end $$;

create or replace function public.admin_save_shipping_zone(p_zone_id uuid,p_slug text,p_name_ar text,p_name_en text,p_fee_minor bigint,p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(btrim(p_name_ar)) not between 1 and 120 or length(btrim(p_name_en)) not between 1 and 120 or p_fee_minor<0 then raise exception using errcode='22023', message='INVALID_SHIPPING_ZONE'; end if;
  if p_zone_id is null then
    insert into public.shipping_zones(slug,name_ar,name_en,fee_minor,active) values(p_slug,btrim(p_name_ar),btrim(p_name_en),p_fee_minor,p_active) returning id into v_id;
  else
    update public.shipping_zones set slug=p_slug,name_ar=btrim(p_name_ar),name_en=btrim(p_name_en),fee_minor=p_fee_minor,active=p_active where id=p_zone_id returning id into v_id;
    if not found then raise exception using errcode='P0002',message='SHIPPING_ZONE_NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_list_staff()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('userId',sr.user_id,'email',u.email,'role',sr.role,'active',sr.active) order by u.email) from public.staff_roles sr join auth.users u on u.id=sr.user_id),'[]'::jsonb);
end $$;

create or replace function public.admin_set_staff_role(p_email text,p_role public.staff_role,p_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid; v_old_role public.staff_role; v_old_active boolean; v_manager_count integer;
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(20261002,130100);
  if length(btrim(p_email)) not between 3 and 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023', message='INVALID_EMAIL'; end if;
  select id into v_user_id from auth.users where lower(email)=lower(btrim(p_email)) and deleted_at is null limit 1;
  if v_user_id is null then raise exception using errcode='P0002', message='USER_NOT_FOUND'; end if;
  select role,active into v_old_role,v_old_active from public.staff_roles where user_id=v_user_id for update;
  if v_old_role='manager' and v_old_active and (p_role<>'manager' or not p_active) then
    select count(*) into v_manager_count from public.staff_roles where role='manager' and active;
    if v_manager_count<=1 then raise exception using errcode='P0001',message='LAST_MANAGER'; end if;
  end if;
  insert into public.staff_roles(user_id,role,active,assigned_by) values(v_user_id,p_role,p_active,auth.uid())
    on conflict(user_id) do update set role=excluded.role,active=excluded.active,assigned_by=excluded.assigned_by;
  insert into private.audit_logs(actor_id,action,entity_type,entity_id,safe_metadata) values(auth.uid(),'staff_role_change','staff',v_user_id,jsonb_build_object('role',p_role,'active',p_active));
  return jsonb_build_object('userId',v_user_id,'role',p_role,'active',p_active);
end $$;

create or replace function public.admin_list_quiz_versions()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'versionNumber',v.version_number,'status',v.status,'publishedAt',v.published_at,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'key',q.key,'titleAr',q.title_ar,'titleEn',q.title_en,'hintAr',q.hint_ar,'hintEn',q.hint_en,'kind',q.kind,'required',q.required,'sortOrder',q.sort_order,'enabled',q.enabled,'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'labelAr',o.label_ar,'labelEn',o.label_en,'sortOrder',o.sort_order,'targetVector',o.target_vector,'dimensionWeights',o.dimension_weights,'filterPayload',o.filter_payload) order by o.sort_order) from public.quiz_options o where o.question_id=q.id),'[]'::jsonb)) order by q.sort_order) from public.quiz_questions q where q.quiz_version_id=v.id),'[]'::jsonb)) order by v.version_number desc) from public.quiz_versions v),'[]'::jsonb);
end $$;

create or replace function public.admin_create_quiz_draft()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer; v_source uuid; q record; o record; v_question_id uuid;
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  select coalesce(max(version_number),0)+1 into v_version from public.quiz_versions;
  insert into public.quiz_versions(version_number,status) values(v_version,'draft') returning id into v_id;
  select id into v_source from public.quiz_versions where status='published' order by version_number desc limit 1;
  if v_source is not null then
    for q in select * from public.quiz_questions where quiz_version_id=v_source order by sort_order loop
      insert into public.quiz_questions(quiz_version_id,key,title_ar,title_en,hint_ar,hint_en,kind,required,sort_order,enabled)
        values(v_id,q.key,q.title_ar,q.title_en,q.hint_ar,q.hint_en,q.kind,q.required,q.sort_order,q.enabled) returning id into v_question_id;
      for o in select * from public.quiz_options where question_id=q.id order by sort_order loop
        insert into public.quiz_options(question_id,label_ar,label_en,image_path,target_vector,dimension_weights,filter_payload,sort_order)
          values(v_question_id,o.label_ar,o.label_en,o.image_path,o.target_vector,o.dimension_weights,o.filter_payload,o.sort_order);
      end loop;
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.admin_save_quiz_question(p_question_id uuid,p_version_id uuid,p_key text,p_title_ar text,p_title_en text,p_hint_ar text,p_hint_en text,p_kind public.quiz_question_kind,p_required boolean,p_sort_order integer,p_enabled boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if length(btrim(p_key)) not between 2 and 80 or p_key !~ '^[a-z0-9_]+$' or length(btrim(p_title_ar)) not between 1 and 240 or length(btrim(p_title_en)) not between 1 and 240 or length(coalesce(p_hint_ar,''))>500 or length(coalesce(p_hint_en,''))>500 or p_sort_order<0 then raise exception using errcode='22023', message='INVALID_QUIZ_QUESTION'; end if;
  if not exists(select 1 from public.quiz_versions where id=p_version_id and status='draft') then raise exception using errcode='P0001',message='QUIZ_VERSION_NOT_DRAFT'; end if;
  if p_question_id is null then
    insert into public.quiz_questions(quiz_version_id,key,title_ar,title_en,hint_ar,hint_en,kind,required,sort_order,enabled) values(p_version_id,p_key,btrim(p_title_ar),btrim(p_title_en),coalesce(p_hint_ar,''),coalesce(p_hint_en,''),p_kind,p_required,p_sort_order,p_enabled) returning id into v_id;
  else
    update public.quiz_questions set key=p_key,title_ar=btrim(p_title_ar),title_en=btrim(p_title_en),hint_ar=coalesce(p_hint_ar,''),hint_en=coalesce(p_hint_en,''),kind=p_kind,required=p_required,sort_order=p_sort_order,enabled=p_enabled where id=p_question_id and quiz_version_id=p_version_id returning id into v_id;
    if not found then raise exception using errcode='P0002',message='QUIZ_QUESTION_NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_save_quiz_option(p_option_id uuid,p_question_id uuid,p_label_ar text,p_label_en text,p_sort_order integer,p_target_vector jsonb,p_dimension_weights jsonb,p_filter_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if length(btrim(p_label_ar)) not between 1 and 160 or length(btrim(p_label_en)) not between 1 and 160 or p_sort_order<0 or jsonb_typeof(p_target_vector)<>'object' or jsonb_typeof(p_dimension_weights)<>'object' or jsonb_typeof(p_filter_payload)<>'object'
     or exists(select 1 from jsonb_each(p_target_vector) e where e.key not in ('woody','floral','fresh','sweet','warm','smoky','bold','calm','classic','modern','day','night') or jsonb_typeof(e.value)<>'number' or (e.value #>> '{}')::numeric not between 0 and 100)
     or exists(select 1 from jsonb_each(p_dimension_weights) e where e.key not in ('woody','floral','fresh','sweet','warm','smoky','bold','calm','classic','modern','day','night') or jsonb_typeof(e.value)<>'number' or (e.value #>> '{}')::numeric<0)
     or (p_filter_payload ? 'maxPriceMinor' and not coalesce((p_filter_payload->>'maxPriceMinor') ~ '^(0|[1-9][0-9]*)$',false))
     or (p_filter_payload ? 'excludedNoteIds' and jsonb_typeof(p_filter_payload->'excludedNoteIds')<>'array')
     or (p_filter_payload ? 'excludedNoteSlugs' and jsonb_typeof(p_filter_payload->'excludedNoteSlugs')<>'array') then raise exception using errcode='22023',message='INVALID_QUIZ_OPTION'; end if;
  if not exists(select 1 from public.quiz_questions q join public.quiz_versions v on v.id=q.quiz_version_id where q.id=p_question_id and v.status='draft') then raise exception using errcode='P0001',message='QUIZ_VERSION_NOT_DRAFT'; end if;
  if p_option_id is null then
    insert into public.quiz_options(question_id,label_ar,label_en,sort_order,target_vector,dimension_weights,filter_payload) values(p_question_id,btrim(p_label_ar),btrim(p_label_en),p_sort_order,p_target_vector,p_dimension_weights,p_filter_payload) returning id into v_id;
  else
    update public.quiz_options set label_ar=btrim(p_label_ar),label_en=btrim(p_label_en),sort_order=p_sort_order,target_vector=p_target_vector,dimension_weights=p_dimension_weights,filter_payload=p_filter_payload where id=p_option_id and question_id=p_question_id returning id into v_id;
    if not found then raise exception using errcode='P0002',message='QUIZ_OPTION_NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_publish_quiz_version(p_version_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if not exists(select 1 from public.quiz_versions where id=p_version_id and status='draft') then raise exception using errcode='P0002',message='QUIZ_DRAFT_NOT_FOUND'; end if;
  if not exists(select 1 from public.quiz_questions q where q.quiz_version_id=p_version_id and q.enabled)
     or exists(select 1 from public.quiz_questions q where q.quiz_version_id=p_version_id and q.enabled and (select count(*) from public.quiz_options o where o.question_id=q.id)<2)
     or (select count(distinct e.key) from public.quiz_questions q join public.quiz_options o on o.question_id=q.id cross join lateral jsonb_each(o.target_vector) e where q.quiz_version_id=p_version_id and q.enabled and q.kind='preference' and jsonb_typeof(e.value)='number' and (e.value #>> '{}')::numeric between 0 and 100 and coalesce((o.dimension_weights->>e.key)::numeric,1)>0)<3 then
    raise exception using errcode='22023',message='QUIZ_NEEDS_OPTIONS_AND_THREE_PREFERENCE_DIMENSIONS';
  end if;
  update public.quiz_versions set status='retired' where status='published';
  update public.quiz_versions set status='published',published_at=now() where id=p_version_id;
end $$;

revoke all on function public.admin_list_shipping_zones(),public.admin_save_shipping_zone(uuid,text,text,text,bigint,boolean),public.admin_get_store_brand(),public.admin_update_store_brand(text,text,text,text,text,text),public.admin_list_staff(),public.admin_set_staff_role(text,public.staff_role,boolean),public.admin_list_quiz_versions(),public.admin_create_quiz_draft(),public.admin_save_quiz_question(uuid,uuid,text,text,text,text,text,public.quiz_question_kind,boolean,integer,boolean),public.admin_save_quiz_option(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb),public.admin_publish_quiz_version(uuid) from public,anon;
grant execute on function public.admin_list_shipping_zones(),public.admin_save_shipping_zone(uuid,text,text,text,bigint,boolean),public.admin_get_store_brand(),public.admin_update_store_brand(text,text,text,text,text,text),public.admin_list_staff(),public.admin_set_staff_role(text,public.staff_role,boolean),public.admin_list_quiz_versions(),public.admin_create_quiz_draft(),public.admin_save_quiz_question(uuid,uuid,text,text,text,text,text,public.quiz_question_kind,boolean,integer,boolean),public.admin_save_quiz_option(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb),public.admin_publish_quiz_version(uuid) to authenticated;
revoke all on function public.get_public_store_brand() from public;
grant execute on function public.get_public_store_brand() to anon,authenticated;
