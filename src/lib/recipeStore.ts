// Alle Rezepte des Haushalts offline auf dem Gerät: Daten in IndexedDB, Bilder im Cache des Browsers.
// Der Abgleich lädt nur neue oder geänderte Rezepte (erkannt an updated_at) und jedes Bild nur einmal.

import { createStore, delMany, entries, get, set, setMany, values } from 'idb-keyval'
import { useEffect } from 'react'
import type { Tables } from './database.types'
import { supabase } from './supabase'

export type StoredRecipe = Tables<'recipes'> & { recipe_ingredients: Tables<'recipe_ingredients'>[] }

const store = createStore('einkaufsliste-rezepte', 'rezepte')

/** Muss zum Cache-Namen im Service Worker passen (vite.config.ts). */
export const IMAGE_CACHE = 'rezeptbilder'

export function getStoredRecipe(id: string): Promise<StoredRecipe | undefined> {
  return get<StoredRecipe>(id, store).catch(() => undefined)
}

export function getStoredRecipes(): Promise<StoredRecipe[]> {
  return values<StoredRecipe>(store).catch(() => [])
}

export function putStoredRecipe(recipe: StoredRecipe): Promise<void> {
  return set(recipe.id, recipe, store).catch(() => undefined)
}

const FULL_SELECT = '*, recipe_ingredients (*)'

let running: Promise<void> | null = null

/** Gleicht die Rezepte mit Supabase ab. Läuft immer nur einmal gleichzeitig. */
export function syncRecipes(): Promise<void> {
  running ??= runSync().finally(() => {
    running = null
  })
  return running
}

async function runSync() {
  const { data: index, error } = await supabase.from('recipes').select('id, updated_at')
  if (error) throw error

  const local = new Map(await entries<string, StoredRecipe>(store))
  const current = new Set(index.map((r) => r.id))
  const changed = index.filter((r) => local.get(r.id)?.updated_at !== r.updated_at).map((r) => r.id)

  // Gelöschte Rezepte (oder die eines früheren Haushalts) entfernen.
  await delMany([...local.keys()].filter((id) => !current.has(id)), store)
  removeOldLocalStorageCopies()

  for (let i = 0; i < changed.length; i += 20) {
    const { data, error } = await supabase
      .from('recipes')
      .select(FULL_SELECT)
      .in('id', changed.slice(i, i + 20))
      .order('position', { referencedTable: 'recipe_ingredients' })
    if (error) throw error
    await setMany(data.map((r) => [r.id, r]), store)
  }

  await cacheImages(await getStoredRecipes())
}

/** Hält die Offline-Rezepte aktuell: beim Start, wenn wieder Netz da ist und bei Änderungen vom anderen Gerät. */
export function useRecipeSync(householdId: string) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    // Kurz warten, damit der Abgleich nicht mit dem Laden der Seite konkurriert und Änderungen gebündelt werden.
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void syncRecipes().catch(() => undefined), 1500)
    }
    schedule()
    window.addEventListener('online', schedule)
    const channel = supabase
      .channel(`recipes-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes', filter: `household_id=eq.${householdId}` },
        schedule,
      )
      .subscribe()
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', schedule)
      void supabase.removeChannel(channel)
    }
  }, [householdId])
}

function imageUrls(recipe: StoredRecipe): string[] {
  const steps = (recipe.steps as { image_url?: string | null }[] | null) ?? []
  return [recipe.image_url, ...steps.map((s) => s.image_url)].filter((url): url is string => Boolean(url))
}

/** Frühere Version speicherte einzeln geöffnete Rezepte im localStorage – das übernimmt jetzt IndexedDB. */
function removeOldLocalStorageCopies() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('recipe:')) localStorage.removeItem(key)
  } catch {
    // egal
  }
}

/** Lädt fehlende Bilder in den Cache und wirft Bilder gelöschter Rezepte raus. */
async function cacheImages(recipes: StoredRecipe[]) {
  if (!('caches' in window)) return
  // Bittet den Browser, die Offline-Daten nicht bei Speicherknappheit zu löschen.
  void navigator.storage?.persist?.()

  const cache = await caches.open(IMAGE_CACHE)
  const wanted = new Set(recipes.flatMap(imageUrls))

  for (const request of await cache.keys()) {
    if (!wanted.has(request.url)) await cache.delete(request)
  }
  for (const url of wanted) {
    // HelloFresh antwortet mit „Vary: Accept“ – deshalb beim Suchen ignorieren.
    if (await cache.match(url, { ignoreVary: true })) continue
    try {
      const response = await fetch(url, { mode: 'cors' })
      if (response.ok) await cache.put(url, response)
    } catch {
      return // offline – beim nächsten Abgleich weiter
    }
  }
}
