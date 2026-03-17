create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  filename text not null,
  storage_path text not null unique,
  signed_storage_path text,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.documents(id) on delete cascade,
  signer_id uuid not null,
  page_number integer not null,
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  image_storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references public.documents(id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute procedure public.set_updated_at();

alter table public.documents enable row level security;
alter table public.signatures enable row level security;
alter table public.audit_logs enable row level security;

-- Adjust claims mapping if your auth schema differs.
create policy "documents_owner_access"
on public.documents
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "signatures_owner_access"
on public.signatures
for all
using (signer_id = auth.uid())
with check (signer_id = auth.uid());

create policy "audit_owner_access"
on public.audit_logs
for all
using (actor_id = auth.uid())
with check (actor_id = auth.uid());