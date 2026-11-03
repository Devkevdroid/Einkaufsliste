# Einkaufsliste & Wochenplan

Eine kleine App für zwei: Wochenplan fürs Abendessen, Rezept-Import von HelloFresh und eine
gemeinsame Einkaufsliste, die sich in Echtzeit zwischen beiden Handys abgleicht. Sie läuft im
Desktop-Browser und lässt sich auf Android als App installieren (PWA).

**Technik:** React + Vite + TypeScript, Tailwind CSS, Supabase (Datenbank, Login, Echtzeit),
Hosting auf Vercel. Alles im kostenlosen Tarif.

## Stand

| Schritt | Inhalt | Status |
| --- | --- | --- |
| 1 | Grundgerüst, Navigation, Hell/Dunkel | ✅ fertig |
| 2 | Datenbank, Login per Magic Link, Haushalt & Einladung | ✅ fertig |
| 3 | Rezept-Import von HelloFresh | ✅ fertig |
| 4 | Rezeptliste mit Suche | ✅ fertig |
| 5 | Wochenplan | ✅ fertig |
| 6 | Einkaufsliste mit Echtzeit-Sync | ✅ fertig |
| 7 | PWA (installierbar, offline) & Deployment auf Vercel | ⏳ |

## Voraussetzungen

