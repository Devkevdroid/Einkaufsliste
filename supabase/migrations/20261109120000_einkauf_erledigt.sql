-- Abhaken in zwei Stufen: erstes Antippen setzt checked (Haken, Artikel bleibt an seinem Platz),
-- zweites Antippen setzt archived (Artikel wandert nach unten zu „Erledigt“).
alter table public.shopping_items add column archived boolean not null default false;

-- Bisher Abgehaktes stand schon unter „Erledigt“ – dort soll es auch bleiben.
update public.shopping_items set archived = true where checked;
