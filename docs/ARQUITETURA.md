# Planejamento Arquitetural - Companhia Ravenport

## 1. Arquitetura Geral

**Padrão:** Modular Monolito Frontend + BaaS Supabase (pode migrar para Express + Prisma)

**Camadas:**
- UI (React + Tailwind + shadcn)
- Estado Global (Context: Auth, Theme, Data)
- Domínio (Parser, TaxEngine, Normalize)
- Persistência (Supabase Client ou localStorage fallback)
- Export (CSV, Excel, PDF)

**Fluxo de Dados:**
Ficha Texto → splitFichas() → parseSingleFicha() → calculateTaxes() → ensureBuyer/Merchant/Product/Destination (dedup) → Sale pendente → aprovação admin → aggregates atualizados → dashboards, rankings, tesouraria

## 2. Banco de Dados (PostgreSQL Supabase)

```
profiles
- id uuid PK FK auth.users
- email unique
- role enum admin|merchant
- merchant_name
- created_at

merchants
- id uuid PK
- user_id FK profiles nullable
- name
- normalized_name UNIQUE (para dedup)
- email
- total_sales int
- total_base numeric
- total_commission numeric
- is_active bool
- created_at, last_sale_at

buyers
- id uuid PK
- name
- normalized_name UNIQUE
- is_ally bool
- ally_house enum Gardener|Lannister|Stark
- total_spent_base, total_spent_final
- total_purchases
- first_seen, last_seen

products
- id uuid PK
- name
- normalized_name UNIQUE
- slug
- category nullable
- cost_price nullable
- avg_price
- total_qty
- total_revenue_base, total_revenue_final
- total_profit computed

destinations
- id uuid PK
- name
- normalized_name UNIQUE
- region
- total_deliveries

sales
- id uuid PK
- ficha_number
- raw_text
- buyer_id FK buyers, buyer_name denormalized
- merchant_id FK merchants, merchant_name
- product_id FK products, product_name
- destination_id FK destinations, destination_name
- quantity numeric
- base_value, final_value
- currency enum ouro|prata|bronze|mista
- delivery_type enum domiciliar|retirada|nao_informado
- is_ally, ally_house
- tax_breakdown JSONB (todos campos calculados)
- status enum pendente|aprovada|rejeitada
- created_by FK profiles, approved_by FK profiles
- created_at, date_text
```

**Índices:**
- GIN em tax_breakdown
- Index em normalized_name
- Index em created_at, status, delivery_type, is_ally

**RLS:** Para MVP allow all authenticated + anon, em prod restringir.

## 3. Diagrama Relacionamentos
```
[auth.users] 1--1 [profiles] 1--N [sales] (created_by)
[merchants] 1--N [sales]
[buyers] 1--N [sales]
[products] 1--N [sales]
[destinations] 1--N [sales]
[profiles] (admin) 1--N [sales] (approved_by)
```

## 4. Estrutura Pastas
```
src/
  lib/
    supabase.ts (client + SQL schema)
    parser.ts (split, extractField, parseSingleFicha, generateFichaText)
    taxEngine.ts (calculateTaxes, breakdownToText)
    normalize.ts (normalizeName, slugify, detectAlly, parseMoney, fuzzyMatch Levenshtein)
    storage.ts (localDB fallback, ensure* dedup)
    export.ts (CSV, Excel, PDF)
  types/
  contexts/
    ThemeContext (dark/light persist)
    AuthContext (Supabase ou local mock)
    DataContext (aggregates, stats, CRUD)
  components/
    ui/ button, input
    layout/ Sidebar, MobileNav
  pages/
    Login, Dashboard, Sales, NewFicha, Approvals, Merchants, Buyers, Products, Treasury, Reports, Archive, Settings
```

## 5. Tecnologias Escolhidas e Justificativa

