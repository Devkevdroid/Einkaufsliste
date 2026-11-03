/** Für Suche und Vergleiche: Kleinbuchstaben, Akzente entfernt ("Börek" → "borek", "ß" → "ss"). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .trim()
}

/** true, wenn alle Suchwörter im Text vorkommen. */
export function matchesSearch(text: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const haystack = normalize(text)
  return words.every((word) => haystack.includes(word))
}
