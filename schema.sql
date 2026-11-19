-- E-Certificate schema for Supabase
-- Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- attendees
-- ---------------------------------------------------------------------------
create table if not exists public.attendees (
  id             uuid        primary key default gen_random_uuid(),
  roll_no        text        not null,
  name           text        not null,
  cert_type      text        not null
                 check (cert_type in ('participation', 'appreciation')),
  cert_id        text        not null unique,
  download_count int         not null default 0,
  source         text        not null default 'csv' check (source in ('csv', 'manual')),
  note           text,
  created_at     timestamptz not null default now(),
  constraint attendees_roll_no_cert_type_key unique (roll_no, cert_type)
);

-- ---------------------------------------------------------------------------
-- settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id       boolean primary key default true check (id), -- only one row possible
  released boolean not null default false
);

insert into public.settings (id, released)
values (true, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled, no policies.
-- anon/authenticated roles get no access; the service role bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.attendees enable row level security;
alter table public.settings  enable row level security;

-- ---------------------------------------------------------------------------
-- Atomic download counter (called from the server with the service role)
-- ---------------------------------------------------------------------------
create or replace function public.increment_download_count(attendee_id uuid)
returns void
language sql
set search_path = public
as $$
  update public.attendees
     set download_count = download_count + 1
   where id = attendee_id;
$$;

revoke execute on function public.increment_download_count(uuid) from public, anon, authenticated;
grant  execute on function public.increment_download_count(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Upsert attendees batch for a specific cert_type
-- Only updates name for existing rows, generates cert_id for new rows.
-- Never touches other cert_types.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_attendees(
  p_cert_type text,
  p_rows jsonb
)
returns table (
  inserted_count int,
  updated_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_updated  int := 0;
begin
  with incoming as (
    select
      (elem->>'roll_no')::text as roll_no,
      (elem->>'name')::text    as name
    from jsonb_array_elements(p_rows) as elem
  ),
  upserted as (
    insert into public.attendees (roll_no, name, cert_type, cert_id)
    select
      i.roll_no,
      i.name,
      p_cert_type,
      upper(substr(md5(random()::text || clock_timestamp()::text || i.roll_no), 1, 10))
    from incoming i
    on conflict (roll_no, cert_type)
    do update set
      name = excluded.name
    returning (xmax = 0) as is_insert
  )
  select
    count(*) filter (where is_insert)::int,
    count(*) filter (where not is_insert)::int
  into v_inserted, v_updated
  from upserted;

  return query select v_inserted, v_updated;
end;
$$;

revoke execute on function public.upsert_attendees(text, jsonb) from public, anon, authenticated;
grant  execute on function public.upsert_attendees(text, jsonb) to service_role;

