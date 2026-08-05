# 📜 Tutorial Completo Supabase + GitHub Pages - Companhia Ravenport

Este guia te leva do zero ao deploy, com sistema em branco, cadastro de mercadores ao subir ficha, admin atribuindo vendedor, estoque com entrada/saída e PDFs.

---

## 1) Criar projeto Supabase (5 min)

1. Acesse https://supabase.com → Sign Up / Login (pode usar GitHub)
2. **New Project**
   - Name: `ravenport-mercantile`
   - Database Password: crie forte e salve
   - Region: **South America (São Paulo)** para menor latência no Brasil
   - Plano Free
3. Aguarde ~2 min até `Project is ready`

## 2) Rodar SQL do estoque + vendas (3 min)

1. No menu lateral Supabase → **SQL Editor** → **New Query**
2. Abra no projeto o arquivo `src/lib/supabase.ts` → copie TODO o conteúdo de `SUPABASE_SCHEMA_SQL` (começa com `create extension...` até o final)
3. Cole no SQL Editor e clique **Run** (ou Ctrl+Enter)
4. Deve aparecer `Success. No rows returned`
5. Vá em **Table Editor** e confirme que existem:
   - `profiles`
   - `merchants`
   - `buyers`
   - `products` (com colunas `stock_quantity`, `min_stock`, `supplier`, `location`)
   - `destinations`
   - `sales`
   - `stock_movements`

Se alguma já existia, o `if not exists` evita erro.

**Se você já tinha o banco antigo sem estoque**, rode apenas a parte de `stock_movements` e os `alter` de produtos:
```sql
alter table products add column if not exists stock_quantity numeric default 0;
alter table products add column if not exists min_stock numeric default 5;
alter table products add column if not exists supplier text;
alter table products add column if not exists location text;
-- depois crie table stock_movements (copie do arquivo)
```

## 3) Configurar Auth (2 min)

1. **Authentication → Providers → Email**
   - Ative Email provider (já vem ativo)
   - **Desmarque** `Confirm email` para RPG facilitar (mercadores não precisam confirmar email)
   - Save

2. **Authentication → Policies** (Opcional para prod)
   - Por enquanto usamos política `allow all` para MVP funcionar sem dor de cabeça.
   - Depois você pode restringir: apenas admin aprova vendas, mercador vê só suas vendas via RLS com `auth.uid()`.

## 4) Pegar chaves para o frontend

1. **Settings → API**
   - Copie **Project URL**: `https://SEU_ID.supabase.co`
   - Copie **anon public key**: começa com `eyJ...` (longa)

## 5) Configurar projeto local

Na raiz do projeto `rpg-mercantile`:

Crie arquivo `.env` (ou `.env.local`):
```
VITE_SUPABASE_URL=https://SEU_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...sua anon key...
```

Instale e rode:
```bash
npm install
npm run dev
```

Se aparecer `Modo atual: Supabase` em Configurações, funcionou. Se não tiver `.env`, cai automaticamente para LocalStorage (PC local).

**Modo em branco:** Ao abrir pela primeira vez, vai estar tudo zerado. Só existe admin. Cadastre mercadores ou deixe eles se registrarem.

## 6) Testar fluxo completo em branco

1. Login como admin: `admin@ravenport.com` / senha qualquer (no modo Supabase, crie esse usuário primeiro em Authentication → Users → Add User, ou registre via tela de Registro escolhendo Tesoureiro/Admin)
2. Vá em **Mercadores** → Cadastre 2 vendedores: `Bran Crowley`, `Finn River`
3. Vá em **Almoxarifado** → Cadastrar Item:
   - Cordas, Geral, 100 un, min 10, custo 5 ouro, Fornecedor Forja Norte
   - Espadas, Armas, 20 un, min 5, custo 50
