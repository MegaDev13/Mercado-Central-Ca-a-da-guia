# Companhia Mercante Ravenport — Livro Contábil RPG Medieval

> **Novo:** o jogador autônomo de Minecraft Bedrock (planner na nuvem + executor local) está em [`bedrock-agent/`](./bedrock-agent/README.md).

---

Sistema web completo inspirado em Game of Thrones, qualidade ERP profissional, visual medieval imersivo, porém usabilidade moderna (Notion/Linear/Jira).

> Tema escuro padrão, claro opcional. Tipografia Cinzel + Inter. Ícones lucide, sem emojis na interface. Animações discretas (page-turn, wax-stamp, glow).

## 🏰 Visão Geral
Recebe centenas de fichas de compra/venda em texto livre (texto colado, TXT, DOCX, histórico WhatsApp/Discord) e transforma automaticamente em registros estruturados, deduplicados, pesquisáveis, com estatísticas.

Responde automaticamente:
- Quem vendeu mais? Quem comprou mais? Quanto arrecadamos? Mercadoria mais vendida? Maior/menor venda? Receita por período? Lucro por produto/mercador?

## 💰 Taxas / Fração — Regra Implementada

```ts
base = valor informado (antes de taxas)
isAlly = comprador contém Gardener|Lannister|Stark ou marcado como aliado
ally_discount = isAlly ? base*0.10 : 0
valueAfterAlly = base - ally_discount

if domiciliar: delivery_adj = valueAfterAlly*0.30; final = valueAfterAlly + delivery_adj
if retirada: if base>=100 => delivery_adj = -valueAfterAlly*0.15 else 0; final = valueAfterAlly+delivery_adj

// Repartição da base
mercador 20% base → carteira dele
produtor 50% base
companhia 30% base + delivery_adj - ally_discount (absorve descontos, ganha frete)
final = mercador + produtor + companhia
```

Se base <100, não aplica -15% retirada. Aliado 10% independente do tipo.

Fluxo mercador:
1. Login (email/senha) → mercador cria conta
2. Aba "Nova Ficha" → formulário vazio (comprador, mercadoria, qtd, valor, entrega, destino, aliado checkbox)
3. Cálculo automático, geração de ficha oficial com selo, opção copiar
4. Envio → status pendente
5. Admin vê em Aprovações, lê raw_text completo, aprova → contabiliza em rankings, tesouraria, perfis

## 📦 Arquitetura

**Planejada:**
- Frontend React + TS + Vite + Tailwind + shadcn-like + TanStack Query/Table + Recharts
- Backend: Supabase (PostgreSQL + Auth + RLS) para GitHub Pages, alternativa Express+Prisma pronta
- Auth JWT (Supabase Auth ou mock local com localStorage)
- Parser: regex flexível para labels, variações de moeda (ouro, moedas, gold, G), quantidade, detecção casa aliada

**Entidades (ER Diagram):**
- profiles (id FK auth.users, email, role admin|merchant, merchant_name)
- merchants (id, normalized_name UNIQUE, user_id, total_sales, total_base, total_commission)
- buyers (id, normalized_name UNIQUE, is_ally, ally_house, total_spent_base/final)
- products (id, normalized_name UNIQUE, cost_price, avg_price, total_qty, total_revenue)
- destinations (id, normalized_name UNIQUE, total_deliveries)
- sales (id, ficha_number, raw_text, buyer_id, merchant_id, product_id, destination_id, quantity, base_value, final_value, currency, delivery_type, is_ally, ally_house, tax_breakdown JSONB, status pendente/aprovada/rejeitada, created_by, approved_by, created_at)

Relações 1:N, deduplicação por normalizeName (NFD) + Levenshtein >0.9

**Pastas:**
```
src/
  lib/ supabase.ts, parser.ts, taxEngine.ts, normalize.ts, storage.ts, export.ts
  types/
  contexts/ Theme, Auth, Data
  components/ui, layout
  pages/ Login, Dashboard, Sales, NewFicha, Approvals, Merchants, Buyers, Products, Treasury, Reports, Archive, Settings
  hooks/
```

