import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Page, Placeholder } from '../components/Page'
import { ErrorText } from '../components/ui'
import { errorMessage, supabase } from '../lib/supabase'
import { matchesSearch } from '../lib/text'

type RecipeSummary = {
  id: string
  title: string
  subtitle: string | null
  image_url: string | null
  prep_minutes: number | null
}

export function RecipesPage() {
  const location = useLocation()
  const savedId = (location.state as { savedId?: string } | null)?.savedId
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, title, subtitle, image_url, prep_minutes')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error))
        else setRecipes(data)
      })
  }, [])

  const filtered = useMemo(
    () => recipes?.filter((recipe) => matchesSearch(`${recipe.title} ${recipe.subtitle ?? ''}`, query)) ?? null,
    [recipes, query],
  )

  return (
    <Page title="Rezepte">
      <div className="space-y-4">
        <Link
          to="/rezepte/import"
          className="flex h-12 items-center justify-center rounded-xl bg-emerald-700 font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          + Rezept von HelloFresh importieren
        </Link>

        {savedId && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            Rezept gespeichert.
          </p>
        )}
        <ErrorText>{error}</ErrorText>

        {recipes && recipes.length > 0 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rezepte durchsuchen …"
            aria-label="Rezepte durchsuchen"
            className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-stone-900"
          />
        )}

        {recipes?.length === 0 && <Placeholder>Noch keine Rezepte. Importiere dein erstes Rezept!</Placeholder>}
        {recipes && recipes.length > 0 && filtered?.length === 0 && (
          <Placeholder>Kein Rezept passt zu „{query}“.</Placeholder>
        )}

        <ul className="space-y-2">
          {filtered?.map((recipe) => (
            <li key={recipe.id}>
              <Link
                to={`/rezepte/${recipe.id}`}
                className={`flex items-center gap-3 rounded-2xl bg-white p-2 shadow-sm hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 ${
                  recipe.id === savedId ? 'ring-2 ring-emerald-600' : ''
                }`}
              >
                {recipe.image_url ? (
                  <img src={recipe.image_url} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="size-16 shrink-0 rounded-xl bg-stone-200 dark:bg-stone-800" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{recipe.title}</p>
                  {recipe.subtitle && (
                    <p className="truncate text-sm text-stone-500 dark:text-stone-400">{recipe.subtitle}</p>
                  )}
                  {recipe.prep_minutes && (
                    <p className="text-xs text-stone-400 dark:text-stone-500">{recipe.prep_minutes} Min.</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  )
}
