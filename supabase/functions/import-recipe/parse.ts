// Liest ein HelloFresh-Rezept aus dem HTML der Rezeptseite.
// Reihenfolge: eingebettete Seitendaten (__NEXT_DATA__) → JSON-LD (schema.org/Recipe) → HTML.
// Reines TypeScript ohne Deno-/Node-APIs, damit es auch lokal mit Node getestet werden kann.

import type { Amount, ImportedIngredient, ImportedRecipe, ImportedStep } from './types.ts'

const IMAGE_BASE = 'https://img.hellofresh.com/f_auto,fl_lossy,q_auto,w_1200/hellofresh_s3'
const STEP_IMAGE_BASE = 'https://img.hellofresh.com/f_auto,fl_lossy,q_auto,w_800/hellofresh_s3'

/** Zutaten, die bei JSON-LD/HTML ohne Lieferkennzeichen als Vorrat gelten. */
const PANTRY_NAMES = [
  'salz', 'pfeffer', 'öl', 'olivenöl', 'sonnenblumenöl', 'rapsöl', 'wasser', 'zucker',
  'essig', 'balsamicoessig', 'weißweinessig', 'butter', 'mehl', 'honig',
]

const UNIT_ALIASES: Record<string, string> = {
  esslöffel: 'EL',
  el: 'EL',
  teelöffel: 'TL',
  tl: 'TL',
  stück: 'Stück',
  stk: 'Stück',
  packung: 'Packung',
  packungen: 'Packung',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
}

const KNOWN_UNITS = new Set([
  'g', 'kg', 'ml', 'l', 'el', 'tl', 'esslöffel', 'teelöffel', 'stück', 'stk', 'packung', 'packungen',
  'zehe', 'zehen', 'zehe(n)', 'bund', 'prise', 'prisen', 'prise(n)', 'dose', 'dosen', 'dose(n)',
  'becher', 'scheibe', 'scheiben', 'scheibe(n)', 'beutel', 'glas', 'gläser', 'zweig', 'zweige',
  'zweig(e)', 'handvoll', 'msp', 'cm',
])

export class RecipeParseError extends Error {}

export function parseRecipePage(html: string, sourceUrl: string): ImportedRecipe {
  return (
    fromNextData(html, sourceUrl) ??
    fromJsonLd(html, sourceUrl) ??
    fromHtml(html, sourceUrl) ??
    (() => {
      throw new RecipeParseError('Auf dieser Seite wurde kein Rezept gefunden.')
    })()
  )
}

// ---------------------------------------------------------------------------
// 1. Eingebettete Seitendaten (Next.js)
// ---------------------------------------------------------------------------

type HfIngredient = { id: string; name: string; shipped?: boolean }
type HfYield = { yields: number; ingredients: { id: string; amount: number | null; unit: string | null }[] }
type HfStep = { index?: number; instructionsMarkdown?: string; instructions?: string; images?: { path?: string }[] }
type HfRecipe = {
  id?: string
  name: string
  headline?: string
  imagePath?: string
  websiteUrl?: string
  prepTime?: string
  totalTime?: string
  ingredients: HfIngredient[]
  yields: HfYield[]
  steps?: HfStep[]
}

