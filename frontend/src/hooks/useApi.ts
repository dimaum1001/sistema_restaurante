import axios from 'axios'

const resolveBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.trim() !== '') {
    return envUrl
  }

  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return 'http://localhost:8000/api'
  }

  return '/api'
}

// Cria instância Axios configurada
const api = axios.create({
  baseURL: resolveBaseURL(),
})

// Adiciona tokens e tenant em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers['Authorization'] = `Bearer ${token}`
  }
  const tenant = localStorage.getItem('tenant')
  if (tenant) {
    config.headers = config.headers || {}
    config.headers['X-Tenant'] = tenant
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (typeof window !== 'undefined' && status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('tenant')
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  },
)

export default api
