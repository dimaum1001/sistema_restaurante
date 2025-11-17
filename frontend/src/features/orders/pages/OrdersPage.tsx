import { FormEvent, useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import jsPDF from 'jspdf'
import api from '../../../hooks/useApi'

interface Unit {
  id: number
  name: string
  abbreviation: string
}

interface Product {
  id: number
  name: string
  sale_price?: number
  cost_price?: number
  type: string
  unit?: Unit
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

interface ProductEditFormState {
  name: string
  unit_id: string
  sale_price: string
  cost_price: string
}

interface ProductUpdatePayload {
  name: string
  type: string
  unit_id?: number
  sale_price?: number
  cost_price?: number
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const productTypeLabels: Record<string, string> = {
  dish: 'Prato',
  merchandise: 'Bebida',
  ingredient: 'Insumo',
}

const emptyProductEditForm: ProductEditFormState = {
  name: '',
  unit_id: '',
  sale_price: '',
  cost_price: '',
}

export default function OrdersPage() {
  const queryClient = useQueryClient()
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
    () => (products ?? []).filter((product) => product.type === 'dish'),
    [products],
  )

  const beverages = useMemo(
    () => (products ?? []).filter((product) => product.type === 'merchandise'),
    [products],
  )

  const unsellableDishCount = useMemo(
    () => dishes.filter((dish) => (dish.sale_price ?? 0) <= 0).length,
    [dishes],
  )

  const unsellableBeverageCount = useMemo(
    () => beverages.filter((beverage) => (beverage.sale_price ?? 0) <= 0).length,
    [beverages],
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productEditForm, setProductEditForm] = useState<ProductEditFormState>({ ...emptyProductEditForm })
  const [productEditError, setProductEditError] = useState<string | null>(null)

  const paymentLabels = useMemo(
    () =>
      Object.fromEntries(paymentOptions.map((option) => [option.value, option.label])) as Record<
        PaymentMethod,
        string
      >,
    [],
  )

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const unitsQuery = useQuery<Unit[]>({
    queryKey: ['products', 'units'],
    queryFn: async () => {
      const response = await api.get('/products/units')
      return response.data
    },
    enabled: Boolean(editingProduct),
    staleTime: 1000 * 60 * 5,
  })

  const closeProductEditor = () => {
    setEditingProduct(null)
    setProductEditForm({ ...emptyProductEditForm })
    setProductEditError(null)
  }

  const startEditProduct = (product: Product) => {
    setEditingProduct(product)
    setProductEditForm({
      name: product.name,
      unit_id: product.unit ? String(product.unit.id) : '',
      sale_price: product.sale_price !== undefined ? product.sale_price.toString() : '',
      cost_price: product.cost_price !== undefined ? product.cost_price.toString() : '',
    })
    setProductEditError(null)
  }

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ProductUpdatePayload }) => {
      const response = await api.put(`/products/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'catalog'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'dishes'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'beverages'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', 'top-products'] })
      closeProductEditor()
    },
    onError: (err: any) => {
      setProductEditError(err.response?.data?.detail || 'Nao foi possivel atualizar o item.')
    },
  })

  const handleProductEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingProduct) {
      return
    }
    setProductEditError(null)

    const trimmedName = productEditForm.name.trim()
    const unitId = productEditForm.unit_id ? Number(productEditForm.unit_id) : undefined
    const salePrice = productEditForm.sale_price ? Number(productEditForm.sale_price) : undefined
    const costPrice = productEditForm.cost_price ? Number(productEditForm.cost_price) : undefined
    const requiresSalePrice = editingProduct.type !== 'ingredient'
    const requiresUnit = editingProduct.type === 'ingredient'

    if (!trimmedName) {
      setProductEditError('Informe o nome do item.')
      return
    }
    if (requiresSalePrice && (!salePrice || salePrice <= 0)) {
      setProductEditError('Informe um preco de venda maior que zero.')
      return
    }
    if (requiresUnit && !unitId) {
      setProductEditError('Selecione a unidade de medida do insumo.')
      return
    }

    const payload: ProductUpdatePayload = {
      name: trimmedName,
      type: editingProduct.type,
      unit_id: unitId,
      sale_price: salePrice,
      cost_price: costPrice,
    }
    updateProductMutation.mutate({ id: editingProduct.id, payload })
  }

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
    <>
      <div className="space-y-8">
        <header className="glass-panel space-y-2 p-6">
          <span className="section-pill">Frente de caixa</span>
          <h1 className="text-3xl font-semibold text-gray-900">PDV a la carte</h1>
          <p className="text-sm text-gray-500">
            Adicione pratos e bebidas em poucos toques. Os acompanhamentos padrao sao baixados automaticamente do estoque.
          </p>
        </header>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section className="glass-panel flex flex-col">
          <div className="border-b border-white/40 px-4 py-4 space-y-3">
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
              className="input-soft"
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
                    onEdit={startEditProduct}
                  />
                ) : (
                  <>
                    {quickView === 'dishes' && (
                      <QuickSuggestionList
                        title="Pratos mais vendidos"
                        emptyMessage="Ainda nao ha dados suficientes para destacar pratos."
                        items={topDishSuggestions}
                        onAdd={addItem}
                        onEdit={startEditProduct}
                      />
                    )}
                    {quickView === 'beverages' && (
                      <QuickSuggestionList
                        title="Bebidas mais vendidas"
                        emptyMessage="Ainda nao ha dados suficientes para destacar bebidas."
                        items={topBeverageSuggestions}
                        onAdd={addItem}
                        onEdit={startEditProduct}
                      />
                    )}
                    {unsellableDishCount > 0 && (
                      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                        {unsellableDishCount === 1
                          ? '1 prato ainda nao possui preco de venda. Clique em Editar para liberar no PDV.'
                          : `${unsellableDishCount} pratos ainda nao possuem preco de venda. Clique em Editar para libera-los no PDV.`}
                      </div>
                    )}
                    <CategoryList
                      title="Pratos"
                      products={dishes}
                      emptyMessage='Nenhum prato cadastrado. Cadastre itens em "Produtos".'
                      onAdd={addItem}
                      onEdit={startEditProduct}
                      highlights={dishHighlights}
                    />
                    {unsellableBeverageCount > 0 && (
                      <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800">
                        {unsellableBeverageCount === 1
                          ? '1 bebida ainda nao possui preco. Ajuste em Editar para vender no PDV.'
                          : `${unsellableBeverageCount} bebidas ainda nao possuem preco. Ajuste em Editar para vende-las no PDV.`}
                      </div>
                    )}
                    <CategoryList
                      title="Bebidas"
                      products={beverages}
                      emptyMessage='Nenhuma bebida cadastrada. Cadastre itens em "Produtos".'
                      onAdd={addItem}
                      onEdit={startEditProduct}
                      highlights={beverageHighlights}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel flex flex-col">
          <div className="border-b border-white/40 px-4 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-800">Carrinho</h2>
            <span className="text-sm text-gray-500">{items.length} item(s)</span>
          </div>
          <div className="flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">Adicione itens para iniciar o pedido.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((item) => (
                  <li
                    key={item.product_id}
                    className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">R$ {item.price.toFixed(2)} cada</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-col gap-1 text-gray-700 sm:flex-row sm:items-center sm:justify-between">
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
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {payOrderMutation.isPending ? 'Processando...' : 'Confirmar pagamento'}
                </button>
              </div>
            )}

            {!order && (
              <button
                onClick={() => createOrderMutation.mutate()}
                disabled={!canGenerateOrder}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createOrderMutation.isPending ? 'Gerando...' : 'Gerar pedido'}
              </button>
            )}

            {items.length > 0 && !createOrderMutation.isPending && (
              <button
                onClick={clearCart}
                type="button"
                className="w-full text-sm font-semibold text-gray-400 transition hover:text-gray-700"
              >
                Limpar carrinho
              </button>
            )}
          </div>
        </section>
      </div>
      </div>
      <ProductEditDrawer
        product={editingProduct}
        form={productEditForm}
        units={unitsQuery.data ?? []}
        error={productEditError}
        isSaving={updateProductMutation.isPending}
        isLoadingUnits={unitsQuery.isLoading}
        onClose={closeProductEditor}
        onChange={(field, value) => setProductEditForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleProductEditSubmit}
      />
    </>
  )
}

function CategoryList({
  title,
  products,
  emptyMessage,
  onAdd,
  onEdit,
  highlights,
}: {
  title: string
  products: Product[]
  emptyMessage: string
  onAdd: (product: Product) => void
  onEdit?: (product: Product) => void
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
          {[...products]
            .sort((a, b) => {
              const aSellable = (a.sale_price ?? 0) > 0 ? 1 : 0
              const bSellable = (b.sale_price ?? 0) > 0 ? 1 : 0
              if (aSellable !== bSellable) {
                return bSellable - aSellable
              }
              return a.name.localeCompare(b.name)
            })
            .map((product) => {
              const highlightLabel = highlights?.get(product.id)
              const salePrice = typeof product.sale_price === 'number' ? product.sale_price : null
              const isSellable = !!salePrice && salePrice > 0
              const priceLabel = salePrice !== null ? formatCurrency(salePrice) : 'Sem preco de venda'
              return (
                <li
                  key={product.id}
                  className={`px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between transition ${
                    highlightLabel ? 'bg-amber-50/80 ring-1 ring-amber-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div>
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className={`text-xs ${isSellable ? 'text-gray-400' : 'text-amber-600 font-semibold'}`}>
                    {priceLabel}
                    {!isSellable && ' - Defina um preco para liberar no PDV.'}
                  </p>
                  {highlightLabel && (
                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      {highlightLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="text-sm font-semibold text-gray-500 transition hover:text-gray-700"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => onAdd(product)}
                    disabled={!isSellable}
                    className={`text-sm font-semibold transition ${
                      isSellable
                        ? 'text-blue-600 hover:text-blue-700'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isSellable ? 'Adicionar' : 'Indisponivel'}
                  </button>
                </div>
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
  onEdit,
}: {
  title: string
  items: SuggestionItem[]
  emptyMessage: string
  onAdd: (product: Product) => void
  onEdit?: (product: Product) => void
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
              className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-amber-100"
            >
              <div>
                <p className="font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500">
                  #{index + 1} - {item.quantitySold.toLocaleString('pt-BR')} vendidos
                </p>
              </div>
              <div className="flex items-center gap-3">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="text-sm font-semibold text-amber-700/70 transition hover:text-amber-900"
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={() => onAdd(item)}
                  className="text-sm font-semibold text-amber-700 transition hover:text-amber-800"
                >
                  Adicionar
                </button>
              </div>
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
  onEdit,
}: {
  results: Product[]
  onAdd: (product: Product) => void
  onClose: () => void
  onEdit?: (product: Product) => void
}) {
  const totalResults = results.length
  return (
    <div className="rounded border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
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
            const salePrice = typeof product.sale_price === 'number' ? product.sale_price : null
            const isSellable = !!salePrice && salePrice > 0
            const priceLabel = salePrice !== null ? formatCurrency(salePrice) : 'Sem preco definido'
            const typeLabel = productTypeLabels[product.type] ?? product.type
            return (
              <li
                key={product.id}
                className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className={`text-xs ${isSellable ? 'text-gray-400' : 'text-amber-600 font-semibold'}`}>
                    {typeLabel} - {priceLabel}
                    {!isSellable && ' - Ajuste o preco para permitir vendas.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="text-sm font-semibold text-gray-500 transition hover:text-gray-700"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => onAdd(product)}
                    disabled={!isSellable}
                    className={`text-sm font-semibold transition ${
                      isSellable
                        ? 'text-blue-600 hover:text-blue-700'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isSellable ? 'Adicionar' : 'Indisponivel'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
function ProductEditDrawer({
  product,
  form,
  units,
  error,
  isSaving,
  isLoadingUnits,
  onClose,
  onChange,
  onSubmit,
}: {
  product: Product | null
  form: ProductEditFormState
  units: Unit[]
  error: string | null
  isSaving: boolean
  isLoadingUnits: boolean
  onClose: () => void
  onChange: (field: keyof ProductEditFormState, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (!product) {
    return null
  }
  const typeLabel = productTypeLabels[product.type] ?? product.type
  const requiresSalePrice = product.type !== 'ingredient'
  const requiresUnit = product.type === 'ingredient'

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{typeLabel}</p>
            <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-500 hover:text-gray-700"
            aria-label="Fechar editor de produto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nome do item</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.name}
              onChange={(event) => onChange('name', event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Unidade de medida {requiresUnit ? '(obrigatoria)' : '(opcional)'}
            </label>
            <select
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.unit_id}
              onChange={(event) => onChange('unit_id', event.target.value)}
            >
              <option value="">{requiresUnit ? 'Selecione a unidade' : 'Nao definir'}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.abbreviation})
                </option>
              ))}
            </select>
            {isLoadingUnits && <p className="text-xs text-gray-400">Carregando unidades...</p>}
            {!isLoadingUnits && units.length === 0 && (
              <p className="text-xs text-amber-600">Cadastre unidades em Produtos &gt; Unidades.</p>
            )}
          </div>
          {requiresSalePrice && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Preco de venda</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={form.sale_price}
                onChange={(event) => onChange('sale_price', event.target.value)}
                required={requiresSalePrice}
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Custo medio (opcional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.cost_price}
              onChange={(event) => onChange('cost_price', event.target.value)}
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
