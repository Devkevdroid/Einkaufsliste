import { useMemo, useState, type FormEvent } from 'react'
import { Page, Placeholder } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { Button, ErrorText } from '../components/ui'
import { addDays, isoWeek, parseISODate, startOfWeek, toISODate, weekRange } from '../lib/dates'
import { useHousehold } from '../lib/household'
import { formatAmount } from '../lib/servings'
import { generateFromPlan, useShoppingList } from '../lib/shopping'
import { groupItems, parseItemInput, type ItemGroup } from '../lib/shoppingGroups'

const HIDE_CHECKED_KEY = 'shopping-hide-checked'

function readHideChecked() {
  try {
    return localStorage.getItem(HIDE_CHECKED_KEY) === '1'
  } catch {
    return false
  }
}

export function ShoppingPage() {
  const { household } = useHousehold()
  const list = useShoppingList(household.id)
  const [text, setText] = useState('')
  const [hideChecked, setHideChecked] = useState(readHideChecked)
  const [showGenerator, setShowGenerator] = useState(false)

  const groups = useMemo(() => groupItems(list.items ?? []), [list.items])
  const open = groups.filter((g) => !g.checked)
  const done = groups.filter((g) => g.checked)

  function addItem(event: FormEvent) {
    event.preventDefault()
    const parsed = parseItemInput(text)
    if (!parsed.name) return
    list.add(parsed)
    setText('')
  }

  function toggleHide() {
    const next = !hideChecked
    setHideChecked(next)
    try {
      localStorage.setItem(HIDE_CHECKED_KEY, next ? '1' : '0')
    } catch {
      // ignorieren
    }
  }

  function deleteDone() {
    if (!confirm(`${done.length} erledigte Artikel endgültig von der Liste löschen?`)) return
    list.remove(done.flatMap((g) => g.itemIds))
  }

  return (
    <Page title="Einkaufsliste">
      <div className="space-y-3">
        {(!list.online || list.pending > 0) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {list.online
              ? `Synchronisiere ${list.pending} Änderung(en) …`
              : `Offline – ${list.pending > 0 ? `${list.pending} Änderung(en) werden` : 'Änderungen werden'} übertragen, sobald wieder Netz da ist.`}
          </p>
        )}
        <ErrorText>{list.error}</ErrorText>

        <form onSubmit={addItem} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Artikel hinzufügen, z. B. 2 l Milch"
            aria-label="Artikel hinzufügen"
            enterKeyHint="done"
            className="h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-stone-900"
          />
          <Button type="submit" aria-label="Hinzufügen" disabled={!text.trim()} className="w-12 px-0 text-2xl">
            +
          </Button>
        </form>

        <Button variant="secondary" className="w-full" onClick={() => setShowGenerator(true)}>
          Aus Wochenplan übernehmen
        </Button>

        {!list.loaded && <p className="py-8 text-center text-stone-500 dark:text-stone-400">Lädt …</p>}
        {list.loaded && groups.length === 0 && (
          <Placeholder>Die Liste ist leer. Übernimm die Zutaten aus dem Wochenplan oder füge eigene Artikel hinzu.</Placeholder>
        )}

        <ul className="space-y-1.5">
          {open.map((group) => (
            <GroupRow key={group.key} group={group} onToggle={() => list.setChecked(group.itemIds, true)} />
          ))}
        </ul>

        {done.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-3">
              <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400">Erledigt ({done.length})</h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={toggleHide}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {hideChecked ? 'Einblenden' : 'Ausblenden'}
                </button>
                <button
                  type="button"
                  onClick={deleteDone}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Löschen
                </button>
              </div>
            </div>
            {!hideChecked && (
              <ul className="space-y-1.5">
                {done.map((group) => (
                  <GroupRow key={group.key} group={group} onToggle={() => list.setChecked(group.itemIds, false)} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {showGenerator && (
        <GeneratorSheet
          onClose={() => setShowGenerator(false)}
          onDone={() => {
            setShowGenerator(false)
            void list.refresh()
          }}
        />
      )}
    </Page>
  )
}

const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

function sourceLabel(group: ItemGroup) {
  const parts = group.sources.map((s) => {
    const date = parseISODate(s.day)
    return date ? `${weekdayShort.format(date).replace('.', '')} · ${s.title}` : s.title
  })
  if (group.hasManual) parts.push('eigener Artikel')
  return parts.join(', ')
}

function GroupRow({ group, onToggle }: { group: ItemGroup; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={group.checked}
        className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left shadow-sm transition-colors active:scale-[0.99] ${
          group.checked
            ? 'bg-stone-100 text-stone-400 dark:bg-stone-900/50 dark:text-stone-500'
            : 'bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800'
        }`}
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
            group.checked
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-stone-300 dark:border-stone-600'
          }`}
          aria-hidden="true"
        >
          {group.checked ? '✓' : ''}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-lg leading-tight font-medium ${group.checked ? 'line-through' : ''}`}>
            {group.name}
          </span>
          {sourceLabel(group) && (
            <span className="block truncate text-xs text-stone-500 dark:text-stone-400">{sourceLabel(group)}</span>
          )}
        </span>
        <span className="shrink-0 text-right text-sm tabular-nums text-stone-600 dark:text-stone-300">
          {group.amounts
            .filter((a) => a.amount !== null || a.unit)
            .map((a, i) => (
              <span key={i} className="block">
                {formatAmount(a)}
              </span>
            ))}
        </span>
      </button>
    </li>
  )
}

function GeneratorSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const thisMonday = startOfWeek(new Date())
  const weeks = [
    { label: 'Diese Woche', monday: thisMonday },
    { label: 'Nächste Woche', monday: addDays(thisMonday, 7) },
  ]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function run(monday: Date) {
    setBusy(true)
    setError(null)
    try {
      const { recipes } = await generateFromPlan(toISODate(monday), toISODate(addDays(monday, 6)))
      if (recipes === 0) {
        setResult('In dieser Woche sind noch keine Rezepte eingeplant.')
        setBusy(false)
      } else {
        onDone()
      }
    } catch (e) {
      setError(
        navigator.onLine ? (e instanceof Error ? e.message : String(e)) : 'Dafür wird eine Internetverbindung gebraucht.',
      )
      setBusy(false)
    }
  }

  return (
    <Sheet title="Aus Wochenplan übernehmen" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Alle angehakten Zutaten der eingeplanten Rezepte kommen auf die Liste. Noch offene Artikel aus dieser Woche
          werden dabei aktualisiert, Erledigtes und eigene Artikel bleiben erhalten.
        </p>
        <ErrorText>{error}</ErrorText>
        {result && <p className="rounded-lg bg-stone-100 p-3 text-sm dark:bg-stone-800">{result}</p>}
        {weeks.map(({ label, monday }) => (
          <Button key={label} className="w-full justify-between" disabled={busy} onClick={() => run(monday)}>
            <span>{label}</span>
            <span className="text-sm font-normal opacity-80">
              KW {isoWeek(monday)} · {weekRange(monday)}
            </span>
          </Button>
        ))}
      </div>
    </Sheet>
  )
}
