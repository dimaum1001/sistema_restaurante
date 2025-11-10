import { ReactNode, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../../../hooks/useApi'

type LocationState = {
  pathname: string
  search?: string
  hash?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tenant, setTenant] = useState('demo')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Redireciona se o usuario ja estiver autenticado
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const tenantStored = localStorage.getItem('tenant')
    if (token && tenantStored) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const sanitizedTenant = tenant.trim()
      const sanitizedUsername = username.trim()
      const response = await api.post(
        '/auth/login',
        { username: sanitizedUsername, password, tenant: sanitizedTenant },
        { headers: { 'X-Tenant': sanitizedTenant } },
      )
      const data = response.data
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('tenant', sanitizedTenant)
      const fromLocation = (location.state as { from?: LocationState } | null)?.from
      const nextPath =
        fromLocation?.pathname ?
          `${fromLocation.pathname}${fromLocation.search ?? ''}${fromLocation.hash ?? ''}` :
          '/'
      navigate(nextPath, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Falha no login')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass-panel w-full max-w-sm space-y-4 p-8">
        <div className="text-center space-y-2">
          <span className="section-pill">Console seguro</span>
          <h1 className="text-2xl font-bold text-gray-900">Bem-vindo</h1>
          <p className="text-sm text-gray-500">Acesse com seu tenant e credenciais provisionadas.</p>
        </div>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <InputField label="Tenant">
          <input
            type="text"
            value={tenant}
            onChange={(event) => setTenant(event.target.value)}
            className="input-soft"
            required
          />
        </InputField>
        <InputField label="Usuário">
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input-soft"
            required
          />
        </InputField>
        <InputField label="Senha">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input-soft"
            required
          />
        </InputField>
        <button
          type="submit"
          className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110"
        >
          Entrar
        </button>
      </form>
    </div>
  )
}

function InputField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm text-gray-600">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}
