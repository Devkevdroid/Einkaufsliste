// Einkaufsliste anzeigen: gleiche Zutaten zusammenfassen. Reine Funktionen – auch mit Node testbar.

import { addDays, parseISODate, startOfWeek, toISODate } from './dates.ts'
import { normalize } from './text.ts'

export type ListItem = {
  id: string
  name: string
  amount: number | null
  unit: string | null
  checked: boolean
  /** Abgehakt und nach unten zu „Erledigt“ verschoben (zweites Antippen) */
  archived: boolean
  source: string
  plan_day: string | null
  recipe_title: string | null
  created_at: string
}

export type ItemGroup = {
  key: string
  name: string
  /** Summen je Einheit; mehrere Einträge = unterschiedliche Einheiten, werden untereinander angezeigt. */
  amounts: { amount: number | null; unit: string | null }[]
  /** Herkunft, z. B. [{ day: "2026-11-03", title: "Sigara Börek" }]; leer bei eigenen Artikeln. */
  sources: { day: string | null; title: string }[]
  hasManual: boolean
  checked: boolean
  archived: boolean
  itemIds: string[]
}

export function unitKey(unit: string | null) {
  return unit ? normalize(unit) : ''
}

/** Fasst Artikel mit gleichem Namen zusammen; Mengen gleicher Einheit werden addiert. */
export function groupItems(items: ListItem[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>()
  for (const item of items) {
    const key = normalize(item.name)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        name: item.name.trim(),
        amounts: [],
        sources: [],
        hasManual: false,
        checked: true,
        archived: true,
        itemIds: [],
      }
      groups.set(key, group)
    }
    group.itemIds.push(item.id)
    group.checked &&= item.checked
    group.archived &&= item.archived

    const sameUnit = group.amounts.find((a) => unitKey(a.unit) === unitKey(item.unit))
    if (!sameUnit) {
      group.amounts.push({ amount: item.amount, unit: item.unit })
    } else if (item.amount !== null) {
      sameUnit.amount = Math.round(((sameUnit.amount ?? 0) + item.amount) * 1000) / 1000
    }

    if (item.source === 'plan' && item.recipe_title) {
      if (!group.sources.some((s) => s.day === item.plan_day && s.title === item.recipe_title)) {
        group.sources.push({ day: item.plan_day, title: item.recipe_title })
      }
    } else if (item.source === 'manual') {
      group.hasManual = true
    }
  }

  const all = [...groups.values()]
  for (const group of all) group.sources.sort((a, b) => (a.day ?? '').localeCompare(b.day ?? ''))
  // Nach Tag sortiert (eigene Artikel ohne Tag danach), dann alphabetisch.
  // Abgehaktes bleibt an seinem Platz, damit beim Antippen nichts in der Liste springt.
  const firstDay = (g: ItemGroup) => g.sources[0]?.day ?? '9999'
  return all.sort((a, b) => firstDay(a).localeCompare(firstDay(b)) || a.name.localeCompare(b.name, 'de'))
}

export type Trip = {
  key: string
  /** false = Einkauf für Mo–Do, true = für Fr–So */
  late: boolean
  /** Montag der Woche ("2026-11-02"); null, wenn nur Artikel ohne Tag auf der Liste stehen */
  monday: string | null
  groups: ItemGroup[]
}

/** Fr, Sa, So → zweiter Einkauf der Woche. */
export function isLateDay(day: string): boolean {
  return [5, 6, 0].includes(parseISODate(day)!.getDay())
}

function previousDay(day: string): string {
  return toISODate(addDays(parseISODate(day)!, -1))
}

/**
 * Tag, an dem gekocht wird: Gleiches Rezept an aufeinanderfolgenden Tagen (z. B. Do kochen, Fr Reste)
 * zählt als ein Gericht vom ersten Tag – auch über das Wochenende hinweg (So → Mo).
 */
function cookDayFinder(items: ListItem[]) {
  const planned = new Set(items.filter((i) => i.plan_day && i.recipe_title).map((i) => `${i.recipe_title}|${i.plan_day}`))
  return (item: ListItem & { plan_day: string }) => {
    let day = item.plan_day
    while (item.recipe_title && planned.has(`${item.recipe_title}|${previousDay(day)}`)) day = previousDay(day)
    return day
  }
}

