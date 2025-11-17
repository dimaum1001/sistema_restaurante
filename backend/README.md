# Sistema de Gestao para Restaurante

Backend FastAPI pensado para operar restaurantes multi-tenant com foco em vendas, estoque e conformidade.

## Visao Geral

- API REST em FastAPI + SQLAlchemy 2.x
- Multi-tenant via coluna `tenant_id` (estrategia configuravel por `TENANCY_STRATEGY`)
- Autenticacao com JWT (access + refresh), RBAC por perfis e cabecalho `X-Tenant`
- Base SQLite por padrao (compatibilidade com Postgres assegurada via SQLAlchemy)

## Destaques da Release

- Visao diaria consolidada: faturamento, ticket medio, mix de pagamento, ranking de produtos
- Relatorios semanais e mensais com agrupamento configuravel (`/api/analytics/periodic`)
- Quebra de pagamento por metodo (`/api/analytics/payment-mix`) e top produtos por periodo
- Cardapio a la carte: produtos expostos apenas como pratos (`/api/products?product_type=dish`) e edicao diretamente pela UI
- PDV permite escolher forma de pagamento (dinheiro, PIX, cartoes, voucher ou conta cliente)
- Registro manual de entradas (`/api/stock/batches`) e baixas (`/api/stock/moves`) integrada ao painel de estoque
- Motor de alertas de estoque com ponto de pedido, cobertura e severidade (`/api/inventory/alerts`)
- Camada de dominio modularizada em `app/modules` (analytics e inventory) para reuso entre rotas

## Estrutura do Projeto

```
backend/
  app/
    api/                # Rotas FastAPI (auth, analytics, inventory, pedidos, etc.)
      routes/
        analytics.py
        inventory.py
        reports.py
        ...
    core/               # Configs, banco, tenant resolver, logger
    models/             # ORM SQLAlchemy (agora inclui InventoryRule)
    modules/
      analytics/        # Servicos e schemas de analytics operacional
      inventory/        # Servicos e schemas de alertas de estoque
    schemas/            # Modelos Pydantic de entrada/saida
    main.py
    seeds.py
  alembic/
  requirements.txt

frontend/
  src/
    App.tsx
    layouts/MainLayout.tsx
    features/
      analytics/
        pages/SalesOverviewPage.tsx
        pages/SalesReportsPage.tsx
      inventory/pages/InventoryAlertsPage.tsx
      catalog/pages/ProductsPage.tsx
      orders/pages/OrdersPage.tsx
      auth/pages/LoginPage.tsx
    hooks/useApi.ts
```

## Endpoints Chave

| Metodo | Endpoint                     | Descricao                                                |
|--------|------------------------------|----------------------------------------------------------|
| GET    | `/api/analytics/daily`       | Snapshot diario com faturamento, pedidos e ranking       |
| GET    | `/api/analytics/periodic`    | Relatorio agregado (daily/weekly/monthly)                |
| GET    | `/api/analytics/payment-mix` | Percentual por metodo de pagamento                       |
| GET    | `/api/analytics/top-products`| Produtos mais vendidos no intervalo informado            |
| GET    | `/api/inventory/alerts`      | Produtos em alerta com cobertura e severidade            |

As rotas continuam exigindo `Authorization: Bearer <token>` e `X-Tenant`.

## Executando com Docker Compose

1. `cp .env.example .env` (ajuste segredos, `DATABASE_URL`, etc.)
2. `docker compose up --build`
3. Backend em `http://localhost:8000` (Swagger: `/docs`), Frontend em `http://localhost:5173`

## Executando Localmente

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # (ou .venv\Scripts\activate no Windows)\  s
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python app/seeds.py
uvicorn app.main:app --reload
```

Credenciais seed (tenant `demo`): `owner/owner`, `manager/manager`, `cashier/cashier`, `chef/chef`, `waiter/waiter`, `purchasing/purchasing`, `accountant/accountant`.

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Deploy na Render (Backend)

1. Instale dependências adicionais: o projeto agora inclui `psycopg2-binary` para compatibilidade com PostgreSQL (Render provisiona automaticamente um banco quando usa o `render.yaml`).
2. Garanta que o arquivo `render.yaml` (na raiz do repositório) aponte para o diretório `backend` e ajuste os valores conforme necessário (principalmente `CORS_ORIGINS` com o domínio real do frontend).
3. Faça o push para um repositório Git (GitHub, GitLab etc.) e conecte-o à Render.
4. Ao criar o serviço, Render usará o blueprint do `render.yaml`:
   - Provisiona um banco PostgreSQL gratuito (`restaurante-db`). Remova esta etapa (`databases`) se utilizar Neon ou outro Postgres externo.
   - Executa `pip install -r requirements.txt` dentro do diretório backend.
   - No start da aplicação executa `alembic upgrade head` e sobe `uvicorn app.main:app` na porta `$PORT`.
5. Após o deploy, atualize `CORS_ORIGINS` (Render → Environment) com o domínio final do frontend (ex.: `https://sua-app.vercel.app`), se ainda não o fez.
6. Use o painel da Render para consultar logs (`Deploys` → `View Logs`) e validar se migrações foram aplicadas.

Variáveis importantes no ambiente da Render:

- `DATABASE_URL`: Render injeta a string de conexão ao PostgreSQL automaticamente.
- `JWT_SECRET`: gerado automaticamente pelo blueprint (pode ser substituído).
- `TENANCY_STRATEGY`: mantido como `column`. Ajuste somente se alterar a estrategia.
- `SQLALCHEMY_DISABLE_POOL` e demais opcoes de pool (`SQLALCHEMY_POOL_SIZE`, `SQLALCHEMY_MAX_OVERFLOW`, `SQLALCHEMY_POOL_TIMEOUT`, `SQLALCHEMY_POOL_RECYCLE`): ajuste conforme o limite de conexoes do provedor (ex.: defina `true` para Neon free).
- Outros (`ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_MINUTES`, `PRIVACY_CONTACT_EMAIL`) podem ser customizados pelo painel.

## Testes

```bash
cd backend
pytest
```

Os testes existentes continuam validando fluxos criticos de caixa, estoque e LGPD. Adicione casos especificos para analytics/inventory conforme evoluir.

> Guia completo de deploy (Render + Vercel): consulte `../DEPLOYMENT.md`.

## Proximos Passos Sugeridos

- Criar migration oficial adicionando `inventory_rules` para bancos ja existentes
- Expandir analytics com margens por categoria e previsao de demanda
- Conectar alertas de estoque a notificacoes (e-mail, Slack, WhatsApp)
- Acrescentar testes de integracao cobrindo os novos endpoints de analytics e inventory

