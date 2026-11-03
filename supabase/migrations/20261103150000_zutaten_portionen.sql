-- Exakte HelloFresh-Mengen je Portionszahl, z. B. {"2": {"amount": 150, "unit": "g"}, "4": {...}}.
-- So stimmen die Mengen auch, wenn ein Rezept später für 2 statt 4 Personen eingeplant wird.
-- null = keine exakten Werte (z. B. manuell bearbeitet) → die App rechnet aus amount/unit hoch.
alter table public.recipe_ingredients add column amounts_by_servings jsonb;
