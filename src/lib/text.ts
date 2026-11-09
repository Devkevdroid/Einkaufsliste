/** Für Suche und Vergleiche: Kleinbuchstaben, Akzente entfernt ("Börek" → "borek", "ß" → "ss"). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .trim()
}

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }

/** Neuere HelloFresh-Schritte enthalten HTML ("<p>…</p>"): Absätze werden zu Zeilen, übrige Tags entfallen. */
export function htmlToText(text: string): string {
  if (!/<[a-z/]/i.test(text)) return text
  return text
    .replace(/<\/p>|<br\s*\/?>|<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

/** true, wenn alle Suchwörter im Text vorkommen. */
export function matchesSearch(text: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const haystack = normalize(text)
  return words.every((word) => haystack.includes(word))
}
