-- =====================================================================
-- 30-posts-data-check.sql  (Lab: Regel fuer posts.data an Audio-Posts anpassen)
--
-- Problem: posts_data_check erlaubte nur das kompakte Format von Perc Lab / Chord Starter
-- (10-3000 Zeichen, nur A-Z a-z 0-9 _ . -). Audio- und Gumball-Posts speichern JSON.
--
-- Neu:
--   * beat / chords: exakt die alte Regel (unveraendert streng)
--   * audio / gumball: gueltiges JSON-Objekt, max. 6000 Zeichen, und die Audio-URL muss
--     im eigenen Ordner auf R2 liegen: https://audio.yardslovesyou.com/lab/<user_id>/...
--     (so kann niemand fremde Links oder Dateien anderer Nutzer posten)
--
-- Einmal im Supabase SQL Editor ausfuehren. Wiederholbar.
-- =====================================================================

-- Hilfsfunktion: liefert true, wenn der Text ein JSON-Objekt ist (ohne Fehler bei Muell)
create or replace function public.lab_json_url(d text)
returns text
language plpgsql
immutable
as $$
begin
  if jsonb_typeof(d::jsonb) <> 'object' then
    return null;
  end if;
  return d::jsonb ->> 'url';
exception when others then
  return null;
end;
$$;

alter table public.posts drop constraint if exists posts_data_check;

alter table public.posts add constraint posts_data_check check (
  case
    when type in ('beat', 'chords') then
      char_length(data) between 10 and 3000
      and data ~ '^[A-Za-z0-9_.\-]+$'
    when type in ('audio', 'gumball') then
      char_length(data) between 10 and 6000
      and coalesce(public.lab_json_url(data), '') like
          'https://audio.yardslovesyou.com/lab/' || user_id::text || '/%.m4a'
    else false
  end
);
