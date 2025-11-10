import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const navItems: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Vendas do dia', end: true },
  { to: '/analytics/reports', label: 'Relatorios' },
  { to: '/inventory/alerts', label: 'Estoque' },
  { to: '/products', label: 'Produtos' },
  { to: '/orders', label: 'PDV' },
  { to: '/payables', label: 'Contas a pagar' },
]

const linkClasses =
  'w-full md:w-auto text-center md:text-left px-4 py-2 rounded-full text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'

export default function MainLayout() {
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('tenant')
    navigate('/login')
    setIsMenuOpen(false)
  }

  const resolveLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? `${linkClasses} bg-white text-blue-600`
      : `${linkClasses} text-blue-100 hover:text-white hover:bg-blue-500`

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  return (
    <div className="min-h-screen flex flex-col text-gray-900">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-slate-950/95 via-blue-900/80 to-indigo-900/80 text-white shadow-2xl shadow-blue-900/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 shadow-inner shadow-slate-900/50">
                  <span className="text-lg font-bold tracking-tight">HQ</span>
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight">Restaurante HQ</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/70">Operação em tempo real</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                >
                  <span>Sair</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 px-3 py-2 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  aria-label="Abrir menu de navegação"
                  aria-expanded={isMenuOpen}
                  aria-controls="main-navigation"
                  onClick={toggleMenu}
                >
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
            <div
              id="main-navigation"
              className={`${isMenuOpen ? 'flex' : 'hidden'} flex-col gap-3 md:flex md:flex-row md:items-center md:justify-between`}
            >
              <div className="flex flex-col gap-2 overflow-x-auto pb-1 md:flex-row md:flex-wrap md:items-center md:gap-2 md:pb-0">
                {navItems.map(({ to, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={resolveLinkClass}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
              <button
                onClick={handleLogout}
                className="md:hidden w-full rounded-full border border-white/30 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
          <div className="space-y-8">
            <div className="flex flex-col gap-2 text-white">
              <span className="section-pill">Painel de comando</span>
              <h1 className="text-3xl font-semibold tracking-tight">Visão geral do restaurante</h1>
              <p className="text-sm text-white/80">
                Acompanhe vendas, estoque e backoffice em um único lugar — otimizado para tablets e celulares.
              </p>
            </div>
            <div className="space-y-8">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
