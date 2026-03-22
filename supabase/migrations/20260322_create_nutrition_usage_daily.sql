-- Track per-user Nutrition Coach usage so the backend can enforce daily caps
-- before sending paid model requests upstream.

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

create table if not exists public.nutrition_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0,
  photo_request_count integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  last_request_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, usage_date),
  constraint nutrition_usage_daily_request_count_nonnegative
    check (request_count >= 0),
  constraint nutrition_usage_daily_photo_request_count_nonnegative
    check (photo_request_count >= 0),
  constraint nutrition_usage_daily_input_tokens_nonnegative
    check (input_tokens >= 0),
  constraint nutrition_usage_daily_output_tokens_nonnegative
    check (output_tokens >= 0)
);

create index if not exists nutrition_usage_daily_last_request_idx
  on public.nutrition_usage_daily (user_id, usage_date desc, last_request_at desc);

drop trigger if exists nutrition_usage_daily_set_updated_at on public.nutrition_usage_daily;
create trigger nutrition_usage_daily_set_updated_at
before update on public.nutrition_usage_daily
for each row
execute function public.set_updated_at();

alter table public.nutrition_usage_daily enable row level security;

revoke all on public.nutrition_usage_daily from anon, authenticated;

create or replace function public.claim_nutrition_usage_quota(
  p_user_id uuid,
  p_usage_date date,
  p_is_photo boolean default false,
  p_max_requests integer default 25,
  p_max_photo_requests integer default 8
)
returns table (
  allowed boolean,
  request_count integer,
  photo_request_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nutrition_usage_daily (
    user_id,
    usage_date
  )
  values (
    p_user_id,
    p_usage_date
  )
  on conflict (user_id, usage_date) do nothing;

  update public.nutrition_usage_daily
  set
    request_count = public.nutrition_usage_daily.request_count + 1,
    photo_request_count = public.nutrition_usage_daily.photo_request_count +
      case when p_is_photo then 1 else 0 end,
    last_request_at = timezone('utc', now())
  where
    user_id = p_user_id
    and usage_date = p_usage_date
    and public.nutrition_usage_daily.request_count < p_max_requests
    and (
      not p_is_photo
      or public.nutrition_usage_daily.photo_request_count < p_max_photo_requests
    )
  returning
    true,
    public.nutrition_usage_daily.request_count,
    public.nutrition_usage_daily.photo_request_count
  into
    allowed,
    request_count,
    photo_request_count;

  if found then
    return next;
    return;
  end if;

  select
    false,
    d.request_count,
    d.photo_request_count
  into
    allowed,
    request_count,
    photo_request_count
  from public.nutrition_usage_daily d
  where d.user_id = p_user_id and d.usage_date = p_usage_date;

  return next;
end;
$$;

create or replace function public.release_nutrition_usage_claim(
  p_user_id uuid,
  p_usage_date date,
  p_is_photo boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.nutrition_usage_daily
  set
    request_count = greatest(0, request_count - 1),
    photo_request_count = greatest(
      0,
      photo_request_count - case when p_is_photo then 1 else 0 end
    )
  where user_id = p_user_id and usage_date = p_usage_date;
end;
$$;

create or replace function public.finalize_nutrition_usage(
  p_user_id uuid,
  p_usage_date date,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.nutrition_usage_daily
  set
    input_tokens = input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
    output_tokens = output_tokens + greatest(coalesce(p_output_tokens, 0), 0)
  where user_id = p_user_id and usage_date = p_usage_date;
end;
$$;

revoke all on function public.claim_nutrition_usage_quota(uuid, date, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.release_nutrition_usage_claim(uuid, date, boolean) from public, anon, authenticated;
revoke all on function public.finalize_nutrition_usage(uuid, date, integer, integer) from public, anon, authenticated;

comment on table public.nutrition_usage_daily is
  'Per-user daily Nutrition Coach request counters and token usage totals.';

comment on function public.claim_nutrition_usage_quota(uuid, date, boolean, integer, integer) is
  'Atomically claims one Nutrition Coach request slot for a user/day if daily caps allow it.';

comment on function public.release_nutrition_usage_claim(uuid, date, boolean) is
  'Releases a previously claimed Nutrition Coach request slot after upstream failure.';

comment on function public.finalize_nutrition_usage(uuid, date, integer, integer) is
  'Adds Anthropic token usage totals after a successful Nutrition Coach request.';
