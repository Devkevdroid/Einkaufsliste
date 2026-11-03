// Einkaufsliste anzeigen: gleiche Zutaten zusammenfassen. Reine Funktionen – auch mit Node testbar.

import { normalize } from './text.ts'

export type ListItem = {
  id: string
  name: string
  amount: number | null
  unit: string | null
  checked: boolean
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
  itemIds: string[]
}

function unitKey(unit: string | null) {
  return unit ? normalize(unit) : ''
}

/** Fasst Artikel mit gleichem Namen zusammen; Mengen gleicher Einheit werden addiert. */
export function groupItems(items: ListItem[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>()
  for (const item of items) {
    const key = normalize(item.name)
    let group = groups.get(key)
    if (!group) {
      group = { key, name: item.name.trim(), amounts: [], sources: [], hasManual: false, checked: true, itemIds: [] }
      groups.set(key, group)
    }
    group.itemIds.push(item.id)
    group.checked &&= item.checked

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
  // Offenes alphabetisch oben, Erledigtes ans Ende.
  return all.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'de'))
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
