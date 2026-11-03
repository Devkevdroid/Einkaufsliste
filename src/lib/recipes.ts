import { FunctionsHttpError } from '@supabase/supabase-js'
import type { ImportedRecipe } from '../../supabase/functions/import-recipe/types.ts'
import type { Json } from './database.types'
import type { Amount } from './servings'
import { errorMessage, supabase } from './supabase'

export type { ImportedIngredient, ImportedRecipe } from '../../supabase/functions/import-recipe/types.ts'

/** Ruft die Edge Function auf und liefert das gelesene Rezept. */
export async function importRecipe(url: string): Promise<ImportedRecipe> {
  const { data, error } = await supabase.functions.invoke<{ recipe: ImportedRecipe }>('import-recipe', {
    body: { url },
  })
  if (error) {
    // Die Function schickt bei Fehlern { error: "…" } mit einer deutschen Meldung.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      if (body?.error) throw new Error(body.error)
    }
    throw new Error(errorMessage(error))
  }
  if (!data?.recipe) throw new Error('Keine Rezeptdaten erhalten.')
  return data.recipe
}

export type RecipeDraft = {
  title: string
  subtitle: string | null
  imageUrl: string | null
  sourceUrl: string
  externalId: string | null
  prepMinutes: number | null
  servings: number
  steps: { text: string; imageUrl: string | null }[]
  ingredients: {
    name: string
    amount: number | null
    unit: string | null
    isPantry: boolean
    addToList: boolean
    /** Exakte Mengen je Portionszahl; null, wenn die Menge von Hand geändert wurde. */
    amountsByServings: Record<string, Amount> | null
  }[]
}

/** Speichert ein Rezept samt Zutaten und liefert die neue id. */
export async function saveRecipe(draft: RecipeDraft): Promise<string> {
  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      title: draft.title.trim(),
      subtitle: draft.subtitle,
      image_url: draft.imageUrl,
      source: 'hellofresh',
      source_url: draft.sourceUrl,
      external_id: draft.externalId,
      prep_minutes: draft.prepMinutes,
      servings: draft.servings,
      steps: draft.steps.map((s) => ({ text: s.text, image_url: s.imageUrl })),
    })
    .select('id')
    .single()
  if (error) throw new Error(errorMessage(error))

  const { error: ingredientsError } = await supabase.from('recipe_ingredients').insert(
    draft.ingredients.map((ingredient, position) => ({
      recipe_id: recipe.id,
      position,
      name: ingredient.name.trim(),
      amount: ingredient.amount,
      unit: ingredient.unit?.trim() || null,
      is_pantry: ingredient.isPantry,
      add_to_list: ingredient.addToList,
      amounts_by_servings: ingredient.amountsByServings as Json,
    })),
  )
  if (ingredientsError) {
    // Halb gespeicherte Rezepte vermeiden.
    await supabase.from('recipes').delete().eq('id', recipe.id)
    throw new Error(errorMessage(ingredientsError))
  }
  return recipe.id
}

/** Gibt es dieses Rezept schon? Dann den Titel und die id zurückgeben. */
export async function findExistingRecipe(sourceUrl: string, externalId: string | null) {
  let query = supabase.from('recipes').select('id, title').limit(1)
  query = externalId
    ? query.or(`source_url.eq."${sourceUrl}",external_id.eq."${externalId}"`)
    : query.eq('source_url', sourceUrl)
  const { data } = await query
  return data?.[0] ?? null
}
