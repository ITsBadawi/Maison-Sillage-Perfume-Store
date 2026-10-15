-- Complete product editing while keeping authorization and writes inside role-checked RPCs.
create or replace function public.admin_save_product(
  p_product_id uuid, p_expected_version integer, p_slug text, p_brand text,
  p_name_ar text, p_name_en text, p_short_description_ar text, p_short_description_en text,
  p_description_ar text, p_description_en text, p_status public.product_status,
  p_category_id uuid, p_gender text, p_family text, p_seasons text[], p_occasions text[],
  p_concentration text, p_longevity_min numeric, p_longevity_max numeric, p_projection smallint,
  p_featured boolean, p_recommendation_enabled boolean, p_priority integer,
  p_image_path text, p_image_alt_ar text, p_image_alt_en text, p_notes jsonb, p_attributes jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer; v_note jsonb; v_layer text; v_note_id uuid; v_keys text[] := array[
  'woody','floral','fresh','sweet','warm','smoky','bold','calm','classic','modern','day','night'];
begin
  if not private.has_staff_role(array['manager','inventory_manager']::public.staff_role[]) then
    raise exception using errcode='42501', message='ADMIN_FORBIDDEN';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(btrim(p_brand)) not between 1 and 120
     or length(btrim(p_name_ar)) not between 1 and 160 or length(btrim(p_name_en)) not between 1 and 160
     or length(coalesce(p_short_description_ar,''))>300 or length(coalesce(p_short_description_en,''))>300
     or length(coalesce(p_description_ar,''))>6000 or length(coalesce(p_description_en,''))>6000
     or p_gender not in ('women','men','unisex') or length(coalesce(p_family,''))>80
     or p_seasons && array( select x from unnest(p_seasons) x where x not in ('spring','summer','autumn','winter'))
     or p_occasions && array( select x from unnest(p_occasions) x where x not in ('day','night','office','travel','evening'))
     or (p_longevity_min is not null and p_longevity_min<0) or (p_longevity_max is not null and (p_longevity_max<0 or p_longevity_max<p_longevity_min))
     or (p_projection is not null and p_projection not between 1 and 5)
     or length(coalesce(p_image_path,''))>500 or length(coalesce(p_image_alt_ar,''))>250 or length(coalesce(p_image_alt_en,''))>250
     or (nullif(btrim(coalesce(p_image_path,'')),'') is not null and p_image_path !~ '^assets/products/[A-Za-z0-9._-]+\.svg$' and p_image_path !~ '^products/[0-9a-f-]+\.(jpg|png|webp)$')
     or jsonb_typeof(coalesce(p_notes,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_notes,'[]'::jsonb))>30
     or jsonb_typeof(coalesce(p_attributes,'{}'::jsonb))<>'object' then
    raise exception using errcode='22023', message='INVALID_PRODUCT';
  end if;
  if exists(select 1 from jsonb_each(p_attributes) a where not (a.key=any(v_keys)) or jsonb_typeof(a.value)<>'number' or (a.value::text)::numeric not between 0 and 100) then
    raise exception using errcode='22023', message='INVALID_PRODUCT_ATTRIBUTES';
  end if;
  if p_status='published' and (select count(*) from jsonb_object_keys(p_attributes))<>12 then
    raise exception using errcode='22023', message='PRODUCT_PROFILE_REQUIRED';
  end if;
  if p_status='published' and (length(btrim(coalesce(p_description_ar,'')))=0 or length(btrim(coalesce(p_description_en,'')))=0
      or nullif(btrim(coalesce(p_image_path,'')),'') is null or jsonb_array_length(coalesce(p_notes,'[]'::jsonb))=0
      or not exists(select 1 from public.product_variants v where v.product_id=coalesce(p_product_id,'00000000-0000-0000-0000-000000000000'::uuid) and v.active)) then
    raise exception using errcode='22023', message='PRODUCT_CONTENT_REQUIRED';
  end if;
  if coalesce(p_recommendation_enabled,false) and p_status<>'published' then
    raise exception using errcode='22023', message='RECOMMENDATION_REQUIRES_PUBLISHED_PRODUCT';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_notes,'[]'::jsonb)) n
    where n->>'layer' not in ('top','heart','base') or coalesce(n->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or length(coalesce(n->>'nameAr','')) not between 1 and 100 or length(coalesce(n->>'nameEn','')) not between 1 and 100) then
    raise exception using errcode='22023', message='INVALID_PRODUCT_NOTES';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_notes,'[]'::jsonb)) n)
      <> (select count(distinct (n->>'layer')||':'||(n->>'slug')) from jsonb_array_elements(coalesce(p_notes,'[]'::jsonb)) n) then
    raise exception using errcode='22023', message='DUPLICATE_PRODUCT_NOTES';
  end if;
  if p_product_id is null then
    insert into public.products(slug,brand,name_ar,name_en,short_description_ar,short_description_en,description_ar,description_en,
      status,category_id,gender,family,seasons,occasions,concentration,longevity_hours_min,longevity_hours_max,projection,featured,
      recommendation_enabled,priority)
    values(p_slug,btrim(p_brand),btrim(p_name_ar),btrim(p_name_en),coalesce(p_short_description_ar,''),coalesce(p_short_description_en,''),
      coalesce(p_description_ar,''),coalesce(p_description_en,''),p_status,p_category_id,p_gender,btrim(coalesce(p_family,'')),
      coalesce(p_seasons,'{}'),coalesce(p_occasions,'{}'),btrim(coalesce(p_concentration,'')),p_longevity_min,p_longevity_max,p_projection,
      coalesce(p_featured,false),coalesce(p_recommendation_enabled,false),coalesce(p_priority,0)) returning id,version into v_id,v_version;
  else
    update public.products set slug=p_slug,brand=btrim(p_brand),name_ar=btrim(p_name_ar),name_en=btrim(p_name_en),
      short_description_ar=coalesce(p_short_description_ar,''),short_description_en=coalesce(p_short_description_en,''),
      description_ar=coalesce(p_description_ar,''),description_en=coalesce(p_description_en,''),status=p_status,category_id=p_category_id,
      gender=p_gender,family=btrim(coalesce(p_family,'')),seasons=coalesce(p_seasons,'{}'),occasions=coalesce(p_occasions,'{}'),
      concentration=btrim(coalesce(p_concentration,'')),longevity_hours_min=p_longevity_min,longevity_hours_max=p_longevity_max,
      projection=p_projection,featured=coalesce(p_featured,false),recommendation_enabled=coalesce(p_recommendation_enabled,false),
      priority=coalesce(p_priority,0),version=version+1
      where id=p_product_id and version=p_expected_version and status<>'archived' returning id,version into v_id,v_version;
    if not found then raise exception using errcode='P0001', message='VERSION_CONFLICT_OR_ARCHIVED'; end if;
  end if;
  delete from public.product_notes where product_id=v_id;
  for v_note in select value from jsonb_array_elements(coalesce(p_notes,'[]'::jsonb)) loop
    v_layer:=v_note->>'layer';
    insert into public.fragrance_notes(slug,name_ar,name_en) values(v_note->>'slug',v_note->>'nameAr',v_note->>'nameEn')
      on conflict(slug) do update set name_ar=excluded.name_ar,name_en=excluded.name_en returning id into v_note_id;
    insert into public.product_notes(product_id,note_id,layer) values(v_id,v_note_id,v_layer);
  end loop;
  insert into public.product_attributes(product_id,vector,profile_version) values(v_id,coalesce(p_attributes,'{}'::jsonb),1)
    on conflict(product_id) do update set vector=excluded.vector,profile_version=public.product_attributes.profile_version+1,updated_at=now();
  delete from public.product_images where product_id=v_id;
  if nullif(btrim(coalesce(p_image_path,'')),'') is not null then
    insert into public.product_images(product_id,storage_path,alt_ar,alt_en,sort_order)
      values(v_id,ltrim(btrim(p_image_path),'/'),coalesce(p_image_alt_ar,''),coalesce(p_image_alt_en,''),0);
  end if;
  return jsonb_build_object('id',v_id,'version',v_version);
