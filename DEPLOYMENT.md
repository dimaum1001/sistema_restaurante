# Deploy com Render e Vercel

## Panorama
- Backend FastAPI (diretorio `backend`) publicado como servico web no Render.
- Banco PostgreSQL gratuito criado automaticamente pela Render (arquivo `render.yaml`).
- Frontend React + Vite (diretorio `frontend`) publicado como app estatico no Vercel.
- Comunicacao via HTTPS: frontend chama o backend usando `VITE_API_URL`.

## Pre-requisitos
- Repositorio versionado em Git (GitHub, GitLab ou Bitbucket).
- Conta gratuita na Render e na Vercel.
- Banco PostgreSQL vazio (Render blueprint ja cuida disso).
- Dominios definitivos (opcional) para configurar CORS e rotas personalizadas.

## Banco de dados em producao
- **Nao use SQLite em producao:** funciona localmente, mas nao suporta concorrencia, backups nor infraestrutura multi-instancia. Migre para PostgreSQL antes de liberar para o restaurante.
- **Render PostgreSQL:** o `render.yaml` cria automaticamente uma instancia gratuita no mesmo datacenter do backend, com latencia baixa e gestao simplificada (backup diario, rotacao de credenciais). Boa escolha se voce quer tudo na Render.
- **Neon.tech (recomendado se precisar de escalabilidade elastica):** oferece Postgres serverless com autosleep, branching e storage separado de compute. Ideal se voce deseja isolar o banco (por exemplo, Vercel + Neon) ou precisa de restauracao rapida. Use a string `postgresql+psycopg2://...` que o Neon fornece (inclui `sslmode=require`), salve em `DATABASE_URL` e ajuste o pool:
  - Defina `SQLALCHEMY_DISABLE_POOL=true` ou reduza `SQLALCHEMY_POOL_SIZE` para respeitar o limite de conexoes (4 no plano gratuito).
  - Opcionalmente habilite o pooling externo do Neon (`neon-proxy`) caso tenha muitos acessos simultaneos.
- **Backup e migracoes:** o Alembic roda automaticamente `alembic upgrade head` no startup do Render. Para Neon, rode localmente `alembic upgrade head` apontando para o banco antes do primeiro deploy (`DATABASE_URL="..." alembic upgrade head`) ou conecte uma instancia temporaria (Render job) para executar as migracoes.

## Backend no Render
1. **Confirme dependencias**  
   O arquivo `backend/requirements.txt` inclui `psycopg2-binary`, necessario para PostgreSQL.

2. **Reveja o blueprint**  
   O arquivo `render.yaml` na raiz descreve:
   - Provisionamento do banco `restaurante-db` (remova a secao `databases` se usar Neon ou outro provedor).
   - Build: `pip install -r requirements.txt` dentro de `backend`.
   - Start: `alembic upgrade head` seguido de `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   - Variaveis iniciais (`JWT_SECRET` gerado, `CORS_ORIGINS` com placeholder, etc.).

3. **Conecte o repositorio**  
   - Na Render, escolha *New +* → *Blueprint* e selecione `render.yaml`.
   - Informe qual branch usar e finalize a criacao. O primeiro deploy aplicara migracoes automaticamente.

4. **Ajuste variaveis de ambiente**  
   - Atualize `CORS_ORIGINS` com o dominio definitivo do frontend (ex.: `https://sua-app.vercel.app`).
   - Confirme `JWT_SECRET` (pode gerar outro via Render se preferir).
   - Configure `UVICORN_WORKERS` se precisar de mais processos (default 1).
   - Se estiver usando Neon, substitua `DATABASE_URL` pela conexao do Neon, defina `SQLALCHEMY_DISABLE_POOL=true` e mantenha `SSLMODE=require` na URL.
   - Ajuste `SQLALCHEMY_POOL_SIZE`, `SQLALCHEMY_MAX_OVERFLOW`, `SQLALCHEMY_POOL_TIMEOUT` e `SQLALCHEMY_POOL_RECYCLE` conforme o limite de conexoes do seu plano.

5. **Verifique**  
   - Use `https://<nome-do-servico>.onrender.com/healthz` para validar.
   - Logs em `Deploys > View Logs` mostram a execucao de `alembic` e o start do Uvicorn.

## Frontend no Vercel
1. **Root directory**  
   Ao importar o projeto na Vercel, defina `frontend` como *Root Directory*. Isso garante que `package.json`, `vercel.json` e `vite.config.ts` sejam detectados.

2. **Configuracao automatica**  
   O `frontend/vercel.json` declara:
   - `buildCommand`: `npm run build`.
   - `outputDirectory`: `dist`.
   - `framework`: `vite` (forca a deteccao correta).
   - `rewrites`: redireciona rotas de SPA para `index.html`.

3. **Variaveis de ambiente**  
   - Adicione `VITE_API_URL` com o dominio do backend Render e o sufixo `/api` (ex.: `https://sistema-backend.onrender.com/api`).
   - Para ambientes de preview, repita o mesmo valor ou use endpoints intermediarios.

4. **Deploy**  
   - Vercel instalara dependencias, rodara `npm run build` e publicara `dist`.
   - Teste a aplicacao visitando o dominio `https://<projeto>.vercel.app`.

5. **Rotas client-side**  
   O rewrite garante que rotas internas (`/analytics`, `/inventory` etc.) carreguem o `index.html`. Nao e necessario mexer em `vite.config.ts`.

## Integracao entre Frontend e Backend
- Mantenha `CORS_ORIGINS` na Render sincronizado com o dominio Vercel.
- O hook `useApi.ts` usa `VITE_API_URL`; sem essa variavel o frontend tentara falar com `/api` no proprio dominio (vai falhar em producao).
- Para seeds iniciais, rode manualmente `python app/seeds.py` apontando para o banco Render (via `DATABASE_URL`) a partir da sua maquina local ou configure um job separado.

## Pos-deploy
- Configure dominios customizados nas duas plataformas (opcional) e atualize o CORS se mudar o hostname.
- Ative HTTPS forcado no Vercel (automatico) e configure alertas de uptime/erros.
- Considere criar um pipeline de CI para rodar `pytest` antes dos deploys.
