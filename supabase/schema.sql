create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.app_users(id) on delete set null,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, email)
);

alter table public.app_users alter column id set default gen_random_uuid();
alter table public.company_users drop constraint if exists company_users_user_id_fkey;
alter table public.company_users
  add constraint company_users_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.app_users'::regclass
      and conname = 'app_users_id_fkey'
  ) then
    alter table public.app_users drop constraint app_users_id_fkey;
  end if;
end $$;

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  has_garage boolean not null default false,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  studio_id uuid not null references public.studios(id),
  platform_id uuid not null references public.platforms(id),
  check_in_at timestamptz not null,
  check_out_at timestamptz not null,
  guests_names text not null,
  guests_count integer not null default 1 check (guests_count >= 1),
  reservation_date date,
  nights_count integer not null default 0 check (nights_count >= 0),
  reservation_status text not null check (reservation_status in ('Reservado', 'Autorizado', 'Instruído', 'Em andamento', 'Concluído', 'Cancelado')),
  notes text,
  car_info text,
  total_amount numeric(12,2) not null default 0,
  fees_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2),
  daily_amount numeric(12,2),
  payment_status text not null check (payment_status in ('A receber', 'Recebido')),
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out_at > check_in_at),
  exclude using gist (
    studio_id with =,
    tstzrange(check_in_at, check_out_at, '[)') with &&
  ) where (deleted_at is null)
);

create table if not exists public.expense_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.expense_type_studios (
  expense_type_id uuid not null references public.expense_types(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  primary key (expense_type_id, studio_id)
);

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  studio_id uuid not null references public.studios(id),
  expense_type_id uuid not null references public.expense_types(id),
  payment_status text not null default 'Não pago' check (payment_status in ('Não pago', 'Pago')),
  reference_month date not null,
  amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expense_entries add column if not exists payment_status text not null default 'Não pago';

drop trigger if exists validate_expense_entry_type_studio on public.expense_entries;

update public.expense_entries
set payment_status = case payment_status
  when 'Recebido' then 'Pago'
  when 'A receber' then 'Não pago'
  else payment_status
end
where payment_status in ('A receber', 'Recebido');

alter table public.expense_entries alter column payment_status set default 'Não pago';

do $$
declare
  existing_constraint text;
begin
  select conname
    into existing_constraint
  from pg_constraint
  where conrelid = 'public.expense_entries'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%payment_status in (''A receber'', ''Recebido'')%';

  if existing_constraint is not null then
    execute format('alter table public.expense_entries drop constraint %I', existing_constraint);
  end if;

  begin
    alter table public.expense_entries
      add constraint expense_entries_payment_status_check
      check (payment_status in ('Não pago', 'Pago'));
  exception when duplicate_object then null;
  end;
end $$;

create unique index if not exists expense_entries_unique_by_studio_type_month
  on public.expense_entries(company_id, studio_id, expense_type_id, reference_month);

create or replace function public.validate_expense_entry_type_studio()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.expense_type_studios ets
    where ets.expense_type_id = new.expense_type_id
      and ets.studio_id = new.studio_id
  ) then
    raise exception 'O tipo de despesa não está associado ao studio selecionado.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_expense_entry_type_studio on public.expense_entries;
create trigger validate_expense_entry_type_studio
before insert or update on public.expense_entries
for each row execute function public.validate_expense_entry_type_studio();

create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('entrada', 'saida')),
  entry_date date not null,
  description text not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  body text not null,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_super_admin() cascade;
drop function if exists public.has_company_access(uuid) cascade;
drop function if exists public.is_company_admin(uuid) cascade;

create or replace function public.link_company_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email = lower(new.email);
  select id into new.user_id from public.app_users where lower(email) = new.email limit 1;
  return new;
end;
$$;

drop trigger if exists company_users_link_user on public.company_users;
create trigger company_users_link_user
before insert or update on public.company_users
for each row execute function public.link_company_user();

create or replace function public.expense_types_with_studios(p_company_id uuid)
returns table(id uuid, company_id uuid, name text, active boolean, deleted_at timestamptz, studio_ids uuid[])
language sql
stable
as $$
  select et.id, et.company_id, et.name, et.active, et.deleted_at,
    coalesce(array_agg(ets.studio_id) filter (where ets.studio_id is not null), '{}') as studio_ids
  from public.expense_types et
  left join public.expense_type_studios ets on ets.expense_type_id = et.id
  where et.company_id = p_company_id and et.deleted_at is null
  group by et.id;
$$;

