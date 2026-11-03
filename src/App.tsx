import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { RecipesPage } from './pages/RecipesPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { WeekPage } from './pages/WeekPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/woche" replace />} />
        <Route path="/woche" element={<WeekPage />} />
        <Route path="/einkauf" element={<ShoppingPage />} />
        <Route path="/rezepte" element={<RecipesPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/woche" replace />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
