import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { useHouseholdState } from '../lib/household'
import { errorMessage, supabase } from '../lib/supabase'

/** Wird nach dem ersten Login gezeigt: Haushalt anlegen oder per Code beitreten. */
export function HouseholdSetupPage() {
  const { reload } = useHouseholdState()
  const [params] = useSearchParams()
  const [name, setName] = useState('Unser Haushalt')
  const [code, setCode] = useState(params.get('code') ?? '')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy('create')
    setError(null)
    const { error } = await supabase.rpc('create_household', { p_name: name })
    if (error) {
      setError(errorMessage(error))
      setBusy(null)
    } else {
      await reload()
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault()
    setBusy('join')
    setError(null)
    const { error } = await supabase.rpc('join_household', { p_code: code })
    if (error) {
      setError(errorMessage(error))
      setBusy(null)
    } else {
      await reload()
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <main className="mx-auto max-w-sm space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Willkommen!</h1>
        <p className="text-stone-500 dark:text-stone-400">
          Lege einen gemeinsamen Haushalt an oder tritt mit einem Einladungscode bei.
        </p>
      </div>

      <ErrorText>{error}</ErrorText>

      <Card>
        <form onSubmit={join} className="space-y-3">
          <h2 className="font-semibold">Ich habe einen Einladungscode</h2>
          <Input
            label="Einladungscode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-widest"
          />
          <Button type="submit" className="w-full" disabled={busy !== null || code.trim().length < 8}>
            {busy === 'join' ? 'Trete bei …' : 'Beitreten'}
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={create} className="space-y-3">
          <h2 className="font-semibold">Neuen Haushalt anlegen</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={busy !== null || !name.trim()}
          >
            {busy === 'create' ? 'Wird angelegt …' : 'Haushalt anlegen'}
          </Button>
        </form>
      </Card>

      <button
        type="button"
        onClick={signOut}
        className="w-full py-3 text-sm text-stone-500 underline dark:text-stone-400"
      >
        Abmelden
      </button>
    </main>
  )
}
