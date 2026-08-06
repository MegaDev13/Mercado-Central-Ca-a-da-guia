import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { SUPABASE_SCHEMA_SQL, isSupabaseConfigured } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useMemo, useState } from 'react';
import { localDataSummary, MigrationSummary } from '../lib/db';
import { CloudUpload, RefreshCw } from 'lucide-react';

export function SettingsPage() {
  const { clearAll, resetBlank, syncError, isRemote, migrateLocalToSupabase } = useData();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [migrating, setMigrating] = useState(false);
  const [migResult, setMigResult] = useState<MigrationSummary | null>(null);
  const [localCounts, setLocalCounts] = useState(()=> localDataSummary());

  const refreshLocalCounts = ()=> setLocalCounts(localDataSummary());

  const handleMigrate = async ()=>{
    if (!confirm(`Migrar dados deste navegador para o Supabase?\n\n${localCounts.merchants} mercadores • ${localCounts.products} mercadorias • ${localCounts.sales} vendas • ${localCounts.movements} movimentações\n\nItens que já existem no Supabase (mesmo nome) são preservados.`)) return;
    setMigrating(true);
    setMigResult(null);
    try {
      const res = await migrateLocalToSupabase();
      setMigResult(res);
      refreshLocalCounts();
    } catch(e:any) {
      alert(`Falha na migração: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

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
          <h3 className="font-display font-bold mb-3">Sincronização & Armazenamento</h3>
          <div className="text-sm">
            <p>Modo atual: <b>{isRemote ? 'Supabase (PostgreSQL) — dados na nuvem, visíveis em todos os dispositivos' : 'LocalStorage (somente este navegador)'}</b></p>
            {syncError ? (
              <div className="mt-3 p-3 rounded-lg bg-red-950/30 border border-red-900/60 text-red-200 text-xs">
                <b>⚠ Erro de sincronização:</b> {syncError}
                <div className="mt-1 text-red-300/70">Verifique se o schema SQL abaixo foi executado no Supabase (tabelas merchants, products, sales, buyers, destinations, stock_movements e policies allow all).</div>
              </div>
            ) : isRemote ? (
              <div className="mt-3 p-3 rounded-lg bg-green-950/20 border border-green-900/50 text-green-300 text-xs">✓ Conectado ao Supabase e sincronizando sem erros.</div>
            ) : (
              <p className="text-[var(--text-secondary)] mt-1">Para GitHub Pages + Supabase, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
            )}
          </div>

          {isRemote && (
            <div className="mt-4 p-4 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]">
              <div className="flex items-center gap-2 font-display font-bold text-sm mb-2"><CloudUpload className="w-4 h-4 text-[#d4af37]"/> Migração: este navegador → Supabase</div>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Dados salvos neste navegador (modo antigo): <b>{localCounts.total}</b> registros —
                {' '}{localCounts.merchants} mercadores • {localCounts.products} mercadorias • {localCounts.buyers} compradores • {localCounts.sales} vendas • {localCounts.movements} movimentações.
                A migração também cria mercadores para logins já registrados.
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <Button variant="gold" size="sm" onClick={handleMigrate} disabled={migrating}>
                  {migrating ? 'Migrando...' : 'Migrar dados locais → Supabase'}
                </Button>
                <Button variant="outline" size="sm" onClick={refreshLocalCounts}><RefreshCw className="w-3 h-3 mr-1"/>Atualizar contagem</Button>
              </div>
              {migResult && (
                <div className="mt-3 p-3 rounded bg-green-950/20 border border-green-900/40 text-xs space-y-1">
                  <div className="font-bold text-green-300">✓ Migração concluída</div>
                  <div>Importados: {migResult.profilesLinked + migResult.merchants} mercadores ({migResult.profilesLinked} vindos de logins) • {migResult.products} produtos • {migResult.buyers} compradores • {migResult.destinations} destinos • {migResult.sales} vendas • {migResult.movements} movimentações</div>
                  <div className="text-[var(--text-secondary)]">Já existentes (preservados): {migResult.skipped}</div>
                  {migResult.errors.length>0 && (
                    <div className="text-red-300">{migResult.errors.length} erros: {migResult.errors.slice(0,3).join(' | ')}{migResult.errors.length>3?' ...':''}</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="text-sm mt-4">
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
          <p className="text-sm text-[var(--text-secondary)] mb-3">Apagar todo o livro mercantil{isRemote ? ' (Supabase + este navegador)' : ' local'} incluindo movimentações.</p>
          <Button variant="outline" className="border-red-900 text-red-300 hover:bg-red-950/30" onClick={clearAll}>Apagar Todos os Registros</Button>
        </div>
      </div>
    </div>
  );
}
