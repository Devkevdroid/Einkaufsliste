import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** false, wenn die .env-Datei fehlt oder unvollständig ist – die App zeigt dann einen Hinweis. */
export const isSupabaseConfigured = Boolean(url && key)

export const supabase = createClient<Database>(url ?? 'http://localhost', key ?? 'missing', {
  auth: {
    // "implicit": Der Login-Link funktioniert auch, wenn er auf einem anderen Gerät
    // oder in einem anderen Browser geöffnet wird als dort, wo er angefordert wurde.
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Macht aus Supabase-Fehlern eine verständliche deutsche Meldung. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message)
    if (/rate limit/i.test(message)) {
      return 'Zu viele Anfragen – bitte warte ein paar Minuten und versuche es dann erneut.'
    }
    if (/failed to fetch|network/i.test(message)) {
      return 'Keine Verbindung zum Server. Bist du online?'
    }
    return message
  }
  return 'Unbekannter Fehler.'
}
