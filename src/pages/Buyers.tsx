import { useData } from '../contexts/DataContext';
import { useState } from 'react';

export function BuyersPage() {
  const { buyers, sales } = useData();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = buyers.find(b=>b.id===selected);
  const buyerSales = sales.filter(s=> s.buyer_id===selected || s.buyer_name===sel?.name).filter(s=>s.status==='aprovada');

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold">Compradores & Lords</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Aliados Gardener, Lannister, Stark recebem 10% de desconto automático</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3 max-h-[75vh] overflow-auto pr-1">
          {[...buyers].sort((a,b)=>b.total_spent_final-a.total_spent_final).map(b=>(
            <button key={b.id} onClick={()=>setSelected(b.id)} className={`w-full text-left merchant-card p-4 ${selected===b.id?'border-[var(--border-brass)]':''} ${b.is_ally?'ring-1 ring-amber-800/30':''}`}>
              <div className="flex justify-between">
                <div className="font-bold truncate">{b.name} {b.is_ally && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-200 border border-amber-800">{b.ally_house || 'ALIADO'}</span>}</div>
                <div className="text-sm font-bold">{b.total_spent_final.toFixed(0)}</div>
              </div>
              <div className="text-xs text-[var(--text-secondary)]">{b.total_purchases} compras • base {b.total_spent_base.toFixed(0)} → final {b.total_spent_final.toFixed(0)}</div>
            </button>
          ))}
          {buyers.length===0 && <div className="merchant-card p-8 text-center text-[var(--text-muted)]">Nenhum comprador ainda</div>}
        </div>
        <div className="lg:col-span-2">
          {sel ? (
            <div className="space-y-4">
              <div className="merchant-card p-6">
                <h2 className="font-display text-2xl font-bold">{sel.name}</h2>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] text-[var(--text-muted)] uppercase">Gasto Final</div><div className="font-bold text-lg">{sel.total_spent_final.toFixed(0)} ouro</div></div>
                  <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] text-[var(--text-muted)] uppercase">Gasto Base</div><div className="font-bold text-lg">{sel.total_spent_base.toFixed(0)}</div></div>
                  <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] text-[var(--text-muted)] uppercase">Compras</div><div className="font-bold text-lg">{sel.total_purchases}</div></div>
                </div>
              </div>
              <div className="merchant-card p-5">
                <h3 className="font-display font-bold mb-3">Produtos Adquiridos</h3>
                <table className="w-full text-sm"><thead className="text-[11px] uppercase text-[var(--text-muted)] border-b border-[var(--border)]"><tr><th className="text-left py-2">Data</th><th className="text-left py-2">Mercadoria</th><th className="text-left py-2">Qtd</th><th className="text-left py-2">Valor Final</th><th className="text-left py-2">Mercador</th></tr></thead><tbody>{buyerSales.map(s=><tr key={s.id} className="border-b border-[var(--border)]/40"><td className="py-2">{new Date(s.created_at).toLocaleDateString()}</td><td className="py-2">{s.product_name}</td><td className="py-2">{s.quantity}</td><td className="py-2 font-bold">{s.final_value.toFixed(0)}</td><td className="py-2">{s.merchant_name}</td></tr>)}</tbody></table>
              </div>
            </div>
          ) : <div className="merchant-card p-12 text-center text-[var(--text-muted)]">Selecione um comprador</div>}
        </div>
      </div>
    </div>
  );
}