end $$;

revoke all on function public.admin_save_product(uuid,integer,text,text,text,text,text,text,text,text,public.product_status,uuid,text,text,text[],text[],text,numeric,numeric,smallint,boolean,boolean,integer,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.admin_save_product(uuid,integer,text,text,text,text,text,text,text,text,public.product_status,uuid,text,text,text[],text[],text,numeric,numeric,smallint,boolean,boolean,integer,text,text,text,jsonb,jsonb) to authenticated;

create or replace function public.admin_list_products()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not private.has_staff_role(array['manager','orders_manager','inventory_manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'slug',p.slug,'brand',p.brand,'nameAr',p.name_ar,'nameEn',p.name_en,
    'shortDescriptionAr',p.short_description_ar,'shortDescriptionEn',p.short_description_en,'descriptionAr',p.description_ar,'descriptionEn',p.description_en,
    'status',p.status,'version',p.version,'categoryId',p.category_id,'gender',p.gender,'family',p.family,'seasons',p.seasons,'occasions',p.occasions,
    'concentration',p.concentration,'longevityHoursMin',p.longevity_hours_min,'longevityHoursMax',p.longevity_hours_max,'projection',p.projection,
    'featured',p.featured,'recommendationEnabled',p.recommendation_enabled,'priority',p.priority,
    'imagePath',coalesce((select i.storage_path from public.product_images i where i.product_id=p.id order by i.sort_order limit 1),''),
    'imageAltAr',coalesce((select i.alt_ar from public.product_images i where i.product_id=p.id order by i.sort_order limit 1),''),
    'imageAltEn',coalesce((select i.alt_en from public.product_images i where i.product_id=p.id order by i.sort_order limit 1),''),
    'attributes',coalesce((select a.vector from public.product_attributes a where a.product_id=p.id),'{}'::jsonb),
    'notes',coalesce((select jsonb_agg(jsonb_build_object('layer',n.layer,'slug',f.slug,'nameAr',f.name_ar,'nameEn',f.name_en) order by n.layer,f.slug)
      from public.product_notes n join public.fragrance_notes f on f.id=n.note_id where n.product_id=p.id),'[]'::jsonb),
    'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'sizeMl',v.size_ml,'priceMinor',v.price_minor::text,
       'compareAtMinor',v.compare_at_minor::text,'stockAvailable',v.stock_available,'lowStockThreshold',v.low_stock_threshold,'active',v.active) order by v.size_ml)
       from public.product_variants v where v.product_id=p.id),'[]'::jsonb)
  ) order by p.updated_at desc),'[]'::jsonb) into v_result from public.products p;
  return v_result;
