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
| 2 | Datenbank, Login per Magic Link, Haushalt & Einladung | ⏳ |
| 3 | Rezept-Import von HelloFresh | ⏳ |
| 4 | Rezeptliste mit Suche | ⏳ |
| 5 | Wochenplan | ⏳ |
| 6 | Einkaufsliste mit Echtzeit-Sync | ⏳ |
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

Hinweis: Im kostenlosen Tarif pausiert Supabase ein Projekt, wenn es etwa eine Woche lang gar
nicht benutzt wurde. Im Dashboard lässt es sich mit einem Klick wieder starten.

## Projektstruktur

```
src/
  components/   wiederverwendbare Bausteine (Navigation, Seitenrahmen, Icons)
  lib/          Hilfsfunktionen (z. B. Hell/Dunkel-Modus)
  pages/        die einzelnen Seiten: Woche, Einkauf, Rezepte, Einstellungen
public/         Dateien, die unverändert ausgeliefert werden (Icon)
```
