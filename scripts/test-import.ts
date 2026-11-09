// Testet den Rezept-Import lokal mit echten HelloFresh-Seiten (ohne Supabase).
// Ausführen: npm run test:import            (die beiden Beispielrezepte)
//            npm run test:import -- <URL>   (beliebiges Rezept)

import assert from 'node:assert/strict'
import { parseRecipePage } from '../supabase/functions/import-recipe/parse.ts'
import { amountForServings, formatAmount, stepTextForServings } from '../src/lib/servings.ts'

const urls = process.argv.slice(2)
const examples = [
  'https://www.hellofresh.de/recipes/sigara-borek-mit-petersilien-hirtenkase-632c3ce1daae714b610a48cb',
  'https://www.hellofresh.de/recipes/gerostete-honig-harissa-aubergine-mit-burrata-63e1b6051baeba494f0abccc',
]

// Kochschritt-Text für 2, 3 und 4 Portionen
const sample =
  'In einen Topf 300 ml [400 ml | 600 ml] Wasser füllen und die Hälfte [drei Viertel | alles] vom Kumin zugeben. ' +
  'Mit 2 EL [3 EL | 4 EL] Öl mischen. Kurz dünsten. Hälfte [drei Viertel | gesamtes] Tomatenmark und von 1 [1,5 | 2] Zitrone den Saft.'
assert.equal(
  stepTextForServings(sample, 2),
  'In einen Topf 300 ml Wasser füllen und die Hälfte vom Kumin zugeben. Mit 2 EL Öl mischen. Kurz dünsten. Hälfte Tomatenmark und von 1 Zitrone den Saft.',
)
assert.equal(
  stepTextForServings(sample, 3),
  'In einen Topf 400 ml Wasser füllen und drei Viertel vom Kumin zugeben. Mit 3 EL Öl mischen. Kurz dünsten. Drei Viertel Tomatenmark und von 1,5 Zitrone den Saft.',
)
assert.equal(
  stepTextForServings(sample, 4),
  'In einen Topf 600 ml Wasser füllen und alles vom Kumin zugeben. Mit 4 EL Öl mischen. Kurz dünsten. Gesamtes Tomatenmark und von 2 Zitrone den Saft.',
)
// Hochrechnen, wenn es keine exakten Werte gibt
assert.deepEqual(amountForServings({ '2': { amount: 150, unit: 'g' }, '4': { amount: 300, unit: 'g' } }, 6), { amount: 450, unit: 'g' })
assert.deepEqual(amountForServings({ '2': { amount: 0.5, unit: 'Packung' } }, 3), { amount: 0.75, unit: 'Packung' })
// Neuere HelloFresh-Rezepte liefern die Schritte als HTML
assert.equal(
  stepTextForServings('<p dir="ltr">Erhitze 400 ml [600 ml | 800 ml] Wasser. </p>\n<p>Burrata &amp; Salat.</p>', 4),
  'Erhitze 800 ml Wasser.\nBurrata & Salat.',
)
console.log('✅ Hilfsfunktionen für Portionen und Kochschritte')

for (const url of urls.length ? urls : examples) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'de-DE' } })
  assert.equal(response.status, 200, `HTTP ${response.status} für ${url}`)
  const html = await response.text()
  const recipe = parseRecipePage(html, url)

  // Rückfallebenen prüfen: ohne Seitendaten → JSON-LD, ohne beides → HTML
  const withoutNextData = html.replace(/<script id="__NEXT_DATA__"[\s\S]*?<\/script>/, '')
  const withoutJsonLd = withoutNextData.replace(/<script[^>]*application\/ld\+json[\s\S]*?<\/script>/g, '')
  for (const [label, fallbackHtml, method] of [
    ['JSON-LD', withoutNextData, 'json-ld'],
    ['HTML', withoutJsonLd, 'html'],
  ] as const) {
    const fallback = parseRecipePage(fallbackHtml, url)
    assert.equal(fallback.method, method)
    assert.equal(fallback.ingredients.length, recipe.ingredients.length, `${label}: Anzahl Zutaten`)
    assert.ok(fallback.ingredients.some((i) => i.isPantry), `${label}: keine Vorratszutaten`)
    const fourFallback = fallback.ingredients.map((i) => formatAmount(amountForServings(i.amounts, 4)))
    console.log(`  Rückfall ${label}: ${fallback.ingredients.length} Zutaten, ${fallback.steps.length} Schritte, z. B. ${fourFallback[0]} ${fallback.ingredients[0].name}`)
  }

  console.log(`\n=== ${recipe.title} (${recipe.method})`)
  console.log(`${recipe.subtitle ?? ''} · ${recipe.prepMinutes ?? '?'} Min. · Portionen: ${recipe.availableServings.join('/')}`)
  console.log(`Bild: ${recipe.imageUrl}`)
  for (const ingredient of recipe.ingredients) {
    const four = formatAmount(amountForServings(ingredient.amounts, 4))
    console.log(`  ${ingredient.isPantry ? '[Vorrat] ' : ''}${four.padEnd(16)} ${ingredient.name}`)
  }
  console.log(`Schritt 1 (4 Portionen): ${stepTextForServings(recipe.steps[0]?.text ?? '', 4).slice(0, 160)} …`)

  assert.ok(recipe.title, 'Titel fehlt')
  assert.ok(recipe.imageUrl, 'Bild fehlt')
  assert.ok(recipe.ingredients.length >= 5, 'zu wenige Zutaten')
  assert.ok(recipe.steps.length >= 3, 'zu wenige Schritte')
  assert.ok(recipe.ingredients.some((i) => i.isPantry), 'keine Vorratszutaten erkannt')
  assert.ok(recipe.availableServings.includes(4), 'keine Mengen für 4 Portionen')
  assert.ok(!recipe.steps.some((s) => s.text.includes('\\*')), 'Markdown-Reste in den Schritten')
}
console.log('\n✅ Import-Test bestanden')
