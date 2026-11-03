import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { DaySheet } from '../components/DaySheet'
import { ErrorText } from '../components/ui'
import { addDays, isoWeek, parseISODate, startOfWeek, toISODate, weekdayName, weekRange } from '../lib/dates'
import { useHousehold } from '../lib/household'
import { loadPlan, type PlanEntry } from '../lib/plan'
import { readStorage, writeStorage } from '../lib/storage'
import { supabase } from '../lib/supabase'

export function WeekPage() {
  const { household } = useHousehold()
  const [params, setParams] = useSearchParams()
  const monday = startOfWeek(parseISODate(params.get('woche')) ?? new Date())
  const mondayISO = toISODate(monday)
  const sundayISO = toISODate(addDays(monday, 6))
  const todayISO = toISODate(new Date())
  const isCurrentWeek = mondayISO === toISODate(startOfWeek(new Date()))

  // Zuletzt geladener Stand dieser Woche – wird offline angezeigt.
  const cacheKey = `plan:${household.id}:${mondayISO}`
  const [entries, setEntries] = useState<Record<string, PlanEntry> | null>(() => readStorage(cacheKey, null))
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const cached = readStorage<Record<string, PlanEntry> | null>(cacheKey, null)
    setEntries(cached)
    try {
      const plan = await loadPlan(mondayISO, sundayISO)
      setEntries(plan)
      writeStorage(cacheKey, plan)
      setError(null)
      setOffline(false)
    } catch (e) {
      // Mit gespeichertem Stand nur ein Hinweis statt Fehlermeldung.
      setOffline(cached !== null)
      setError(cached !== null ? null : e instanceof Error ? e.message : String(e))
    }
  }, [cacheKey, mondayISO, sundayISO])

  useEffect(() => {
    void reload()
    // Wieder online → aktuellen Stand holen.
    const onOnline = () => void reload()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [reload])

  // Änderungen vom anderen Gerät sofort übernehmen.
  useEffect(() => {
    const channel = supabase
      .channel(`plan-${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meal_plan_entries', filter: `household_id=eq.${household.id}` },
        () => void reload(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [household.id, reload])

  function goToWeek(offset: number) {
    const target = offset === 0 ? startOfWeek(new Date()) : addDays(monday, offset * 7)
    setParams(offset === 0 ? {} : { woche: toISODate(target) }, { replace: true })
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-24">
      <div className="mb-4 flex items-center justify-between gap-2">
        <NavButton label="Vorherige Woche" onClick={() => goToWeek(-1)}>
          ‹
        </NavButton>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">KW {isoWeek(monday)}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">{weekRange(monday)}</p>
        </div>
        <NavButton label="Nächste Woche" onClick={() => goToWeek(1)}>
          ›
        </NavButton>
      </div>

      {!isCurrentWeek && (
        <button
          type="button"
          onClick={() => goToWeek(0)}
          className="mb-3 w-full rounded-xl py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          Zur aktuellen Woche
        </button>
      )}

      <ErrorText>{error}</ErrorText>
      {offline && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Offline – du siehst den zuletzt geladenen Stand.
        </p>
      )}

      <ul className="space-y-2">
        {days.map((date) => {
          const iso = toISODate(date)
          const entry = entries?.[iso]
          const isToday = iso === todayISO
          const isPast = iso < todayISO
          return (
            <li key={iso}>
              <button
                type="button"
                onClick={() => setOpenDay(iso)}
                className={`flex min-h-20 w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition-colors hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 ${
                  isToday ? 'ring-2 ring-emerald-600' : ''
                } ${isPast ? 'opacity-60' : ''}`}
              >
                <div className="w-12 shrink-0 text-center">
                  <p className={`text-sm font-bold ${isToday ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                    {weekdayName(date).slice(0, 2)}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {date.getDate()}.{date.getMonth() + 1}.
                  </p>
                </div>
                <EntryPreview entry={entry} loading={entries === null} />
              </button>
            </li>
          )
        })}
      </ul>

      {openDay && (
        <DaySheet
          day={openDay}
          entry={entries?.[openDay] ?? null}
          onClose={() => setOpenDay(null)}
          onChanged={() => {
            setOpenDay(null)
            void reload()
          }}
        />
      )}
    </main>
  )
}

function EntryPreview({ entry, loading }: { entry: PlanEntry | undefined; loading: boolean }) {
  if (loading) return <span className="h-4 w-1/2 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
  if (entry?.recipe) {
    return (
      <>
        {entry.recipe.image_url ? (
          <img src={entry.recipe.image_url} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="size-14 shrink-0 rounded-xl bg-stone-200 dark:bg-stone-800" />
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium">{entry.recipe.title}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{entry.servings ?? entry.recipe.servings} Portionen</p>
        </div>
      </>
    )
  }
  if (entry?.note) return <p className="font-medium italic text-stone-600 dark:text-stone-300">{entry.note}</p>
  return <p className="text-stone-400 dark:text-stone-500">+ Planen</p>
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full text-3xl text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      {children}
    </button>
  )
}
