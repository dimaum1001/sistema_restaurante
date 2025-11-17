import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../hooks/useApi'

type TabKey = 'dishes' | 'ingredients' | 'beverages' | 'units'

interface Unit {
  id: number
  name: string
  abbreviation: string
}

interface Product {
  id: number
  name: string
  type: 'dish' | 'ingredient' | 'merchandise'
  sale_price?: number
  cost_price?: number
  unit?: Unit
}

interface ProductPayload {
  name: string
  type: string
  unit_id?: number
  sale_price?: number
  cost_price?: number
}

interface SaveProductArgs {
  payload: ProductPayload
}

interface DishFormState {
  name: string
  unit_id: string
  sale_price: string
  cost_price: string
}

interface IngredientFormState {
  name: string
  unit_id: string
  cost_price: string
}

interface BeverageFormState {
  name: string
  unit_id: string
  sale_price: string
  cost_price: string
}

interface UnitFormState {
  name: string
  abbreviation: string
}

interface ProductEditFormState {
  name: string
  unit_id: string
  sale_price: string
  cost_price: string
}

const emptyDishForm: DishFormState = {
  name: '',
  unit_id: '',
  sale_price: '',
  cost_price: '',
}

const emptyIngredientForm: IngredientFormState = {
  name: '',
  unit_id: '',
  cost_price: '',
}

const emptyBeverageForm: BeverageFormState = {
  name: '',
  unit_id: '',
  sale_price: '',
  cost_price: '',
}

const emptyUnitForm: UnitFormState = {
  name: '',
  abbreviation: '',
}

