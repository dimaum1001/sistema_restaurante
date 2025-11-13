import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../hooks/useApi'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const periodFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
})

interface Payable {
  id: number
  description?: string
  amount: number
  due_date: string
  status: 'open' | 'paid' | 'canceled'
  supplier?: {
    name: string
  }
  paid_at?: string
}

interface PayableCreate {
  description: string
  amount: string
  due_date: string
}

interface PayableSummaryWindow {
  start: string
  end: string
  total_paid: number
}

type SummaryGranularity = 'daily' | 'weekly' | 'monthly'

export default function PayablesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PayableCreate>({ description: '', amount: '', due_date: '' })
  const [error, setError] = useState<string | null>(null)
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [weeklyValue, setWeeklyValue] = useState(() => formatWeekInput(new Date()))
  const [monthlyValue, setMonthlyValue] = useState(() => formatMonthInput(new Date()))
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const currentWeekValue = useMemo(() => formatWeekInput(new Date()), [])
  const currentMonthValue = useMemo(() => formatMonthInput(new Date()), [])

  const weeklyReferenceDate = useMemo(() => isoWeekValueToDate(weeklyValue), [weeklyValue])
  const monthlyReferenceDate = useMemo(() => monthValueToDate(monthlyValue), [monthlyValue])

  const payablesQuery = useQuery<Payable[]>({
    queryKey: ['payables'],
    queryFn: async () => {
      const response = await api.get('/purchases/payables')
      return response.data
    },
  })

  const dailySummaryQuery = useQuery<PayableSummaryWindow>({
    queryKey: ['payables', 'summary', 'daily', dailyDate],
    queryFn: () => fetchSummaryWindow('daily', dailyDate),
    enabled: Boolean(dailyDate),
  })

  const weeklySummaryQuery = useQuery<PayableSummaryWindow>({
    queryKey: ['payables', 'summary', 'weekly', weeklyReferenceDate],
    queryFn: () => fetchSummaryWindow('weekly', weeklyReferenceDate!),
    enabled: Boolean(weeklyReferenceDate),
  })

  const monthlySummaryQuery = useQuery<PayableSummaryWindow>({
    queryKey: ['payables', 'summary', 'monthly', monthlyReferenceDate],
    queryFn: () => fetchSummaryWindow('monthly', monthlyReferenceDate!),
    enabled: Boolean(monthlyReferenceDate),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description: form.description.trim() || 'Despesa operacional',
        amount: Number(form.amount),
        due_date: form.due_date,
      }
      const response = await api.post('/purchases/payables', payload)
      return response.data
    },
    onSuccess: () => {
      setForm({ description: '', amount: '', due_date: '' })
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['payables'] })
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao cadastrar despesa.')
    },
  })

  const settleMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/purchases/payables/${id}/settle`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payables'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/purchases/payables/${id}/cancel`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payables'] })
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Informe o valor da despesa.')
      return
    }
    if (!form.due_date) {
      setError('Informe a data de vencimento.')
      return
    }
    createMutation.mutate()
  }

  const openPayables = useMemo(
    () => (payablesQuery.data ?? []).filter((item) => item.status === 'open'),
    [payablesQuery.data],
  )
  const closedPayables = useMemo(
    () => (payablesQuery.data ?? []).filter((item) => item.status !== 'open'),
    [payablesQuery.data],
  )

  return (
    <div className="space-y-8">
      <header className="glass-panel space-y-2 p-6">
        <span className="section-pill">Backoffice</span>
        <h1 className="text-3xl font-semibold text-gray-900">Contas a pagar</h1>
        <p className="text-sm text-gray-500">
          Controle despesas recorrentes como agua, luz, aluguel e outros custos administrativos.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Pago no dia"
          description="Pagamentos confirmados no dia selecionado."
          summary={dailySummaryQuery.data}
          loading={dailySummaryQuery.isLoading}
          error={dailySummaryQuery.isError ? 'Erro ao carregar resumo diário.' : undefined}
          control={
            <label className="flex flex-col text-xs text-gray-500">
              <span className="mb-1 font-semibold text-gray-600">Dia</span>
              <input
                className="input-soft text-sm"
                type="date"
                value={dailyDate}
                max={todayIso}
                onChange={(event) => setDailyDate(event.target.value)}
              />
            </label>
          }
        />
        <SummaryCard
          label="Resumo semanal"
          description="Total quitado para a semana escolhida."
          summary={weeklySummaryQuery.data}
          loading={weeklySummaryQuery.isLoading}
          error={weeklySummaryQuery.isError ? 'Erro ao carregar resumo semanal.' : undefined}
          control={
            <label className="flex flex-col text-xs text-gray-500">
              <span className="mb-1 font-semibold text-gray-600">Semana (ISO)</span>
              <input
                className="input-soft text-sm"
                type="week"
                value={weeklyValue}
                max={currentWeekValue}
                onChange={(event) => setWeeklyValue(event.target.value)}
              />
            </label>
          }
        />
        <SummaryCard
          label="Resumo mensal"
          description="Despesas quitadas no mês selecionado."
          summary={monthlySummaryQuery.data}
          loading={monthlySummaryQuery.isLoading}
          error={monthlySummaryQuery.isError ? 'Erro ao carregar resumo mensal.' : undefined}
          control={
            <label className="flex flex-col text-xs text-gray-500">
              <span className="mb-1 font-semibold text-gray-600">Mês</span>
              <input
                className="input-soft text-sm"
                type="month"
                value={monthlyValue}
                max={currentMonthValue}
                onChange={(event) => setMonthlyValue(event.target.value)}
              />
            </label>
          }
        />
      </section>

      <form onSubmit={handleSubmit} className="glass-panel space-y-4 p-6">
        <h2 className="text-lg font-semibold text-gray-800">Nova despesa</h2>
        {error && <div className="text-sm text-red-500">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Descricao">
            <input
              className="input-soft"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Ex.: Conta de luz"
            />
          </Field>
          <Field label="Valor">
            <input
              className="input-soft"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required
            />
          </Field>
          <Field label="Vencimento">
            <input
              className="input-soft"
              type="date"
              value={form.due_date}
              onChange={(event) => setForm({ ...form, due_date: event.target.value })}
              required
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createMutation.isPending ? 'Salvando...' : 'Cadastrar despesa'}
        </button>
      </form>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <PayablesTable
          title="Em aberto"
          emptyMessage="Nenhuma despesa em aberto."
          data={openPayables}
          actionLabel="Confirmar pagamento"
          onAction={(id) => settleMutation.mutate(id)}
          loading={settleMutation.isPending}
          secondaryActionLabel="Cancelar"
          onSecondaryAction={(id) => cancelMutation.mutate(id)}
        />

        <PayablesTable
          title="Historico"
          emptyMessage="Nenhum pagamento registrado."
          data={closedPayables}
          disabled
        />
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  description,
  summary,
  loading,
  control,
  error,
}: {
  label: string
  description: string
  summary?: PayableSummaryWindow
  loading: boolean
  control?: React.ReactNode
  error?: string
}) {
  const hasSummary = Boolean(summary)
  return (
    <div className="glass-panel space-y-3 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
          <div>
            <p className="text-3xl font-semibold text-gray-900">
              {loading && !hasSummary ? '...' : currencyFormatter.format(summary?.total_paid ?? 0)}
            </p>
            <p className="text-xs text-gray-500">
              {summary ? `Período ${formatPeriod(summary)}` : loading ? 'Carregando dados...' : 'Sem registros pagos'}
            </p>
          </div>
        </div>
        {control && <div className="text-right">{control}</div>}
      </div>
      <p className="text-sm text-gray-600">{description}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function PayablesTable({
  title,
  emptyMessage,
  data,
  actionLabel,
  onAction,
  loading,
  disabled,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string
  emptyMessage: string
  data: Payable[]
  actionLabel?: string
  onAction?: (id: number) => void
  loading?: boolean
  disabled?: boolean
  secondaryActionLabel?: string
  onSecondaryAction?: (id: number) => void
}) {
  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[34rem] w-full text-sm">
          <thead className="bg-slate-900/5 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Vencimento</th>
            <th className="px-4 py-3 text-left font-medium">Descricao</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
            <th className="px-4 py-3 text-right font-medium">Acao</th>
          </tr>
        </thead>
          <tbody className="divide-y divide-white/60">
          {data.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 text-gray-600">{new Date(item.due_date).toLocaleDateString('pt-BR')}</td>
              <td className="px-4 py-3 text-gray-700">{item.description ?? 'Despesa operacional'}</td>
              <td className="px-4 py-3 text-right text-gray-800">R$ {item.amount.toFixed(2)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {actionLabel && onAction && (
                    <button
                      disabled={disabled}
                      onClick={() => onAction(item.id)}
                      className="text-sm text-green-600 hover:text-green-700 font-semibold disabled:text-gray-400"
                    >
                      {loading ? 'Processando...' : actionLabel}
                    </button>
                  )}
                  {secondaryActionLabel && onSecondaryAction && (
                    <button
                      disabled={disabled}
                      onClick={() => onSecondaryAction(item.id)}
                      className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400"
                    >
                      {secondaryActionLabel}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td className="px-4 py-4 text-center text-gray-500" colSpan={4}>
                {emptyMessage}
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-gray-600 space-y-1">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

function formatPeriod(summary: PayableSummaryWindow) {
  const start = new Date(`${summary.start}T00:00:00Z`)
  const end = new Date(`${summary.end}T00:00:00Z`)
  const formattedStart = periodFormatter.format(start)
  const formattedEnd = periodFormatter.format(end)
  if (summary.start === summary.end) {
    return formattedStart
  }
  return `${formattedStart} - ${formattedEnd}`
}

async function fetchSummaryWindow(granularity: SummaryGranularity, referenceDate: string) {
  const response = await api.get('/purchases/payables/summary/window', {
    params: {
      granularity,
      reference_date: referenceDate,
    },
  })
  return response.data
}

function formatWeekInput(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const year = target.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function isoWeekValueToDate(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const week = Number(match[2])
  if (!year || !week) {
    return null
  }
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dayOfWeek = simple.getUTCDay()
  const isoWeekStart = new Date(simple)
  isoWeekStart.setUTCDate(simple.getUTCDate() - ((dayOfWeek + 6) % 7))
  return isoWeekStart.toISOString().slice(0, 10)
}

function formatMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthValueToDate(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null
  }
  return `${value}-01`
}
