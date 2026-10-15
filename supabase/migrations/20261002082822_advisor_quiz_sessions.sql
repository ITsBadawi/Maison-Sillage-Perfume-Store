-- Public quiz seed and narrowly scoped RPCs. Anonymous ownership is a random
-- HttpOnly cookie hash; all writes validate that hash inside the database.
update public.quiz_versions set status='retired' where status='published' and id<>'21000000-0000-4000-8000-000000000001';
insert into public.quiz_versions (id, version_number, status, published_at)
values ('21000000-0000-4000-8000-000000000001', 1, 'published', now())
on conflict (version_number) do nothing;

insert into public.quiz_questions (id, quiz_version_id, key, title_ar, title_en, hint_ar, hint_en, kind, required, sort_order) values
('21000000-0000-4000-8000-000000000101','21000000-0000-4000-8000-000000000001','sanctuary','أي مكان يشبه سكينتك؟','Where do you feel most at ease?','','','preference',true,10),
('21000000-0000-4000-8000-000000000102','21000000-0000-4000-8000-000000000001','memory','أي أثر عطري تود الاحتفاظ به؟','Which scent memory would you keep?','','','preference',true,20),
('21000000-0000-4000-8000-000000000103','21000000-0000-4000-8000-000000000001','presence','كيف تحب أن يعبّر عطرك عن حضورك؟','How should your scent express your presence?','','','preference',true,30),
('21000000-0000-4000-8000-000000000104','21000000-0000-4000-8000-000000000001','sweetness','أي لمسة تلامس ذوقك؟','Which finishing touch appeals to you?','','','preference',true,40),
('21000000-0000-4000-8000-000000000105','21000000-0000-4000-8000-000000000001','style','أي أسلوب أقرب إليك؟','Which style feels closer to you?','','','preference',true,50),
('21000000-0000-4000-8000-000000000106','21000000-0000-4000-8000-000000000001','moment','متى تود أن يرافقك؟','When would you wear it?','','','preference',true,60),
('21000000-0000-4000-8000-000000000107','21000000-0000-4000-8000-000000000001','budget','ما المساحة المناسبة لاختيارك؟','What budget feels comfortable?','','','budget',false,70),
('21000000-0000-4000-8000-000000000108','21000000-0000-4000-8000-000000000001','exclusions','هل هناك نوتة تفضل تجنبها؟','Is there a note you prefer to avoid?','','','exclusions',false,80)
on conflict (quiz_version_id,key) do nothing;

