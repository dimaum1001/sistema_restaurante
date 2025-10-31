import { Navigate, Route, Routes } from 'react-router-dom'

import LoginPage from './features/auth/pages/LoginPage'
import ProtectedRoute from './features/auth/components/ProtectedRoute'
import SalesOverviewPage from './features/analytics/pages/SalesOverviewPage'
import SalesReportsPage from './features/analytics/pages/SalesReportsPage'
import InventoryAlertsPage from './features/inventory/pages/InventoryAlertsPage'
import ProductsPage from './features/catalog/pages/ProductsPage'
import OrdersPage from './features/orders/pages/OrdersPage'
import PayablesPage from './features/payables/pages/PayablesPage'
import MainLayout from './layouts/MainLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<SalesOverviewPage />} />
          <Route path="analytics/reports" element={<SalesReportsPage />} />
          <Route path="inventory/alerts" element={<InventoryAlertsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="payables" element={<PayablesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