- [Node.js](https://nodejs.org/) (Version 20 oder neuer) – prüfen mit `node --version`
- [Git](https://git-scm.com/)
- Kostenlose Konten bei [GitHub](https://github.com), [Supabase](https://supabase.com) und
  (später) [Vercel](https://vercel.com)

## App lokal starten

```bash
npm install
npm run dev
```

Danach im Browser <http://localhost:5173> öffnen. Änderungen am Code erscheinen sofort.

Weitere Befehle:

| Befehl | Wozu |
| --- | --- |
| `npm run build` | Prüft die Typen und baut die fertige App in den Ordner `dist` |
| `npm run preview` | Startet die gebaute App zum Testen |
| `npm run lint` | Sucht nach typischen Fehlern im Code |
| `npm run test:shopping` | Testet das Zusammenfassen der Einkaufsliste |

## Supabase einrichten (einmalig)

Supabase ist unsere Datenbank mit Login. Der kostenlose Tarif reicht völlig.

1. Auf <https://supabase.com> auf **Start your project** klicken und mit dem GitHub-Konto anmelden.
2. **New project** wählen:
   - **Name:** `einkaufsliste`
   - **Database Password:** auf **Generate a password** klicken und das Passwort in deinem
     Passwort-Manager speichern (wird selten gebraucht, ist aber nicht wiederherstellbar).
   - **Region:** `Central EU (Frankfurt)`
   - **Plan:** Free
3. Etwa zwei Minuten warten, bis das Projekt bereit ist.
4. Oben auf **Connect** klicken (oder links **Project Settings → API Keys**). Dort findest du:
   - die **Project URL** (`https://….supabase.co`)
   - den **Publishable key** (beginnt mit `sb_publishable_`; in älteren Projekten heißt er
     **anon public**)
5. Im Projektordner die Datei `.env.example` kopieren und die Kopie `.env` nennen. Die beiden
   Werte dort eintragen.

> **Wichtig:** Der *Publishable key* darf in der App stehen – die Daten schützt die Datenbank
> selbst (Row Level Security). Den **Secret key** bzw. **service_role key** dagegen niemals in
> die `.env` des Frontends, in den Chat oder ins Repository kopieren.

Die `.env`-Datei ist in `.gitignore` eingetragen und wird nie hochgeladen.

### Login-Adressen eintragen

Im Supabase-Dashboard unter **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` (später die Vercel-Adresse)
- **Redirect URLs:** `http://localhost:5173/**` (später zusätzlich `https://deine-app.vercel.app/**`)

### Datenbank-Schema hochladen

Das Schema liegt als SQL-Datei in `supabase/migrations/`. Einmalig mit der Supabase-CLI verbinden:

```bash
npx supabase login
npx supabase link --project-ref DEINE_PROJECT_REF
```

Die *Project Ref* ist der Teil der Project URL vor `.supabase.co`. Danach:

| Befehl | Wozu |
| --- | --- |
| `npm run db:push` | Neue Migrationen in die Datenbank übernehmen |
| `npm run db:types` | TypeScript-Typen aus der Datenbank neu erzeugen |
| `npx supabase db query --remote -f supabase/tests/rls_haushalt.sql` | Sicherheitstest der Haushaltsregeln (ändert nichts) |

### Rezept-Import (Edge Function)

Der Browser darf HelloFresh nicht direkt abrufen (CORS). Deshalb lädt die Supabase Edge Function
`import-recipe` (in `supabase/functions/import-recipe/`) die Rezeptseite und liest sie aus:
zuerst die eingebetteten Seitendaten (`__NEXT_DATA__`, mit exakten Mengen für 2/3/4 Portionen),
dann JSON-LD (schema.org/Recipe), zuletzt das HTML.

| Befehl | Wozu |
| --- | --- |
| `npm run functions:deploy` | Edge Functions nach Supabase hochladen (nach jeder Änderung) |
| `npm run test:import` | Import lokal mit den Beispielrezepten testen |
| `npm run test:import -- <URL>` | Import mit einem beliebigen HelloFresh-Link testen |

### E-Mail-Versand für weitere Personen

Der eingebaute E-Mail-Versand von Supabase schickt Login-Links nur an Mitglieder deines
Supabase-Teams und nur wenige pro Stunde. Damit weitere Personen sich anmelden können, unter
**Authentication → Emails → SMTP Settings** einen eigenen SMTP-Server eintragen (z. B. Gmail mit
App-Passwort).

### Hinweis zum kostenlosen Tarif

Im kostenlosen Tarif pausiert Supabase ein Projekt, wenn es etwa eine Woche lang gar
nicht benutzt wurde. Im Dashboard lässt es sich mit einem Klick wieder starten.

## Online stellen mit Vercel (einmalig)

Vercel baut die App bei jedem Push auf GitHub automatisch neu und stellt sie online.

1. Auf <https://vercel.com/signup> **Hobby** wählen und mit **Continue with GitHub** anmelden.
2. **Add New… → Project** wählen. Bei **Import Git Repository** das Repository `Einkaufsliste`
   auswählen. Falls es fehlt: **Adjust GitHub App Permissions** und Zugriff auf das Repository geben.
3. Vercel erkennt **Vite** automatisch, die Einstellungen bleiben, wie sie sind.
4. **Environment Variables** aufklappen und dieselben zwei Werte wie in deiner `.env` eintragen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. **Deploy** klicken. Nach etwa einer Minute steht oben die Adresse, z. B.
   `https://einkaufsliste-xyz.vercel.app`.
6. Diese Adresse in Supabase unter **Authentication → URL Configuration** eintragen:
   - **Site URL:** `https://einkaufsliste-xyz.vercel.app`
   - **Redirect URLs:** zusätzlich `https://einkaufsliste-xyz.vercel.app/**`
     (`http://localhost:5173/**` bleibt für die Entwicklung stehen)

Danach reicht `git push`: Vercel baut und veröffentlicht die neue Version selbst. Die
Datei `vercel.json` sorgt dafür, dass Adressen wie `/einkauf` auch beim Neuladen funktionieren.

> Ändert sich die Datenbank oder die Edge Function, muss das weiterhin separat mit
> `npm run db:push` bzw. `npm run functions:deploy` hochgeladen werden.

## Als App aufs Handy (Android)

1. Die Vercel-Adresse in **Chrome** oder **Samsung Internet** öffnen und anmelden.
2. Chrome: Menü **⋮ → Zum Startbildschirm hinzufügen → Installieren**.
   Samsung Internet: Menü **≡ → Seite hinzufügen zu → Startbildschirm**.
3. Die App startet danach ohne Browserleiste. Langes Drücken auf das Icon bietet die
   Abkürzungen **Einkaufsliste** und **Wochenplan**.

Offline: Die App selbst und die Einkaufsliste funktionieren ohne Netz. Abgehakte und neue
Artikel werden gespeichert und automatisch übertragen, sobald wieder Verbindung besteht.
Wochenplan und Rezepte brauchen eine Verbindung.

Neue Versionen lädt die App im Hintergrund; sie sind ab dem nächsten Öffnen aktiv.

Die App-Icons entstehen aus `public/favicon.svg`. Nach einer Änderung am Logo: `npm run icons`.

## Projektstruktur

```
src/
  components/   wiederverwendbare Bausteine (Navigation, Seitenrahmen, Icons)
  lib/          Supabase-Verbindung, Login, Haushalt, Hell/Dunkel-Modus
  pages/        die einzelnen Seiten: Login, Haushalt, Woche, Einkauf, Rezepte, Einstellungen
public/         Dateien, die unverändert ausgeliefert werden (Icons)
supabase/
  migrations/   Datenbank-Schema inkl. Sicherheitsregeln (RLS)
  tests/        SQL-Tests für die Sicherheitsregeln
```
