-- Extension additive : les migrations déjà fusionnées restent intactes.
alter table public.dame_matches drop constraint dame_matches_status_check;
alter table public.dame_matches add constraint dame_matches_status_check
  check (status in ('IN_PROGRESS', 'WHITE_WON', 'BLACK_WON', 'DRAW'));
alter table public.dame_matches drop constraint dame_matches_dates_check;
alter table public.dame_matches add constraint dame_matches_dates_check check (
  (status = 'IN_PROGRESS' and finished_at is null)
  or (status in ('WHITE_WON', 'BLACK_WON', 'DRAW') and finished_at is not null and finished_at >= started_at)
);
