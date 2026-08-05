import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { SUPABASE_SCHEMA_SQL, isSupabaseConfigured } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';

export function SettingsPage() {
  const { clearAll, resetBlank } = useData();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  return (
    <div className="p-4 lg:p-8 max-w-[1000px] mx-auto">
      <h1 className="font-display text-2xl font-bold">Configurações da Companhia</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Tema, armazenamento, estoque, Supabase, GitHub Pages deploy - Modo entrega em branco ativo</p>

      <div className="space-y-6">
        <div className="merchant-card p-6">
          <h3 className="font-display font-bold mb-3">Identidade</h3>
          <div className="text-sm space-y-1">
            <div>Email: {user?.email}</div>
            <div>Nome Mercante: {user?.merchant_name}</div>
            <div>Papel: {user?.role}</div>
            <div>ID: {user?.id}</div>
          </div>
          <div className="mt-3 p-3 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs">
            <b>Modo em branco:</b> Sistema inicia zerado. Mercadores se cadastram em Login → Registrar quando forem subir fichas. Admin cadastra vendedores em Mercadores e itens em Almoxarifado → Entrada. Vendas via fichas dão baixa automática no estoque ao aprovar.
          </div>
        </div>

        <div className="merchant-card p-6">
          <h3 className="font-display font-bold mb-3">Aparência Medieval</h3>
          <div className="flex gap-2">
            <Button variant={theme==='dark'?'gold':'outline'} onClick={()=>setTheme('dark')}>Tema Escuro (Padrão)</Button>
            <Button variant={theme==='light'?'gold':'outline'} onClick={()=>setTheme('light')}>Tema Claro (Pergaminho)</Button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Paleta: carvão, grafite, couro, madeira escura, dourado envelhecido, bronze, prata, musgo, petróleo, vinho.</p>
        </div>

        <div className="merchant-card p-6">
          <h3 className="font-display font-bold mb-3">Almoxarifado & Estoque</h3>
          <div className="text-sm space-y-2">
            <p><b>Entrada:</b> Admin vai em Almoxarifado → Cadastrar Item (nome, categoria, qtd inicial, min, custo, fornecedor, local) → Salvar. Depois pode fazer Entrada manual com quantidade e motivo.</p>
            <p><b>Edição:</b> Clique no lápis para editar nome, qtd, min, custo, etc. Lixeira para excluir item (mantém histórico de movimentações).</p>
            <p><b>Saída:</b> Automática quando ficha de venda é aprovada em Aprovações. Baixa estoque e registra movimento tipo 'saida' com referência da ficha.</p>
            <p><b>Relatórios PDF:</b> Em Relatórios → aba Estoque → escolha tipo (Estoque Atual, Baixo Estoque, Entradas Período, Saídas Período, Movimentações Completa, Lucro por Produto, etc.) → aplique filtros de produto, mercador, categoria, datas → Exportar PDF. Todos com cabeçalho Ravenport e selo oficial.</p>
          </div>
        </div>

        <div className="merchant-card p-6">
          <h3 className="font-display font-bold mb-3">Armazenamento & Deploy</h3>
          <div className="text-sm">
            <p>Modo atual: <b>{isSupabaseConfigured ? 'Supabase (PostgreSQL)' : 'LocalStorage (PC local)'}</b></p>
            <p className="text-[var(--text-secondary)] mt-1">Para GitHub Pages + Supabase, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
            <div className="mt-4 p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]">
              <div className="text-xs font-bold uppercase tracking-widest mb-2">Fluxo mercadores (em branco)</div>
              <ol className="list-decimal ml-4 space-y-1 text-xs leading-relaxed">
                <li>Admin cadastra vendedores em Mercadores (ou deixa mercador se auto-cadastrar no Login)</li>
                <li>Admin cadastra itens em Almoxarifado com estoque inicial</li>
                <li>Mercador cria conta em Login → Registrar → escolhe nome exato já cadastrado ou novo (vincula automaticamente)</li>
                <li>Mercador vai em Nova Ficha → preenche → envia para aprovação</li>
                <li>Admin em Aprovações aprova → baixa automática do estoque + contabiliza carteira 20%, produtor 50%, companhia 30%+taxas</li>
                <li>Relatórios PDF sempre disponíveis com filtros</li>
              </ol>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest">Ver SQL Schema Supabase (inclui estoque)</summary>
              <pre className="mt-2 p-3 rounded bg-[#0a0a0b] text-[#9a9aa0] text-[11px] overflow-auto max-h-[300px] whitespace-pre-wrap">{SUPABASE_SCHEMA_SQL}</pre>
              <div className="text-[11px] text-[var(--text-muted)] mt-2">Adicione também tabela stock_movements: id uuid, product_id uuid, product_name text, type text, quantity numeric, previous_stock numeric, new_stock numeric, reason text, related_sale_id uuid, created_by uuid, created_at timestamptz</div>
            </details>
          </div>
        </div>

        <div className="merchant-card p-6 border-amber-900/30">
          <h3 className="font-display font-bold mb-3 text-amber-300">Entrega em Branco</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">Zera vendas, mercadores, compradores, produtos, destinos e movimentações. Mantém logins. Ideal para iniciar do zero como solicitado.</p>
          <Button variant="outline" className="border-amber-800 text-amber-200 hover:bg-amber-950/20" onClick={resetBlank}>Deixar Tudo em Branco (Reset Entrega)</Button>
        </div>

        <div className="merchant-card p-6 border-red-900/50">
          <h3 className="font-display font-bold mb-3 text-red-300">Zona Perigosa</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">Apagar todo o livro mercantil local incluindo movimentações.</p>
          <Button variant="outline" className="border-red-900 text-red-300 hover:bg-red-950/30" onClick={clearAll}>Apagar Todos os Registros Locais</Button>
        </div>
      </div>
    </div>
  );
}
