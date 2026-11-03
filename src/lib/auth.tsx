import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { storedSession, supabase } from './supabase'

type AuthState = {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    // Liefert sofort ein INITIAL_SESSION-Ereignis – auch nach dem Klick auf den Login-Link.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Ohne Netz mit der gespeicherten Anmeldung weitermachen (z. B. Einkaufsliste im Laden).
      // Sobald wieder Netz da ist, erneuert supabase-js sie selbst und meldet sich hier erneut.
      if (event === 'INITIAL_SESSION' && !session) session = storedSession()
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export function useUser() {
  const { session } = useAuth()
  if (!session) throw new Error('useUser darf nur nach dem Login verwendet werden.')
  return session.user
}