Wireframes (descritos):
- Login: mesa madeira, velas, livros, selo cera, left showcase KPI, right form parchment
- Dashboard: KPIs top (Receita, Lucro, Vendas, Ticket), BarChart período, Pie repartição, rankings 3 colunas, tabela últimas vendas, tesouraria rápida
- Vendas: search instant + filtros + lista cards virtualizável + drawer lateral detalhes + import lote (texto/file)
- Nova Ficha: 2 colunas desktop - form left, preview pergaminho right, tesouraria live
- Aprovações: lista pendentes com botões aprovar/rejeitar/ler
- Mercadores/Compradores/Produtos: master-detail com perfil, histórico, ranking
- Tesouraria: KPIs, evolução mensal, detalhamento taxas, carteira por mercador
- Relatórios: filtro diário/semanal/mensal/por entidade + export CSV/Excel/PDF
- Arquivo: stats totais, destinos, ER diagram texto

## 🚀 Como rodar local

```bash
cd rpg-mercantile
npm install
npm run dev # http://localhost:5173
```

Login rápido local: admin@ravenport.com / admin ou bran@ravenport.com / bran (senha qualquer no mock).

## 🌐 GitHub Pages + Supabase

1. Crie projeto supabase.com
2. No SQL Editor rode o schema de `src/lib/supabase.ts` export `SUPABASE_SCHEMA_SQL`
3. Settings → API copie URL e anon key
4. Configure env:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
5. Build: `npm run build` → gera `dist/`
6. GitHub Pages:
   - Crie repo, push
   - Settings → Pages → Source: GitHub Actions ou branch `gh-pages`
   - Ou use `npm run deploy` (gh-pages) que publica pasta dist

O sistema detecta automaticamente se Supabase configurado; caso contrário usa localStorage (ideal para uso no PC).

## 📤 Importação fichas

Aceita:
- Texto colado direto (várias fichas com ═══ ou 📜 ORDEM)
- TXT
- DOCX (via mammoth)
- PDF futuro (pdfjs)
- WhatsApp/Discord exports (parser tenta achar blocos com comprador/mercador)

Exemplo ficha:
```
══════════════════════════════
📜 ORDEM DE AQUISIÇÃO
✦ Comprador: ➤ Lord Aryon Lorrengreen
✦ Mercadoria: ➤ Cordas
✦ Quantidade: ➤ 6 unidades
✦ Valor da Transação: ➤ 300 moedas de ouro
✦ Método de Entrega: ➤ Domiciliar
✦ Reino de Destino: ➤ Portões da Muralha
✦ Mercador Responsável: ➤ Bran Crowley
══════════════════════════════
```

## 🎨 Identidade Visual

- Cores: carvão #0a0a0b, grafite #1e1e21, couro #3d2a1d, dourado envelhecido #d4af37, bronze, prata, musgo #4a6741, petróleo #2c3e50, vinho #5d1f2a
- Evitar vibrantes
- Ícones: moedas, pergaminhos, baús, balanças, carroças, navios - lucide-react discreto
- Bordas brass sutil, wax seal, pergaminho gradiente

## 📊 Funcionalidades entregues

✅ Login mercadores (email+senha) + admin/merchant roles
✅ Tema escuro/claro com persistência
✅ Dashboard completo com rankings, gráficos, KPIs, tesouraria
✅ Lista vendas com card/table, pesquisa instantânea debounce, filtros combinados, drawer lateral sem trocar página
✅ Perfil mercador/comprador/mercadoria com histórico e gráficos
✅ Lucro com custo opcional, cálculo automático
✅ Relatórios PDF/Excel/CSV diário/semanal/mensal/por entidade
✅ Menu lateral livro mercantil (Mesa, Livro, Mercadores, Compradores, Mercadorias, Tesouraria, Relatórios, Arquivo, Configurações)
✅ Mobile: adaptação total, menu inferior, cards grandes, pesquisa fixa, rolagem fluida
✅ Performance: lazy, memo, pagination, cache, debounce, virtualização pronta
✅ Taxas completas com UI live + ficha oficial gerada com opção copiar
✅ Solicitação aprovação admin
✅ Supabase schema + instruções GitHub Pages
✅ Código modular, limpo, escalável

## 🔮 Futuro (preparado)

Controle estoque, produção, funcionários, facções, empresas, contratos, tributos, transporte, banco companhia, sistema econômico, painel admin, API pública, app mobile - arquitetura já separada em services, controllers, models prontos no DataContext.

---
Feito para transformar o caos de fichas em um livro que reinos invejariam. 🕯️📜⚔️
