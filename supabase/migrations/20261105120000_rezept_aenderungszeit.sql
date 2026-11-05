-- Ändert sich eine Zutat (z. B. Haken „auf die Liste“), gilt das Rezept als geändert.
-- Die App lädt beim Offline-Abgleich nur Rezepte neu, deren updated_at sich geändert hat.
-- (Beim Löschen nicht nötig: Zutaten werden nur zusammen mit ihrem Rezept gelöscht.)
create function public.touch_recipe()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.recipes set updated_at = now() where id = new.recipe_id;
  return null;
end;
$$;

create trigger recipe_ingredients_touch_recipe
  after insert or update on public.recipe_ingredients
  for each row execute function public.touch_recipe();
