import { useData } from '../contexts/DataContext';
import { Button } from '../components/ui/button';
import { Check, X, Eye } from 'lucide-react';
import { useState } from 'react';
import { Sale } from '../types';

export function ApprovalsPage() {
  const { pendingSales, approveSale, rejectSale } = useData();
  const [selected, setSelected] = useState<Sale | null>(null);

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold">Solicitações do Tesoureiro</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{pendingSales.length} fichas aguardando selo de cera vermelho</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {pendingSales.map(s=>(
            <div key={s.id} className="merchant-card p-4">
              <div className="flex justify-between gap-4">
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-2">{s.product_name} x{s.quantity} <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-900/30 border border-amber-800 text-amber-200">PENDENTE</span></div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">{s.buyer_name} {s.is_ally && `• ALIADO ${s.ally_house}`} • {s.destination_name} • {s.merchant_name}</div>
                  <div className="text-xs mt-1">Base {s.base_value} → Final {s.final_value.toFixed(2)} ouro • {s.delivery_type} {s.is_ally && '(aliado -10%)'}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="gold" onClick={()=>approveSale(s.id)}><Check className="w-4 h-4 mr-1"/>Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={()=>setSelected(s)}><Eye className="w-4 h-4 mr-1"/>Ler</Button>
                  <Button size="sm" variant="ghost" onClick={()=>rejectSale(s.id)} className="text-red-300"><X className="w-4 h-4 mr-1"/>Rejeitar</Button>
                </div>
              </div>
            </div>
          ))}
          {pendingSales.length===0 && <div className="merchant-card p-12 text-center text-[var(--text-muted)]">Nenhuma pendência. Selo da companhia em dia.</div>}
        </div>

        <div>
          {selected ? (
            <div className="merchant-card p-5 sticky top-4">
              <h3 className="font-display font-bold mb-3">Ficha Completa</h3>
              <pre className="whitespace-pre-wrap font-mono text-xs p-3 rounded bg-[var(--bg-input)] border border-[var(--border)] max-h-[500px] overflow-auto">{selected.raw_text}</pre>
              <div className="flex gap-2 mt-4">
                <Button variant="gold" className="flex-1" onClick={()=>{approveSale(selected.id); setSelected(null);}}>Aprovar e Contabilizar</Button>
                <Button variant="outline" onClick={()=>{rejectSale(selected.id); setSelected(null);}}>Rejeitar</Button>
              </div>
            </div>
          ) : (
            <div className="merchant-card p-8 text-center text-[var(--text-muted)]">Clique em Ler para inspecionar antes de carimbar.</div>
          )}
        </div>
      </div>
    </div>
  );
}
