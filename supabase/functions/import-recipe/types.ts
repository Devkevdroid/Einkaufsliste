// Gemeinsame Typen für die Edge Function und die App (src/ importiert diese Datei).

export type Amount = {
  /** null bei "nach Geschmack" o. Ä. */
  amount: number | null
  unit: string | null
}

export type ImportedIngredient = {
  name: string
  /** Steht bei HelloFresh unter "Nicht in Deiner Lieferung enthalten" (Öl, Salz, Pfeffer …). */
  isPantry: boolean
  /** Mengen je Portionszahl, z. B. { "2": {...}, "4": {...} } */
  amounts: Record<string, Amount>
}

export type ImportedStep = {
  /**
   * Text wie bei HelloFresh, inkl. Portionsangaben in der Form "300 ml [400 ml | 600 ml]"
   * (Werte für 2 [3 | 4] Portionen). Die App wählt beim Anzeigen den passenden Wert.
   */
  text: string
  imageUrl: string | null
}

export type ImportedRecipe = {
  title: string
  subtitle: string | null
  imageUrl: string | null
  sourceUrl: string
  externalId: string | null
  prepMinutes: number | null
  steps: ImportedStep[]
  ingredients: ImportedIngredient[]
  /** Portionszahlen, für die HelloFresh exakte Mengen liefert (meist 2 und 4). */
  availableServings: number[]
  /** Woher die Daten stammen – hilfreich bei der Fehlersuche. */
  method: 'next-data' | 'json-ld' | 'html'
}
