import { Link, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'

const navItems = [
  { label: 'Dashboard', to: '/admin' as const },
  { label: 'Guest List', to: '/admin/guest-list' as const },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <main className="afterlife-bg min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="admin-shell-card animate-rise flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.34em] text-red-200/80">
              Afterlife Club 2026
            </p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
              Admin Control Room
            </h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const isActive = item.to === '/admin'
                ? location.pathname === '/admin' || location.pathname === '/admin/'
                : location.pathname === item.to || location.pathname.startsWith('/admin/guest/')

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={isActive ? 'admin-nav-link admin-nav-link-active' : 'admin-nav-link'}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        {children}
      </div>
    </main>
  )
}
