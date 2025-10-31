import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import jsPDF from 'jspdf'
import api from '../../../hooks/useApi'

interface Product {
  id: number
  name: string
  sale_price?: number
  type: string
}

interface OrderResponse {
  id: number
  total: number
}

interface CartItem {
  product_id: number
  quantity: number
  name: string
  price: number
}

type PaymentMethod =
  | 'cash'
  | 'pix'
  | 'card_debit'
  | 'card_credit'
  | 'voucher'
  | 'house_account'

const paymentOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'card_debit', label: 'Cartao (debito)' },
  { value: 'card_credit', label: 'Cartao (credito)' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'house_account', label: 'Conta cliente' },
]

interface TopProduct {
  product_id: number
  name: string
  quantity_sold: number
  revenue: number
}

interface SuggestionItem extends Product {
  quantitySold: number
}

interface ReceiptItem {
  name: string
  quantity: number
  price: number
}

interface ReceiptData {
  orderId: number
  items: ReceiptItem[]
  total: number
  paymentMethod: PaymentMethod
  issuedAt: string
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const productTypeLabels: Record<string, string> = {
  dish: 'Prato',
  merchandise: 'Bebida',
}

export default function OrdersPage() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products', 'catalog'],
    queryFn: async () => {
      const response = await api.get('/products')
      return response.data
    },
  })

  const { data: topProducts } = useQuery<TopProduct[]>({
    queryKey: ['analytics', 'top-products'],
    queryFn: async () => {
      const response = await api.get('/analytics/top-products', { params: { limit: 10 } })
      return response.data
    },
    enabled: !!products?.length,
    staleTime: 1000 * 60 * 5,
  })

  const dishes = useMemo(
    () =>
      (products ?? []).filter(
        (product) => product.type === 'dish' && (product.sale_price ?? 0) > 0,
      ),
    [products],
  )

  const beverages = useMemo(
    () =>
      (products ?? []).filter(
        (product) => product.type === 'merchandise' && (product.sale_price ?? 0) > 0,
      ),
    [products],
  )

  const topSuggestionGroups = useMemo(() => {
    if (!topProducts || !products) {
      return {
        dishes: [] as SuggestionItem[],
        beverages: [] as SuggestionItem[],
      }
    }

    const dishSuggestions: SuggestionItem[] = []
    const beverageSuggestions: SuggestionItem[] = []
    const productMap = new Map<number, Product>()
    products.forEach((product) => {
      productMap.set(product.id, product)
    })

    topProducts.forEach((entry) => {
      const product = productMap.get(entry.product_id)
      if (!product || !product.sale_price || product.sale_price <= 0) {
        return
      }

      const suggestion: SuggestionItem = {
        ...product,
        quantitySold: entry.quantity_sold,
      }

      if (product.type === 'dish') {
        dishSuggestions.push(suggestion)
      } else if (product.type === 'merchandise') {
        beverageSuggestions.push(suggestion)
      }
    })

    return {
      dishes: dishSuggestions.slice(0, 5),
      beverages: beverageSuggestions.slice(0, 5),
    }
  }, [topProducts, products])

  const topDishSuggestions = topSuggestionGroups.dishes
  const topBeverageSuggestions = topSuggestionGroups.beverages

  const dishHighlights = useMemo(() => {
    const map = new Map<number, string>()
    topDishSuggestions.forEach((item, index) => {
      map.set(item.id, `#${index + 1} em pratos`)
    })
    return map
  }, [topDishSuggestions])

  const beverageHighlights = useMemo(() => {
    const map = new Map<number, string>()
    topBeverageSuggestions.forEach((item, index) => {
      map.set(item.id, `#${index + 1} em bebidas`)
    })
    return map
  }, [topBeverageSuggestions])

  const [items, setItems] = useState<CartItem[]>([])
  const [order, setOrder] = useState<OrderResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [searchTerm, setSearchTerm] = useState('')
  const [quickView, setQuickView] = useState<'dishes' | 'beverages' | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  const paymentLabels = useMemo(
    () =>
      Object.fromEntries(paymentOptions.map((option) => [option.value, option.label])) as Record<
        PaymentMethod,
        string
      >,
    [],
  )

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const matchedProducts = useMemo(() => {
    if (!normalizedSearch) {
      return [] as Product[]
    }

    return (products ?? [])
      .filter((product) => product.name.toLowerCase().includes(normalizedSearch))
      .slice(0, 20)
  }, [products, normalizedSearch])

  const toggleQuickView = (category: 'dishes' | 'beverages') => {
    setQuickView((prev) => (prev === category ? null : category))
  }

  const buildReceiptDocument = useCallback(
    (data: ReceiptData) => {
      const doc = new jsPDF()
      const issuedDate = new Date(data.issuedAt)

      doc.setFontSize(14)
      doc.text('Restaurante - Recibo', 10, 15)
      doc.setFontSize(10)
      doc.text(`Pedido #${data.orderId}`, 10, 25)
      doc.text(`Data: ${issuedDate.toLocaleString('pt-BR')}`, 10, 31)
      doc.text(`Pagamento: ${paymentLabels[data.paymentMethod]}`, 10, 37)

      doc.setFontSize(11)
      doc.text('Itens', 10, 46)
      doc.setDrawColor(200)
      doc.line(10, 48, 200, 48)

      let cursorY = 54
      doc.setFontSize(10)

      data.items.forEach((item, index) => {
        const subtotal = item.quantity * item.price
        doc.text(`${item.quantity}x ${item.name}`, 10, cursorY)
        doc.text(formatCurrency(item.price), 120, cursorY)
        doc.text(formatCurrency(subtotal), 200, cursorY, { align: 'right' })
        cursorY += 6

        if (cursorY >= 270 && index < data.items.length - 1) {
          doc.addPage()
          cursorY = 20
        }
      })

      if (cursorY < 260) {
        doc.setDrawColor(200)
        doc.line(10, cursorY + 2, 200, cursorY + 2)
      }

      doc.setFontSize(12)
      doc.text(`Total: ${formatCurrency(data.total)}`, 10, cursorY + 12)
      doc.setFontSize(10)
      doc.text('Obrigado pela preferencia!', 10, cursorY + 22)

      return doc
    },
    [paymentLabels],
  )

  const downloadReceiptPdf = useCallback(() => {
    if (!receiptData) return
    const doc = buildReceiptDocument(receiptData)
    doc.save(`recibo-pedido-${receiptData.orderId}.pdf`)
  }, [buildReceiptDocument, receiptData])

  const printReceipt = useCallback(() => {
    if (!receiptData) return
    const doc = buildReceiptDocument(receiptData)
    doc.autoPrint()
    const url = doc.output('bloburl')
    const printWindow = window.open(url)
    if (!printWindow) {
      window.alert('Nao foi possivel abrir a janela de impressao. Verifique o bloqueio de pop-ups.')
    } else if (url.startsWith('blob:') && typeof window.URL.revokeObjectURL === 'function') {
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url)
        } catch {
          // ignora falhas de limpeza
        }
      }, 20000)
    }
  }, [buildReceiptDocument, receiptData])

  const addItem = (product: Product) => {
    setError(null)
    if (!product.sale_price || product.sale_price <= 0) {
      setError('Esse item nao possui preco de venda configurado.')
      return
    }
    if (!order) {
      setReceiptData(null)
    }
    setItems((prev) => {
      const found = prev.find((item) => item.product_id === product.id)
      if (found) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          quantity: 1,
          name: product.name,
          price: product.sale_price,
        },
      ]
    })
  }

  const increment = (productId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    )
  }

  const decrement = (productId: number) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.product_id === productId ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const clearCart = (options: { keepReceipt?: boolean } = {}) => {
    setItems([])
    setOrder(null)
    setError(null)
    setPaymentMethod('cash')
    setSearchTerm('')
    setQuickView(null)
    if (!options.keepReceipt) {
      setReceiptData(null)
    }
  }

  const total = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [items],
  )

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          notes: null,
        })),
      }
      const response = await api.post('/orders', payload)
      return response.data as OrderResponse
    },
    onSuccess: (data) => {
      setOrder(data)
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao criar pedido')
    },
  })

  const payOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) return
      const payload = [{ method: paymentMethod, amount: order.total }]
      const response = await api.put(`/orders/${order.id}/pay`, payload)
      return response.data
    },
    onSuccess: () => {
      if (!order) {
        return
      }
      const receipt: ReceiptData = {
        orderId: order.id,
        total: order.total,
        paymentMethod,
        issuedAt: new Date().toISOString(),
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      }
      setReceiptData(receipt)
      clearCart({ keepReceipt: true })
      alert('Pagamento registrado com sucesso. Recibo disponivel para baixar ou imprimir.')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao registrar pagamento')
    },
  })

  const canGenerateOrder = items.length > 0 && !createOrderMutation.isPending && !order
  const canPay = !!order && !payOrderMutation.isPending

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">PDV a la carte</h1>
        <p className="text-sm text-gray-500">
          Adicione apenas os pratos vendidos. Os acompanhamentos padrao (salada, arroz, feijao) sao abatidos do estoque automaticamente.
        </p>
      </header>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded shadow flex flex-col">
          <div className="border-b px-4 py-3 space-y-3">
            <div>
              <h2 className="font-semibold text-gray-800">Itens disponiveis</h2>
              <p className="text-xs text-gray-500">
                Digite para filtrar o catalogo ou use os atalhos de mais vendidos.
              </p>
            </div>
            <input
              placeholder="Buscar por prato ou bebida..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                if (event.target.value.trim() !== '') {
                  setQuickView(null)
                }
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm.trim().length === 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggleQuickView('dishes')}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    quickView === 'dishes'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {quickView === 'dishes' ? 'Ocultar pratos mais vendidos' : 'Pratos mais vendidos'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleQuickView('beverages')}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    quickView === 'beverages'
                      ? 'bg-sky-500 text-white'
                      : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  {quickView === 'beverages'
                    ? 'Ocultar bebidas mais vendidas'
                    : 'Bebidas mais vendidas'}
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Carregando catalogo...</div>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto p-2 space-y-4">
                {normalizedSearch ? (
                  <SearchResults
                    results={matchedProducts}
                    onAdd={addItem}
                    onClose={() => setSearchTerm('')}
                  />
                ) : (
                  <>
                    {quickView === 'dishes' && (
                      <QuickSuggestionList
                        title="Pratos mais vendidos"
                        emptyMessage="Ainda nao ha dados suficientes para destacar pratos."
                        items={topDishSuggestions}
                        onAdd={addItem}
                      />
                    )}
                    {quickView === 'beverages' && (
                      <QuickSuggestionList
                        title="Bebidas mais vendidas"
                        emptyMessage="Ainda nao ha dados suficientes para destacar bebidas."
                        items={topBeverageSuggestions}
                        onAdd={addItem}
                      />
                    )}
                    <CategoryList
                      title="Pratos"
                      products={dishes}
                      emptyMessage='Nenhum prato cadastrado. Cadastre itens em "Produtos".'
                      onAdd={addItem}
                      highlights={dishHighlights}
                    />
                    <CategoryList
                      title="Bebidas"
                      products={beverages}
                      emptyMessage='Nenhuma bebida cadastrada. Cadastre itens em "Produtos".'
                      onAdd={addItem}
                      highlights={beverageHighlights}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded shadow flex flex-col">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Carrinho</h2>
            <span className="text-sm text-gray-500">{items.length} item(s)</span>
          </div>
          <div className="flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">Adicione itens para iniciar o pedido.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((item) => (
                  <li key={item.product_id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">R$ {item.price.toFixed(2)} cada</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border rounded">
                        <button
                          onClick={() => decrement(item.product_id)}
                          className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-800">{item.quantity}</span>
                        <button
                          onClick={() => increment(item.product_id)}
                          className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-semibold text-gray-800">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {receiptData && (
            <div className="mx-4 my-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  Recibo pronto para o pedido #{receiptData.orderId}.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadReceiptPdf}
                    className="rounded bg-emerald-600 px-3 py-1 text-white transition hover:bg-emerald-700"
                  >
                    Baixar PDF
                  </button>
                  <button
                    type="button"
                    onClick={printReceipt}
                    className="rounded border border-emerald-600 px-3 py-1 text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
                  >
                    Imprimir
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="border-t px-4 py-3 space-y-3">
            <div className="flex items-center justify-between text-gray-700">
              <span>Total do pedido</span>
              <span className="text-lg font-semibold">R$ {total.toFixed(2)}</span>
            </div>

            {order && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="text-sm text-gray-600 flex-1">
                  <span className="block font-medium mb-1">Forma de pagamento</span>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  >
                    {paymentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => payOrderMutation.mutate()}
                  disabled={!canPay}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
                >
                  {payOrderMutation.isPending ? 'Processando...' : 'Confirmar pagamento'}
                </button>
              </div>
            )}

            {!order && (
              <button
                onClick={() => createOrderMutation.mutate()}
                disabled={!canGenerateOrder}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
              >
                {createOrderMutation.isPending ? 'Gerando...' : 'Gerar pedido'}
              </button>
            )}

            {items.length > 0 && !createOrderMutation.isPending && (
              <button
                onClick={clearCart}
                type="button"
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Limpar carrinho
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function CategoryList({
  title,
  products,
  emptyMessage,
  onAdd,
  highlights,
}: {
  title: string
  products: Product[]
  emptyMessage: string
  onAdd: (product: Product) => void
  highlights?: Map<number, string>
}) {
  return (
    <div className="divide-y divide-gray-100 rounded border border-gray-100 bg-white shadow-sm">
      <div className="px-4 py-2 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
        {title}
      </div>
      {products.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500">{emptyMessage}</div>
      ) : (
        <ul>
          {products.map((product) => {
            const highlightLabel = highlights?.get(product.id)
            const price = product.sale_price ?? 0
            return (
              <li
                key={product.id}
                className={`px-4 py-3 flex items-center justify-between transition ${
                  highlightLabel ? 'bg-amber-50/80 ring-1 ring-amber-200' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(price)}</p>
                  {highlightLabel && (
                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      {highlightLabel}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onAdd(product)}
                  className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Adicionar
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function QuickSuggestionList({
  title,
  items,
  emptyMessage,
  onAdd,
}: {
  title: string
  items: SuggestionItem[]
  emptyMessage: string
  onAdd: (product: Product) => void
}) {
  return (
    <div className="rounded border border-dashed border-amber-300 bg-amber-50 shadow-sm">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-3 text-sm text-amber-700">{emptyMessage}</div>
      ) : (
        <ul className="divide-y divide-amber-200">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-amber-100"
            >
              <div>
                <p className="font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500">
                  #{index + 1} - {item.quantitySold.toLocaleString('pt-BR')} vendidos
                </p>
              </div>
              <button
                onClick={() => onAdd(item)}
                className="text-sm font-semibold text-amber-700 transition hover:text-amber-800"
              >
                Adicionar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SearchResults({
  results,
  onAdd,
  onClose,
}: {
  results: Product[]
  onAdd: (product: Product) => void
  onClose: () => void
}) {
  const totalResults = results.length
  return (
    <div className="rounded border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <span>
          {totalResults} resultado{totalResults === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-semibold text-blue-600 transition hover:text-blue-700"
        >
          Limpar busca
        </button>
      </div>
      {totalResults === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500">Nenhum item corresponde a sua busca.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {results.map((product) => {
            const price = product.sale_price ?? 0
            const typeLabel = productTypeLabels[product.type] ?? product.type
            return (
              <li
                key={product.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-400">
                    {typeLabel} • {formatCurrency(price)}
                  </p>
                </div>
                <button
                  onClick={() => onAdd(product)}
                  className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Adicionar
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
