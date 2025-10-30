import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../hooks/useApi'

interface Payable {
  id: number
  description?: string
  amount: number
  due_date: string
  status: 'open' | 'paid' | 'canceled'
  supplier?: {
    name: string
  }
}

interface PayableCreate {
  description: string
  amount: string
  due_date: string
}

export default function PayablesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PayableCreate>({ description: '', amount: '', due_date: '' })
  const [error, setError] = useState<string | null>(null)

  const payablesQuery = useQuery<Payable[]>({
    queryKey: ['payables'],
    queryFn: async () => {
      const response = await api.get('/purchases/payables')
      return response.data
    },
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Contas a pagar</h1>
        <p className="text-sm text-gray-500">
          Controle despesas recorrentes como agua, luz, aluguel e outros custos administrativos.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Nova despesa</h2>
        {error && <div className="text-sm text-red-500">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Descricao">
            <input
              className="w-full border rounded px-3 py-2"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Ex.: Conta de luz"
            />
          </Field>
          <Field label="Valor">
            <input
              className="w-full border rounded px-3 py-2"
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
              className="w-full border rounded px-3 py-2"
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          {createMutation.isPending ? 'Salvando...' : 'Cadastrar despesa'}
        </button>
      </form>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Vencimento</th>
            <th className="px-4 py-3 text-left font-medium">Descricao</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
            <th className="px-4 py-3 text-right font-medium">Acao</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
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
