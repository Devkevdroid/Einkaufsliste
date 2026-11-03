// Testet das Zusammenfassen der Einkaufsliste und die Eingabe eigener Artikel.
// Ausführen: npm run test:shopping

import assert from 'node:assert/strict'
import { groupItems, parseItemInput, type ListItem } from '../src/lib/shoppingGroups.ts'

let n = 0
function item(name: string, amount: number | null, unit: string | null, extra: Partial<ListItem> = {}): ListItem {
  n += 1
  return {
    id: `id-${n}`,
    name,
    amount,
    unit,
    checked: false,
    source: 'plan',
    plan_day: '2026-11-02',
    recipe_title: 'Rezept A',
    created_at: '',
    ...extra,
  }
}

const groups = groupItems([
  item('Tomatenmark', 70, 'g'),
  item('tomatenmark', 70, 'g', { plan_day: '2026-11-04', recipe_title: 'Rezept B' }),
  item('Paprika', 2, 'Stück'),
  item('Paprika', 100, 'g', { plan_day: '2026-11-04', recipe_title: 'Rezept B' }),
  item('Salz', null, 'nach Geschmack'),
  item('Milch', 1, 'l', { source: 'manual', recipe_title: null, plan_day: null }),
  item('Brot', null, null, { source: 'manual', recipe_title: null, plan_day: null, checked: true }),
  item('Zwiebel', 1, 'Stück', { checked: true }),
  item('Zwiebel', 2, 'Stück', { plan_day: '2026-11-04', recipe_title: 'Rezept B' }),
])
const byName = Object.fromEntries(groups.map((g) => [g.name.toLowerCase(), g]))

assert.deepEqual(byName.tomatenmark.amounts, [{ amount: 140, unit: 'g' }], 'gleiche Einheit wird addiert')
assert.equal(byName.tomatenmark.sources.length, 2, 'beide Rezepte als Herkunft')
assert.deepEqual(
  byName.paprika.amounts,
  [{ amount: 2, unit: 'Stück' }, { amount: 100, unit: 'g' }],
  'verschiedene Einheiten untereinander',
)
assert.deepEqual(byName.salz.amounts, [{ amount: null, unit: 'nach Geschmack' }])
assert.equal(byName.milch.hasManual, true)
assert.equal(byName.zwiebel.checked, false, 'nur teilweise abgehakt = offen')
assert.deepEqual(byName.zwiebel.amounts, [{ amount: 3, unit: 'Stück' }])
assert.equal(groups.at(-1)?.name, 'Brot', 'Erledigtes steht am Ende')
assert.deepEqual(
  groups.map((g) => g.name),
  ['Milch', 'Paprika', 'Salz', 'Tomatenmark', 'Zwiebel', 'Brot'],
  'offen alphabetisch, dann erledigt',
)
console.log('✅ Zusammenfassen der Einkaufsliste')

assert.deepEqual(parseItemInput('500 g Hackfleisch'), { name: 'Hackfleisch', amount: 500, unit: 'g' })
assert.deepEqual(parseItemInput('2 Zwiebeln'), { name: 'Zwiebeln', amount: 2, unit: null })
assert.deepEqual(parseItemInput('1,5 l Milch'), { name: 'Milch', amount: 1.5, unit: 'l' })
assert.deepEqual(parseItemInput('2 Pck. Butter'), { name: 'Butter', amount: 2, unit: 'Packung' })
assert.deepEqual(parseItemInput('Eier x10'), { name: 'Eier', amount: 10, unit: null })
assert.deepEqual(parseItemInput('  Klopapier  '), { name: 'Klopapier', amount: null, unit: null })
assert.deepEqual(parseItemInput('3 rote Paprika'), { name: 'rote Paprika', amount: 3, unit: null })
console.log('✅ Eingabe eigener Artikel')
