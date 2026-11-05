import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Placeholder } from '../components/Page'
import { ServingsStepper } from '../components/ServingsStepper'
import { Button, Card, ErrorText } from '../components/ui'
import type { Tables } from '../lib/database.types'
import { DEFAULT_SERVINGS, formatAmount, ingredientAmount, stepServings, stepTextForServings } from '../lib/servings'
import { getStoredRecipe, putStoredRecipe, syncRecipes, type StoredRecipe } from '../lib/recipeStore'
import { errorMessage, isNetworkError, supabase } from '../lib/supabase'

type Ingredient = Tables<'recipe_ingredients'>
type Recipe = StoredRecipe
type Step = { text: string; image_url: string | null }

export function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined)
  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let fresh = false
    // Sofort die Fassung vom Gerät zeigen (auch offline), dann vom Server aktualisieren.
    void getStoredRecipe(id).then((stored) => {
      if (!fresh && stored) setRecipe(stored)
    })
    supabase
      .from('recipes')
      .select('*, recipe_ingredients (*)')
      .eq('id', id)
      .order('position', { referencedTable: 'recipe_ingredients' })
      .maybeSingle()
      .then(async ({ data, error }) => {
        // Offline mit gespeicherter Fassung: einfach diese weiter anzeigen.
        if (error && isNetworkError(error) && (await getStoredRecipe(id))) return
        fresh = true
        if (error) setError(errorMessage(error))
        setRecipe(data)
        if (data) void putStoredRecipe(data)
      })
  }, [id])

  async function toggleOnList(ingredient: Ingredient) {
    const addToList = !ingredient.add_to_list
    const update = (value: boolean) =>
      setRecipe((r) =>
        r && {
          ...r,
          recipe_ingredients: r.recipe_ingredients.map((i) => (i.id === ingredient.id ? { ...i, add_to_list: value } : i)),
        },
      )
    update(addToList)
    const { error } = await supabase.from('recipe_ingredients').update({ add_to_list: addToList }).eq('id', ingredient.id)
    if (error) {
      update(!addToList)
      setError(errorMessage(error))
    }
  }

  async function remove() {
    if (!recipe) return
    if (!confirm(`„${recipe.title}“ löschen? Es wird auch aus dem Wochenplan entfernt.`)) return
    setDeleting(true)
    const { error } = await supabase.from('recipes').delete().eq('id', recipe.id)
    if (error) {
      setError(errorMessage(error))
      setDeleting(false)
    } else {
      void syncRecipes().catch(() => undefined)
      navigate('/rezepte', { replace: true })
    }
  }

  if (recipe === undefined && !error) return null

  if (!recipe) {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 pt-6 pb-24">
        <BackLink />
        <ErrorText>{error}</ErrorText>
        <Placeholder>Dieses Rezept gibt es nicht (mehr).</Placeholder>
      </main>
    )
  }

  const steps = (recipe.steps as Step[] | null) ?? []
  const delivered = recipe.recipe_ingredients.filter((i) => !i.is_pantry)
  const pantry = recipe.recipe_ingredients.filter((i) => i.is_pantry)

  return (
    <main className="mx-auto max-w-xl pb-24">
      <div className="relative">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt="" className="aspect-[16/10] w-full object-cover sm:rounded-b-2xl" />
        ) : (
          <div className="h-20" />
        )}
        <div className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3">
          <BackLink floating />
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{recipe.title}</h1>
          {recipe.subtitle && <p className="text-stone-500 dark:text-stone-400">{recipe.subtitle}</p>}
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {recipe.prep_minutes ? `${recipe.prep_minutes} Min. · ` : ''}
            {recipe.source_url && (
              <a href={recipe.source_url} target="_blank" rel="noreferrer" className="underline">
                Original bei HelloFresh
              </a>
            )}
          </p>
        </div>

        <ErrorText>{error}</ErrorText>

        <Card>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Portionen</span>
            <ServingsStepper value={servings} onChange={setServings} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Zutaten</h2>
          <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
            Haken = kommt beim Einplanen auf die Einkaufsliste.
          </p>
          <IngredientList items={delivered} recipe={recipe} servings={servings} onToggle={toggleOnList} />
          {pantry.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 font-semibold">Vorrat</h3>
              <IngredientList items={pantry} recipe={recipe} servings={servings} onToggle={toggleOnList} />
            </>
          )}
        </Card>

        {steps.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold">Zubereitung</h2>
            {stepServings(servings) !== servings && (
              <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
                Mengen in den Schritten gelten für {stepServings(servings)} Portionen.
              </p>
            )}
            <ol className="space-y-5">
              {steps.map((step, i) => (
                <li key={i} className="space-y-2">
                  {step.image_url && (
                    <img src={step.image_url} alt="" loading="lazy" className="aspect-[16/10] w-full rounded-xl object-cover" />
                  )}
                  <div className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <p className="whitespace-pre-line">{stepTextForServings(step.text, servings)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        <Button variant="danger" className="w-full" onClick={remove} disabled={deleting}>
          {deleting ? 'Wird gelöscht …' : 'Rezept löschen'}
        </Button>
      </div>
    </main>
  )
}

function BackLink({ floating = false }: { floating?: boolean }) {
  return (
    <Link
      to="/rezepte"
      className={
        floating
          ? 'flex h-10 items-center rounded-full bg-white/90 px-4 text-sm font-medium shadow backdrop-blur dark:bg-stone-900/90'
          : 'text-sm font-medium text-emerald-700 dark:text-emerald-400'
      }
    >
      ← Rezepte
    </Link>
  )
}

type IngredientListProps = {
  items: Ingredient[]
  recipe: Recipe
  servings: number
  onToggle: (ingredient: Ingredient) => void
}

function IngredientList({ items, recipe, servings, onToggle }: IngredientListProps) {
  return (
    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
      {items.map((ingredient) => (
        <li key={ingredient.id}>
          <label
            className={`flex min-h-11 cursor-pointer items-center gap-3 py-1 ${
              ingredient.add_to_list ? '' : 'text-stone-400 dark:text-stone-500'
            }`}
          >
            <input
              type="checkbox"
              checked={ingredient.add_to_list}
              onChange={() => onToggle(ingredient)}
              className="ml-3 size-5 shrink-0 accent-emerald-700"
            />
            <span className="w-24 shrink-0 tabular-nums text-stone-500 dark:text-stone-400">
              {formatAmount(ingredientAmount(ingredient, recipe.servings, servings))}
            </span>
            <span>{ingredient.name}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}