function fromNextData(html: string, sourceUrl: string): ImportedRecipe | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return null
  let data: unknown
  try {
    data = JSON.parse(match[1])
  } catch {
    return null
  }
  const recipe = findRecipeObject(data)
  if (!recipe) return null

  const yields = recipe.yields
    .filter((y) => y.ingredients?.length > 0)
    .sort((a, b) => a.yields - b.yields)

  const ingredients: ImportedIngredient[] = recipe.ingredients.map((ingredient) => {
    const amounts: Record<string, Amount> = {}
    for (const y of yields) {
      const entry = y.ingredients.find((i) => i.id === ingredient.id)
      if (entry) amounts[String(y.yields)] = normalizeAmount(entry.amount, entry.unit)
    }
    return {
      name: cleanText(ingredient.name),
      isPantry: ingredient.shipped === false,
      amounts,
    }
  })

  const steps: ImportedStep[] = [...(recipe.steps ?? [])]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((step) => ({
      text: cleanStepText(step.instructionsMarkdown ?? step.instructions ?? ''),
      imageUrl: step.images?.[0]?.path ? STEP_IMAGE_BASE + step.images[0].path : null,
    }))
    .filter((step) => step.text)

  return {
    title: cleanText(recipe.name),
    subtitle: recipe.headline ? cleanText(recipe.headline) : null,
    imageUrl: recipe.imagePath ? IMAGE_BASE + recipe.imagePath : null,
    sourceUrl: recipe.websiteUrl ?? sourceUrl,
    externalId: recipe.id ?? null,
    prepMinutes: parseDuration(recipe.prepTime) ?? parseDuration(recipe.totalTime),
    steps,
    ingredients,
    availableServings: yields.map((y) => y.yields),
    method: 'next-data',
  }
}

/** Sucht im (tief verschachtelten) Next.js-Datenobjekt das Rezept. */
function findRecipeObject(value: unknown, depth = 0): HfRecipe | null {
  if (!value || typeof value !== 'object' || depth > 8) return null
  const obj = value as Record<string, unknown>
  if (typeof obj.name === 'string' && Array.isArray(obj.ingredients) && Array.isArray(obj.yields)) {
    return obj as unknown as HfRecipe
  }
  for (const child of Object.values(obj)) {
    const found = findRecipeObject(child, depth + 1)
    if (found) return found
  }
  return null
}

// ---------------------------------------------------------------------------
// 2. JSON-LD (schema.org/Recipe)
// ---------------------------------------------------------------------------

function fromJsonLd(html: string, sourceUrl: string): ImportedRecipe | null {
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let data: unknown
    try {
      data = JSON.parse(match[1])
    } catch {
      continue
    }
    const recipe = findJsonLdRecipe(data)
    if (!recipe) continue

    const servings = parseInt(String(recipe.recipeYield ?? ''), 10) || 2
    const ingredients = (recipe.recipeIngredient ?? []).map((line) => ingredientFromLine(line, servings))
    const instructions = recipe.recipeInstructions ?? []
    const steps = (Array.isArray(instructions) ? instructions : [instructions])
      .map((step) => ({ text: cleanStepText(typeof step === 'string' ? step : (step.text ?? '')), imageUrl: null }))
      .filter((step) => step.text)
    const image = Array.isArray(recipe.image) ? recipe.image[0] : recipe.image

    return {
      title: cleanText(recipe.name ?? ''),
      subtitle: null,
      imageUrl: typeof image === 'string' ? image : null,
      sourceUrl,
      externalId: null,
      prepMinutes: parseDuration(recipe.prepTime) ?? parseDuration(recipe.totalTime),
      steps,
      ingredients,
      availableServings: [servings],
      method: 'json-ld',
    }
  }
  return null
}

type JsonLdRecipe = {
  '@type'?: string | string[]
  name?: string
  image?: string | string[]
  recipeYield?: string | number
  recipeIngredient?: string[]
  recipeInstructions?: (string | { text?: string })[] | string
  prepTime?: string
  totalTime?: string
}

function findJsonLdRecipe(value: unknown): JsonLdRecipe | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonLdRecipe(item)
      if (found) return found
    }
    return null
  }
  if (!value || typeof value !== 'object') return null
  const obj = value as JsonLdRecipe & { '@graph'?: unknown }
  const type = obj['@type']
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return obj
  return obj['@graph'] ? findJsonLdRecipe(obj['@graph']) : null
}

// ---------------------------------------------------------------------------
// 3. HTML (letzter Ausweg)
// ---------------------------------------------------------------------------

