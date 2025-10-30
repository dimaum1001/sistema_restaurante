import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
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

export default function OrdersPage() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products', 'catalog'],
    queryFn: async () => {
      const response = await api.get('/products')
      return response.data
    },
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

  const [items, setItems] = useState<CartItem[]>([])
  const [order, setOrder] = useState<OrderResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  const addItem = (product: Product) => {
    setError(null)
    if (!product.sale_price || product.sale_price <= 0) {
      setError('Esse item nao possui preco de venda configurado.')
      return
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

  const clearCart = () => {
    setItems([])
    setOrder(null)
    setError(null)
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
      clearCart()
      alert('Pagamento registrado com sucesso')
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
        <section className="bg-white rounded shadow">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-gray-800">Itens disponiveis</h2>
          </div>
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500">Carregando catalogo...</div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-200">
              <CategoryList
                title="Pratos"
                products={dishes}
                emptyMessage='Nenhum prato cadastrado. Cadastre itens em "Produtos".'
                onAdd={addItem}
              />
              <CategoryList
                title="Bebidas"
                products={beverages}
                emptyMessage='Nenhuma bebida cadastrada. Cadastre itens em "Produtos".'
                onAdd={addItem}
              />
            </div>
          )}
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
}: {
  title: string
  products: Product[]
  emptyMessage: string
  onAdd: (product: Product) => void
}) {
  return (
    <div className="divide-y divide-gray-100">
      <div className="px-4 py-2 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
        {title}
      </div>
      {products.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500">{emptyMessage}</div>
      ) : (
        <ul>
          {products.map((product) => (
            <li
              key={product.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-800">{product.name}</p>
                <p className="text-xs text-gray-400">
                  R$ {product.sale_price !== undefined ? product.sale_price.toFixed(2) : '0.00'}
                </p>
              </div>
              <button
                onClick={() => onAdd(product)}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
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
