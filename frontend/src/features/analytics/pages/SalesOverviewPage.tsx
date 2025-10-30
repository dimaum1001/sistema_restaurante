import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../../hooks/useApi'

interface PaymentBreakdownItem {
  method: string
  amount: number
  percentage: number
}

interface TopProductItem {
  product_id: number
  name: string
  quantity_sold: number
  revenue: number
}

interface SalesDailyOverview {
  date: string
  generated_at: string
  total_orders: number
  total_revenue: number
  average_ticket: number
  customers_served: number
  payment_breakdown: PaymentBreakdownItem[]
  top_products: TopProductItem[]
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

export default function SalesOverviewPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [productView, setProductView] = useState<'top' | 'all'>('top')

  const { data, isLoading, isError } = useQuery<SalesDailyOverview>({
    queryKey: ['analytics', 'daily', selectedDate],
    queryFn: async () => {
      const response = await api.get('/analytics/daily', {
        params: { target_date: selectedDate, top_limit: 5 },
      })
      return response.data
    },
  })

  const paymentMix = useMemo(
    () => data?.payment_breakdown ?? [],
    [data?.payment_breakdown],
  )

const topProducts = useMemo(
    () => data?.top_products ?? [],
    [data?.top_products],
  )

  const allProducts = useMemo(
    () => data?.sold_products ?? [],
    [data?.sold_products],
  )

  if (isLoading) {
    return <div>Carregando visão diária...</div>
  }

  if (isError || !data) {
    return <div>Não foi possível carregar as métricas de vendas.</div>
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral das Vendas</h1>
          <p className="text-gray-500">Métricas consolidadas do dia selecionado para apoio às decisões em tempo real.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-600">Data:</span>
          <input
            className="border border-gray-300 rounded px-3 py-2 text-gray-900"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Faturamento" value={currencyFormatter.format(data.total_revenue)} />
        <KpiCard title="Pedidos pagos" value={data.total_orders.toString()} />
        <KpiCard title="Ticket médio" value={currencyFormatter.format(data.average_ticket)} />
        <KpiCard title="Clientes atendidos" value={data.customers_served.toString()} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Mix de Pagamentos</h2>
          <div className="space-y-3">
            {paymentMix.length === 0 && <p className="text-sm text-gray-500">Ainda não há lançamentos para o período.</p>}
            {paymentMix.map((item) => (
              <div key={item.method} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 capitalize">{translatePayment(item.method)}</p>
                  <p className="text-xs text-gray-400">{item.percentage.toFixed(1)}% do faturamento</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{currencyFormatter.format(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white shadow rounded p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Produtos vendidos</h2>
            <div className="inline-flex rounded border border-gray-200 bg-gray-50 p-1 text-xs font-medium text-gray-600">
              <button
                type="button"
                onClick={() => setProductView('top')}
                className={`px-3 py-1 rounded transition ${productView === 'top' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Destaques
              </button>
              <button
                type="button"
                onClick={() => setProductView('all')}
                className={`px-3 py-1 rounded transition ${productView === 'all' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Todos
              </button>
            </div>
          </div>
          {productView === 'top' ? (
            <div className="space-y-3">
              {topProducts.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum produto vendido no período informado.</p>
              )}
              {topProducts.map((product) => (
                <div key={product.product_id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.quantity_sold.toFixed(2)} unidades</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {currencyFormatter.format(product.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {allProducts.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum produto vendido no período informado.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Produto</th>
                      <th className="px-4 py-2 text-right font-medium">Quantidade</th>
                      <th className="px-4 py-2 text-right font-medium">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allProducts.map((product) => (
                      <tr key={product.product_id}>
                        <td className="px-4 py-2 text-gray-700">{product.name}</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {product.quantity_sold.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900 font-medium">
                          {currencyFormatter.format(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="text-xs text-gray-400">
        Atualizado às {new Date(data.generated_at).toLocaleTimeString('pt-BR')} — fonte: módulo de analytics.
      </footer>
    </div>
  )
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white shadow rounded px-6 py-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p>
    </div>
  )
}

function translatePayment(method: string): string {
  switch (method) {
    case 'cash':
      return 'Dinheiro'
    case 'pix':
      return 'PIX'
    case 'card_debit':
      return 'Cartão (débito)'
    case 'card_credit':
      return 'Cartão (crédito)'
    case 'voucher':
      return 'Voucher'
    case 'house_account':
      return 'Conta cliente'
    default:
      return method
  }
}
