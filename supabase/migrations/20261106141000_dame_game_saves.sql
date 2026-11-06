-- Aucun accès direct du navigateur, y compris avec un JWT authentifié.
create table public.dame_game_saves (
  id uuid primary key references public.dame_matches(id) on delete cascade,
  owner_hash text not null check (owner_hash ~ '^[0-9a-f]{64}$'),
  version integer not null check (version >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'
    and state ? 'view' and state ? 'history' and octet_length(state::text) <= 65536)
);
alter table public.dame_game_saves enable row level security;
revoke all on public.dame_game_saves from public, anon, authenticated, service_role;
grant select on public.dame_game_saves to service_role;

-- Le verrou et la comparaison de version protègent aussi deux processus Java distincts.
-- SECURITY DEFINER permet de limiter service_role à cette opération atomique.
create function public.dame_save_game(
  p_id uuid, p_owner_hash text, p_version integer, p_state jsonb,
  p_white_name text, p_black_name text, p_started_at timestamptz,
  p_status text, p_finished_at timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  previous public.dame_game_saves;
  metadata public.dame_matches;
begin
  if p_version = 0 then
    insert into public.dame_matches(id, white_name, black_name, started_at, status, finished_at)
      values (p_id, p_white_name, p_black_name, p_started_at, p_status, p_finished_at);
    insert into public.dame_game_saves(id, owner_hash, version, state)
      values (p_id, p_owner_hash, p_version, p_state);
    return true;
  end if;

  select * into previous from public.dame_game_saves where id = p_id for update;
  if not found or previous.owner_hash is distinct from p_owner_hash or previous.version is distinct from p_version - 1 then
    return false;
  end if;
  select * into metadata from public.dame_matches where id = p_id for update;
  if metadata.status <> 'IN_PROGRESS' then return false; end if;
  if row(metadata.white_name, metadata.black_name, metadata.started_at)
      is distinct from row(p_white_name, p_black_name, p_started_at) then
    raise exception 'Identité de rencontre immuable.' using errcode = 'check_violation';
  end if;
  if p_status <> 'IN_PROGRESS' then
    update public.dame_matches set status = p_status, finished_at = p_finished_at where id = p_id;
  elsif p_finished_at is not null then
    raise exception 'Une partie en cours ne possède pas de résultat.' using errcode = 'check_violation';
  end if;
  update public.dame_game_saves set version = p_version, state = p_state where id = p_id;
  return true;
end;
$$;
revoke all on function public.dame_save_game(uuid,text,integer,jsonb,text,text,timestamptz,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.dame_save_game(uuid,text,integer,jsonb,text,text,timestamptz,text,timestamptz)
  to service_role;
