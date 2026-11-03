import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Page } from '../components/Page'
import { ServingsStepper } from '../components/ServingsStepper'
import { Button, Card, ErrorText } from '../components/ui'
import { findExistingRecipe, importRecipe, saveRecipe, type ImportedRecipe } from '../lib/recipes'
import {
  amountForServings,
  DEFAULT_SERVINGS,
  extractUrl,
  formatAmount,
  formatNumber,
  parseAmountInput,
  stepServings,
  stepTextForServings,
  type Amount,
} from '../lib/servings'

type IngredientRow = {
  name: string
  isPantry: boolean
  addToList: boolean
  amounts: Record<string, Amount>
  /** Von Hand geänderte Menge; null = automatisch aus der Portionszahl. */
  override: Amount | null
}

export function RecipeImportPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(params.get('url') ?? '')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<ImportedRecipe | null>(null)
  const [existing, setExisting] = useState<{ id: string; title: string } | null>(null)
  const [title, setTitle] = useState('')
  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [rows, setRows] = useState<IngredientRow[]>([])
  const [editing, setEditing] = useState<number | null>(null)

  async function load(text: string) {
    const url = extractUrl(text)
    if (!url) {
      setError('Bitte einen Link zu einem HelloFresh-Rezept einfügen.')
      return
    }
    setLoading(true)
    setError(null)
    setRecipe(null)
    try {
      const result = await importRecipe(url)
      setRecipe(result)
      setTitle(result.title)
      setServings(DEFAULT_SERVINGS)
      setRows(
        result.ingredients.map((i) => ({
          name: i.name,
          isPantry: i.isPantry,
          addToList: !i.isPantry,
          amounts: i.amounts,
          override: null,
        })),
      )
      setExisting(await findExistingRecipe(result.sourceUrl, result.externalId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // Link aus der Adresse (später: "Teilen" aus der HelloFresh-App) direkt laden.
  useEffect(() => {
    const url = params.get('url')
    if (url) void load(url)
  }, []) // nur beim ersten Öffnen

  function submit(event: FormEvent) {
    event.preventDefault()
    void load(input)
  }

  function updateRow(index: number, change: Partial<IngredientRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)))
  }

  const amountOf = (row: IngredientRow) => row.override ?? amountForServings(row.amounts, servings)
  const exact = recipe?.availableServings.includes(servings) ?? false

  async function save() {
    if (!recipe) return
    setSaving(true)
    setError(null)
    try {
      const id = await saveRecipe({
        title: title.trim() || recipe.title,
        subtitle: recipe.subtitle,
        imageUrl: recipe.imageUrl,
        sourceUrl: recipe.sourceUrl,
        externalId: recipe.externalId,
        prepMinutes: recipe.prepMinutes,
        servings,
        steps: recipe.steps,
        ingredients: rows.map((row) => {
          const amount = amountOf(row)
          return {
            name: row.name,
            amount: amount.amount,
            unit: amount.unit,
            isPantry: row.isPantry,
            addToList: row.addToList,
            amountsByServings: row.override ? null : row.amounts,
          }
        }),
      })
      navigate('/rezepte', { replace: true, state: { savedId: id } })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const delivered = rows.map((row, index) => ({ row, index })).filter(({ row }) => !row.isPantry)
  const pantry = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.isPantry)
  const selectedCount = rows.filter((r) => r.addToList).length

  return (
    <Page title="Rezept importieren">
      <div className="space-y-4">
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="url"
            inputMode="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.hellofresh.de/recipes/…"
            aria-label="Link zum HelloFresh-Rezept"
            className="h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-stone-900"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            {loading ? 'Lädt …' : 'Laden'}
          </Button>
        </form>

        <ErrorText>{error}</ErrorText>

        {loading && <p className="text-center text-stone-500 dark:text-stone-400">Rezept wird von HelloFresh geladen …</p>}

        {recipe && (
          <>
            {existing && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Dieses Rezept ist schon gespeichert:{' '}
                <Link to={`/rezepte/${existing.id}`} className="font-medium underline">
                  {existing.title}
                </Link>
                . Du kannst es trotzdem noch einmal speichern.
              </p>
            )}

            <Card className="overflow-hidden p-0">
              {recipe.imageUrl && (
                <img src={recipe.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
              )}
              <div className="space-y-1 p-4">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Titel"
                  className="w-full rounded-md bg-transparent text-xl font-bold outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
                {recipe.subtitle && <p className="text-stone-500 dark:text-stone-400">{recipe.subtitle}</p>}
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {recipe.prepMinutes ? `${recipe.prepMinutes} Min. · ` : ''}
                  <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    Original bei HelloFresh
                  </a>
                </p>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Portionen</span>
                <ServingsStepper value={servings} onChange={setServings} />
              </div>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {exact
                  ? 'Exakte Mengen von HelloFresh.'
                  : `HelloFresh liefert Mengen für ${recipe.availableServings.join(', ')} Portionen – hier hochgerechnet.`}
              </p>
            </Card>

            <Card>
              <h2 className="mb-1 font-semibold">Zutaten</h2>
              <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
                Haken = kommt auf die Einkaufsliste. Tippe auf eine Zutat, um sie zu bearbeiten.
              </p>
              <IngredientList
                items={delivered}
                editing={editing}
                setEditing={setEditing}
                amountOf={amountOf}
                updateRow={updateRow}
                removeRow={(i) => setRows((r) => r.filter((_, index) => index !== i))}
              />

              {pantry.length > 0 && (
                <>
                  <h3 className="mt-4 mb-1 font-semibold">Vorrat</h3>
                  <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
                    Nicht in der HelloFresh-Lieferung enthalten. Nur anhaken, wenn es fehlt.
                  </p>
                  <IngredientList
                    items={pantry}
                    editing={editing}
                    setEditing={setEditing}
                    amountOf={amountOf}
                    updateRow={updateRow}
                    removeRow={(i) => setRows((r) => r.filter((_, index) => index !== i))}
                  />
                </>
              )}
            </Card>

            {recipe.steps.length > 0 && (
              <Card>
                <details>
                  <summary className="cursor-pointer font-semibold">
                    {recipe.steps.length} Kochschritte ansehen
                  </summary>
                  {stepServings(servings) !== servings && (
                    <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                      Mengen in den Schritten gelten für {stepServings(servings)} Portionen.
                    </p>
                  )}
                  <ol className="mt-3 space-y-3">
                    {recipe.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                          {i + 1}
                        </span>
                        <p className="whitespace-pre-line text-sm">{stepTextForServings(step.text, servings)}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              </Card>
            )}

            <div className="sticky bottom-20 z-10">
              <Button className="w-full shadow-lg" onClick={save} disabled={saving || rows.length === 0}>
                {saving ? 'Wird gespeichert …' : `Rezept speichern (${selectedCount} für die Liste)`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Page>
  )
}

type IngredientListProps = {
  items: { row: IngredientRow; index: number }[]
  editing: number | null
  setEditing: (index: number | null) => void
  amountOf: (row: IngredientRow) => Amount
  updateRow: (index: number, change: Partial<IngredientRow>) => void
  removeRow: (index: number) => void
}

function IngredientList({ items, editing, setEditing, amountOf, updateRow, removeRow }: IngredientListProps) {
  return (
    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
      {items.map(({ row, index }) => {
        const amount = amountOf(row)
        return (
          <li key={index} className="py-1">
            <div className="flex items-center gap-1">
              <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={row.addToList}
                  onChange={(e) => updateRow(index, { addToList: e.target.checked })}
                  aria-label={`${row.name} auf die Einkaufsliste`}
                  className="size-5 accent-emerald-700"
                />
              </label>
              <button
                type="button"
                onClick={() => setEditing(editing === index ? null : index)}
                className={`flex min-h-11 flex-1 items-baseline gap-2 text-left ${row.addToList ? '' : 'text-stone-400 dark:text-stone-500'}`}
              >
                <span className="w-24 shrink-0 tabular-nums text-stone-500 dark:text-stone-400">{formatAmount(amount)}</span>
                <span>{row.name}</span>
              </button>
            </div>
            {editing === index && (
              <IngredientEditor
                row={row}
                amount={amount}
                onChange={(change) => updateRow(index, change)}
                onRemove={() => {
                  removeRow(index)
                  setEditing(null)
                }}
                onDone={() => setEditing(null)}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

type IngredientEditorProps = {
  row: IngredientRow
  amount: Amount
  onChange: (change: Partial<IngredientRow>) => void
  onRemove: () => void
  onDone: () => void
}

function IngredientEditor({ row, amount, onChange, onRemove, onDone }: IngredientEditorProps) {
  const [amountText, setAmountText] = useState(amount.amount === null ? '' : formatNumber(amount.amount))
  const [unit, setUnit] = useState(amount.unit ?? '')
  const inputClass =
    'h-11 min-w-0 rounded-lg border border-stone-300 bg-white px-2 outline-none focus:border-emerald-600 dark:border-stone-700 dark:bg-stone-900'

  // Menge/Einheit nur übernehmen, wenn wirklich geändert – sonst bleibt die automatische Umrechnung aktiv.
  const [original] = useState(amount)
  function commitAmount(nextAmountText: string, nextUnit: string) {
    const parsed = parseAmountInput(nextAmountText)
    const next = { amount: parsed, unit: nextUnit.trim() || null }
    if (next.amount !== original.amount || next.unit !== original.unit) onChange({ override: next })
  }

  return (
    <div className="mb-2 ml-12 space-y-2 rounded-xl bg-stone-50 p-2 dark:bg-stone-800/50">
      <div className="flex gap-2">
        <input
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value)
            commitAmount(e.target.value, unit)
          }}
          inputMode="decimal"
          placeholder="Menge"
          aria-label="Menge"
          className={`${inputClass} w-20`}
        />
        <input
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value)
            commitAmount(amountText, e.target.value)
          }}
          placeholder="Einheit"
          aria-label="Einheit"
          className={`${inputClass} w-24`}
        />
        <input
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Zutat"
          aria-label="Zutat"
          className={`${inputClass} flex-1`}
        />
      </div>
      <div className="flex justify-between text-sm">
        <button type="button" onClick={onRemove} className="px-2 py-2 text-red-700 underline dark:text-red-400">
          Zutat entfernen
        </button>
        <button type="button" onClick={onDone} className="px-2 py-2 font-medium text-emerald-700 dark:text-emerald-400">
          Fertig
        </button>
      </div>
    </div>
  )
}