**Frontend:**
- React 18 + TypeScript: ecossistema maduro, tipagem segura para taxas e entidades
- Vite: build ultra-rápido, HMR, base para GitHub Pages
- Tailwind CSS: utilitário para tema medieval custom (parchment, leather, brass) sem CSS pesado, responsivo fácil
- shadcn/ui inspirado (custom minimal): controle total visual, sem depender biblioteca pesada
- TanStack Query: cache queries Supabase futuras, invalidação automática (preparado)
- TanStack Table: virtualização, sorts, filters para dezenas de milhares registros
- Recharts: gráficos leves, customizável, bom para dashboards medievais
- lucide-react: ícones discretos (coins, scroll, crown, package) sem emojis

**Backend:**
- Supabase: PostgreSQL + Auth + RLS + Storage, deploy instant GitHub Pages, sem precisar servidor Express, free tier suficiente. Alternativa Express+Prisma documentada para migração quando escalar.
- Prisma ORM (planejado): tipagem, migrations, caso migrar para Node Express
- JWT: Supabase Auth usa JWT nativo

**Parser:**
- mammoth para DOCX, FileReader para TXT, regex flexível para variações (300 ouro, 300 gold, 300 G, 300 moedas)
- split por ═══, 📜 ORDEM, ou \n\n\n - cobre WhatsApp/Discord
- fuzzyMatch Levenshtein simples para dedup nomes (ex: Aryon Lorrengreen vs Aryon Lorengreen)

**Export:**
- xlsx para Excel, jspdf + autotable para PDF, Blob para CSV

## 6. Wireframes Principais (texto)

**Login:**
- Desktop split: left 60% arte medieval (mesa madeira, velas, gradiente brass, 3 KPI cards, wax seal), right 40% form parchment com h1 gold gradient, inputs com ícone, toggle tema, acesso rápido admin/bran
- Mobile: só right

**Dashboard (Mesa Tesoureiro):**
- Top: título + botão Nova Ficha + Aprovações badge
- Grid KPIs 4 col (Receita, Lucro, Vendas, Ticket)
- Row: BarChart período (2/3) + Pie repartição (1/3)
- Row: 3 cards ranking mercador/comprador/produto com medalhas
- Row: tabela últimas vendas (2/3) + tesouraria rápida regras (1/3)
- Mobile: stack vertical, cards grandes

**Sales (Livro Vendas):**
- Top search + selects delivery/status
- Left list cards scroll (virtualizable) com badge status, ally, qty, valores
- Right drawer sticky com raw_text, grid comprador/mercador/mercad./destino, tesouraria breakdown, tags
- Import panel collapsible com textarea e file input
- Mobile: list full width, drawer modal bottom-sheet

**NewFicha:**
- 2 col: left form (comprador, mercadoria/qty, valor, entrega/destino, mercador, ally checkbox), tesouraria live card
- Right preview parchment pre com botão copiar e enviar para aprovação
- Mobile: tabs Form / Preview

**Approvals:**
- List pendentes com ações aprovar/rejeitar/ler
- Right preview completa
- Admin only

**Merchants/Buyers/Products:**
- Master/detail: left lista ranking com avatar/initial, right perfil com KPIs grid 4, histórico table, gráficos
- Products extra input custo para calcular lucro

**Treasury:**
- KPIs base/final/comissão/empresa
- BarChart mensal
- Detalhamento taxas com cores (green domiciliar, red retirada, amber aliado)

**Reports:**
- Filters diario/semanal/mensal/por entidade + selects
- KPIs filtered
- Table preview 100 linhas
- Buttons export CSV/Excel/PDF

**Archive:**
- Stats totais + destinos list + ER diagram textual

**Settings:**
- Identidade, tema toggle, armazenamento modo, instruções Supabase+GitHub Pages, SQL schema details, zona perigosa clear

## 7. Performance & Escalabilidade

- Debounce 300ms search
- useMemo filtered, stats
- Lazy loading pages via dynamic import pronto
- Pagination (slice 100 no reports preview)
- localStorage limite ~5MB, instruir usar Supabase para dezenas mil registros
- TanStack Query cache futuro
- Index Supabase em normalized_name e created_at

## 8. Fluxo Taxas
Documentado em README e taxEngine.ts com comentários.