const emptyProductEditForm: ProductEditFormState = {
  name: '',
  unit_id: '',
  sale_price: '',
  cost_price: '',
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('dishes')

  const [dishForm, setDishForm] = useState<DishFormState>({ ...emptyDishForm })
  const [dishError, setDishError] = useState<string | null>(null)

  const [dishSearch, setDishSearch] = useState('')

  const [ingredientForm, setIngredientForm] = useState<IngredientFormState>({ ...emptyIngredientForm })
  const [ingredientError, setIngredientError] = useState<string | null>(null)

  const [ingredientSearch, setIngredientSearch] = useState('')

  const [beverageForm, setBeverageForm] = useState<BeverageFormState>({ ...emptyBeverageForm })
  const [beverageError, setBeverageError] = useState<string | null>(null)

  const [beverageSearch, setBeverageSearch] = useState('')

  const [unitForm, setUnitForm] = useState<UnitFormState>({ ...emptyUnitForm })
  const [unitError, setUnitError] = useState<string | null>(null)
  const [unitSuccess, setUnitSuccess] = useState<string | null>(null)

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productEditForm, setProductEditForm] = useState<ProductEditFormState>({ ...emptyProductEditForm })
  const [productEditError, setProductEditError] = useState<string | null>(null)

  const dishesQuery = useQuery<Product[]>({
    queryKey: ['products', 'dishes'],
    queryFn: async () => {
      const response = await api.get('/products', { params: { product_type: 'dish' } })
      return response.data
    },
  })

  const ingredientsQuery = useQuery<Product[]>({
    queryKey: ['products', 'ingredients'],
    queryFn: async () => {
      const response = await api.get('/products', { params: { product_type: 'ingredient' } })
      return response.data
    },
  })

  const beveragesQuery = useQuery<Product[]>({
    queryKey: ['products', 'beverages'],
    queryFn: async () => {
      const response = await api.get('/products', { params: { product_type: 'merchandise' } })
      return response.data
    },
  })

  const unitsQuery = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: async () => {
      const response = await api.get('/products/units')
      return response.data
    },
  })

  const productsMutation = useMutation({
    mutationFn: async ({ payload }: SaveProductArgs) => {
      const response = await api.post('/products', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'dishes'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'beverages'] })
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ProductPayload }) => {
      const response = await api.put(`/products/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'dishes'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'beverages'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'catalog'] })
      closeProductEditor()
    },
    onError: (err: any) => {
      setProductEditError(err.response?.data?.detail || 'Erro ao atualizar produto.')
    },
  })

  const unitMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/products/units', {
        name: unitForm.name.trim(),
        abbreviation: unitForm.abbreviation.trim(),
      })
      return response.data
    },
    onSuccess: () => {
      setUnitForm({ ...emptyUnitForm })
      setUnitError(null)
      setUnitSuccess('Unidade cadastrada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['units'] })
    },
    onError: (err: any) => {
      setUnitSuccess(null)
      setUnitError(err.response?.data?.detail || 'Erro ao cadastrar unidade')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/products/${id}`)
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['products', 'dishes'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'beverages'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'catalog'] })
      if (editingProduct?.id === id) {
        closeProductEditor()
      }
    },
  })

  const orderedDishes = useMemo(
    () => (dishesQuery.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [dishesQuery.data],
  )

  const filteredDishes = useMemo(() => {
    const term = dishSearch.trim().toLowerCase()
    if (!term) {
      return orderedDishes
    }
    return orderedDishes.filter((dish) => dish.name.toLowerCase().includes(term))
  }, [orderedDishes, dishSearch])

  const orderedIngredients = useMemo(
    () => (ingredientsQuery.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [ingredientsQuery.data],
  )

  const filteredIngredients = useMemo(() => {
    const term = ingredientSearch.trim().toLowerCase()
    if (!term) {
      return orderedIngredients
    }
    return orderedIngredients.filter((ingredient) => ingredient.name.toLowerCase().includes(term))
  }, [orderedIngredients, ingredientSearch])

  const orderedBeverages = useMemo(
    () => (beveragesQuery.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [beveragesQuery.data],
  )

  const filteredBeverages = useMemo(() => {
    const term = beverageSearch.trim().toLowerCase()
    if (!term) {
      return orderedBeverages
    }
    return orderedBeverages.filter((beverage) => beverage.name.toLowerCase().includes(term))
  }, [orderedBeverages, beverageSearch])

  const orderedUnits = useMemo(
    () => (unitsQuery.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [unitsQuery.data],
  )

  const resetDishForm = () => {
    setDishForm({ ...emptyDishForm })
    setDishError(null)
  }

  const resetIngredientForm = () => {
    setIngredientForm({ ...emptyIngredientForm })
    setIngredientError(null)
  }

  const resetBeverageForm = () => {
    setBeverageForm({ ...emptyBeverageForm })
    setBeverageError(null)
  }

  const closeProductEditor = () => {
    setEditingProduct(null)
    setProductEditForm({ ...emptyProductEditForm })
    setProductEditError(null)
  }

  const openProductEditor = (product: Product) => {
    setEditingProduct(product)
    setProductEditError(null)
  }

  useEffect(() => {
    if (!editingProduct) return
    setProductEditForm({
      name: editingProduct.name,
      unit_id: editingProduct.unit ? String(editingProduct.unit.id) : '',
      sale_price: editingProduct.sale_price != null ? editingProduct.sale_price.toString() : '',
      cost_price: editingProduct.cost_price != null ? editingProduct.cost_price.toString() : '',
    })
  }, [editingProduct])

  const resolveProductCategory = (product: Product): TabKey => {
    if (product.type === 'dish') return 'dishes'
    if (product.type === 'ingredient') return 'ingredients'
    return 'beverages'
  }

  const handleDrawerDelete = () => {
    if (!editingProduct) return
    handleDeleteProduct(editingProduct.id, resolveProductCategory(editingProduct), { skipConfirm: true })
  }

  const handleSubmitDish = (event: React.FormEvent) => {
    event.preventDefault()
    setDishError(null)

    const payload: ProductPayload = {
      name: dishForm.name.trim(),
      type: 'dish',
      unit_id: dishForm.unit_id ? Number(dishForm.unit_id) : undefined,
      sale_price: dishForm.sale_price ? Number(dishForm.sale_price) : undefined,
      cost_price: dishForm.cost_price ? Number(dishForm.cost_price) : undefined,
    }

    if (!payload.name) {
      setDishError('Informe o nome do prato.')
      return
    }
    if (!payload.sale_price || payload.sale_price <= 0) {
      setDishError('Informe um preco de venda maior que zero.')
      return
    }

    productsMutation.mutate(
      { payload },
      {
        onSuccess: () => resetDishForm(),
        onError: (err: any) => {
          setDishError(err.response?.data?.detail || 'Erro ao salvar o prato.')
        },
      },
    )
  }

  const handleSubmitIngredient = (event: React.FormEvent) => {
    event.preventDefault()
    setIngredientError(null)

    const payload: ProductPayload = {
      name: ingredientForm.name.trim(),
      type: 'ingredient',
      unit_id: ingredientForm.unit_id ? Number(ingredientForm.unit_id) : undefined,
      cost_price: ingredientForm.cost_price ? Number(ingredientForm.cost_price) : undefined,
    }

    if (!payload.name) {
      setIngredientError('Informe o nome do insumo.')
      return
    }
    if (!payload.unit_id) {
      setIngredientError('Selecione a unidade de medida.')
      return
    }

    productsMutation.mutate(
      { payload },
      {
        onSuccess: () => resetIngredientForm(),
        onError: (err: any) => {
          setIngredientError(err.response?.data?.detail || 'Erro ao salvar o insumo.')
        },
      },
    )
  }

  const handleSubmitBeverage = (event: React.FormEvent) => {
    event.preventDefault()
    setBeverageError(null)

    const payload: ProductPayload = {
      name: beverageForm.name.trim(),
      type: 'merchandise',
      unit_id: beverageForm.unit_id ? Number(beverageForm.unit_id) : undefined,
      sale_price: beverageForm.sale_price ? Number(beverageForm.sale_price) : undefined,
      cost_price: beverageForm.cost_price ? Number(beverageForm.cost_price) : undefined,
    }

    if (!payload.name) {
      setBeverageError('Informe o nome da bebida.')
      return
    }
    if (!payload.sale_price || payload.sale_price <= 0) {
      setBeverageError('Informe o preco de venda da bebida.')
      return
    }

    productsMutation.mutate(
      { payload },
      {
        onSuccess: () => resetBeverageForm(),
        onError: (err: any) => {
          setBeverageError(err.response?.data?.detail || 'Erro ao salvar a bebida.')
        },
      },
    )
  }

  const handleSubmitUnit = (event: React.FormEvent) => {
    event.preventDefault()
    setUnitError(null)
    setUnitSuccess(null)

    if (!unitForm.name.trim() || !unitForm.abbreviation.trim()) {
      setUnitError('Preencha nome e abreviacao.')
      return
    }
    unitMutation.mutate()
  }

  const handleDeleteProduct = (id: number, category: TabKey, options?: { skipConfirm?: boolean }) => {
    if (!options?.skipConfirm) {
      const confirmed = window.confirm('Confirma a exclusao deste item?')
      if (!confirmed) return
    }
    deleteMutation.mutate(id, {
      onError: (err: any) => {
        const message = err.response?.data?.detail || 'Falha ao excluir item.'
        if (category === 'dishes') {
          setDishError(message)
        } else if (category === 'ingredients') {
          setIngredientError(message)
        } else if (category === 'beverages') {
          setBeverageError(message)
        }
      },
    })
  }

  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
      <TabButton label="Pratos" tab="dishes" activeTab={activeTab} onClick={setActiveTab} />
      <TabButton label="Insumos" tab="ingredients" activeTab={activeTab} onClick={setActiveTab} />
      <TabButton label="Bebidas" tab="beverages" activeTab={activeTab} onClick={setActiveTab} />
      <TabButton label="Unidades" tab="units" activeTab={activeTab} onClick={setActiveTab} />
    </div>
  )

  const handleProductEditSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingProduct) return
    setProductEditError(null)

    const trimmedName = productEditForm.name.trim()
    const unitId = productEditForm.unit_id ? Number(productEditForm.unit_id) : undefined
    const salePriceValue = productEditForm.sale_price ? Number(productEditForm.sale_price) : undefined
    const costPriceValue = productEditForm.cost_price ? Number(productEditForm.cost_price) : undefined
    const requiresSalePrice = editingProduct.type !== 'ingredient'
    const requiresUnit = editingProduct.type === 'ingredient'

    if (!trimmedName) {
      setProductEditError('Informe o nome do produto.')
      return
    }
    if (requiresSalePrice && (!salePriceValue || salePriceValue <= 0)) {
      setProductEditError('Defina um preco de venda maior que zero.')
      return
    }
    if (requiresUnit && !unitId) {
      setProductEditError('Selecione a unidade do insumo.')
      return
    }

    const payload: ProductPayload = {
      name: trimmedName,
      type: editingProduct.type,
      unit_id: unitId,
      sale_price: requiresSalePrice ? salePriceValue : undefined,
      cost_price: costPriceValue,
    }
    updateProductMutation.mutate({ id: editingProduct.id, payload })
  }

  const renderDishPanel = () => (
    <div className="space-y-6">
      <form onSubmit={handleSubmitDish} className="glass-panel p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Cadastrar prato</h2>
        </div>
        {dishError && <div className="text-sm text-red-500">{dishError}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nome do prato">
            <input
              className="w-full border rounded px-3 py-2"
              value={dishForm.name}
              onChange={(event) => setDishForm({ ...dishForm, name: event.target.value })}
              required
            />
          </Field>
          <Field label="Unidade (porcao, prato, etc.)">
            <select
              className="w-full border rounded px-3 py-2"
              value={dishForm.unit_id}
              onChange={(event) => setDishForm({ ...dishForm, unit_id: event.target.value })}
            >
              <option value="">Selecione...</option>
              {orderedUnits.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.name} ({unit.abbreviation})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preco de venda">
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="0.01"
              value={dishForm.sale_price}
              onChange={(event) => setDishForm({ ...dishForm, sale_price: event.target.value })}
              required
            />
          </Field>
          <Field label="Custo medio (opcional)">
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="0.01"
              value={dishForm.cost_price}
              onChange={(event) => setDishForm({ ...dishForm, cost_price: event.target.value })}
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={productsMutation.isPending}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {productsMutation.isPending ? 'Salvando...' : 'Adicionar prato'}
        </button>
      </form>

      <section className="glass-panel overflow-hidden">
        <div className="px-4 py-4 flex flex-col gap-3 border-b border-white/40 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Pratos cadastrados</h3>
          <input
            type="search"
            value={dishSearch}
            onChange={(event) => setDishSearch(event.target.value)}
            placeholder="Buscar prato..."
            className="input-soft md:w-64"
          />
        </div>
        {dishesQuery.isLoading ? (
          <div className="p-4 text-sm text-gray-500">Carregando pratos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[40rem] w-full text-sm">
              <thead className="bg-slate-900/5 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Prato</th>
                  <th className="px-4 py-3 text-left font-medium">Unidade</th>
                  <th className="px-4 py-3 text-right font-medium">Preco</th>
                  <th className="px-4 py-3 text-right font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                {filteredDishes.map((dish) => (
                  <tr key={dish.id} className={editingProduct?.id === dish.id ? 'bg-blue-50/50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">{dish.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {dish.unit ? `${dish.unit.name} (${dish.unit.abbreviation})` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800">
                      {dish.sale_price !== undefined ? `R$ ${dish.sale_price.toFixed(2)}` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                          onClick={() => openProductEditor(dish)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-sm text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteProduct(dish.id, 'dishes')}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDishes.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-gray-500" colSpan={4}>
                      {orderedDishes.length === 0
                        ? 'Nenhum prato cadastrado ainda.'
                        : 'Nenhum prato encontrado para a busca.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )

  const renderIngredientPanel = () => (
    <div className="space-y-6">
      <form onSubmit={handleSubmitIngredient} className="glass-panel p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Cadastrar insumo</h2>
        </div>
        {ingredientError && <div className="text-sm text-red-500">{ingredientError}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nome do insumo">
            <input
              className="w-full border rounded px-3 py-2"
              value={ingredientForm.name}
              onChange={(event) => setIngredientForm({ ...ingredientForm, name: event.target.value })}
              required
            />
          </Field>
          <Field label="Unidade de controle">
            <select
              className="w-full border rounded px-3 py-2"
              value={ingredientForm.unit_id}
              onChange={(event) => setIngredientForm({ ...ingredientForm, unit_id: event.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {orderedUnits.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.name} ({unit.abbreviation})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Custo medio">
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="0.01"
              value={ingredientForm.cost_price}
              onChange={(event) => setIngredientForm({ ...ingredientForm, cost_price: event.target.value })}
              required
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={productsMutation.isPending}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {productsMutation.isPending ? 'Salvando...' : 'Adicionar insumo'}
        </button>
      </form>

      <section className="glass-panel overflow-hidden">
        <div className="px-4 py-4 flex flex-col gap-3 border-b border-white/40 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Insumos cadastrados</h3>
          <input
            type="search"
            value={ingredientSearch}
            onChange={(event) => setIngredientSearch(event.target.value)}
            placeholder="Buscar insumo..."
            className="input-soft md:w-64"
          />
        </div>
        {ingredientsQuery.isLoading ? (
          <div className="p-4 text-sm text-gray-500">Carregando insumos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[40rem] w-full text-sm">
              <thead className="bg-slate-900/5 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Insumo</th>
                  <th className="px-4 py-3 text-left font-medium">Unidade</th>
                  <th className="px-4 py-3 text-right font-medium">Custo</th>
                  <th className="px-4 py-3 text-right font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                {filteredIngredients.map((ingredient) => (
                  <tr key={ingredient.id} className={editingProduct?.id === ingredient.id ? 'bg-blue-50/50' : ''}>
                  <td className="px-4 py-3 font-medium text-gray-900">{ingredient.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {ingredient.unit ? `${ingredient.unit.name} (${ingredient.unit.abbreviation})` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {ingredient.cost_price !== undefined ? `R$ ${ingredient.cost_price.toFixed(2)}` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                          onClick={() => openProductEditor(ingredient)}
                        >
                          Editar
                        </button>
                      <button
                        className="text-sm text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteProduct(ingredient.id, 'ingredients')}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIngredients.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-500" colSpan={4}>
                    {orderedIngredients.length === 0
                      ? 'Nenhum insumo cadastrado ainda.'
                      : 'Nenhum insumo encontrado para a busca.'}
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )

  const renderBeveragePanel = () => (
    <div className="space-y-6">
      <form onSubmit={handleSubmitBeverage} className="glass-panel p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Cadastrar bebida</h2>
        </div>
        {beverageError && <div className="text-sm text-red-500">{beverageError}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nome da bebida">
            <input
              className="w-full border rounded px-3 py-2"
              value={beverageForm.name}
              onChange={(event) => setBeverageForm({ ...beverageForm, name: event.target.value })}
              required
            />
          </Field>
          <Field label="Unidade (garrafa, lata, ml...)">
            <select
              className="w-full border rounded px-3 py-2"
              value={beverageForm.unit_id}
              onChange={(event) => setBeverageForm({ ...beverageForm, unit_id: event.target.value })}
            >
              <option value="">Selecione...</option>
              {orderedUnits.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.name} ({unit.abbreviation})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preco de venda">
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="0.01"
              value={beverageForm.sale_price}
              onChange={(event) => setBeverageForm({ ...beverageForm, sale_price: event.target.value })}
              required
            />
          </Field>
          <Field label="Custo medio (opcional)">
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="0.01"
              value={beverageForm.cost_price}
              onChange={(event) => setBeverageForm({ ...beverageForm, cost_price: event.target.value })}
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={productsMutation.isPending}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {productsMutation.isPending ? 'Salvando...' : 'Adicionar bebida'}
        </button>
      </form>

      <section className="glass-panel overflow-hidden">
        <div className="px-4 py-4 flex flex-col gap-3 border-b border-white/40 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Bebidas cadastradas</h3>
          <input
            type="search"
            value={beverageSearch}
            onChange={(event) => setBeverageSearch(event.target.value)}
            placeholder="Buscar bebida..."
            className="input-soft md:w-64"
          />
        </div>
        {beveragesQuery.isLoading ? (
          <div className="p-4 text-sm text-gray-500">Carregando bebidas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[40rem] w-full text-sm">
              <thead className="bg-slate-900/5 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Bebida</th>
                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                <th className="px-4 py-3 text-right font-medium">Preco</th>
                <th className="px-4 py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-white/60">
                {filteredBeverages.map((beverage) => (
                  <tr key={beverage.id} className={editingProduct?.id === beverage.id ? 'bg-blue-50/50' : ''}>
                  <td className="px-4 py-3 font-medium text-gray-900">{beverage.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {beverage.unit ? `${beverage.unit.name} (${beverage.unit.abbreviation})` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {beverage.sale_price !== undefined ? `R$ ${beverage.sale_price.toFixed(2)}` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                          onClick={() => openProductEditor(beverage)}
                        >
                          Editar
                        </button>
                      <button
                        className="text-sm text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteProduct(beverage.id, 'beverages')}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBeverages.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-500" colSpan={4}>
                    {orderedBeverages.length === 0
                      ? 'Nenhuma bebida cadastrada ainda.'
                      : 'Nenhuma bebida encontrada para a busca.'}
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )

  const renderUnitPanel = () => (
    <div className="space-y-6">
      <form onSubmit={handleSubmitUnit} className="glass-panel p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Cadastrar unidade de medida</h2>
        {unitError && <div className="text-sm text-red-500">{unitError}</div>}
        {unitSuccess && <div className="text-sm text-green-600">{unitSuccess}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome completo">
            <input
              className="w-full border rounded px-3 py-2"
              value={unitForm.name}
              onChange={(event) => setUnitForm({ ...unitForm, name: event.target.value })}
              required
            />
          </Field>
          <Field label="Abreviacao">
            <input
              className="w-full border rounded px-3 py-2"
              value={unitForm.abbreviation}
              onChange={(event) => setUnitForm({ ...unitForm, abbreviation: event.target.value })}
              required
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={unitMutation.isPending}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {unitMutation.isPending ? 'Salvando...' : 'Cadastrar unidade'}
        </button>
      </form>

      <section className="glass-panel overflow-hidden">
        <div className="px-4 py-4 border-b border-white/40">
          <h3 className="text-lg font-semibold text-gray-800">Unidades cadastradas</h3>
        </div>
        {unitsQuery.isLoading ? (
          <div className="p-4 text-sm text-gray-500">Carregando unidades...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[28rem] w-full text-sm">
              <thead className="bg-slate-900/5 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Abreviacao</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-white/60">
              {orderedUnits.map((unit) => (
                <tr key={unit.id}>
                  <td className="px-4 py-3 text-gray-800">{unit.name}</td>
                  <td className="px-4 py-3 text-gray-600">{unit.abbreviation}</td>
                </tr>
              ))}
              {orderedUnits.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-500" colSpan={2}>
                    Nenhuma unidade cadastrada ainda.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )

  let content: JSX.Element
  if (activeTab === 'dishes') {
    content = renderDishPanel()
  } else if (activeTab === 'ingredients') {
    content = renderIngredientPanel()
  } else if (activeTab === 'beverages') {
    content = renderBeveragePanel()
  } else {
    content = renderUnitPanel()
  }

  return (
    <>
      <div className="space-y-8">
        <header className="glass-panel space-y-4 p-6">
          <div className="space-y-2">
            <span className="section-pill">Catálogo vivo</span>
            <h1 className="text-3xl font-semibold text-gray-900">Produtos, insumos e bebidas</h1>
            <p className="text-sm text-gray-500">
              Cadastre receitas, controle custos e mantenha unidades alinhadas para todo o time.
            </p>
          </div>
          {renderTabs()}
        </header>
        {content}
      </div>
      <ProductEditDrawer
        product={editingProduct}
        form={productEditForm}
        units={orderedUnits}
        error={productEditError}
        isSaving={updateProductMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onClose={closeProductEditor}
        onChange={(field, value) => setProductEditForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleProductEditSubmit}
        onDelete={handleDrawerDelete}
      />
    </>
  )
}

function TabButton({
  label,
  tab,
  activeTab,
  onClick,
}: {
  label: string
  tab: TabKey
  activeTab: TabKey
  onClick: (tab: TabKey) => void
}) {
  const isActive = tab === activeTab
  const base =
    'px-4 py-2 rounded border text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500'
  const classes = isActive
    ? `${base} bg-blue-600 border-blue-600 text-white`
    : `${base} bg-white border-gray-300 text-gray-600 hover:text-gray-800`

  return (
    <button type="button" className={classes} onClick={() => onClick(tab)}>
      {label}
    </button>
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

function ProductEditDrawer({
  product,
  form,
  units,
  error,
  isSaving,
  isDeleting,
  onClose,
  onChange,
  onSubmit,
  onDelete,
}: {
  product: Product | null
  form: ProductEditFormState
  units: Unit[]
  error: string | null
  isSaving: boolean
  isDeleting: boolean
  onClose: () => void
  onChange: (field: keyof ProductEditFormState, value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onDelete: () => void
}) {
  if (!product) {
    return null
  }
  const typeLabels: Record<Product['type'], string> = {
    dish: 'Prato',
    ingredient: 'Insumo',
    merchandise: 'Bebida',
  }
  const requiresSalePrice = product.type !== 'ingredient'
  const requiresUnit = product.type === 'ingredient'

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{typeLabels[product.type]}</p>
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
            <label className="text-sm font-medium text-gray-700">Nome</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.name}
              onChange={(event) => onChange('name', event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Unidade {requiresUnit ? '(obrigatória)' : '(opcional)'}
            </label>
            <select
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.unit_id}
              onChange={(event) => onChange('unit_id', event.target.value)}
            >
              <option value="">{requiresUnit ? 'Selecione a unidade' : 'Não definir'}</option>
              {units.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.name} ({unit.abbreviation})
                </option>
              ))}
            </select>
            {requiresUnit && units.length === 0 && (
              <p className="text-xs text-amber-600">Cadastre unidades na aba específica antes de editar este item.</p>
            )}
          </div>
          {requiresSalePrice && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Preço de venda</label>
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
            <label className="text-sm font-medium text-gray-700">Custo médio</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.cost_price}
              onChange={(event) => onChange('cost_price', event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir produto'}
            </button>
            <div className="flex items-center gap-2">
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
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
