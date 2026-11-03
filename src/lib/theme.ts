import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

let current: Theme = readTheme()

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // localStorage nicht verfügbar (z. B. privates Fenster) – dann gilt die Systemeinstellung.
  }
  return 'system'
}

function applyTheme() {
  const dark = current === 'dark' || (current === 'system' && darkQuery.matches)
  document.documentElement.classList.toggle('dark', dark)
}

/** Einmal beim Start aufrufen: setzt den Modus und folgt danach der Systemeinstellung. */
export function initTheme() {
  applyTheme()
  darkQuery.addEventListener('change', applyTheme)
}

export function setTheme(theme: Theme) {
  current = theme
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignorieren – die Wahl gilt dann nur bis zum Neuladen
  }
  applyTheme()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Liefert die gewählte Farbdarstellung und eine Funktion zum Ändern. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  return [theme, setTheme] as const
}
