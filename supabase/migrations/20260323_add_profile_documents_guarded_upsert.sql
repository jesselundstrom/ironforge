create or replace function public.upsert_profile_documents_if_newer(_docs jsonb)
returns table (
  doc_key text,
  applied boolean,
  updated_at timestamptz,
  client_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _item jsonb;
  _doc_key text;
  _payload jsonb;
  _client_updated_at timestamptz;
begin
  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  if _docs is null or jsonb_typeof(_docs) <> 'array' then
    raise exception '_docs must be a JSON array';
  end if;

  for _item in
    select value
    from jsonb_array_elements(_docs)
  loop
    _doc_key := nullif(btrim(coalesce(_item->>'doc_key', '')), '');
    if _doc_key is null then
      raise exception 'doc_key is required';
    end if;

    if not (_item ? 'client_updated_at') then
      raise exception 'client_updated_at is required for doc_key %', _doc_key;
    end if;

    _payload := coalesce(_item->'payload', '{}'::jsonb);
    _client_updated_at := (_item->>'client_updated_at')::timestamptz;

    insert into public.profile_documents as pd (
      user_id,
      doc_key,
      payload,
      client_updated_at
    )
    values (
      _user_id,
      _doc_key,
      _payload,
      _client_updated_at
    )
    on conflict (user_id, doc_key) do update
      set payload = excluded.payload,
          client_updated_at = excluded.client_updated_at
    where excluded.client_updated_at >= pd.client_updated_at;

    return query
    select
      pd.doc_key,
      pd.client_updated_at = _client_updated_at as applied,
      pd.updated_at,
      pd.client_updated_at
    from public.profile_documents pd
    where pd.user_id = _user_id
      and pd.doc_key = _doc_key;
  end loop;
end;
$$;

comment on function public.upsert_profile_documents_if_newer(jsonb) is
  'Upserts per-user profile documents only when the incoming client_updated_at is not older than the stored document timestamp.';
