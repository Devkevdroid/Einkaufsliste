import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { Page, Placeholder } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { Button, ErrorText } from '../components/ui'
import { addDays, isoWeek, parseISODate, startOfWeek, toISODate, weekRange } from '../lib/dates'
import { useHousehold } from '../lib/household'
import { formatAmount, formatNumber, parseAmountInput } from '../lib/servings'
import { generateFromPlan, useShoppingList } from '../lib/shopping'
import { isLateDay, parseItemInput, sourceRuns, splitByTrip, unitKey, type ItemGroup } from '../lib/shoppingGroups'

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
  // Nur eine Zeile gleichzeitig aufgewischt
  const [swipedKey, setSwipedKey] = useState<string | null>(null)
  const [editing, setEditing] = useState<ItemGroup | null>(null)

  const trips = useMemo(() => splitByTrip(list.items ?? []), [list.items])
  // Unter „Erledigt“ steht nur, was zweimal angetippt wurde; einmal Abgehaktes bleibt mit Haken an seinem Platz.
  const done = trips.flatMap((t) => t.groups.filter((g) => g.archived))
  // Stehen mehrere Wochen auf der Liste, kommt die Kalenderwoche in die Überschrift.
  const multipleWeeks = new Set(trips.map((t) => t.monday)).size > 1

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

  /**
   * Speichert Änderungen an einer Zeile. Eine Zeile kann mehrere Artikel zusammenfassen (z. B. Zwiebeln aus
   * zwei Rezepten): je Einheit bleibt dann ein Artikel mit der neuen Gesamtmenge, die übrigen werden gelöscht.
   */
  function saveEdit(group: ItemGroup, name: string, amounts: EditAmount[]) {
    const members = (list.items ?? []).filter((i) => group.itemIds.includes(i.id))
    group.amounts.forEach((original, index) => {
      const next = amounts[index]
      const unit = next.unit.trim() || null
      if (name === group.name && next.amount === original.amount && unit === original.unit) return
      const [first, ...rest] = members.filter((i) => unitKey(i.unit) === unitKey(original.unit))
      if (!first) return
      list.update(first.id, { name, amount: next.amount, unit })
      if (rest.length > 0) list.remove(rest.map((i) => i.id))
    })
    setEditing(null)
  }

  const rowProps = (group: ItemGroup) => ({
    group,
    swiped: swipedKey === group.key,
    onSwipe: (open: boolean) => setSwipedKey(open ? group.key : null),
    onEdit: () => {
      setSwipedKey(null)
      setEditing(group)
    },
    onDelete: () => {
      setSwipedKey(null)
      list.remove(group.itemIds)
    },
  })

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
        {list.loaded && trips.length === 0 && (
          <Placeholder>Die Liste ist leer. Übernimm die Zutaten aus dem Wochenplan oder füge eigene Artikel hinzu.</Placeholder>
        )}

        {trips.map((trip) => {
          const visible = trip.groups.filter((g) => !g.archived)
          const open = visible.filter((g) => !g.checked)
          if (visible.length === 0) return null
          const tone = TONES[trip.late ? 'late' : 'early']
          const week = multipleWeeks && trip.monday ? `KW ${isoWeek(parseISODate(trip.monday)!)} · ` : ''
          return (
            <section key={trip.key} className="space-y-1.5 pt-2">
              <h2 className={`flex items-center gap-2 text-sm font-bold ${tone.text}`}>
                <span className={`size-2.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                {week}
                {trip.monday ? (trip.late ? 'Für Fr–So' : 'Für Mo–Do') : 'Einkauf'}
                <span className="font-normal text-stone-500 dark:text-stone-400">({open.length})</span>
              </h2>
              <ul className="space-y-1.5">
                {visible.map((group) => (
                  <GroupRow
                    key={group.key}
                    {...rowProps(group)}
                    tone={tone}
                    // 1. Tippen: Haken, bleibt stehen – 2. Tippen: wandert zu „Erledigt“
                    onToggle={() => list.setChecked(group.itemIds, true, group.checked)}
                  />
                ))}
              </ul>
            </section>
          )
        })}

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
                  <GroupRow key={group.key} {...rowProps(group)} onToggle={() => list.setChecked(group.itemIds, false)} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {editing && (
        <EditSheet
          group={editing}
          onClose={() => setEditing(null)}
          onSave={(name, amounts) => saveEdit(editing, name, amounts)}
          onDelete={() => {
            list.remove(editing.itemIds)
            setEditing(null)
          }}
        />
      )}

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

// Grün = Einkauf für Mo–Do, Violett = für Fr–So.
const TONES = {
  early: { text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-600', edge: 'border-l-emerald-600' },
  late: { text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-600', edge: 'border-l-violet-600' },
}
type Tone = (typeof TONES)[keyof typeof TONES]

const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })
const shortWeekday = (date: Date) => weekdayShort.format(date).replace('.', '')

function SourceLine({ group }: { group: ItemGroup }) {
  if (group.sources.length === 0 && !group.hasManual) return null
  return (
    <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
      {sourceRuns(group.sources).map((run, i) => {
        const from = parseISODate(run.from)
        const to = parseISODate(run.to)
        const tone = run.from && TONES[isLateDay(run.from) ? 'late' : 'early']
        return (
          <span key={i}>
            {i > 0 && ', '}
            {from && (
              <span className={group.checked || !tone ? '' : `font-semibold ${tone.text}`}>
                {shortWeekday(from)}
                {to && run.to !== run.from && `–${shortWeekday(to)}`}
              </span>
            )}
            {from && ' · '}
            {run.title}
          </span>
        )
      })}
      {group.hasManual && `${group.sources.length > 0 ? ', ' : ''}eigener Artikel`}
    </span>
  )
}

/** Breite der Knöpfe hinter einer aufgewischten Zeile (2 × 80 px). */
const ACTIONS_WIDTH = 160
/** Ist die Zeile schon offen, löscht ein zweites Wischen um mindestens so viel weiter direkt. */
const DELETE_SWIPE = 60

type GroupRowProps = {
  group: ItemGroup
  tone?: Tone
  /** Zeile ist nach links gewischt, Bearbeiten/Löschen sichtbar */
  swiped: boolean
  onSwipe: (open: boolean) => void
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

function GroupRow({ group, tone, swiped, onSwipe, onToggle, onEdit, onDelete }: GroupRowProps) {
  // Wischen nach links: Zeile folgt dem Finger, ab der halben Strecke rastet sie offen ein.
  const [drag, setDrag] = useState<number | null>(null)
  const gesture = useRef<{ x: number; y: number; base: number; swiping: boolean } | null>(null)
  const dragValue = useRef(0)
  const suppressClick = useRef(false)
  const offset = drag ?? (swiped ? -ACTIONS_WIDTH : 0)
  // Zweites Wischen weit genug: Loslassen löscht (Löschen-Knopf füllt dann die ganze Fläche).
  const deleteArmed = swiped && offset <= -(ACTIONS_WIDTH + DELETE_SWIPE)

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    gesture.current = { x: event.clientX, y: event.clientY, base: swiped ? -ACTIONS_WIDTH : 0, swiping: false }
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current
    if (!g) return
    const dx = event.clientX - g.x
    if (!g.swiping) {
      // Erst ab ein paar Pixeln und nur bei eher waagerechter Bewegung – sonst ist es Scrollen oder Tippen.
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(event.clientY - g.y)) return
      g.swiping = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const limit = g.base < 0 ? ACTIONS_WIDTH + DELETE_SWIPE + 80 : ACTIONS_WIDTH + 40
    dragValue.current = Math.min(0, Math.max(-limit, g.base + dx))
    setDrag(dragValue.current)
  }

  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    if (!g?.swiping) return
    suppressClick.current = true
    setDrag(null)
    if (g.base < 0 && dragValue.current <= -(ACTIONS_WIDTH + DELETE_SWIPE)) onDelete()
    else onSwipe(dragValue.current < -ACTIONS_WIDTH / 2)
  }

  function onClick() {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (swiped) onSwipe(false)
    else onToggle()
  }

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {offset < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex text-sm font-medium text-white"
          style={{ width: Math.max(ACTIONS_WIDTH, -offset) }}
        >
          {!deleteArmed && (
            <button
              type="button"
              onClick={onEdit}
              className="w-20 shrink-0 bg-stone-500 hover:bg-stone-600 dark:bg-stone-600 dark:hover:bg-stone-500"
            >
              Bearbeiten
            </button>
          )}
          <button type="button" onClick={onDelete} className="min-w-20 flex-1 bg-red-600 hover:bg-red-700">
            Löschen
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null
          setDrag(null)
        }}
        aria-pressed={group.checked}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        className={`relative flex min-h-16 w-full touch-pan-y items-center gap-3 rounded-2xl px-3 py-2 text-left shadow-sm select-none ${
          drag === null ? 'transition-[transform,background-color] duration-200' : ''
        } ${
          group.checked
            ? 'bg-stone-100 text-stone-400 dark:bg-stone-900 dark:text-stone-500'
            : 'bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800'
        } ${tone ? `border-l-4 ${tone.edge}` : ''}`}
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
          <SourceLine group={group} />
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

type EditAmount = { amount: number | null; unit: string; text: string }

/** Sinnvolle Schritte für − / +: Gramm in 10ern bzw. 50ern, Kilo/Liter in halben, sonst ganze. */
function stepFor(unit: string, amount: number | null) {
  if (/^(g|ml)$/i.test(unit.trim())) return (amount ?? 0) >= 100 ? 50 : 10
  if (/^(kg|l)$/i.test(unit.trim())) return 0.5
  return 1
}

type EditSheetProps = {
  group: ItemGroup
  onClose: () => void
  onSave: (name: string, amounts: EditAmount[]) => void
  onDelete: () => void
}

function EditSheet({ group, onClose, onSave, onDelete }: EditSheetProps) {
  const [name, setName] = useState(group.name)
  const [amounts, setAmounts] = useState<EditAmount[]>(() =>
    group.amounts.map((a) => ({
      amount: a.amount,
      unit: a.unit ?? '',
      text: a.amount === null ? '' : formatNumber(a.amount),
    })),
  )

  function change(index: number, next: Partial<EditAmount>) {
    setAmounts((current) => current.map((a, i) => (i === index ? { ...a, ...next } : a)))
  }

  function nudge(index: number, direction: 1 | -1) {
    const { amount, unit } = amounts[index]
    const step = stepFor(unit, direction === -1 ? (amount ?? 0) - 1 : amount)
    const value = Math.max(step, Math.round(((amount ?? 0) + direction * step) * 100) / 100)
    change(index, { amount: value, text: formatNumber(value) })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim()) onSave(name.trim(), amounts)
  }

  const inputClass =
    'h-12 min-w-0 rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-emerald-600 dark:border-stone-700 dark:bg-stone-950'
  const stepClass =
    'flex size-12 shrink-0 items-center justify-center rounded-xl bg-stone-200 text-2xl font-medium hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700'

  return (
    <Sheet title="Artikel bearbeiten" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-full`} />
        </label>

        {amounts.map((a, index) => (
          <div key={index} className="space-y-1">
            <span className="text-sm font-medium">Menge</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Weniger" onClick={() => nudge(index, -1)} className={stepClass}>
                −
              </button>
              <input
                value={a.text}
                onChange={(e) => change(index, { text: e.target.value, amount: parseAmountInput(e.target.value) })}
                inputMode="decimal"
                aria-label="Menge"
                placeholder="–"
                className={`${inputClass} w-20 text-center tabular-nums`}
              />
              <button type="button" aria-label="Mehr" onClick={() => nudge(index, 1)} className={stepClass}>
                +
              </button>
              <input
                value={a.unit}
                onChange={(e) => change(index, { unit: e.target.value })}
                aria-label="Einheit"
                placeholder="Einheit"
                className={`${inputClass} w-full flex-1`}
              />
            </div>
          </div>
        ))}

        {group.itemIds.length > 1 && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Diese Zeile fasst mehrere Rezepte zusammen. Beim Speichern wird daraus ein Artikel mit der neuen Menge.
          </p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="danger" onClick={onDelete}>
            Löschen
          </Button>
          <Button type="submit" className="flex-1" disabled={!name.trim()}>
            Speichern
          </Button>
        </div>
      </form>
    </Sheet>
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
