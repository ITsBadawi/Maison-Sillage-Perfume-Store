-- Public catalog availability is a boolean. Never expose stock_available counts.
create or replace function public.catalog_availability()
returns table (product_id uuid, in_stock boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         exists (
           select 1
           from public.product_variants v
           where v.product_id = p.id
             and v.active
             and v.stock_available > 0
         ) as in_stock
  from public.products p
  where p.status = 'published'
$$;

revoke all on function public.catalog_availability() from public;
revoke all on function public.catalog_availability() from anon, authenticated;
grant execute on function public.catalog_availability() to anon, authenticated;
