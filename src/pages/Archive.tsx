import { useData } from '../contexts/DataContext';

export function ArchivePage() {
  const { buyers, products, destinations, sales } = useData();
  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold">Arquivo da Companhia</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Banco de dados consolidado, sem duplicações, relacionamentos automáticos</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="merchant-card p-5"><div className="text-[11px] uppercase text-[var(--text-muted)]">Total Fichas Brutas</div><div className="font-display text-3xl font-bold">{sales.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Aprovadas {sales.filter(s=>s.status==='aprovada').length} • Pendentes {sales.filter(s=>s.status==='pendente').length}</div></div>
        <div className="merchant-card p-5"><div className="text-[11px] uppercase text-[var(--text-muted)]">Compradores Únicos</div><div className="font-display text-3xl font-bold">{buyers.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Aliados {buyers.filter(b=>b.is_ally).length}</div></div>
        <div className="merchant-card p-5"><div className="text-[11px] uppercase text-[var(--text-muted)]">Mercadorias Únicas</div><div className="font-display text-3xl font-bold">{products.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Com custo {products.filter(p=>!!p.cost_price).length}</div></div>
        <div className="merchant-card p-5"><div className="text-[11px] uppercase text-[var(--text-muted)]">Destinos</div><div className="font-display text-3xl font-bold">{destinations.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Reinos e portos mapeados</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="merchant-card p-5">
          <h3 className="font-display font-bold mb-3">Destinos Mapeados</h3>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {destinations.map(d=><div key={d.id} className="flex justify-between p-2 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm"><span>{d.name}</span><span className="text-[var(--text-muted)]">{d.total_deliveries} entregas</span></div>)}
            {destinations.length===0 && <div className="text-sm text-[var(--text-muted)] text-center py-8">Nenhum destino</div>}
          </div>
        </div>
        <div className="lg:col-span-2 merchant-card p-5">
          <h3 className="font-display font-bold mb-3">Diagrama de Relacionamentos (Entidades)</h3>
          <div className="p-4 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] font-mono text-xs leading-relaxed">
            <div className="text-[var(--text-secondary)]">-- Banco Relacional Normalizado --</div>
            <div>profiles (id, email, role, merchant_name) 1──∞ sales (created_by, approved_by)</div>
            <div>merchants (id, name, total_base, commission) 1──∞ sales</div>
            <div>buyers (id, name, is_ally, ally_house) 1──∞ sales</div>
            <div>products (id, name, cost, avg_price, total_qty) 1──∞ sales</div>
            <div>destinations (id, name, total_deliveries) 1──∞ sales</div>
            <div>sales (id, buyer_id, merchant_id, product_id, destination_id, base, final, tax_breakdown jsonb, status)</div>
            <br/>
            <div className="text-[var(--text-secondary)]">-- Regras de Negócio --</div>
            <div>• Fuzzy deduplication por normalizeName + Levenshtein &gt;0.9</div>
            <div>• TaxEngine: base → ally -10% → delivery +30% domiciliar / -15% retirada se ≥100</div>
            <div>• Split: mercador 20% base, produtor 50% base, companhia 30% + delivery_adj - ally_discount</div>
            <div>• Status flow: pendente → aprovada/rejeitada (admin only)</div>
            <div>• Parsing: regex flexível para variações de label, moedas, quantidade, Discord/WhatsApp history</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="font-bold">Scalability</div><div className="text-[var(--text-secondary)] mt-1">Lazy loading, pagination, debounce search, virtualization, cache TanStack Query, indexing Supabase</div></div>
            <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="font-bold">Future</div><div className="text-[var(--text-secondary)] mt-1">Estoque, produção, funcionários, facções, contratos, tributos, transporte, banco companhia, API pública, app mobile</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