insert into public.quiz_options (id,question_id,label_ar,label_en,target_vector,dimension_weights,filter_payload,sort_order) values
('22000000-0000-4000-8000-000000000101','21000000-0000-4000-8000-000000000101','غابة هادئة','A quiet forest','{"woody":85,"calm":85}','{}','{}',10),
('22000000-0000-4000-8000-000000000102','21000000-0000-4000-8000-000000000101','مكتبة عتيقة','An old library','{"woody":65,"classic":85}','{}','{}',20),
('22000000-0000-4000-8000-000000000103','21000000-0000-4000-8000-000000000101','منزل دافئ','A warm home','{"warm":85,"calm":70}','{}','{}',30),
('22000000-0000-4000-8000-000000000104','21000000-0000-4000-8000-000000000101','لا تفضيل','No preference','{}','{"woody":0,"calm":0,"classic":0,"warm":0}','{}',40),
('22000000-0000-4000-8000-000000000201','21000000-0000-4000-8000-000000000102','أثر المطر','After the rain','{"fresh":90}','{}','{}',10),
('22000000-0000-4000-8000-000000000202','21000000-0000-4000-8000-000000000102','حطب دافئ','Glowing wood','{"smoky":85,"warm":90}','{}','{}',20),
('22000000-0000-4000-8000-000000000203','21000000-0000-4000-8000-000000000102','زهور الربيع','Spring blossoms','{"floral":90}','{}','{}',30),
('22000000-0000-4000-8000-000000000204','21000000-0000-4000-8000-000000000102','نسيم البحر','Sea breeze','{"fresh":85}','{}','{}',40),
('22000000-0000-4000-8000-000000000205','21000000-0000-4000-8000-000000000102','لا تفضيل','No preference','{}','{"fresh":0,"smoky":0,"warm":0,"floral":0}','{}',50),
('22000000-0000-4000-8000-000000000301','21000000-0000-4000-8000-000000000103','همسة هادئة','A quiet whisper','{"bold":20,"calm":90}','{}','{}',10),
('22000000-0000-4000-8000-000000000302','21000000-0000-4000-8000-000000000103','حضور واضح','A distinct presence','{"bold":85}','{}','{}',20),
('22000000-0000-4000-8000-000000000303','21000000-0000-4000-8000-000000000103','توازن أنيق','An elegant balance','{"bold":50,"calm":60}','{}','{}',30),
('22000000-0000-4000-8000-000000000304','21000000-0000-4000-8000-000000000103','لا تفضيل','No preference','{}','{"bold":0,"calm":0}','{}',40),
('22000000-0000-4000-8000-000000000401','21000000-0000-4000-8000-000000000104','جافة ونقية','Dry and clean','{"sweet":15,"fresh":65}','{}','{}',10),
('22000000-0000-4000-8000-000000000402','21000000-0000-4000-8000-000000000104','حلاوة رقيقة','Gentle sweetness','{"sweet":50}','{}','{}',20),
('22000000-0000-4000-8000-000000000403','21000000-0000-4000-8000-000000000104','حلاوة غنية','Rich sweetness','{"sweet":90}','{}','{}',30),
('22000000-0000-4000-8000-000000000404','21000000-0000-4000-8000-000000000104','لا تفضيل','No preference','{}','{"sweet":0,"fresh":0}','{}',40),
('22000000-0000-4000-8000-000000000501','21000000-0000-4000-8000-000000000105','أناقة كلاسيكية','Timeless elegance','{"classic":90,"modern":20}','{}','{}',10),
('22000000-0000-4000-8000-000000000502','21000000-0000-4000-8000-000000000105','طابع معاصر','Contemporary character','{"classic":20,"modern":90}','{}','{}',20),
('22000000-0000-4000-8000-000000000503','21000000-0000-4000-8000-000000000105','مزيج متوازن','A balanced blend','{"classic":55,"modern":55}','{}','{}',30),
('22000000-0000-4000-8000-000000000504','21000000-0000-4000-8000-000000000105','لا تفضيل','No preference','{}','{"classic":0,"modern":0}','{}',40),
('22000000-0000-4000-8000-000000000601','21000000-0000-4000-8000-000000000106','صباح هادئ','A calm morning','{"day":90,"night":20}','{}','{}',10),
('22000000-0000-4000-8000-000000000602','21000000-0000-4000-8000-000000000106','مساء مميز','A special evening','{"day":20,"night":90}','{}','{}',20),
('22000000-0000-4000-8000-000000000603','21000000-0000-4000-8000-000000000106','طوال اليوم','Throughout the day','{"day":60,"night":60}','{}','{}',30),
('22000000-0000-4000-8000-000000000604','21000000-0000-4000-8000-000000000106','لا تفضيل','No preference','{}','{"day":0,"night":0}','{}',40),
('22000000-0000-4000-8000-000000000701','21000000-0000-4000-8000-000000000107','حتى 75,000','Up to IQD 75,000','{}','{}','{"maxPriceMinor":75000000}',10),
('22000000-0000-4000-8000-000000000702','21000000-0000-4000-8000-000000000107','حتى 150,000','Up to IQD 150,000','{}','{}','{"maxPriceMinor":150000000}',20),
('22000000-0000-4000-8000-000000000703','21000000-0000-4000-8000-000000000107','بلا حد','No limit','{}','{}','{}',30),
('22000000-0000-4000-8000-000000000801','21000000-0000-4000-8000-000000000108','لا شيء','None','{}','{}','{}',10),
('22000000-0000-4000-8000-000000000802','21000000-0000-4000-8000-000000000108','العود','Oud','{}','{}','{"excludedNoteSlugs":["oud"]}',20),
('22000000-0000-4000-8000-000000000803','21000000-0000-4000-8000-000000000108','الورد','Rose','{}','{}','{"excludedNoteSlugs":["rose"]}',30),
('22000000-0000-4000-8000-000000000804','21000000-0000-4000-8000-000000000108','الدخان','Smoke','{}','{}','{"excludedNoteSlugs":["smoke"]}',40)
on conflict (id) do nothing;

