import { useCallback, useEffect, useRef, useState } from 'react'
import { ingredientAmount } from './servings'
import type { ListItem } from './shoppingGroups'
import { readStorage, writeStorage } from './storage'
import { errorMessage, isNetworkError, supabase } from './supabase'
import { normalize } from './text'

// ---------------------------------------------------------------------------
// Einkaufsliste aus dem Wochenplan erzeugen (braucht Internet)
// ---------------------------------------------------------------------------

/**
 * Übernimmt alle Rezepte im Zeitraum auf die Liste.
 * Noch nicht abgehakte Plan-Artikel des Zeitraums werden dabei ersetzt (so wirkt es wie "Aktualisieren"),
 * bereits abgehakte bleiben stehen und werden nicht doppelt hinzugefügt. Eigene Artikel bleiben unberührt.
 */
export async function generateFromPlan(from: string, to: string): Promise<{ recipes: number; items: number }> {
  const { data: entries, error } = await supabase
    .from('meal_plan_entries')
    .select(
      'id, day, servings, recipe:recipes (id, title, servings, recipe_ingredients (name, amount, unit, add_to_list, amounts_by_servings, position))',
    )
    .gte('day', from)
    .lte('day', to)
    .not('recipe_id', 'is', null)
  if (error) throw new Error(errorMessage(error))

  const { data: existing, error: existingError } = await supabase
    .from('shopping_items')
    .select('id, meal_plan_entry_id, name, checked')
    .eq('source', 'plan')
    .gte('plan_day', from)
    .lte('plan_day', to)
  if (existingError) throw new Error(errorMessage(existingError))

  const keep = keepKeys(existing)
  const rows = entries.flatMap((entry) =>
    entry.recipe ? ingredientRows(entry.recipe, entry.servings ?? entry.recipe.servings, entry, keep) : [],
  )
  await replaceItems(existing, rows)
  return { recipes: entries.length, items: rows.length }
}

type RecipeForList = {
  id: string
  servings: number
  recipe_ingredients: {
    name: string
    amount: number | null
    unit: string | null
    add_to_list: boolean
    amounts_by_servings: unknown
    position: number
  }[]
}
type ExistingItem = { id: string; meal_plan_entry_id: string | null; name: string; checked: boolean }

/** Bereits abgehakte Zutaten (je Plan-Eintrag) – die kommen nicht noch einmal auf die Liste. */
function keepKeys(existing: ExistingItem[]) {
  return new Set(existing.filter((i) => i.checked).map((i) => `${i.meal_plan_entry_id}|${normalize(i.name)}`))
}

function ingredientRows(
  recipe: RecipeForList,
  servings: number,
  entry: { id: string; day: string } | null,
  keep: Set<string>,
) {
  return [...recipe.recipe_ingredients]
    .sort((a, b) => a.position - b.position)
    .filter((i) => i.add_to_list && !keep.has(`${entry?.id ?? null}|${normalize(i.name)}`))
    .map((ingredient) => {
      const { amount, unit } = ingredientAmount(ingredient, recipe.servings, servings)
      return {
        name: ingredient.name,
        amount,
        unit,
        source: 'plan',
        meal_plan_entry_id: entry?.id ?? null,
        recipe_id: recipe.id,
        plan_day: entry?.day ?? null,
      }
    })
}

/** Ersetzt die noch offenen alten Artikel durch die neuen. */
async function replaceItems(existing: ExistingItem[], rows: ReturnType<typeof ingredientRows>) {
  const removeIds = existing.filter((i) => !i.checked).map((i) => i.id)
  if (removeIds.length > 0) {
    const { error } = await supabase.from('shopping_items').delete().in('id', removeIds)
    if (error) throw new Error(errorMessage(error))
  }
  if (rows.length > 0) {
    const { error } = await supabase.from('shopping_items').insert(rows)
    if (error) throw new Error(errorMessage(error))
  }
}

export type PlannedDay = { id: string; day: string; servings: number | null }

/** Kommende Tage (ab heute), an denen das Rezept eingeplant ist. */
export async function upcomingPlanDays(recipeId: string, today: string): Promise<PlannedDay[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('id, day, servings')
    .eq('recipe_id', recipeId)
    .gte('day', today)
    .order('day')
    .limit(7)
  if (error) throw new Error(errorMessage(error))
  return data
}

/**
 * Ein einzelnes Rezept auf die Liste – für bestimmte geplante Tage (mit deren Portionen)
 * oder ohne Tag mit frei gewählter Portionszahl. Wie beim Wochenplan werden offene Artikel
 * desselben Rezepts/Tages ersetzt, abgehakte bleiben.
 */
export async function addRecipeToList(
  recipe: RecipeForList,
  target: { days: PlannedDay[] } | { servings: number },
): Promise<number> {
  let query = supabase
    .from('shopping_items')
    .select('id, meal_plan_entry_id, name, checked')
    .eq('source', 'plan')
    .eq('recipe_id', recipe.id)
  query =
    'days' in target
      ? query.in(
          'meal_plan_entry_id',
          target.days.map((d) => d.id),
        )
      : query.is('meal_plan_entry_id', null)
  const { data: existing, error } = await query
  if (error) throw new Error(errorMessage(error))

  const keep = keepKeys(existing)
  const rows =
    'days' in target
      ? target.days.flatMap((day) => ingredientRows(recipe, day.servings ?? recipe.servings, day, keep))
      : ingredientRows(recipe, target.servings, null, keep)
  await replaceItems(existing, rows)
  return rows.length
}

