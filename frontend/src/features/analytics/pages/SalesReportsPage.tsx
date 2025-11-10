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
      <header className="glass-panel flex flex-col gap-4 rounded-2xl p-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <span className="section-pill">Relatórios inteligentes</span>
          <h1 className="text-3xl font-semibold text-slate-900">Performance comparativa</h1>
          <p className="text-sm text-slate-500">
            Explore tendências, sazonalidade e ticket médio por período para direcionar promoções e metas.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex w-full flex-col text-gray-600 sm:w-auto">
            <span className="mb-1 font-medium">Início</span>
            <input
              className="input-soft"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="flex w-full flex-col text-gray-600 sm:w-auto">
            <span className="mb-1 font-medium">Fim</span>
            <input
              className="input-soft"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label className="flex w-full flex-col text-gray-600 sm:w-auto">
            <span className="mb-1 font-medium">Agrupamento</span>
            <select
              className="input-soft"
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
        <section className="table-shell">
          <div className="overflow-x-auto">
            <table className="min-w-[36rem] w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Período</th>
                  <th className="px-4 py-3 font-medium">Pedidos</th>
                  <th className="px-4 py-3 font-medium">Faturamento</th>
                  <th className="px-4 py-3 font-medium">Ticket médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-gray-700">
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
                      <p className="font-semibold text-slate-900">{entry.label}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(entry.start)} a {formatDate(entry.end)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{entry.total_orders}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {currencyFormatter.format(entry.total_revenue)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {currencyFormatter.format(entry.average_ticket)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR')
}
