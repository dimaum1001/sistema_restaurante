import { ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../hooks/useApi'

export default function LoginPage() {
  const navigate = useNavigate()
  const [tenant, setTenant] = useState('demo')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

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
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Falha no login')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Bem-vindo</h1>
          <p className="text-sm text-gray-500">Acesse com seu tenant e credenciais provisionadas.</p>
        </div>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <InputField label="Tenant">
          <input
            type="text"
            value={tenant}
            onChange={(event) => setTenant(event.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </InputField>
        <InputField label="Usuário">
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </InputField>
        <InputField label="Senha">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </InputField>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
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
