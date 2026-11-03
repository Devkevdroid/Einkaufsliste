-- Grundschema: Haushalte, Rezepte, Wochenplan, Einkaufsliste.
-- Alle Daten gehören einem Haushalt und sind per Row Level Security (RLS) geschützt.
-- Tabellen für Version 2 (Lidl-Bereiche, Stammartikel, Vorrat) sind schon angelegt, werden aber noch nicht genutzt.

-- ---------------------------------------------------------------------------
-- Haushalt & Mitglieder
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  -- unique: Jede Person gehört zu genau einem Haushalt.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Prüft, ob die angemeldete Person Mitglied des Haushalts ist (Grundlage aller RLS-Regeln).
create function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

-- Haushalt der angemeldeten Person; dient als Standardwert, damit die App household_id nicht mitschicken muss.
create function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id from public.household_members m where m.user_id = (select auth.uid());
$$;

-- Setzt updated_at bei jeder Änderung.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Version 2 (vorbereitet): Ladenbereiche, Stammartikel, Vorrat
-- ---------------------------------------------------------------------------

create table public.store_sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index store_sections_household_idx on public.store_sections (household_id, position);

-- Merkt sich pro Artikel den Ladenbereich und wie oft er gekauft wurde.
create table public.household_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  name text not null,
  name_key text generated always as (lower(trim(name))) stored,
  section_id uuid references public.store_sections (id) on delete set null,
  purchase_count integer not null default 0,
  last_purchased_at timestamptz,
  unique (household_id, name_key)
);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  name text not null,
  amount numeric,
  unit text,
  updated_at timestamptz not null default now()
);
create index pantry_items_household_idx on public.pantry_items (household_id);
create trigger pantry_items_updated_at before update on public.pantry_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rezepte
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  title text not null,
  subtitle text,
  image_url text,
  source text not null default 'manual' check (source in ('hellofresh', 'manual')),
  source_url text,
  external_id text,
  servings integer not null default 4 check (servings between 1 and 20),
  prep_minutes integer,
  -- Kochschritte als Liste: [{ "text": "...", "image_url": "..." }]
  steps jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Für zusammengesetzte Fremdschlüssel: verhindert Verweise auf Rezepte anderer Haushalte.
  unique (id, household_id)
);
create index recipes_household_idx on public.recipes (household_id, created_at desc);
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null default public.my_household_id(),
  position integer not null default 0,
  name text not null,
  amount numeric,
  unit text,
  -- "Nicht in Deiner Lieferung enthalten" (Öl, Salz, Pfeffer …)
  is_pantry boolean not null default false,
  -- Soll beim Erzeugen der Einkaufsliste übernommen werden?
  add_to_list boolean not null default true,
  section_id uuid references public.store_sections (id) on delete set null,
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_household_idx on public.recipe_ingredients (household_id);

-- ---------------------------------------------------------------------------
-- Wochenplan: pro Tag höchstens ein Eintrag (Rezept oder Freitext)
-- ---------------------------------------------------------------------------

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id(),
  day date not null,
  recipe_id uuid,
  note text,
  servings integer check (servings between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, day),
  unique (id, household_id),
  foreign key (household_id) references public.households (id) on delete cascade,
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create trigger meal_plan_entries_updated_at before update on public.meal_plan_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Einkaufsliste: eine Zeile pro Zutat und Herkunft; gleiche Zutaten fasst die App beim Anzeigen zusammen.
-- ---------------------------------------------------------------------------

create table public.shopping_items (
  -- Die App darf die id selbst erzeugen, damit offline angelegte Artikel später eindeutig synchronisieren.
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id(),
  name text not null,
  amount numeric,
  unit text,
  checked boolean not null default false,
  checked_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'plan')),
  meal_plan_entry_id uuid,
  recipe_id uuid,
  plan_day date,
  section_id uuid references public.store_sections (id) on delete set null,
  position integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id) references public.households (id) on delete cascade,
  foreign key (meal_plan_entry_id, household_id)
    references public.meal_plan_entries (id, household_id) on delete cascade,
  foreign key (recipe_id, household_id)
    references public.recipes (id, household_id) on delete set null (recipe_id)
);
create index shopping_items_household_idx on public.shopping_items (household_id, checked, position);
create trigger shopping_items_updated_at before update on public.shopping_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.store_sections enable row level security;
alter table public.household_items enable row level security;
alter table public.pantry_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.shopping_items enable row level security;

