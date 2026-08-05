# Sistema de Estoque - Companhia Ravenport

## Fluxo completo

### 1. Modo entrega em branco (como solicitado)
- Sistema inicia zerado: sem vendas, sem mercadores, sem produtos, sem compradores, sem movimentações.
- Apenas login admin `admin@ravenport.com` existe por padrão.
- Botão em Configurações > "Deixar Tudo em Branco" zera tudo mantendo logins.

### 2. Cadastro de vendedores
- **Admin**: Mercadores → campo "Novo mercador" → Cadastrar → pode Excluir com lixeira → pode vincular login existente via dropdown.
- **Mercador**: Login → Registrar → informa Email, Senha, Nome exato do mercador → cria conta → cria automaticamente vendedor com mesmo nome se não existir, ou vincula ao existente.

### 3. Cadastro de itens - Entrada de estoque
- **Página Almoxarifado (Estoque)**:
  - Botão Cadastrar Item: nome *, categoria, qtd inicial, estoque mínimo (alerta), custo por unidade (ouro), fornecedor, localização.
  - Ao cadastrar com qtd inicial >0, cria movimento tipo 'entrada' automático.
  - Lista com busca, mostra status: OK / BAIXO (amarelo) / ZERADO (vermelho).
  - Editar: lápis → edita todos campos inclusive qtd atual, min, custo.
  - Excluir: lixeira → remove item da lista, mantém histórico de movimentações.

- **Entrada / Ajuste Manual**:
  - Formulário lateral: selecione produto, tipo (entrada, saída manual, ajuste, perda, devolução), quantidade, motivo, custo opcional (atualiza custo).
  - Exemplo: Compra de fornecedor 100 cordas a 10 ouro cada → entrada 100, motivo "Compra fornecedor Forja Norte".
  - Ajuste serve para correção de inventário.

### 4. Saída automática por venda (fichas)
- Mercador ou admin preenche ficha em Nova Ficha:
  - Admin escolhe de quem foi a venda via dropdown (lista vendedores) + botão Cadastrar Novo Vendedor inline.
  - Mercador: campo mercador travado no seu nome (login).
- Ficha vai para status pendente.
- Admin em Aprovações aprova:
  - Sistema baixa automaticamente do estoque: `stock_quantity -= quantidade_vendida`
  - Cria movimento tipo 'saida' com razão `Venda F-xxx - Lord Aryon`, link para ficha.
  - Se estoque ficar negativo, permite mas alerta (pode vender sem estoque).
  - Atualiza total_qty vendido, receita, lucro.

### 5. Relatórios em PDF com filtros

Página Relatórios → aba Estoque & Movimentações:

- **Tipo de relatório** (todos em PDF com cabeçalho Ravenport, selo, filtros, paginação):
  - `estoque_atual`: Item, Cat, Estoque, Min, Custo, Valor Total, Forn, Local, Status
  - `baixo_estoque`: Itens <= min, falta para 2x min, ação sugerida COMPRA URGENTE / Repor
  - `entradas_periodo`: Filtra movimentos tipo entrada no período
  - `saidas_periodo`: Saídas por vendas (e perdas) no período
  - `movimentacoes_completa`: Entrada/Saída/Ajuste/Perda/Devolução com antes→depois, motivo, responsável
  - `lucro_produto`: Vendidos, custo unit, receita base/final, lucro estimado (final - custo*qtd), margem %, em estoque
  - `vendas_por_produto`: Filtra por produto e mercador e datas, mostra vendas
  - `tesouraria_completa`: Tesouraria com repartição (base, ally -10%, entrega ±, final, mercador 20%, produtor 50%, companhia)

- **Filtros**:
  - Produto (opcional)
  - Mercador (para vendas)
  - Categoria
  - Data De / Até

- **Exportações**:
  - PDF: `exportStockPDF()` com jspdf-autotable, cabeçalho dourado, totais.
  - Excel: `exportStockExcel()` com 2 abas: Estoque e Movimentacoes.

Todos os PDFs incluem:
- Cabeçalho dourado Ravenport - Companhia Mercante
- Título do relatório e descrição dos filtros aplicados
- Data de geração e selo oficial
- Tabelas estilizadas
- Rodapé com paginação e selo

### 6. Integração com vendas e tesouraria

- Produtos agora têm `stock_quantity` e `min_stock`.
- Quando admin aprova venda, estoque baixa.
- Se tentar vender item que não existe no estoque, `ensureProduct` cria com 0 e depois fica negativo - admin pode fazer entrada para corrigir.
- Dashboard mostra alertas de estoque baixo (badge no menu Estoque).

### 7. Estrutura de dados nova

```ts
Product {
  stock_quantity: number
  min_stock: number
  supplier?: string
  location?: string
  // ... existentes
}

StockMovement {
  id, product_id, product_name, type: entrada|saida|ajuste|perda|devolucao,
  quantity, previous_stock, new_stock,
  reason, cost_at_time,
  related_sale_id, related_sale_ficha,
  created_by, created_by_name, created_at
}
```

Armazenado em localStorage `rpg_stock_movements` ou Supabase tabela `stock_movements`.

### 8. Como usar no modo em branco (passo a passo para entrega)

1. Configurações → Deixar Tudo em Branco
2. Mercadores → Cadastre vendedores (ex: Bran Crowley, Finn River) ou deixe mercadores se auto-cadastrarem via Login Registrar
3. Almoxarifado → Cadastrar itens (ex: Cordas qtd 100 min 10 custo 5, Espadas qtd 20 min 5 custo 50)
4. Para entrada extra: Almoxarifado → Entrada → selecione produto → qtd → motivo
5. Mercador: Login → Nova Ficha → preencha comprador, escolha produto que existe no estoque, qtd, valor base, entrega, destino → Gerar → Enviar para aprovação
6. Admin: Aprovações → aprova → baixa estoque automática
7. Relatórios → Estoque → escolha tipo: Estoque Atual / Baixo Estoque / Entradas Período etc → filtre por produto / categoria / datas → Exportar PDF

PDFs prontos para imprimir ou enviar no Discord/WhatsApp da guilda RPG.
