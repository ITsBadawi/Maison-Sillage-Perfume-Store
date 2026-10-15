-- Local bootstrap only: create the user's Auth account first, then replace the
-- UUID below with that account's auth.users.id and run this as local postgres.
-- This is deliberately a one-off operator script, never an RPC or public API.
do $$
declare
  first_manager_id constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  perform pg_advisory_xact_lock(hashtextextended('maison-sillage:first-manager', 0));

  if exists (
    select 1 from public.staff_roles
    where role = 'manager' and active
  ) then
    raise exception 'An active manager already exists; bootstrap is closed.';
  end if;

  if not exists (select 1 from auth.users where id = first_manager_id) then
    raise exception 'The selected Auth user does not exist; create the account first and set its UUID.';
  end if;

  if not exists (select 1 from public.profiles where id = first_manager_id) then
    raise exception 'The profile trigger did not create a profile for this user.';
  end if;

  insert into public.staff_roles (user_id, role, active, assigned_by)
  values (first_manager_id, 'manager', true, null)
  on conflict (user_id) do update
    set role = 'manager', active = true, assigned_by = null, updated_at = now();
end;
$$;
