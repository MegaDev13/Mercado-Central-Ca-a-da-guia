# Deploy GitHub Pages + Supabase - Passo a Passo

## 1. Supabase

1. Crie conta em https://supabase.com
2. New Project -> nome ravenport, senha forte, region SA-East (Brasil)
3. Wait provisioning (~2min)
4. SQL Editor -> New Query -> cole conteúdo de `src/lib/supabase.ts` constante `SUPABASE_SCHEMA_SQL` e RUN
5. Verifique Tables: profiles, merchants, buyers, products, destinations, sales
6. Settings -> API -> copie Project URL e anon public key

## 2. Local env

Crie `.env` na raiz:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
```

`npm run dev` agora usará Supabase ao invés de localStorage.

Para testar auth: no Supabase Auth -> Users desative email confirmations (opcional para RPG) em Auth -> Providers -> Email -> desmarque Confirm email.

## 3. Código Auth

O `AuthContext` já faz:
- signUp -> cria auth.users + insert em profiles
- signIn -> puxa profile
- onAuthStateChange

RLS policies estão em allow all para MVP; para produção, crie policies restritas:
```sql
-- Apenas.admin pode aprovar, merchants só veem próprias vendas, etc.
```

## 4. GitHub Pages

Opção A - gh-pages branch:

```bash
npm run build
npm run deploy # faz push dist para branch gh-pages
```

No GitHub repo -> Settings -> Pages -> Source: gh-pages / root

Opção B - GitHub Actions (recomendado com secrets):

Crie `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on: push: branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v4
        with: github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Adicione secrets em Settings -> Secrets and variables -> Actions:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Push para main -> Action builda e publica.

## 5. Local PC apenas (sem Supabase)

Se deixar sem .env, sistema usa localStorage automaticamente (detecção `isSupabaseConfigured`). Dados ficam em `rpg_sales`, `rpg_merchants`, etc. Bom para uso offline no seu PC.

Você pode exportar relatórios e guardar.

## 6. Testando Taxas

Valores no `taxEngine.ts`:
- 30% domiciliar, -15% retirada se >=100, -10% aliado
- Mercador 20% base
Testes rápidos:
- Base 300 domiciliar não aliado = 300 +90 =390 final, mercador 60, produtor 150, companhia 180
- Base 300 retirada aliado = ally -30 =>270, retirada -40.5 =>229.5 final, mercador 60, produtor 150, companhia 19.5
- Base 80 retirada aliado = ally -8 =>72 final (sem -15% pois <100), mercador 16, produtor 40, companhia 16

Todos exibidos no painel Tesouraria.
