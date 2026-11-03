import { useEffect, type ReactNode } from 'react'

type SheetProps = {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Von unten einfahrendes Fenster (auf dem Handy gut mit dem Daumen erreichbar). */
export function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Schließen" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-3xl bg-stone-50 pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-3xl dark:bg-stone-900">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex size-10 items-center justify-center rounded-full text-2xl text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
