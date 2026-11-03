import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { parseISODate, shortDate, weekdayName } from '../lib/dates'
import { useHousehold } from '../lib/household'
import { deletePlanEntry, setPlanEntry, type PlanEntry } from '../lib/plan'
import { errorMessage, supabase } from '../lib/supabase'
import { matchesSearch } from '../lib/text'
import { ServingsStepper } from './ServingsStepper'
import { Sheet } from './Sheet'
import { Button, ErrorText } from './ui'

const NOTE_SUGGESTIONS = ['Essen gehen', 'Reste', 'Unterwegs', 'Bestellen', 'Bei Freunden']
const DEFAULT_SERVINGS = 4

type RecipeOption = { id: string; title: string; image_url: string | null; servings: number }

type DaySheetProps = {
  day: string
  entry: PlanEntry | null
  onClose: () => void
  onChanged: () => void
}

/** Auswahl für einen Tag: Rezept oder Freitext. */
export function DaySheet({ day, entry, onClose, onChanged }: DaySheetProps) {
  const { household } = useHousehold()
  const date = parseISODate(day)!
  const [tab, setTab] = useState<'recipe' | 'note'>(entry?.note ? 'note' : 'recipe')
  const [recipes, setRecipes] = useState<RecipeOption[] | null>(null)
  const [query, setQuery] = useState('')
  const [servings, setServings] = useState(entry?.servings ?? DEFAULT_SERVINGS)
  const [note, setNote] = useState(entry?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, title, image_url, servings')
      .order('title')
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error))
        else setRecipes(data)
      })
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const chooseRecipe = (recipeId: string) => run(() => setPlanEntry(household.id, day, { recipeId, servings }))
  const chooseNote = (text: string) => run(() => setPlanEntry(household.id, day, { note: text }))
  const remove = () => entry && run(() => deletePlanEntry(entry.id))

  function submitNote(event: FormEvent) {
    event.preventDefault()
    if (note.trim()) void chooseNote(note)
  }

  const filtered = recipes?.filter((r) => matchesSearch(r.title, query)) ?? []

  return (
    <Sheet title={`${weekdayName(date)}, ${shortDate(date)}`} onClose={onClose}>
      <div className="space-y-4">
        {entry && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 dark:bg-stone-800">
            <div className="min-w-0">
              <p className="text-xs text-stone-500 dark:text-stone-400">Geplant</p>
              <p className="truncate font-medium">{entry.recipe?.title ?? entry.note}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              {entry.recipe && (
                <Link
                  to={`/rezepte/${entry.recipe.id}`}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                >
                  Öffnen
                </Link>
              )}
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Entfernen
              </button>
            </div>
          </div>
        )}

        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
          {(
            [
              ['recipe', 'Rezept'],
              ['note', 'Freitext'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`h-10 rounded-lg text-sm font-medium ${
                tab === value ? 'bg-white shadow-sm dark:bg-stone-950' : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ErrorText>{error}</ErrorText>

        {tab === 'recipe' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Portionen</span>
              <ServingsStepper value={servings} onChange={setServings} />
            </div>
            {recipes && recipes.length > 0 && (
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rezept suchen …"
                aria-label="Rezept suchen"
                className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-emerald-600 dark:border-stone-700 dark:bg-stone-950"
              />
            )}
            {recipes?.length === 0 && (
              <p className="text-center text-stone-500 dark:text-stone-400">
                Noch keine Rezepte.{' '}
                <Link to="/rezepte/import" className="font-medium text-emerald-700 underline dark:text-emerald-400">
                  Jetzt importieren
                </Link>
              </p>
            )}
            <ul className="space-y-1">
              {filtered.map((recipe) => {
                const selected = entry?.recipe?.id === recipe.id
                return (
                  <li key={recipe.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => chooseRecipe(recipe.id)}
                      className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white dark:hover:bg-stone-800 ${
                        selected ? 'bg-emerald-50 ring-2 ring-emerald-600 dark:bg-emerald-950' : ''
                      }`}
                    >
                      {recipe.image_url ? (
                        <img src={recipe.image_url} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="size-12 shrink-0 rounded-lg bg-stone-200 dark:bg-stone-800" />
                      )}
                      <span className="line-clamp-2 font-medium">{recipe.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {NOTE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseNote(suggestion)}
                  className="h-11 rounded-full border border-stone-300 bg-white px-4 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:hover:bg-stone-800"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form onSubmit={submitNote} className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Eigener Text, z. B. Pizza bei Oma"
                aria-label="Eigener Text"
                maxLength={80}
                className="h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-emerald-600 dark:border-stone-700 dark:bg-stone-950"
              />
              <Button type="submit" disabled={busy || !note.trim()}>
                Speichern
              </Button>
            </form>
          </div>
        )}
      </div>
    </Sheet>
  )
}
