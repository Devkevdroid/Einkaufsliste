-- Prüft die Haushaltsregeln mit drei simulierten Nutzern (A, B, C).
-- Läuft in einer Transaktion und wird am Ende zurückgerollt – in der Datenbank bleibt nichts übrig.
-- Ausführen: npx supabase db query --remote -f supabase/tests/rls_haushalt.sql

begin;

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to authenticated;
grant usage on sequence results_n_seq to authenticated;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-a000-00000000000a', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-00000000000b', 'b@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-00000000000c', 'c@test.invalid', 'authenticated', 'authenticated');

-- A legt Haushalt, Rezept und Einkaufsartikel an
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","email":"a@test.invalid","role":"authenticated"}';
select public.create_household('Test-Haushalt');
insert into public.recipes (title) values ('Testrezept');
insert into public.recipe_ingredients (recipe_id, name, amount, unit)
  select id, 'Tomate', 2, 'Stück' from public.recipes;
insert into public.shopping_items (name) values ('Milch');
insert into results (test, ok, detail)
  select 'A sieht eigenen Haushalt + 9 Lidl-Bereiche', count(*) = 9, count(*)::text from public.store_sections;
reset role;
create temp table code as select id, invite_code from public.households where name = 'Test-Haushalt';
grant select on code to authenticated;

-- B (noch ohne Haushalt) darf nichts sehen und nichts in fremde Haushalte schreiben
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","email":"b@test.invalid","role":"authenticated"}';
insert into results (test, ok, detail)
  select 'B ohne Haushalt sieht keine Rezepte', count(*) = 0, count(*)::text from public.recipes;
insert into results (test, ok, detail)
  select 'B ohne Haushalt sieht keine Haushalte', count(*) = 0, count(*)::text from public.households;
do $$
begin
  -- B kennt die id von A's Haushalt (z. B. erraten) und versucht, dort etwas anzulegen.
  insert into public.recipes (title, household_id) select 'Eindringling', id from code;
  insert into results (test, ok, detail) values ('B kann nicht in fremden Haushalt schreiben', false, 'Insert ging durch');
exception when others then
  insert into results (test, ok, detail) values ('B kann nicht in fremden Haushalt schreiben', true, sqlerrm);
end $$;
do $$
begin
  perform public.join_household('FALSCH12');
  insert into results (test, ok, detail) values ('Falscher Code wird abgelehnt', false, 'Beitritt ging durch');
exception when others then
  insert into results (test, ok, detail) values ('Falscher Code wird abgelehnt', true, sqlerrm);
end $$;

-- B tritt mit Code bei (mit Bindestrich und Kleinbuchstaben, wie man ihn abtippen würde)
select public.join_household(lower(substr(invite_code, 1, 4) || '-' || substr(invite_code, 5))) from code;
insert into results (test, ok, detail)
  select 'B sieht nach Beitritt das Rezept', count(*) = 1, count(*)::text from public.recipes;
insert into results (test, ok, detail)
  select 'B sieht nach Beitritt die Einkaufsliste', count(*) = 1, count(*)::text from public.shopping_items;
insert into results (test, ok, detail)
  select 'B sieht beide Mitglieder', count(*) = 2, string_agg(email, ', ') from public.household_members;
do $$
begin
  update public.households set invite_code = 'GEHACKT1';
  insert into results (test, ok, detail) values ('Einladungscode nicht direkt änderbar', false, 'Update ging durch');
exception when others then
  insert into results (test, ok, detail) values ('Einladungscode nicht direkt änderbar', true, sqlerrm);
end $$;
do $$
begin
  perform public.create_household('Zweiter Haushalt');
  insert into results (test, ok, detail) values ('Nur ein Haushalt pro Person', false, 'Zweiter Haushalt angelegt');
exception when others then
  insert into results (test, ok, detail) values ('Nur ein Haushalt pro Person', true, sqlerrm);
end $$;

-- C legt eigenen Haushalt an und sieht die Daten von A/B nicht
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000c","email":"c@test.invalid","role":"authenticated"}';
select public.create_household('Fremder Haushalt');
insert into results (test, ok, detail)
  select 'C sieht keine fremden Rezepte', count(*) = 0, count(*)::text from public.recipes;
insert into results (test, ok, detail)
  select 'C sieht keine fremden Zutaten', count(*) = 0, count(*)::text from public.recipe_ingredients;
insert into results (test, ok, detail)
  select 'C sieht keine fremde Einkaufsliste', count(*) = 0, count(*)::text from public.shopping_items;
do $$
declare n integer;
begin
  update public.shopping_items set checked = true;
  get diagnostics n = row_count;
  insert into results (test, ok, detail) values ('C kann fremde Artikel nicht abhaken', n = 0, n || ' Zeilen geändert');
end $$;
reset role;

select n, case when ok then '✅' else '❌' end as ergebnis, test, detail from results order by n;

rollback;
