import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router'
import { BookIcon, CalendarIcon, CartIcon, SettingsIcon } from './Icons'

type NavItem = {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const items: NavItem[] = [
  { to: '/woche', label: 'Woche', icon: CalendarIcon },
  { to: '/einkauf', label: 'Einkauf', icon: CartIcon },
  { to: '/rezepte', label: 'Rezepte', icon: BookIcon },
  { to: '/einstellungen', label: 'Mehr', icon: SettingsIcon },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
      <ul className="mx-auto flex max-w-xl">
        {items.map(({ to, label, icon: ItemIcon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                }`
              }
            >
              <ItemIcon className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
