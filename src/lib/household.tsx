import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useUser } from './auth'
import { readStorage, removeStorage, writeStorage } from './storage'
import { errorMessage, isNetworkError, supabase } from './supabase'

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

type CachedHousehold = { household: Household; role: HouseholdState['role'] }

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  // Zuletzt geladener Haushalt – damit die App auch ohne Netz startet.
  const cacheKey = `household:${user.id}`
  const [cached] = useState(() => readStorage<CachedHousehold | null>(cacheKey, null))
  const [household, setHousehold] = useState<Household | null>(cached?.household ?? null)
  const [role, setRole] = useState<HouseholdState['role']>(cached?.role ?? null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('household_members')
      .select('role, households (id, name, invite_code)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      // Ohne Netz mit dem gespeicherten Haushalt weitermachen.
      if (!(isNetworkError(error) && readStorage(cacheKey, null))) setError(errorMessage(error))
    } else {
      const role = (data?.role as HouseholdState['role']) ?? null
      setError(null)
      setHousehold(data?.households ?? null)
      setRole(role)
      if (data?.households) writeStorage(cacheKey, { household: data.households, role })
      else removeStorage(cacheKey)
    }
    setLoading(false)
  }, [user.id, cacheKey])

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
