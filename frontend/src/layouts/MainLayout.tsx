import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const linkClasses =
  'px-3 py-2 rounded text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500'

export default function MainLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('tenant')
    navigate('/login')
  }

  const resolveLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? `${linkClasses} bg-white text-blue-600`
      : `${linkClasses} text-blue-100 hover:text-white hover:bg-blue-500`

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-blue-600 text-white shadow">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-lg">Restaurante HQ</span>
              <div className="flex gap-1">
                <NavLink to="/" className={resolveLinkClass} end>
                  Vendas do dia
                </NavLink>
                <NavLink to="/analytics/reports" className={resolveLinkClass}>
                  Relatorios
                </NavLink>
                <NavLink to="/inventory/alerts" className={resolveLinkClass}>
                  Estoque
                </NavLink>
                <NavLink to="/products" className={resolveLinkClass}>
                  Produtos
                </NavLink>
                <NavLink to="/orders" className={resolveLinkClass}>
                  PDV
                </NavLink>
                <NavLink to="/payables" className={resolveLinkClass}>
                  Contas a pagar
                </NavLink>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-2 bg-blue-800 hover:bg-blue-900 rounded transition"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