// ---------------------------------------------------------------------------
// Liste mit Offline-Unterstützung
//
// Jede Änderung wird sofort lokal angezeigt und in einer Warteschlange ("Outbox") im Browser
// gespeichert. Die Warteschlange wird abgearbeitet, sobald der Server erreichbar ist.
// Die zuletzt geladene Liste liegt ebenfalls im Browser, damit sie offline sichtbar ist.
// ---------------------------------------------------------------------------

type NewItem = { id: string; name: string; amount: number | null; unit: string | null }

type Op =
  | { kind: 'check'; ids: string[]; checked: boolean; at: string }
  | { kind: 'add'; item: NewItem; at: string }
  | { kind: 'delete'; ids: string[] }

function applyOp(items: ListItem[], op: Op): ListItem[] {
  switch (op.kind) {
    case 'check':
      return items.map((i) => (op.ids.includes(i.id) ? { ...i, checked: op.checked } : i))
    case 'add':
      if (items.some((i) => i.id === op.item.id)) return items
      return [
        ...items,
        { ...op.item, checked: false, source: 'manual', plan_day: null, recipe_title: null, created_at: op.at },
      ]
    case 'delete':
      return items.filter((i) => !op.ids.includes(i.id))
  }
}

async function sendOp(op: Op) {
  const query =
    op.kind === 'check'
      ? supabase
          .from('shopping_items')
          .update({ checked: op.checked, checked_at: op.checked ? op.at : null })
          .in('id', op.ids)
      : op.kind === 'add'
        ? supabase.from('shopping_items').upsert({ ...op.item, source: 'manual', created_at: op.at }, { ignoreDuplicates: true })
        : supabase.from('shopping_items').delete().in('id', op.ids)
  const { error } = await query
  if (!error) return
  if (isNetworkError(error)) throw error
  // Dauerhafter Fehler (z. B. Artikel wurde inzwischen gelöscht): Änderung verwerfen statt ewig zu wiederholen.
  console.warn('Änderung verworfen:', error.message)
}

export function useShoppingList(householdId: string) {
  const cacheKey = `shopping:${householdId}`
  const outboxKey = `shopping-outbox:${householdId}`

  const outbox = useRef<Op[]>(readStorage(outboxKey, []))
  const [base, setBase] = useState<ListItem[] | null>(() => readStorage<ListItem[] | null>(cacheKey, null))
  const [items, setItems] = useState<ListItem[] | null>(() => base && outbox.current.reduce(applyOp, base))
  const [pending, setPending] = useState(outbox.current.length)
  const [online, setOnline] = useState(navigator.onLine)
  const [error, setError] = useState<string | null>(null)
  const flushing = useRef(false)

  const show = useCallback((nextBase: ListItem[]) => {
    setItems(outbox.current.reduce(applyOp, nextBase))
  }, [])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('id, name, amount, unit, checked, source, plan_day, created_at, recipe:recipes (title)')
      .order('created_at')
    if (error) {
      if (!isNetworkError(error)) setError(errorMessage(error))
      return
    }
    const loaded: ListItem[] = data.map(({ recipe, ...item }) => ({ ...item, recipe_title: recipe?.title ?? null }))
    setError(null)
    setBase(loaded)
    writeStorage(cacheKey, loaded)
    show(loaded)
  }, [cacheKey, show])

  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (outbox.current.length > 0) {
        await sendOp(outbox.current[0])
        outbox.current = outbox.current.slice(1)
        writeStorage(outboxKey, outbox.current)
        setPending(outbox.current.length)
      }
      setOnline(true)
    } catch {
      setOnline(false) // offline: beim nächsten "online"-Ereignis erneut versuchen
    } finally {
      flushing.current = false
    }
    if (outbox.current.length === 0) await refresh()
  }, [outboxKey, refresh])

  const mutate = useCallback(
    (op: Op) => {
      outbox.current = [...outbox.current, op]
      writeStorage(outboxKey, outbox.current)
      setPending(outbox.current.length)
      setItems((current) => (current ? applyOp(current, op) : current))
      void flush()
    },
    [outboxKey, flush],
  )

  useEffect(() => {
    void flush()
  }, [flush])

  // Netzwerkstatus und Rückkehr in die App: Warteschlange abarbeiten.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      void flush()
    }
    const goOffline = () => setOnline(false)
    const onVisible = () => document.visibilityState === 'visible' && void flush()
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush])

  // Echtzeit: Änderungen vom anderen Gerät übernehmen (kurz gebündelt, falls viele auf einmal kommen).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (outbox.current.length === 0) void refresh()
      }, 300)
    }
    const channel = supabase
      .channel(`shopping-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` },
        schedule,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') schedule() // nach Verbindungsabbruch verpasste Änderungen holen
      })
    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [householdId, refresh])

  return {
    items,
    loaded: base !== null,
    online,
    pending,
    error,
    refresh,
    setChecked: (ids: string[], checked: boolean) =>
      mutate({ kind: 'check', ids, checked, at: new Date().toISOString() }),
    add: (item: Omit<NewItem, 'id'>) =>
      mutate({ kind: 'add', item: { ...item, id: crypto.randomUUID() }, at: new Date().toISOString() }),
    remove: (ids: string[]) => mutate({ kind: 'delete', ids }),
  }
}
