import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { errorMessage, supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Zurück auf genau diese Seite, damit z. B. ein Einladungscode in der Adresse erhalten bleibt.
      options: { emailRedirectTo: window.location.href },
    })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else setSentTo(email.trim())
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <img src="/favicon.svg" alt="" className="mx-auto mb-3 size-16" />
        <h1 className="text-2xl font-bold">Einkaufsliste</h1>
        <p className="text-stone-500 dark:text-stone-400">Wochenplan & Einkauf für zwei</p>
      </div>

      <Card>
        {sentTo ? (
          <div className="space-y-4 text-center">
            <p className="text-4xl" aria-hidden="true">
              ✉️
            </p>
            <p>
              Wir haben einen Anmelde-Link an <strong>{sentTo}</strong> geschickt.
            </p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Öffne die E-Mail und tippe auf den Link. Schau auch im Spam-Ordner nach.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => setSentTo(null)}>
              Andere E-Mail-Adresse
            </Button>
          </div>
        ) : (
          <form onSubmit={sendLink} className="space-y-4">
            <Input
              label="E-Mail-Adresse"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
            />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
              {busy ? 'Wird gesendet …' : 'Anmelde-Link senden'}
            </Button>
            <p className="text-center text-sm text-stone-500 dark:text-stone-400">
              Kein Passwort nötig – du bekommst einen Link per E-Mail.
            </p>
          </form>
        )}
      </Card>
    </main>
  )
}