create or replace function public.seed_company_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platforms(company_id, name, color) values
    (new.id, 'Airbnb', '#f8a6c8'),
    (new.id, 'Booking', '#8ed8ff'),
    (new.id, 'Particular', '#d8b8ff')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists seed_company_defaults_after_insert on public.companies;
create trigger seed_company_defaults_after_insert
after insert on public.companies
for each row execute function public.seed_company_defaults();

do $$
declare table_name text;
begin
  foreach table_name in array array['app_users','companies','company_users','studios','platforms','stays','expense_types','expense_type_studios','expense_entries','cash_entries','notes']
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists "users can read own profile" on public.app_users;
drop policy if exists "super admin updates users" on public.app_users;
drop policy if exists "read linked companies" on public.companies;
drop policy if exists "super admin manages companies" on public.companies;
drop policy if exists "company admins read users" on public.company_users;
drop policy if exists "company admins manage users" on public.company_users;
drop policy if exists "company access studios" on public.studios;
drop policy if exists "company admin studios" on public.studios;
drop policy if exists "company admin studios update" on public.studios;
drop policy if exists "company access platforms" on public.platforms;
drop policy if exists "company admin platforms" on public.platforms;
drop policy if exists "company access stays" on public.stays;
drop policy if exists "company access insert stays" on public.stays;
drop policy if exists "company access update stays" on public.stays;
drop policy if exists "company access expense types" on public.expense_types;
drop policy if exists "company admin expense types" on public.expense_types;
drop policy if exists "company access expense type studios" on public.expense_type_studios;
drop policy if exists "company admin expense type studios" on public.expense_type_studios;
drop policy if exists "company access expense entries" on public.expense_entries;
drop policy if exists "company access insert expense entries" on public.expense_entries;
drop policy if exists "company access update expense entries" on public.expense_entries;
drop policy if exists "company access cash entries" on public.cash_entries;
drop policy if exists "company access insert cash entries" on public.cash_entries;
drop policy if exists "company access update cash entries" on public.cash_entries;
drop policy if exists "company access notes" on public.notes;
drop policy if exists "company access insert notes" on public.notes;
drop policy if exists "company access update notes" on public.notes;
drop policy if exists "anon_select_app_users" on public.app_users;
drop policy if exists "anon_insert_app_users" on public.app_users;
drop policy if exists "anon_update_app_users" on public.app_users;
drop policy if exists "anon_select_companies" on public.companies;
drop policy if exists "anon_insert_companies" on public.companies;
drop policy if exists "anon_update_companies" on public.companies;
drop policy if exists "anon_select_company_users" on public.company_users;
drop policy if exists "anon_insert_company_users" on public.company_users;
drop policy if exists "anon_update_company_users" on public.company_users;
drop policy if exists "anon_select_studios" on public.studios;
drop policy if exists "anon_insert_studios" on public.studios;
drop policy if exists "anon_update_studios" on public.studios;
drop policy if exists "anon_select_platforms" on public.platforms;
drop policy if exists "anon_insert_platforms" on public.platforms;
drop policy if exists "anon_update_platforms" on public.platforms;
drop policy if exists "anon_select_stays" on public.stays;
drop policy if exists "anon_insert_stays" on public.stays;
drop policy if exists "anon_update_stays" on public.stays;
drop policy if exists "anon_select_expense_types" on public.expense_types;
drop policy if exists "anon_insert_expense_types" on public.expense_types;
drop policy if exists "anon_update_expense_types" on public.expense_types;
drop policy if exists "anon_select_expense_type_studios" on public.expense_type_studios;
drop policy if exists "anon_insert_expense_type_studios" on public.expense_type_studios;
drop policy if exists "anon_update_expense_type_studios" on public.expense_type_studios;
drop policy if exists "anon_delete_expense_type_studios" on public.expense_type_studios;
drop policy if exists "anon_select_expense_entries" on public.expense_entries;
drop policy if exists "anon_insert_expense_entries" on public.expense_entries;
drop policy if exists "anon_update_expense_entries" on public.expense_entries;
drop policy if exists "anon_delete_expense_entries" on public.expense_entries;
drop policy if exists "anon_select_cash_entries" on public.cash_entries;
drop policy if exists "anon_insert_cash_entries" on public.cash_entries;
drop policy if exists "anon_update_cash_entries" on public.cash_entries;
drop policy if exists "anon_select_notes" on public.notes;
drop policy if exists "anon_insert_notes" on public.notes;
drop policy if exists "anon_update_notes" on public.notes;

