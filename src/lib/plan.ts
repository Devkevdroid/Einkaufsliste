import { supabase, errorMessage } from './supabase'

export type PlanEntry = {
  id: string
  day: string
  note: string | null
  servings: number | null
  recipe: { id: string; title: string; image_url: string | null; servings: number } | null
}

/** Alle Einträge zwischen zwei Tagen (jeweils inklusive), als Objekt nach Datum. */
export async function loadPlan(from: string, to: string): Promise<Record<string, PlanEntry>> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('id, day, note, servings, recipe:recipes (id, title, image_url, servings)')
    .gte('day', from)
    .lte('day', to)
  if (error) throw new Error(errorMessage(error))
  return Object.fromEntries(data.map((entry) => [entry.day, entry]))
}

type PlanValue = { recipeId: string; servings: number } | { note: string }

/** Setzt den Eintrag für einen Tag (ersetzt einen vorhandenen). */
export async function setPlanEntry(householdId: string, day: string, value: PlanValue) {
  const row =
    'recipeId' in value
      ? { recipe_id: value.recipeId, servings: value.servings, note: null }
      : { recipe_id: null, servings: null, note: value.note.trim() }
  const { error } = await supabase
    .from('meal_plan_entries')
    .upsert({ household_id: householdId, day, ...row }, { onConflict: 'household_id,day' })
  if (error) throw new Error(errorMessage(error))
}

export async function deletePlanEntry(id: string) {
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id)
  if (error) throw new Error(errorMessage(error))
}
