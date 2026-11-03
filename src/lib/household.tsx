import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useUser } from './auth'
import { supabase } from './supabase'

export type Household = {
  id: string
  name: string
  invite_code: string
}

type HouseholdState = {
  household: Household | null
  role: 'owner' | 'member' | null
  loading: boolean
  error: string | null
  /** Lädt den Haushalt neu, z. B. nach Anlegen, Beitreten oder Verlassen. */
  reload: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdState | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  const [household, setHousehold] = useState<Household | null>(null)
  const [role, setRole] = useState<HouseholdState['role']>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('household_members')
      .select('role, households (id, name, invite_code)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setHousehold(data?.households ?? null)
      setRole((data?.role as HouseholdState['role']) ?? null)
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <HouseholdContext.Provider value={{ household, role, loading, error, reload }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHouseholdState() {
  const context = useContext(HouseholdContext)
  if (!context) throw new Error('useHouseholdState braucht einen HouseholdProvider.')
  return context
}

/** Der Haushalt der angemeldeten Person – nur innerhalb der eigentlichen App verwenden. */
export function useHousehold() {
  const { household, ...rest } = useHouseholdState()
  if (!household) throw new Error('Kein Haushalt geladen.')
  return { household, ...rest }
}

/** Zeigt den Code gut lesbar als ABCD-EFGH an. */
export function formatInviteCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

export function inviteLink(code: string) {
  return `${window.location.origin}/beitreten?code=${code}`
}
