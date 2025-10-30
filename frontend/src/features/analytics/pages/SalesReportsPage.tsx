import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../../hooks/useApi'

type Granularity = 'daily' | 'weekly' | 'monthly'

interface SalesPeriodEntry {
  label: string
  start: string
  end: string
  total_orders: number
  total_revenue: number
  average_ticket: number
}

interface SalesPeriodicReport {
  granularity: Granularity
  start: string
  end: string
  entries: SalesPeriodEntry[]
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

export default function SalesReportsPage() {
  const today = new Date()
  const defaultStart = new Date(today)
  defaultStart.setDate(defaultStart.getDate() - 30)

  const [granularity, setGranularity] = useState<Granularity>('weekly')
  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10))

  const { data, isLoading, isError } = useQuery<SalesPeriodicReport>({
    queryKey: ['analytics', 'periodic', granularity, startDate, endDate],
    queryFn: async () => {
      const response = await api.get('/analytics/periodic', {
        params: {
          granularity,
          start_date: startDate,
          end_date: endDate,
        },
      })
      return response.data
    },
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios Analíticos</h1>
          <p className="text-gray-500">
            Compare períodos distintos para acompanhar tendências, sazonalidade e oscilações de ticket médio.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col text-gray-600">
            <span className="mb-1 font-medium">Início</span>
            <input
              className="border border-gray-300 rounded px-3 py-2 text-gray-900"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="flex flex-col text-gray-600">
            <span className="mb-1 font-medium">Fim</span>
            <input
              className="border border-gray-300 rounded px-3 py-2 text-gray-900"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label className="flex flex-col text-gray-600">
            <span className="mb-1 font-medium">Agrupamento</span>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-gray-900"
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as Granularity)}
            >
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </label>
        </div>
      </header>

      {isLoading && <div>Carregando relatórios...</div>}
      {isError && <div>Não foi possível carregar os dados de relatórios.</div>}

      {data && (
        <section className="bg-white shadow rounded overflow-hidden">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Pedidos</th>
                <th className="px-4 py-3 font-medium">Faturamento</th>
                <th className="px-4 py-3 font-medium">Ticket médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {data.entries.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-500" colSpan={4}>
                    Nenhum dado encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
              {data.entries.map((entry) => (
                <tr key={entry.label}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{entry.label}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(entry.start)} a {formatDate(entry.end)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{entry.total_orders}</td>
                  <td className="px-4 py-3">{currencyFormatter.format(entry.total_revenue)}</td>
                  <td className="px-4 py-3">{currencyFormatter.format(entry.average_ticket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR')
}
