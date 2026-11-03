import { useEffect, useState } from 'react'
import { Page } from '../components/Page'
import { Button, Card, ErrorText } from '../components/ui'
import { useUser } from '../lib/auth'
import { formatInviteCode, inviteLink, useHousehold } from '../lib/household'
import { errorMessage, supabase } from '../lib/supabase'
import { useTheme, type Theme } from '../lib/theme'

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
]

type Member = { user_id: string; email: string | null; role: string }

export function SettingsPage() {
  const [theme, setTheme] = useTheme()
  const user = useUser()

  return (
    <Page title="Einstellungen">
      <div className="space-y-4">
        <HouseholdSection />

        <Card>
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
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Konto</h2>
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">Angemeldet als {user.email}</p>
          <Button variant="secondary" className="w-full" onClick={() => supabase.auth.signOut()}>
            Abmelden
          </Button>
        </Card>
      </div>
    </Page>
  )
}

function HouseholdSection() {
  const { household, reload } = useHousehold()
  const user = useUser()
  const [members, setMembers] = useState<Member[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('household_members')
      .select('user_id, email, role')
      .eq('household_id', household.id)
      .order('joined_at')
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error))
        else setMembers(data ?? [])
      })
  }, [household.id])

  const link = inviteLink(household.invite_code)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formatInviteCode(household.invite_code))
      setMessage('Code kopiert.')
    } catch {
      setMessage('Kopieren nicht möglich – bitte den Code abschreiben.')
    }
  }

  async function share() {
    const text = `Tritt unserem Haushalt in der Einkaufsliste bei: ${link}\nEinladungscode: ${formatInviteCode(household.invite_code)}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Einladung zur Einkaufsliste', text })
      } catch {
        // Teilen abgebrochen – nichts zu tun.
      }
    } else {
      const subject = encodeURIComponent('Einladung zur Einkaufsliste')
      window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(text)}`
    }
  }

  async function newCode() {
    if (!confirm('Neuen Code erzeugen? Der alte Code funktioniert danach nicht mehr.')) return
    const { error } = await supabase.rpc('regenerate_invite_code')
    if (error) setError(errorMessage(error))
    else await reload()
  }

  async function leave() {
    const last = members.length <= 1
    const warning = last
      ? 'Du bist das letzte Mitglied. Der Haushalt und ALLE Rezepte, Pläne und Listen werden gelöscht. Wirklich verlassen?'
      : 'Haushalt wirklich verlassen? Du siehst die gemeinsamen Daten danach nicht mehr.'
    if (!confirm(warning)) return
    const { error } = await supabase.rpc('leave_household')
    if (error) setError(errorMessage(error))
    else await reload()
  }

  return (
    <Card>
      <h2 className="font-semibold">Haushalt: {household.name}</h2>

      <ul className="my-3 space-y-1 text-sm">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />
            {m.email ?? 'Unbekannt'}
            {m.user_id === user.id && <span className="text-stone-500 dark:text-stone-400">(du)</span>}
          </li>
        ))}
      </ul>

      <div className="rounded-xl bg-stone-100 p-3 text-center dark:bg-stone-800">
        <p className="text-sm text-stone-500 dark:text-stone-400">Einladungscode</p>
        <p className="font-mono text-2xl font-bold tracking-widest">{formatInviteCode(household.invite_code)}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={copyCode}>
          Code kopieren
        </Button>
        <Button onClick={share}>Einladen</Button>
      </div>
      {message && <p className="mt-2 text-center text-sm text-stone-500 dark:text-stone-400">{message}</p>}
      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>

      <div className="mt-3 flex justify-between text-sm">
        <button type="button" onClick={newCode} className="py-2 text-stone-500 underline dark:text-stone-400">
          Neuen Code erzeugen
        </button>
        <button type="button" onClick={leave} className="py-2 text-red-700 underline dark:text-red-400">
          Haushalt verlassen
        </button>
      </div>
    </Card>
  )
}
