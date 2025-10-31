import { Navigate, Outlet, useLocation } from 'react-router-dom'

const hasAuth = () => {
  if (typeof window === 'undefined') {
    return false
  }
  const accessToken = localStorage.getItem('access_token')
  const tenant = localStorage.getItem('tenant')
  return Boolean(accessToken && tenant)
}

export default function ProtectedRoute() {
  const location = useLocation()

  if (!hasAuth()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
