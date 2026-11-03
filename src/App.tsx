import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { Splash } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { HouseholdProvider, useHouseholdState } from './lib/household'
import { isSupabaseConfigured } from './lib/supabase'
import { HouseholdSetupPage } from './pages/HouseholdSetupPage'
import { LoginPage } from './pages/LoginPage'
import { RecipeImportPage } from './pages/RecipeImportPage'
import { RecipesPage } from './pages/RecipesPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { WeekPage } from './pages/WeekPage'

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />

  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  )
}

/** Nicht angemeldet → Login; angemeldet → Haushalt prüfen. */
function AuthGate() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <LoginPage />
  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  )
}

/** Ohne Haushalt → anlegen/beitreten; mit Haushalt → die eigentliche App. */
function HouseholdGate() {
  const { household, loading, error } = useHouseholdState()
  if (loading) return <Splash />
  if (error) return <p className="p-6 text-red-700 dark:text-red-400">Fehler beim Laden: {error}</p>
  if (!household) return <HouseholdSetupPage />

  return (
    <>
      <Routes>
        <Route path="/woche" element={<WeekPage />} />
        <Route path="/einkauf" element={<ShoppingPage />} />
        <Route path="/rezepte" element={<RecipesPage />} />
        <Route path="/rezepte/import" element={<RecipeImportPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/woche" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}

function ConfigMissing() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-xl font-bold">Supabase ist noch nicht eingerichtet</h1>
      <p>
        Lege im Projektordner eine Datei <code>.env</code> an (Vorlage: <code>.env.example</code>) und trage
        dort <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> ein. Danach den
        Entwicklungsserver neu starten.
      </p>
    </main>
  )
}