create or replace function public.advisor_create_session(p_user_id uuid, p_token_hash text, p_version_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (p_user_id is null) = (p_token_hash is null) then raise exception 'invalid owner'; end if;
  if not exists (select 1 from public.quiz_versions where id=p_version_id and status='published') then raise exception 'quiz unavailable'; end if;
  insert into public.quiz_sessions(user_id,anonymous_token_hash,quiz_version_id,expires_at)
  values(p_user_id,p_token_hash,p_version_id,now()+case when p_user_id is null then interval '24 hours' else interval '90 days' end) returning id into v_id;
  return v_id;
end $$;

create or replace function public.advisor_session_owned(p_session_id uuid,p_user_id uuid,p_token_hash text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.quiz_sessions s where s.id=p_session_id and s.expires_at>now() and
    ((p_user_id is not null and s.user_id=p_user_id) or
     (p_token_hash is not null and s.anonymous_token_hash=p_token_hash)));
$$;

create or replace function public.advisor_save_answers(p_session_id uuid,p_user_id uuid,p_token_hash text,p_answers jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)>30 then raise exception 'invalid answers'; end if;
  if not public.advisor_session_owned(p_session_id,p_user_id,p_token_hash) then raise exception 'not owned'; end if;
  if exists(select 1 from public.quiz_sessions where id=p_session_id and completed_at is not null) then raise exception 'session completed'; end if;
  if exists(select 1 from jsonb_array_elements(p_answers) x group by x->>'questionId' having count(*)>1) then raise exception 'duplicate question'; end if;
  if exists(select 1 from jsonb_array_elements(p_answers) x where not exists (
    select 1 from public.quiz_options o join public.quiz_questions q on q.id=o.question_id join public.quiz_sessions s on s.quiz_version_id=q.quiz_version_id
    where s.id=p_session_id and q.id=(x->>'questionId')::uuid and o.id=(x->>'optionId')::uuid and q.enabled)) then raise exception 'invalid option'; end if;
  delete from public.quiz_answers where session_id=p_session_id;
  insert into public.quiz_answers(session_id,question_id,option_id)
  select p_session_id,(x->>'questionId')::uuid,(x->>'optionId')::uuid from jsonb_array_elements(p_answers) x;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.advisor_mark_completed(p_session_id uuid,p_user_id uuid,p_token_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.advisor_session_owned(p_session_id,p_user_id,p_token_hash) then raise exception 'not owned'; end if;
  update public.quiz_sessions set completed_at=coalesce(completed_at,now()) where id=p_session_id and expires_at>now();
  return found;
end $$;

create or replace function public.advisor_catalog_candidates(p_excluded_note_ids uuid[] default '{}')
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'status',p.status,'recommendation_enabled',p.recommendation_enabled,'priority',p.priority,'name_ar',p.name_ar,'name_en',p.name_en,
    'primary_image',case when im.id is null then null else jsonb_build_object('altAr',im.alt_ar,'altEn',im.alt_en) end,
    'short_description_ar',p.short_description_ar,'short_description_en',p.short_description_en,
    'notes_ar',coalesce((select jsonb_agg(n.name_ar order by n.slug) from public.product_notes pn join public.fragrance_notes n on n.id=pn.note_id where pn.product_id=p.id),'[]'::jsonb),
    'notes_en',coalesce((select jsonb_agg(n.name_en order by n.slug) from public.product_notes pn join public.fragrance_notes n on n.id=pn.note_id where pn.product_id=p.id),'[]'::jsonb),
    'note_slugs',coalesce((select jsonb_agg(n.slug order by n.slug) from public.product_notes pn join public.fragrance_notes n on n.id=pn.note_id where pn.product_id=p.id),'[]'::jsonb),
    'attributes',pa.vector,'note_ids',coalesce((select jsonb_agg(pn.note_id) from public.product_notes pn where pn.product_id=p.id),'[]'::jsonb),
    'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'active',v.active,'stockAvailable',v.stock_available,'priceMinor',v.price_minor::text)) from public.product_variants v where v.product_id=p.id),'[]'::jsonb)
  )), '[]'::jsonb)
  from public.products p join public.product_attributes pa on pa.product_id=p.id
  left join lateral (select i.id,i.alt_ar,i.alt_en from public.product_images i where i.product_id=p.id order by i.sort_order limit 1) im on true
  where p.status='published' and p.recommendation_enabled and im.id is not null
    and not exists(select 1 from public.product_notes pn where pn.product_id=p.id and pn.note_id=any(coalesce(p_excluded_note_ids,'{}'::uuid[])));
