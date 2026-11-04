-- Noms de participants locaux, sans relation avec les comptes de la plateforme.
-- Même limite que String.length() (UTF-16) et même bordure que String.strip() en Java 21.
-- char_length compte les points de code en PostgreSQL ; chaque caractère hors BMP compte donc deux fois.
create function public.dame_valid_player_name(value text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select value <> ''
    and value = btrim(value, U&'\0009\000A\000B\000C\000D\001C\001D\001E\001F\0020\1680\2000\2001\2002\2003\2004\2005\2006\2008\2009\200A\2028\2029\205F\3000')
    and 2 * char_length(value)
        - char_length(regexp_replace(value, U&'[\+010000-\+10FFFF]', '', 'g')) between 1 and 50
$$;

revoke all on function public.dame_valid_player_name(text) from public, anon, authenticated;
grant execute on function public.dame_valid_player_name(text) to service_role;

create table public.dame_matches (
  id          uuid primary key,
  white_name  text not null check (public.dame_valid_player_name(white_name)),
  black_name  text not null check (public.dame_valid_player_name(black_name)),
  started_at  timestamptz not null,
  status      text not null check (status in ('IN_PROGRESS', 'WHITE_WON', 'BLACK_WON')),
  finished_at timestamptz,
  constraint dame_matches_dates_check check (
    (status = 'IN_PROGRESS' and finished_at is null)
    or (status in ('WHITE_WON', 'BLACK_WON') and finished_at is not null and finished_at >= started_at)
  )
);

create function public.dame_check_match_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'IN_PROGRESS' then
      raise exception 'Une rencontre doit démarrer en cours.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if row(new.id, new.white_name, new.black_name, new.started_at)
      is distinct from row(old.id, old.white_name, old.black_name, old.started_at) then
    raise exception 'Les participants et le début de la rencontre sont immuables.' using errcode = 'check_violation';
  end if;
  if old.status <> 'IN_PROGRESS' or new.status = 'IN_PROGRESS' then
    raise exception 'Cette rencontre ne peut pas être clôturée.' using errcode = 'object_not_in_prerequisite_state';
  end if;
  return new;
end;
$$;

revoke all on function public.dame_check_match_transition() from public, anon, authenticated;

create trigger dame_matches_transition
  before insert or update on public.dame_matches
  for each row execute function public.dame_check_match_transition();

-- Les noms ne sont pas publics. L'API Java contrôlera la session propriétaire de la rencontre.
alter table public.dame_matches enable row level security;
revoke all on public.dame_matches from public, anon, authenticated, service_role;
grant select, insert on public.dame_matches to service_role;
grant update (status, finished_at) on public.dame_matches to service_role;