function fromHtml(html: string, sourceUrl: string): ImportedRecipe | null {
  const ingredients: ImportedIngredient[] = []
  const pattern = /data-test-id="ingredient-item-(shipped|not-shipped)"([\s\S]*?)(?=data-test-id="ingredient-item-|data-test-id="utensils|$)/g
  for (const match of html.matchAll(pattern)) {
    const texts = [...match[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((p) => cleanText(stripTags(p[1])))
    if (texts.length < 2) continue
    const ingredient = ingredientFromLine(`${texts[0]} ${texts[1]}`, 2)
    ingredient.isPantry = match[1] === 'not-shipped'
    ingredients.push(ingredient)
  }
  const title = metaContent(html, 'og:title') ?? cleanText(stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''))
  if (!title || ingredients.length === 0) return null

  const steps = [...html.matchAll(/data-test-id="instruction-step"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => ({ text: cleanStepText(stripTags(m[1])), imageUrl: null }))
    .filter((step) => step.text)

  return {
    title: title.replace(/\s*\|\s*HelloFresh.*$/i, ''),
    subtitle: null,
    imageUrl: metaContent(html, 'og:image'),
    sourceUrl,
    externalId: null,
    prepMinutes: null,
    steps,
    ingredients,
    availableServings: [2],
    method: 'html',
  }
}

function metaContent(html: string, property: string): string | null {
  const match =
    html.match(new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`)) ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${property}"`))
  return match ? decodeEntities(match[1]) : null
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** "½ Packung Filoteig" → { name: "Filoteig", amounts: { "2": { amount: 0.5, unit: "Packung" } } } */
export function ingredientFromLine(line: string, servings: number): ImportedIngredient {
  let rest = cleanText(line)
  let amount: number | null = null
  let unit: string | null = null

  const amountMatch = rest.match(/^(\d+\s*[½¼¾⅓⅔]|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])\s*(.*)$/)
  if (amountMatch) {
    amount = parseNumber(amountMatch[1])
    rest = amountMatch[2]
    const unitMatch = rest.match(/^(\S+)\s+(.+)$/)
    if (unitMatch && KNOWN_UNITS.has(unitMatch[1].toLowerCase())) {
      unit = unitMatch[1]
      rest = unitMatch[2]
    }
  } else if (/^nach geschmack\s+/i.test(rest)) {
    unit = 'nach Geschmack'
    rest = rest.replace(/^nach geschmack\s+/i, '')
  }

  const name = rest.replace(/\s*\(enthält:.*$/i, '').trim()
  return {
    name,
    isPantry: PANTRY_NAMES.includes(name.toLowerCase()),
    amounts: { [String(servings)]: normalizeAmount(amount, unit) },
  }
}

function normalizeAmount(amount: number | null | undefined, unit: string | null | undefined): Amount {
  const cleanUnit = unit ? cleanText(unit) : null
  const normalizedUnit = cleanUnit ? (UNIT_ALIASES[cleanUnit.toLowerCase()] ?? cleanUnit) : null
  // HelloFresh schreibt bei "nach Geschmack" die Menge 0.
  if (!amount || normalizedUnit?.toLowerCase() === 'nach geschmack') {
    return { amount: null, unit: normalizedUnit }
  }
  return { amount: Math.round(amount * 1000) / 1000, unit: normalizedUnit }
}

function parseNumber(text: string): number {
  const fractions: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }
  const compact = text.replace(/\s+/g, '')
  const last = compact.slice(-1)
  if (last in fractions) {
    const whole = compact.slice(0, -1)
    return (whole ? parseInt(whole, 10) : 0) + fractions[last]
  }
  return parseFloat(compact.replace(',', '.'))
}

/** "PT40M" → 40 */
function parseDuration(value: string | undefined): number | null {
  if (!value) return null
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return null
  const minutes = parseInt(match[1] ?? '0', 10) * 60 + parseInt(match[2] ?? '0', 10)
  return minutes || null
}

function cleanText(text: string): string {
  return decodeEntities(text).replace(/\s+/g, ' ').trim()
}

/** Entfernt Markdown-Escapes (z. B. "Wasser\*") und trennt Sätze mit Doppel-Leerzeichen in Zeilen. */
function cleanStepText(text: string): string {
  return decodeEntities(text)
    .replace(/\\\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/[ \t]{2,}/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}
