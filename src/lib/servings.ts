// Portionen umrechnen und Mengen anzeigen. Reine Funktionen ohne React – auch mit Node testbar.

import { htmlToText } from './text.ts'

export type Amount = { amount: number | null; unit: string | null }

/** Unsere übliche Portionszahl: beim Import, beim Einplanen und in der Rezeptansicht. */
export const DEFAULT_SERVINGS = 2

/**
 * Menge für die gewünschte Portionszahl.
 * Exakte HelloFresh-Werte haben Vorrang; sonst wird von der größten bekannten Portionszahl hochgerechnet.
 */
export function amountForServings(amounts: Record<string, Amount>, servings: number): Amount {
  const exact = amounts[String(servings)]
  if (exact) return exact
  const keys = Object.keys(amounts).map(Number).filter((n) => n > 0)
  if (keys.length === 0) return { amount: null, unit: null }
  const base = Math.max(...keys)
  return scaleAmount(amounts[String(base)], base, servings)
}

/** Menge einer gespeicherten Rezeptzutat für eine beliebige Portionszahl. */
export function ingredientAmount(
  ingredient: { amount: number | null; unit: string | null; amounts_by_servings: unknown },
  recipeServings: number,
  servings: number,
): Amount {
  const exact = ingredient.amounts_by_servings as Record<string, Amount> | null
  if (exact && Object.keys(exact).length > 0) return amountForServings(exact, servings)
  return scaleAmount({ amount: ingredient.amount, unit: ingredient.unit }, recipeServings, servings)
}

export function scaleAmount(value: Amount, fromServings: number, toServings: number): Amount {
  if (value.amount === null || fromServings === toServings) return value
  return { amount: roundAmount((value.amount * toServings) / fromServings, value.unit), unit: value.unit }
}

/** g/ml auf ganze Zahlen, sonst auf Viertel runden (z. B. 1,5 Stück). */
export function roundAmount(value: number, unit: string | null): number {
  if (unit && /^(g|ml)$/i.test(unit)) return Math.max(1, Math.round(value))
  if (value >= 10) return Math.round(value)
  return Math.max(0.25, Math.round(value * 4) / 4)
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' }

/** 1.5 → "1½", 0.25 → "¼", 300 → "300", 2.4 → "2,4" */
export function formatNumber(value: number): string {
  const whole = Math.floor(value)
  const fraction = Math.round((value - whole) * 100) / 100
  const symbol = FRACTIONS[String(fraction)]
  if (symbol) return whole > 0 ? `${whole}${symbol}` : symbol
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

/** { amount: 2, unit: "EL" } → "2 EL"; { amount: null, unit: "nach Geschmack" } → "nach Geschmack" */
export function formatAmount({ amount, unit }: Amount): string {
  if (amount === null) return unit ?? ''
  return unit ? `${formatNumber(amount)} ${unit}` : formatNumber(amount)
}

/** Eingabe wie "1,5" oder "½" in eine Zahl umwandeln; leer → null. */
export function parseAmountInput(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const symbols: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 }
  const match = trimmed.match(/^(\d*)\s*([½¼¾])$/)
  if (match) return (match[1] ? parseInt(match[1], 10) : 0) + symbols[match[2]]
  const value = parseFloat(trimmed.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

// ---------------------------------------------------------------------------
// Kochschritte: HelloFresh schreibt Portionsangaben als "300 ml [400 ml | 600 ml]" (2 [3 | 4] Portionen).
// ---------------------------------------------------------------------------

const ARTICLES = new Set(['die', 'der', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem', 'einer'])
const NUMBER = /^[\d½¼¾⅓⅔][\d.,½¼¾⅓⅔]*$/

/** Portionszahl, für die der Text der Kochschritte gilt (HelloFresh kennt nur 2, 3 und 4). */
export function stepServings(servings: number): 2 | 3 | 4 {
  return servings <= 2 ? 2 : servings === 3 ? 3 : 4
}

export function stepTextForServings(html: string, servings: number): string {
  const text = htmlToText(html)
  const target = stepServings(servings)
  let out = ''
  let last = 0
  for (const match of text.matchAll(/\s*\[([^\]|]+)\|([^\]]+)\]/g)) {
    const before = out + text.slice(last, match.index)
    last = match.index + match[0].length
    const options = [match[1].trim(), match[2].trim()]
    if (target === 2) {
      out = before
      continue
    }
    const chosen = target === 3 ? options[0] : options[1]
    // Ist der Ausgangswert nicht eindeutig erkennbar, bleibt die Angabe wie bei HelloFresh stehen.
    out = replaceBase(before, options[0], chosen) ?? `${before} [${options[0]} | ${options[1]}]`
  }
  return out + text.slice(last)
}

function popWord(text: string): { rest: string; word: string } | null {
  const match = text.match(/^([\s\S]*?)(\S+)$/)
  return match ? { rest: match[1], word: match[2] } : null
}

/** Ersetzt den Wert für 2 Portionen am Ende von `before` durch `chosen`. */
function replaceBase(before: string, sample: string, chosen: string): string | null {
  let word = popWord(before)
  if (!word) return null

  if (/^[\d½¼¾⅓⅔]/.test(sample)) {
    // Zahl, evtl. mit Einheit: "300 ml", "2 EL", "1"
    const unit = sample.split(/\s+/)[1]
    if (unit) {
      if (word.word !== unit) return null
      word = popWord(word.rest.trimEnd())
      if (!word) return null
    }
    if (!NUMBER.test(word.word)) return null
    return joinWord(word.rest, chosen)
  }

  // Wort: "die Hälfte", "Hälfte"
  let rest = word.rest
  const article = popWord(rest.trimEnd())
  if (article && ARTICLES.has(article.word.toLowerCase())) rest = article.rest
  return joinWord(rest, chosen)
}

function joinWord(rest: string, word: string): string {
  const sentenceStart = /(^|[.!?\n])\s*$/.test(rest)
  return rest + (sentenceStart ? word.charAt(0).toUpperCase() + word.slice(1) : word)
}

/** Erste URL aus einem Text holen (z. B. aus "Schau mal: https://www.hellofresh.de/recipes/…"). */
export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/)
  return match ? match[0].replace(/[).,]+$/, '') : null
}
