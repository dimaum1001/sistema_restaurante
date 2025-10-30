import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../hooks/useApi'

interface InventoryAlert {
  product_id: number
  product_name: string
  unit?: string
  current_stock: number
  reorder_point: number
  par_level?: number
  avg_daily_consumption?: number
  coverage_days?: number
  status: 'critical' | 'warning'
}

interface InventoryAlertResponse {
  generated_at: string
  alerts: InventoryAlert[]
}

interface StockableProduct {
  id: number
  name: string
  type?: string
  unit?: {
    id: number
    name: string
    abbreviation: string
  }
}

interface StockMove {
  id: number
  product: {
    id: number
    name: string
  }
  quantity: number
  unit?: {
    abbreviation: string
  }
  type: string
  reason?: string
  created_at: string
}

type InventoryBalances = Record<string, number>

const statusLabel: Record<'critical' | 'warning', string> = {
  critical: 'Critico',
  warning: 'Atencao',
}

export default function InventoryAlertsPage() {
  const queryClient = useQueryClient()
  const [historyDays, setHistoryDays] = useState(14)
  const [warningMultiplier, setWarningMultiplier] = useState(1.15)

  const [entryForm, setEntryForm] = useState({
    product_input: '',
    product_id: '',
    quantity: '',
    unit_cost: '',
    expiration_date: '',
  })
  const [exitForm, setExitForm] = useState({
    product_input: '',
    product_id: '',
    quantity: '',
    reason: '',
  })
  const [entryDropdownOpen, setEntryDropdownOpen] = useState(false)
  const [exitDropdownOpen, setExitDropdownOpen] = useState(false)
  const [entryError, setEntryError] = useState<string | null>(null)
  const [exitError, setExitError] = useState<string | null>(null)
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null)
  const [exitSuccess, setExitSuccess] = useState<string | null>(null)

  const { data: alerts, isLoading, isError } = useQuery<InventoryAlertResponse>({
    queryKey: ['inventory', 'alerts', historyDays, warningMultiplier],
    queryFn: async () => {
      const response = await api.get('/inventory/alerts', {
        params: {
          history_days: historyDays,
          warning_multiplier: warningMultiplier,
        },
      })
      return response.data
    },
  })

  const { data: stockableProducts } = useQuery<StockableProduct[]>({
    queryKey: ['products', 'stockable'],
    queryFn: async () => {
      const response = await api.get('/products', { params: { stockable: true } })
      return response.data
    },
  })

  const stockableOptions = useMemo(() => stockableProducts ?? [], [stockableProducts])
  const filteredEntryIngredients = useMemo(() => {
    const term = entryForm.product_input.trim().toLowerCase()
    if (!term) {
      return stockableOptions
    }
    return stockableOptions.filter((item) => item.name.toLowerCase().includes(term))
  }, [stockableOptions, entryForm.product_input])
  const filteredExitIngredients = useMemo(() => {
    const term = exitForm.product_input.trim().toLowerCase()
    if (!term) {
      return stockableOptions
    }
    return stockableOptions.filter((item) => item.name.toLowerCase().includes(term))
  }, [stockableOptions, exitForm.product_input])
  const selectedEntryProduct = useMemo(
    () => stockableOptions.find((item) => String(item.id) === entryForm.product_id) ?? null,
    [stockableOptions, entryForm.product_id],
  )
  const selectedExitProduct = useMemo(
    () => stockableOptions.find((item) => String(item.id) === exitForm.product_id) ?? null,
    [stockableOptions, exitForm.product_id],
  )
  const { data: inventoryBalances } = useQuery<InventoryBalances>({
    queryKey: ['inventory', 'balances'],
    queryFn: async () => {
      const response = await api.get('/stock/inventory')
      return response.data
    },
  })

  const { data: recentMoves } = useQuery<StockMove[]>({
    queryKey: ['inventory', 'moves'],
    queryFn: async () => {
      const response = await api.get('/stock/moves', { params: { limit: 25 } })
      return response.data
    },
  })

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory', 'alerts'] })
    queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] })
    queryClient.invalidateQueries({ queryKey: ['inventory', 'moves'] })
  }

  const entryMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        product_id: Number(entryForm.product_id),
        quantity: Number(entryForm.quantity),
        cost_price: Number(entryForm.unit_cost || 0),
      }
      if (entryForm.expiration_date) {
        payload.expiration_date = entryForm.expiration_date
      }
      const response = await api.post('/stock/batches', payload)
      return response.data
    },
    onSuccess: () => {
      setEntryForm({
        product_input: '',
        product_id: '',
        quantity: '',
        unit_cost: '',
        expiration_date: '',
      })
      setEntryDropdownOpen(false)
      setEntryError(null)
      setEntrySuccess('Entrada registrada com sucesso.')
      invalidateInventory()
    },
    onError: (err: any) => {
      setEntrySuccess(null)
      setEntryError(err.response?.data?.detail || 'Erro ao registrar entrada')
    },
  })

  const exitMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        product_id: Number(exitForm.product_id),
        quantity: Number(exitForm.quantity),
        type: 'out',
        reason: exitForm.reason || 'Baixa manual',
      }
      const response = await api.post('/stock/moves', payload)
      return response.data
    },
    onSuccess: () => {
      setExitForm({
        product_input: '',
        product_id: '',
        quantity: '',
        reason: '',
      })
      setExitError(null)
      setExitSuccess('Baixa manual registrada.')
      invalidateInventory()
      setExitDropdownOpen(false)
    },
    onError: (err: any) => {
      setExitSuccess(null)
      setExitError(err.response?.data?.detail || 'Erro ao registrar baixa')
    },
  })

  const handleSubmitEntry = (event: React.FormEvent) => {
    event.preventDefault()
    setEntryError(null)
    setEntrySuccess(null)
    if (!entryForm.product_id || !entryForm.quantity || !entryForm.unit_cost) {
      setEntryError('Informe o produto, a quantidade e o custo unitario.')
      return
    }
    entryMutation.mutate()
  }

  const handleSubmitExit = (event: React.FormEvent) => {
    event.preventDefault()
    setExitError(null)
    setExitSuccess(null)
    if (!exitForm.product_id || !exitForm.quantity) {
      setExitError('Informe o produto e a quantidade para baixa.')
      return
    }
    exitMutation.mutate()
  }

  const inventoryList = useMemo(() => {
    if (!inventoryBalances) return []
    return Object.entries(inventoryBalances)
      .map(([name, quantity]) => ({ name, quantity: Number(quantity) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [inventoryBalances])

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque e Compras</h1>
          <p className="text-gray-500">
            Registre entradas de compras, baixe insumos manualmente e acompanhe alertas de ruptura.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col text-gray-600">
            <span className="mb-1 font-medium">Historico (dias)</span>
            <input
              className="border border-gray-300 rounded px-3 py-2 text-gray-900"
              type="number"
              min={1}
              max={60}
              value={historyDays}
              onChange={(event) => setHistoryDays(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col text-gray-600">
            <span className="mb-1 font-medium">Sensibilidade</span>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-gray-900"
              value={warningMultiplier}
              onChange={(event) => setWarningMultiplier(Number(event.target.value))}
            >
              <option value={1.05}>Alta</option>
              <option value={1.15}>Moderada</option>
              <option value={1.3}>Baixa</option>
            </select>
          </label>
        </div>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Entrada de compras</h2>
          <p className="text-sm text-gray-500">
            Registre tudo que chegou para manter o estoque em dia. Use o custo unitario do insumo para manter o custo medio atualizado.
          </p>
          {entryError && <div className="text-sm text-red-500">{entryError}</div>}
          {entrySuccess && <div className="text-sm text-green-600">{entrySuccess}</div>}
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={handleSubmitEntry}>
            <label className="text-sm text-gray-600 space-y-1 sm:col-span-2 relative">
              <span className="font-medium">Ingrediente / insumo</span>
              <input
                className="w-full border rounded px-3 py-2"
                value={entryForm.product_input}
                onChange={(event) => {
                  const value = event.target.value
                  setEntryForm((prev) => ({
                    ...prev,
                    product_input: value,
                    product_id: '',
                  }))
                  setEntryDropdownOpen(true)
                }}
                onFocus={() => setEntryDropdownOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setEntryDropdownOpen(false), 150)
                }}
                placeholder="Digite para localizar um insumo..."
                required
              />
              {entryDropdownOpen && (
                <ul className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded border border-gray-200 bg-white shadow">
                  {filteredEntryIngredients.length === 0 && (
                    <li className="px-3 py-2 text-xs text-gray-400">Nenhum insumo encontrado.</li>
                  )}
                  {filteredEntryIngredients.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-gray-700 hover:bg-gray-100"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setEntryForm((prev) => ({
                            ...prev,
                            product_input: product.name,
                            product_id: String(product.id),
                          }))
                          setEntryDropdownOpen(false)
                        }}
                      >
                        <div>
                          <p className="text-sm">{product.name}</p>
                          <p className="text-xs text-gray-400">
                            {productTypeLabel(product.type)}
                            {product.unit?.abbreviation ? ` · ${product.unit.abbreviation}` : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {entryForm.product_id && (
                <p className="text-xs text-gray-500">
                  Selecionado: {entryForm.product_input}
                  {selectedEntryProduct ? ` · ${productTypeLabel(selectedEntryProduct.type)}` : ''}
                  {selectedEntryProduct?.unit?.abbreviation ? ` (${selectedEntryProduct.unit.abbreviation})` : ''}
                </p>
              )}
            </label>
            <label className="text-sm text-gray-600 space-y-1">
              <span className="font-medium">Quantidade</span>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                step="0.01"
                min="0"
                value={entryForm.quantity}
                onChange={(event) => setEntryForm({ ...entryForm, quantity: event.target.value })}
                required
              />
            </label>
            <label className="text-sm text-gray-600 space-y-1">
              <span className="font-medium">Custo unitario</span>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                step="0.01"
                min="0"
                value={entryForm.unit_cost}
                onChange={(event) => setEntryForm({ ...entryForm, unit_cost: event.target.value })}
                required
              />
            </label>
            <label className="text-sm text-gray-600 space-y-1 sm:col-span-2">
              <span className="font-medium">Validade (opcional)</span>
              <input
                className="w-full border rounded px-3 py-2"
                type="date"
                value={entryForm.expiration_date}
                onChange={(event) => setEntryForm({ ...entryForm, expiration_date: event.target.value })}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={entryMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
              >
                {entryMutation.isPending ? 'Registrando...' : 'Registrar entrada'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white shadow rounded p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Baixa manual</h2>
          <p className="text-sm text-gray-500">
            Use este formulario para descartar insumos, corrigir contagens ou lancar consumo fora do PDV.
          </p>
          {exitError && <div className="text-sm text-red-500">{exitError}</div>}
          {exitSuccess && <div className="text-sm text-green-600">{exitSuccess}</div>}
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={handleSubmitExit}>
            <label className="text-sm text-gray-600 space-y-1 sm:col-span-2 relative">
              <span className="font-medium">Ingrediente / insumo</span>
              <input
                className="w-full border rounded px-3 py-2"
                value={exitForm.product_input}
                onChange={(event) => {
                  const value = event.target.value
                  setExitForm((prev) => ({
                    ...prev,
                    product_input: value,
                    product_id: '',
                  }))
                  setExitDropdownOpen(true)
                }}
                onFocus={() => setExitDropdownOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setExitDropdownOpen(false), 150)
                }}
                placeholder="Digite para localizar um insumo..."
                required
              />
              {exitDropdownOpen && (
                <ul className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded border border-gray-200 bg-white shadow">
                  {filteredExitIngredients.length === 0 && (
                    <li className="px-3 py-2 text-xs text-gray-400">Nenhum insumo encontrado.</li>
                  )}
                  {filteredExitIngredients.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-gray-700 hover:bg-gray-100"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setExitForm((prev) => ({
                            ...prev,
                            product_input: product.name,
                            product_id: String(product.id),
                          }))
                          setExitDropdownOpen(false)
                        }}
                      >
                        <div>
                          <p className="text-sm">{product.name}</p>
                          <p className="text-xs text-gray-400">
                            {productTypeLabel(product.type)}
                            {product.unit?.abbreviation ? ` · ${product.unit.abbreviation}` : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {exitForm.product_id && (
                <p className="text-xs text-gray-500">
                  Selecionado: {exitForm.product_input}
                  {selectedExitProduct ? ` · ${productTypeLabel(selectedExitProduct.type)}` : ''}
                  {selectedExitProduct?.unit?.abbreviation ? ` (${selectedExitProduct.unit.abbreviation})` : ''}
                </p>
              )}
            </label>
            <label className="text-sm text-gray-600 space-y-1">
              <span className="font-medium">Quantidade</span>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                step="0.01"
                min="0"
                value={exitForm.quantity}
                onChange={(event) => setExitForm({ ...exitForm, quantity: event.target.value })}
                required
              />
            </label>
            <label className="text-sm text-gray-600 space-y-1 sm:col-span-2">
              <span className="font-medium">Motivo</span>
              <input
                className="w-full border rounded px-3 py-2"
                value={exitForm.reason}
                onChange={(event) => setExitForm({ ...exitForm, reason: event.target.value })}
                placeholder="Ex.: ajuste de inventario, perda, etc."
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={exitMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition"
              >
                {exitMutation.isPending ? 'Registrando...' : 'Registrar baixa'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {isLoading && <div>Calculando alertas de estoque...</div>}
      {isError && <div>Nao foi possivel recuperar os alertas de estoque.</div>}

      {alerts && (
        <section className="bg-white shadow rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Alertas de estoque</h2>
          </div>
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Ingrediente</th>
                <th className="px-4 py-3 font-medium">Saldo atual</th>
                <th className="px-4 py-3 font-medium">Ponto de pedido</th>
                <th className="px-4 py-3 font-medium">Cobertura</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {alerts.alerts.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-500" colSpan={5}>
                    Nenhum alerta para os filtros selecionados.
                  </td>
                </tr>
              )}
              {alerts.alerts.map((alert) => (
                <tr key={alert.product_id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{alert.product_name}</p>
                    {alert.unit && <p className="text-xs text-gray-400">Unidade: {alert.unit}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {alert.current_stock.toFixed(2)}
                    {alert.unit && ` ${alert.unit}`}
                  </td>
                  <td className="px-4 py-3">
                    {alert.reorder_point.toFixed(2)}
                    {alert.unit && ` ${alert.unit}`}
                  </td>
                  <td className="px-4 py-3">
                    {alert.coverage_days ? `${alert.coverage_days.toFixed(1)} dias` : 'N/A'}
                    <p className="text-xs text-gray-400">
                      Consumo medio:{' '}
                      {alert.avg_daily_consumption ? `${alert.avg_daily_consumption.toFixed(2)} / dia` : 'indisponivel'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={alert.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="px-4 py-2 text-xs text-gray-400 bg-gray-50">
            Atualizado em {new Date(alerts.generated_at).toLocaleString('pt-BR')}
          </footer>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Estoque atual</h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Ingrediente</th>
                  <th className="px-4 py-3 text-right font-medium">Quantidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventoryList.map((item) => (
                  <tr key={item.name}>
                    <td className="px-4 py-3 text-gray-700">{item.name}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{item.quantity.toFixed(2)}</td>
                  </tr>
                ))}
                {inventoryList.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-gray-500" colSpan={2}>
                      Nenhuma movimentacao registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white shadow rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Ultimas movimentacoes</h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Item</th>
                  <th className="px-4 py-3 text-right font-medium">Quantidade</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentMoves?.map((move) => (
                  <tr key={move.id}>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(move.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{move.product?.name ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-right text-gray-800">
                      {move.type === 'out' ? '-' : ''}
                      {move.quantity.toFixed(2)} {move.unit?.abbreviation ?? ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{translateMoveType(move.type)}</td>
                    <td className="px-4 py-3 text-gray-500">{move.reason ?? 'N/A'}</td>
                  </tr>
                ))}
                {(!recentMoves || recentMoves.length === 0) && (
                  <tr>
                    <td className="px-4 py-4 text-center text-gray-500" colSpan={5}>
                      Nenhuma movimentacao registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: 'critical' | 'warning' }) {
  const styles =
    status === 'critical'
      ? 'bg-red-100 text-red-800 border border-red-200'
      : 'bg-amber-100 text-amber-800 border border-amber-200'
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${styles}`}>{statusLabel[status]}</span>
}

function productTypeLabel(type?: string): string {
  switch (type) {
    case 'merchandise':
      return 'Bebida'
    case 'ingredient':
      return 'Insumo'
    case 'dish':
      return 'Prato'
    default:
      return 'Produto'
  }
}

function translateMoveType(type: string): string {
  switch (type) {
    case 'in':
      return 'Entrada'
    case 'out':
      return 'Saida'
    case 'adjust':
      return 'Ajuste'
    case 'transfer':
      return 'Transferencia'
    default:
      return type
  }
}