create policy "anon_select_app_users" on public.app_users for select to anon using (true);
create policy "anon_insert_app_users" on public.app_users for insert to anon with check (true);
create policy "anon_update_app_users" on public.app_users for update to anon using (true) with check (true);

create policy "anon_select_companies" on public.companies for select to anon using (true);
create policy "anon_insert_companies" on public.companies for insert to anon with check (true);
create policy "anon_update_companies" on public.companies for update to anon using (true) with check (true);

create policy "anon_select_company_users" on public.company_users for select to anon using (true);
create policy "anon_insert_company_users" on public.company_users for insert to anon with check (true);
create policy "anon_update_company_users" on public.company_users for update to anon using (true) with check (true);

create policy "anon_select_studios" on public.studios for select to anon using (true);
create policy "anon_insert_studios" on public.studios for insert to anon with check (true);
create policy "anon_update_studios" on public.studios for update to anon using (true) with check (true);

create policy "anon_select_platforms" on public.platforms for select to anon using (true);
create policy "anon_insert_platforms" on public.platforms for insert to anon with check (true);
create policy "anon_update_platforms" on public.platforms for update to anon using (true) with check (true);

create policy "anon_select_stays" on public.stays for select to anon using (true);
create policy "anon_insert_stays" on public.stays for insert to anon with check (true);
create policy "anon_update_stays" on public.stays for update to anon using (true) with check (true);

create policy "anon_select_expense_types" on public.expense_types for select to anon using (true);
create policy "anon_insert_expense_types" on public.expense_types for insert to anon with check (true);
create policy "anon_update_expense_types" on public.expense_types for update to anon using (true) with check (true);

create policy "anon_select_expense_type_studios" on public.expense_type_studios for select to anon using (true);
create policy "anon_insert_expense_type_studios" on public.expense_type_studios for insert to anon with check (true);
create policy "anon_update_expense_type_studios" on public.expense_type_studios for update to anon using (true) with check (true);
create policy "anon_delete_expense_type_studios" on public.expense_type_studios for delete to anon using (true);

create policy "anon_select_expense_entries" on public.expense_entries for select to anon using (true);
create policy "anon_insert_expense_entries" on public.expense_entries for insert to anon with check (true);
create policy "anon_update_expense_entries" on public.expense_entries for update to anon using (true) with check (true);
create policy "anon_delete_expense_entries" on public.expense_entries for delete to anon using (true);

create policy "anon_select_cash_entries" on public.cash_entries for select to anon using (true);
create policy "anon_insert_cash_entries" on public.cash_entries for insert to anon with check (true);
create policy "anon_update_cash_entries" on public.cash_entries for update to anon using (true) with check (true);

create policy "anon_select_notes" on public.notes for select to anon using (true);
create policy "anon_insert_notes" on public.notes for insert to anon with check (true);
create policy "anon_update_notes" on public.notes for update to anon using (true) with check (true);

drop trigger if exists touch_companies on public.companies;
drop trigger if exists touch_studios on public.studios;
drop trigger if exists touch_stays on public.stays;
drop trigger if exists touch_expense_types on public.expense_types;
drop trigger if exists touch_expense_entries on public.expense_entries;
drop trigger if exists touch_cash_entries on public.cash_entries;
drop trigger if exists touch_notes on public.notes;

create trigger touch_companies before update on public.companies for each row execute function public.touch_updated_at();
create trigger touch_studios before update on public.studios for each row execute function public.touch_updated_at();
create trigger touch_stays before update on public.stays for each row execute function public.touch_updated_at();
create trigger touch_expense_types before update on public.expense_types for each row execute function public.touch_updated_at();
create trigger touch_expense_entries before update on public.expense_entries for each row execute function public.touch_updated_at();
create trigger touch_cash_entries before update on public.cash_entries for each row execute function public.touch_updated_at();
create trigger touch_notes before update on public.notes for each row execute function public.touch_updated_at();

insert into public.companies(name)
values ('Minha Empresa')
on conflict do nothing;

insert into public.studios(company_id, name, has_garage)
select c.id, 'Studio 1', true from public.companies c where c.name = 'Minha Empresa'
on conflict do nothing;

insert into public.studios(company_id, name, has_garage)
select c.id, 'Studio 2', false from public.companies c where c.name = 'Minha Empresa'
on conflict do nothing;

insert into public.company_users(company_id, email, is_admin)
select c.id, 'marcelosr6@gmail.com', true from public.companies c where c.name = 'Minha Empresa'
on conflict do nothing;
