-- Create a dedicated document table for profile and schedule sync so the app
-- no longer needs to overwrite a single profiles.data blob for unrelated
-- settings changes.
--
-- This migration is additive:
-- - existing profiles.data reads remain usable as a fallback
-- - the client can migrate users document-by-document
-- - no existing profile data is deleted

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profile_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_key text not null,
  payload jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, doc_key),
  constraint profile_documents_doc_key_not_blank check (char_length(doc_key) > 0)
);

create index if not exists profile_documents_user_updated_idx
  on public.profile_documents (user_id, updated_at desc);

drop trigger if exists profile_documents_set_updated_at on public.profile_documents;
create trigger profile_documents_set_updated_at
before update on public.profile_documents
for each row
execute function public.set_updated_at();

alter table public.profile_documents enable row level security;

drop policy if exists "Users can read own profile documents" on public.profile_documents;
create policy "Users can read own profile documents"
on public.profile_documents
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile documents" on public.profile_documents;
create policy "Users can insert own profile documents"
on public.profile_documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile documents" on public.profile_documents;
create policy "Users can update own profile documents"
on public.profile_documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own profile documents" on public.profile_documents;
create policy "Users can delete own profile documents"
on public.profile_documents
for delete
using (auth.uid() = user_id);

comment on table public.profile_documents is
  'Per-user settings documents used for fine-grained sync of profile core, schedule, and individual program state.';

comment on column public.profile_documents.doc_key is
  'Logical document key such as profile_core, schedule, or program:<id>.';

comment on column public.profile_documents.client_updated_at is
  'Client-side logical update timestamp used to compare document freshness across devices.';