$$;

create or replace function public.advisor_save_recommendation(p_session_id uuid,p_user_id uuid,p_token_hash text,p_locale text,p_profile_snapshot jsonb,p_algorithm_version text,p_catalog_snapshot_hash text,p_explanation_source text,p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_locale not in ('ar','en') or p_explanation_source not in ('gemini','fallback') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>3 then raise exception 'invalid recommendation'; end if;
  if not public.advisor_session_owned(p_session_id,p_user_id,p_token_hash) then raise exception 'invalid session'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where not exists(
    select 1 from public.products p join public.product_variants v on v.product_id=p.id
    where p.id=(x->>'product_id')::uuid and p.status='published' and p.recommendation_enabled and v.id=(x->>'variant_id')::uuid and v.active and v.stock_available>0)) then raise exception 'unavailable item'; end if;
  insert into public.recommendations(session_id,profile_snapshot,algorithm_version,catalog_snapshot_hash,locale,explanation_source,explanation_status,expires_at)
  values(p_session_id,p_profile_snapshot,p_algorithm_version,p_catalog_snapshot_hash,p_locale,p_explanation_source,'complete',now()+case when p_user_id is null then interval '24 hours' else interval '90 days' end) returning id into v_id;
  insert into public.recommendation_items(recommendation_id,product_id,variant_id,rank,score,product_profile_snapshot,explanation)
  select v_id,(x->>'product_id')::uuid,(x->>'variant_id')::uuid,(x->>'rank')::smallint,(x->>'score')::numeric,x->'product_profile_snapshot',x->>'explanation' from jsonb_array_elements(p_items) x;
  update public.quiz_sessions set completed_at=coalesce(completed_at,now()) where id=p_session_id;
  return v_id;
end $$;

create or replace function public.advisor_read_result(p_recommendation_id uuid,p_user_id uuid,p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',r.id,'profile',r.profile_snapshot,'explanationSource',r.explanation_source,'explanationStatus',r.explanation_status,
    'items',coalesce(jsonb_agg(jsonb_build_object('productId',p.id,'variantId',v.id,'slug',p.slug,'nameAr',p.name_ar,'nameEn',p.name_en,'imagePath',im.storage_path,'score',ri.score,'explanation',ri.explanation,'available',(v.active and v.stock_available>0),'priceMinor',v.price_minor::text) order by ri.rank) filter(where ri.product_id is not null),'[]'::jsonb))
  from public.recommendations r join public.quiz_sessions s on s.id=r.session_id
  left join public.recommendation_items ri on ri.recommendation_id=r.id
  left join public.products p on p.id=ri.product_id left join public.product_variants v on v.id=ri.variant_id
  left join lateral(select i.storage_path from public.product_images i where i.product_id=p.id order by i.sort_order limit 1) im on true
  where r.id=p_recommendation_id and r.expires_at>now() and
    ((p_user_id is not null and s.user_id=p_user_id) or (p_token_hash is not null and s.anonymous_token_hash=p_token_hash))
  group by r.id;
$$;

revoke all on function public.advisor_create_session(uuid,text,uuid) from public;
revoke all on function public.advisor_session_owned(uuid,uuid,text) from public;
revoke all on function public.advisor_save_answers(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.advisor_mark_completed(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.advisor_catalog_candidates(uuid[]) from public;
revoke all on function public.advisor_save_recommendation(uuid,uuid,text,text,jsonb,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.advisor_read_result(uuid,uuid,text) from public;
revoke all on function public.advisor_create_session(uuid,text,uuid), public.advisor_session_owned(uuid,uuid,text), public.advisor_catalog_candidates(uuid[]), public.advisor_read_result(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.advisor_create_session(uuid,text,uuid), public.advisor_session_owned(uuid,uuid,text), public.advisor_save_answers(uuid,uuid,text,jsonb), public.advisor_mark_completed(uuid,uuid,text), public.advisor_catalog_candidates(uuid[]), public.advisor_save_recommendation(uuid,uuid,text,text,jsonb,text,text,text,jsonb), public.advisor_read_result(uuid,uuid,text) to service_role;
