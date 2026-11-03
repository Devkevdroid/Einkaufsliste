import { Page } from '../components/Page'
import { useTheme, type Theme } from '../lib/theme'

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
]

export function SettingsPage() {
  const [theme, setTheme] = useTheme()

  return (
    <Page title="Einstellungen">
      <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-stone-900">
        <h2 className="mb-3 font-semibold">Darstellung</h2>
        <div role="radiogroup" aria-label="Darstellung" className="grid grid-cols-3 gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => setTheme(option.value)}
              className={`h-12 rounded-lg border text-sm font-medium transition-colors ${
                theme === option.value
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'border-stone-200 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </Page>
  )
}