/**
 * Teilt die Liste in Einkäufe: Mo–Do und Fr–So je Woche, in zeitlicher Reihenfolge (nach Kochtag).
 * Eigene Artikel ohne Tag kommen zum ersten Einkauf.
 */
export function splitByTrip(items: ListItem[]): Trip[] {
  const buckets = new Map<string, { late: boolean; monday: string | null; items: ListItem[] }>()
  const undated: ListItem[] = []
  const cookDay = cookDayFinder(items)
  for (const item of items) {
    if (!item.plan_day) {
      undated.push(item)
      continue
    }
    const day = cookDay({ ...item, plan_day: item.plan_day })
    const monday = toISODate(startOfWeek(parseISODate(day)!))
    const late = isLateDay(day)
    const key = `${monday}:${late ? 2 : 1}`
    const bucket = buckets.get(key) ?? { late, monday, items: [] }
    bucket.items.push(item)
    buckets.set(key, bucket)
  }
  const keys = [...buckets.keys()].sort()
  if (undated.length > 0) {
    if (keys.length === 0) {
      keys.push('ohne-tag')
      buckets.set('ohne-tag', { late: false, monday: null, items: [] })
    }
    buckets.get(keys[0])!.items.push(...undated)
  }
  return keys.map((key) => {
    const { late, monday, items } = buckets.get(key)!
    // Gleiche Zutat in beiden Einkäufen bleibt getrennt – jeweils mit der Menge für diese Tage.
    const groups = groupItems(items).map((g) => ({ ...g, key: `${key}|${g.key}` }))
    return { key, late, monday, groups }
  })
}

export type SourceRun = { from: string | null; to: string | null; title: string }

/** Fasst gleiche Rezepte an Folgetagen zusammen: [Do Bowl, Fr Bowl] → [{ from: Do, to: Fr, title: Bowl }]. */
export function sourceRuns(sources: ItemGroup['sources']): SourceRun[] {
  const runs: SourceRun[] = []
  for (const { day, title } of sources) {
    const run = day ? runs.find((r) => r.title === title && r.to === previousDay(day)) : undefined
    if (run) run.to = day
    else runs.push({ from: day, to: day, title })
  }
  return runs
}

const UNITS: Record<string, string> = {
  g: 'g', gramm: 'g', kg: 'kg', ml: 'ml', l: 'l', liter: 'l',
  stück: 'Stück', stk: 'Stück', st: 'Stück',
  packung: 'Packung', pck: 'Packung', pkg: 'Packung', packungen: 'Packung',
  el: 'EL', tl: 'TL', dose: 'Dose', dosen: 'Dose', bund: 'Bund', becher: 'Becher',
  flasche: 'Flasche', flaschen: 'Flasche', glas: 'Glas', beutel: 'Beutel', netz: 'Netz',
}

/** "500 g Hackfleisch" → { amount: 500, unit: "g", name: "Hackfleisch" }; "Milch" → nur Name. */
export function parseItemInput(text: string): { name: string; amount: number | null; unit: string | null } {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?|[½¼¾])\s*([a-zA-ZäöüÄÖÜ]+\.?)?\s+(.+)$/)
  if (!match) {
    // "Milch 2" / "Eier x10" am Ende
    const tail = trimmed.match(/^(.+?)\s+x?(\d+)$/i)
    if (tail) return { name: tail[1], amount: Number(tail[2]), unit: null }
    return { name: trimmed, amount: null, unit: null }
  }
  const fractions: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 }
  const amount = fractions[match[1]] ?? parseFloat(match[1].replace(',', '.'))
  const unitWord = match[2]?.replace(/\.$/, '').toLowerCase()
  if (unitWord && UNITS[unitWord]) return { name: match[3], amount, unit: UNITS[unitWord] }
  // Kein bekanntes Einheitenwort → gehört zum Namen ("2 Zwiebeln")
  return { name: match[2] ? `${match[2]} ${match[3]}` : match[3], amount, unit: null }
}
