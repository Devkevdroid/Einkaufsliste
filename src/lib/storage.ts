// Kleiner Offline-Speicher im Browser (localStorage). Fehler werden geschluckt: ohne Speicher läuft die App trotzdem.

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Speicher voll oder gesperrt – dann eben nur im Arbeitsspeicher.
  }
}

export function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // egal
  }
}
