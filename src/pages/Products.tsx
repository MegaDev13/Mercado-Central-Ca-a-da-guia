import { useData } from '../contexts/DataContext';
import { useState } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export function ProductsPage() {
  const { products, sales, updateProductCost } = useData();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = products.find(p=>p.id===selected);
  const prodSales = sales.filter(s=> s.product_id===selected || s.product_name===sel?.name).filter(s=>s.status==='aprovada');
  const [costInput, setCostInput] = useState('');

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold">Mercadorias & Estoque Lendário</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Defina custo para calcular lucro automaticamente. Marge = (final - custo*qty)</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3 max-h-[75vh] overflow-auto">
          {[...products].sort((a,b)=>b.total_revenue_final-a.total_revenue_final).map(p=>(
            <button key={p.id} onClick={()=>{setSelected(p.id); setCostInput(p.cost_price?.toString()||'');}} className={`w-full text-left merchant-card p-4 ${selected===p.id?'border-[var(--border-brass)]':''}`}>
              <div className="font-bold">{p.name}</div>
              <div className="text-xs text-[var(--text-secondary)]">{p.total_qty} unid • avg {p.avg_price.toFixed(1)} ouro • receita final {p.total_revenue_final.toFixed(0)}</div>
              {p.cost_price ? <div className="text-[11px] mt-1">Custo {p.cost_price} • Lucro {p.total_profit?.toFixed(0)} ouro • Margem {p.total_revenue_final>0 ? ((p.total_profit||0)/p.total_revenue_final*100).toFixed(1):0}%</div> : <div className="text-[11px] text-amber-300 mt-1">Sem custo - só faturamento</div>}
            </button>
          ))}
          {products.length===0 && <div className="merchant-card p-8 text-center text-[var(--text-muted)]">Nenhuma mercadoria</div>}
        </div>
        <div className="lg:col-span-2">
          {sel ? (
            <div className="space-y-4">
              <div className="merchant-card p-6">
                <h2 className="font-display text-2xl font-bold">{sel.name}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Qtd Vendida</div><div className="font-bold text-lg">{sel.total_qty}</div></div>
                  <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Receita Base</div><div className="font-bold text-lg">{sel.total_revenue_base.toFixed(0)}</div></div>
                  <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Receita Final</div><div className="font-bold text-lg">{sel.total_revenue_final.toFixed(0)}</div></div>
                  <div className="p-3 rounded bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Lucro</div><div className="font-bold text-lg">{sel.total_profit?.toFixed(0)||'—'}</div></div>
                </div>
                <div className="mt-4 flex gap-2 items-end">
                  <div className="flex-1"><div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-1">Custo por unidade (para lucro)</div><Input type="number" value={costInput} onChange={e=>setCostInput(e.target.value)} placeholder="ex: 20"/></div>
                  <Button variant="gold" onClick={()=>{if(costInput) updateProductCost(sel.id, Number(costInput));}}>Salvar Custo</Button>
                </div>
              </div>
              <div className="merchant-card p-5">
                <h3 className="font-display font-bold mb-3">Quem vendeu / Quem comprou / Destinos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div><div className="text-[11px] uppercase text-[var(--text-muted)]">Mercadores</div><ul className="mt-2 space-y-1">{Array.from(new Set(prodSales.map(s=>s.merchant_name))).map(n=><li key={n} className="p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]">{n}</li>)}</ul></div>
                  <div><div className="text-[11px] uppercase text-[var(--text-muted)]">Compradores</div><ul className="mt-2 space-y-1">{Array.from(new Set(prodSales.map(s=>s.buyer_name))).slice(0,8).map(n=><li key={n} className="p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]">{n}</li>)}</ul></div>
                  <div><div className="text-[11px] uppercase text-[var(--text-muted)]">Destinos</div><ul className="mt-2 space-y-1">{Array.from(new Set(prodSales.map(s=>s.destination_name))).map(n=><li key={n} className="p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]">{n}</li>)}</ul></div>
                </div>
              </div>
            </div>
          ) : <div className="merchant-card p-12 text-center text-[var(--text-muted)]">Selecione uma mercadoria para ver receita, custo, lucro, gráficos e cadeia</div>}
        </div>
      </div>
    </div>
  );
}
