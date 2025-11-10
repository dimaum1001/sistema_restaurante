import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../../hooks/useApi'
import jsPDF from 'jspdf'

type Granularity = 'daily' | 'weekly' | 'monthly'

interface SalesPeriodEntry {
  label: string
  start: string
  end: string
  total_orders: number
  total_revenue: number
  average_ticket: number
  products: TopProduct[]
}

interface TopProduct {
  product_id: number
  name: string
  quantity_sold: number
  revenue: number
}

interface SalesPeriodicSummary {
  total_orders: number
  total_revenue: number
  average_ticket: number
  products: TopProduct[]
}

interface SalesPeriodicReport {
  granularity: Granularity
  start: string
  end: string
  entries: SalesPeriodEntry[]
  summary: SalesPeriodicSummary
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
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)

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

  const handleTogglePeriod = (label: string) => {
    setExpandedPeriod((prev) => (prev === label ? null : label))
  }

  const handleExportPdf = (entry: SalesPeriodEntry) => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Relatório de vendas - ${entry.label}`, 14, 20)
    doc.setFontSize(11)
    doc.text(`Período: ${formatDate(entry.start)} a ${formatDate(entry.end)}`, 14, 30)
    doc.text(`Pedidos: ${entry.total_orders}`, 14, 38)
    doc.text(`Faturamento: ${currencyFormatter.format(entry.total_revenue)}`, 14, 46)
    doc.text(`Ticket médio: ${currencyFormatter.format(entry.average_ticket)}`, 14, 54)

    let cursorY = 66
    doc.setFontSize(12)
    doc.text('Produtos vendidos', 14, cursorY)
    cursorY += 6

    if (entry.products.length === 0) {
      doc.text('Nenhum item registrado no período.', 14, cursorY)
    } else {
      doc.setFontSize(10)
      entry.products.forEach((product, index) => {
        if (cursorY > 270) {
          doc.addPage()
          cursorY = 20
        }
        doc.text(
          `${index + 1}. ${product.name} — ${product.quantity_sold.toFixed(2)} un — ${currencyFormatter.format(product.revenue)}`,
          14,
          cursorY,
        )
        cursorY += 6
      })
    }

    doc.save(`relatorio-${entry.label}.pdf`)
  }

  const summaryCards = useMemo(() => {
    if (!data) {
      return []
    }
    return [
      { label: 'Pedidos', value: data.summary.total_orders.toLocaleString('pt-BR') },
      { label: 'Faturamento', value: currencyFormatter.format(data.summary.total_revenue) },
      { label: 'Ticket médio', value: currencyFormatter.format(data.summary.average_ticket) },
    ]
  }, [data])

  const overallTopProducts = useMemo(() => data?.summary.products.slice(0, 5) ?? [], [data?.summary.products])

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

      {data && data.summary && (
        <section className="glass-panel">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-inner shadow-white/40">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Top produtos do período</p>
            {overallTopProducts.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma venda registrada no intervalo selecionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/5 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Produto</th>
                      <th className="px-4 py-2 text-right font-medium">Quantidade</th>
                      <th className="px-4 py-2 text-right font-medium">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/60">
                    {overallTopProducts.map((product) => (
                      <tr key={product.product_id}>
                        <td className="px-4 py-2 text-slate-800">{product.name}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{product.quantity_sold.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-900">
                          {currencyFormatter.format(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

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
                  <Fragment key={entry.label}>
                    <tr
                      className="cursor-pointer transition hover:bg-slate-50"
                      onClick={() => handleTogglePeriod(entry.label)}
                    >
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
                    {expandedPeriod === entry.label && (
                      <tr>
                        <td colSpan={4} className="bg-white/60 px-4 py-4">
                          <div className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm text-slate-600">
                                Período selecionado: <strong>{formatDate(entry.start)}</strong> a{' '}
                                <strong>{formatDate(entry.end)}</strong>
                              </p>
                              <button
                                type="button"
                                onClick={() => handleExportPdf(entry)}
                                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110"
                              >
                                Exportar PDF
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <DetailCard label="Pedidos" value={entry.total_orders.toLocaleString('pt-BR')} />
                              <DetailCard label="Faturamento" value={currencyFormatter.format(entry.total_revenue)} />
                              <DetailCard label="Ticket médio" value={currencyFormatter.format(entry.average_ticket)} />
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                                Produtos vendidos
                              </p>
                              {entry.products.length === 0 ? (
                                <p className="text-sm text-slate-500">Nenhum item foi vendido neste período.</p>
                              ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-slate-900/5 text-[11px] uppercase tracking-wide text-slate-500">
                                      <tr>
                                        <th className="px-4 py-2 text-left font-medium">Produto</th>
                                        <th className="px-4 py-2 text-right font-medium">Quantidade</th>
                                        <th className="px-4 py-2 text-right font-medium">Faturamento</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/60">
                                      {entry.products.map((product) => (
                                        <tr key={`${entry.label}-${product.product_id}`}>
                                          <td className="px-4 py-2 text-slate-800">{product.name}</td>
                                          <td className="px-4 py-2 text-right text-slate-600">
                                            {product.quantity_sold.toFixed(2)}
                                          </td>
                                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                                            {currencyFormatter.format(product.revenue)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-inner shadow-white/40">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