-- Haushalte und Mitglieder werden nur über die Funktionen unten angelegt bzw. geändert.
create policy "Mitglieder sehen ihren Haushalt" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "Mitglieder benennen ihren Haushalt um" on public.households
  for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy "Mitglieder sehen einander" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

create policy "Haushaltsdaten" on public.store_sections
  for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Haushaltsdaten" on public.household_items
  for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Haushaltsdaten" on public.pantry_items
  for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Haushaltsdaten" on public.recipes
  for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Haushaltsdaten" on public.recipe_ingredients
  for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Haushaltsdaten" on public.meal_plan_entries
  for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Haushaltsdaten" on public.shopping_items
  for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Funktionen für Haushalt anlegen, beitreten, verlassen
-- ---------------------------------------------------------------------------

-- 8 Zeichen ohne leicht verwechselbare Zeichen (kein I, O, 0, 1).
create function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end;
$$;

create function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  h public.households;
begin
  if uid is null then
    raise exception 'Nicht angemeldet.';
  end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'Du bist bereits Mitglied eines Haushalts.';
  end if;

  insert into public.households (name, invite_code, created_by)
  values (trim(p_name), public.generate_invite_code(), uid)
  returning * into h;

  insert into public.household_members (household_id, user_id, email, role)
  values (h.id, uid, auth.jwt() ->> 'email', 'owner');

  -- Lidl-Bereiche als Startreihenfolge (für Version 2)
  insert into public.store_sections (household_id, name, position)
  select h.id, s.name, s.pos::integer
  from unnest(array[
    'Obst & Gemüse', 'Brot', 'Kühlregal', 'Fleisch', 'Trockenware',
    'Konserven', 'Tiefkühl', 'Getränke', 'Drogerie'
  ]) with ordinality as s(name, pos);

  return h;
end;
$$;

create function public.join_household(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  hid uuid;
begin
  if uid is null then
    raise exception 'Nicht angemeldet.';
  end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'Du bist bereits Mitglied eines Haushalts.';
  end if;

  select id into hid from public.households where invite_code = normalized;
  if hid is null then
    raise exception 'Dieser Einladungscode ist ungültig.';
  end if;
  if (select count(*) from public.household_members where household_id = hid) >= 6 then
    raise exception 'Dieser Haushalt hat schon die maximale Anzahl an Mitgliedern.';
  end if;

  insert into public.household_members (household_id, user_id, email, role)
  values (hid, uid, auth.jwt() ->> 'email', 'member');

  return hid;
end;
$$;

create function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid := public.my_household_id();
  code text;
begin
  if hid is null then
    raise exception 'Du bist in keinem Haushalt.';
  end if;
  code := public.generate_invite_code();
  update public.households set invite_code = code where id = hid;
  return code;
end;
$$;

-- Verlassen; das letzte Mitglied löscht damit den Haushalt samt aller Daten.
create function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid := public.my_household_id();
begin
  if hid is null then
    return;
  end if;
  delete from public.household_members where household_id = hid and user_id = auth.uid();
  if not exists (select 1 from public.household_members where household_id = hid) then
    delete from public.households where id = hid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte: "Automatically expose new tables" ist aus, darum hier gezielt freigeben.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on
  public.store_sections,
  public.household_items,
  public.pantry_items,
  public.recipes,
  public.recipe_ingredients,
  public.meal_plan_entries,
  public.shopping_items
to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_household_member(uuid),
  public.my_household_id(),
  public.create_household(text),
  public.join_household(text),
  public.regenerate_invite_code(),
  public.leave_household()
to authenticated;

-- ---------------------------------------------------------------------------
-- Echtzeit-Sync (respektiert RLS)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.recipes,
  public.recipe_ingredients,
  public.meal_plan_entries,
  public.shopping_items;
