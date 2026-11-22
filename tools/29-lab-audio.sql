-- =====================================================================
-- 29-lab-audio.sql  (Lab: Community-Uploads mit Audio, Gumball-Patches und Tags)
--
-- Was das macht:
--   1. Erlaubt auf der Tabelle posts die neuen Typen 'audio' (Loops) und 'gumball'
--      (zusaetzlich zu 'beat' und 'chords'). Ein bestehender CHECK auf posts.type wird
--      gesucht und ersetzt. Ist type ein ENUM, werden die Werte stattdessen ergaenzt.
--   2. Neue Spalte posts.tags (text[], max. 5 Eintraege) plus GIN-Index fuer die Tag-Suche.
--   3. RLS bleibt unveraendert aktiv. Es werden keine Policies angefasst.
--
-- Wie ausfuehren: EINMAL im Supabase SQL Editor einfuegen und "Run" klicken.
-- Das Skript ist wiederholbar (idempotent). VOR dem Deployen der neuen Lab-Seite ausfuehren,
-- sonst kennt die Datenbank die Spalte tags noch nicht.
-- =====================================================================

-- 1. Typen erweitern -------------------------------------------------
do $$
declare
  c record;
  udt text;
begin
  select udt_name into udt from information_schema.columns
   where table_schema = 'public' and table_name = 'posts' and column_name = 'type';

  if udt is not null and udt not in ('text', 'varchar', 'bpchar') then
    -- type ist ein ENUM: neue Werte ergaenzen
    execute format('alter type %I add value if not exists %L', udt, 'audio');
    execute format('alter type %I add value if not exists %L', udt, 'gumball');
  else
    -- type ist Text: alte CHECK-Constraints auf posts.type entfernen
    for c in
      select conname from pg_constraint
       where conrelid = 'public.posts'::regclass
         and contype = 'c'
         and pg_get_constraintdef(oid) ~* '\mtype\M'
         and pg_get_constraintdef(oid) ~* '(beat|chords)'
    loop
      execute format('alter table public.posts drop constraint %I', c.conname);
    end loop;
    alter table public.posts drop constraint if exists posts_type_check;
    alter table public.posts
      add constraint posts_type_check check (type in ('beat', 'chords', 'audio', 'gumball'));
  end if;
end $$;

-- 2. Tags ------------------------------------------------------------
alter table public.posts add column if not exists tags text[] not null default '{}';

alter table public.posts drop constraint if exists posts_tags_max;
alter table public.posts add constraint posts_tags_max check (cardinality(tags) <= 5);

create index if not exists posts_tags_gin on public.posts using gin (tags);

-- falls die Tabelle mit Spalten-Rechten arbeitet, die neue Spalte freigeben (harmlos sonst)
grant select (tags), insert (tags) on public.posts to anon, authenticated;

-- Hinweis: Die Titelsuche nutzt ilike auf posts.title, dafuer ist kein Extra-Index noetig.
-- Hinweis: Bestehende Trigger (protect_post, post_rate_limit) koennen neue Typen oder das
-- Feld data weiterhin ablehnen. Der Client zeigt dann die echte Fehlermeldung an.
