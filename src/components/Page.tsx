import type { ReactNode } from 'react'

type PageProps = {
  title: string
  children: ReactNode
}

/** Gemeinsamer Rahmen für alle Seiten: Überschrift oben, Inhalt darunter. */
export function Page({ title, children }: PageProps) {
  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-24">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </main>
  )
}

/** Hinweis für Bereiche, die in einem späteren Schritt gebaut werden. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-500 dark:border-stone-700 dark:text-stone-400">
      {children}
    </p>
  )
}