end $$;

create or replace function public.admin_list_categories()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['manager','inventory_manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'slug',slug,'nameAr',name_ar,'nameEn',name_en,'active',active) order by sort_order,name_en) from public.categories),'[]'::jsonb);
end $$;
revoke all on function public.admin_list_categories() from public,anon;
grant execute on function public.admin_list_categories() to authenticated;

create or replace function public.admin_save_category(p_id uuid,p_slug text,p_name_ar text,p_name_en text,p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.has_staff_role(array['manager','inventory_manager']::public.staff_role[]) then raise exception using errcode='42501', message='ADMIN_FORBIDDEN'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(btrim(p_name_ar)) not between 1 and 100 or length(btrim(p_name_en)) not between 1 and 100 then raise exception using errcode='22023',message='INVALID_CATEGORY'; end if;
  if p_id is null then insert into public.categories(slug,name_ar,name_en,active) values(p_slug,btrim(p_name_ar),btrim(p_name_en),p_active) returning id into v_id;
  else update public.categories set slug=p_slug,name_ar=btrim(p_name_ar),name_en=btrim(p_name_en),active=p_active,updated_at=now() where id=p_id returning id into v_id; end if;
  if v_id is null then raise exception using errcode='P0002',message='CATEGORY_NOT_FOUND'; end if;
  return v_id;
end $$;
revoke all on function public.admin_save_category(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.admin_save_category(uuid,text,text,text,boolean) to authenticated;
