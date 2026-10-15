create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 2 and 100),
  phone text not null check (char_length(phone) between 8 and 32),
  city text not null check (char_length(city) between 2 and 80),
  district text not null check (char_length(district) between 2 and 120),
  street text not null check (char_length(street) between 5 and 250),
  landmark text not null default '' check (char_length(landmark) <= 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_addresses_user_idx on public.customer_addresses(user_id, created_at);
grant select, insert, update, delete on public.customer_addresses to authenticated;
alter table public.customer_addresses enable row level security;
create policy customer_addresses_owner_read on public.customer_addresses for select to authenticated using ((select auth.uid()) = user_id);
create policy customer_addresses_owner_insert on public.customer_addresses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy customer_addresses_owner_update on public.customer_addresses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy customer_addresses_owner_delete on public.customer_addresses for delete to authenticated using ((select auth.uid()) = user_id);
create trigger customer_addresses_set_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();