4. Faça uma **Entrada** extra se quiser.
5. Deslogue, clique **Registrar** → Crie mercador `Bran Crowley` com email `bran@...` mesmo nome → Login → Nova Ficha → escolha produto Cordas 6 un valor 300 domiciliar → Enviar para aprovação
6. Logue como admin → **Aprovações** → Aprovar → veja estoque baixar automaticamente de 100 para 94 e movimento criado.
7. **Relatórios → Estoque → Tipo Estoque Atual → Exportar PDF**

## 7) Deploy GitHub Pages (2 modos)

### Modo A - Manual com gh-pages (mais simples)

```bash
npm run build
# gera pasta dist/
npm run deploy
# faz push da dist para branch gh-pages
```

No GitHub: seu repositório → Settings → Pages → Source: `Deploy from branch` → Branch `gh-pages` / root → Save. Site ficará em `https://SEUUSER.github.io/NOME_REPO/`

**Importante**: Para funcionar com Supabase, precisa setar env antes do build. No seu PC com `.env` criado, o `npm run build` já embute as chaves.

### Modo B - GitHub Actions automático (recomendado)

1. No repositório GitHub → Settings → Secrets and variables → Actions → New repository secret:
   - Nome: `VITE_SUPABASE_URL` Valor: sua URL
   - Nome: `VITE_SUPABASE_ANON_KEY` Valor: sua anon key

2. Crie arquivo `.github/workflows/deploy.yml` na raiz:

```yaml
name: Deploy Ravenport

on:
  push:
    branches: [ main, master ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install deps
        run: npm ci
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - name: Deploy to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

3. Dê push para `main`. Em Actions verá o workflow rodar e publicar.

4. Ative Pages em Settings → Pages → Source: `gh-pages`.

## 8) Como mercadores acessam

- Você envia para eles o link do GitHub Pages: `https://seuuser.github.io/ravenport/`
- Eles clicam **Registrar** → colocam Email, Senha, Nome de Mercador (tem que ser igual ao que admin cadastrou para vincular automaticamente, ou novo nome cria novo vendedor)
- Eles fazem login → vêem apenas **Meu Painel**, **Nova Ficha**, **Minhas Vendas**, **Estoque (somente leitura)**, **Minha Carteira**
- Admin vê tudo.

Se usar Supabase, cada mercador acessa de seu próprio PC/celular, dados ficam centralizados no Supabase. Se usar sem Supabase (sem .env), dados ficam só no localStorage do navegador de quem abriu (ideal para teste local na sua máquina).

## 9) Estrutura dist pronta

Após `npm run build`, a pasta `dist/` contém:
- `index.html`
- `assets/` com CSS/JS minificados

É estática e pode ser hospedada em qualquer lugar: GitHub Pages, Vercel, Netlify, etc.

## 10) Troubleshooting

- **Login não funciona no Supabase**: verifique se desmarcou `Confirm email` ou confirme email em Authentication → Users.
- **Tabela não existe**: rode novamente o SQL do `SUPABASE_SCHEMA_SQL`.
- **PDF não baixa**: verifique se pop-up não está bloqueado.
- **Estoque não baixa**: só baixa ao **aprovar** venda pendente em Aprovações, não ao criar.
- **Mercador não aparece ao importar**: admin precisa cadastrar vendedor em Mercadores antes ou usar Cadastrar Novo Vendedor inline no import.
- **Quero zerar tudo**: Configurações → Deixar Tudo em Branco (mantém logins) ou Apagar Todos os Registros Locais.

## 11) Próximos passos opcionais

- Adicionar RLS por role: mercador só vê suas vendas (`created_by = auth.uid()`), admin vê tudo.
- Adicionar Storage para upload de comprovantes.
- Ativar Realtime Supabase para quando admin aprovar, mercador ver ao vivo.

---

Feito! Seu livro mercante agora está em nuvem, em branco para entrega, com estoque entrada/saída automática e relatórios PDF lendários. 🕯️📦⚔️ Se quiser, já gero um `supabase_schema_completo.sql` separado na pasta `supabase/`.
