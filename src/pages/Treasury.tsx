import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function TreasuryPage() {
  const { stats, approvedSales, merchants } = useData();
  const { isAdmin, user } = useAuth();

  const mySales = isAdmin ? approvedSales : approvedSales.filter(s=> s.merchant_name===user?.merchant_name);
  const myStats = {
    totalBase: mySales.reduce((a,s)=>a+s.base_value,0),
    totalFinal: mySales.reduce((a,s)=>a+s.final_value,0),
    commission: mySales.reduce((a,s)=>a+s.tax_breakdown.merchant_commission,0),
    company: mySales.reduce((a,s)=>a+s.tax_breakdown.company_final,0),
    producer: mySales.reduce((a,s)=>a+s.tax_breakdown.producer_share,0),
    deliveryExtra: mySales.filter(s=>s.delivery_type==='domiciliar').reduce((a,s)=>a+s.tax_breakdown.delivery_adjustment,0),
    allyDiscount: mySales.filter(s=>s.is_ally).reduce((a,s)=>a+s.tax_breakdown.ally_discount,0),
  };

  const merchantWallet = isAdmin ? merchants.map(m=>({name:m.name, commission:m.total_commission, base:m.total_base})) : [];

  const monthly = (()=> {
    const map = new Map<string, {base:number, final:number, company:number}>();
    approvedSales.forEach(s=>{
      const d = new Date(s.created_at);
      const key = `${d.getMonth()+1}/${d.getFullYear()}`;
      const cur = map.get(key) || {base:0, final:0, company:0};
      cur.base+=s.base_value; cur.final+=s.final_value; cur.company+=s.tax_breakdown.company_final;
      map.set(key, cur);
    });
    return Array.from(map.entries()).map(([name,v])=>({name, ...v}));
  })();

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <h1 className="font-display text-2xl font-bold">{isAdmin ? 'Tesouraria da Companhia' : 'Minha Carteira'}</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        {isAdmin ? 'Repartição oficial: 20% mercador, 50% produtor, 30% companhia + taxas de entrega' : 'Seu ganho é 20% da base antes de taxas, independente de entrega ou aliado'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="merchant-card p-5"><div className="text-[11px] uppercase text-[var(--text-muted)]">Receita Base Total</div><div className="font-display text-2xl font-bold">{myStats.totalBase.toFixed(0)} ouro</div><div className="text-xs text-[var(--text-secondary)]">Antes de taxas</div></div>
        <div className="merchant-card p-5"><div className="text-[11px] uppercase text-[var(--text-muted)]">Receita Final</div><div className="font-display text-2xl font-bold">{myStats.totalFinal.toFixed(0)} ouro</div><div className="text-xs text-green-400">+ Domiciliar {myStats.deliveryExtra.toFixed(0)} • - Aliado {myStats.allyDiscount.toFixed(0)}</div></div>
        <div className="merchant-card p-5 border-[var(--border-brass)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">{isAdmin ? 'Lucro Companhia' : 'Minha Comissão 20%'}</div><div className="font-display text-2xl font-bold">{(isAdmin ? myStats.company : myStats.commission).toFixed(0)} ouro</div><div className="text-xs text-[var(--text-secondary)]">{isAdmin ? 'Após pagar mercador e produtor' : 'Carteira disponível'}</div></div>
        <div className="merchant-card p-5"><div className="text-[11px] uppercase text-[var(--text-muted)]">Produtor (Forja)</div><div className="font-display text-2xl font-bold">{myStats.producer.toFixed(0)} ouro</div><div className="text-xs text-[var(--text-secondary)]">50% da base</div></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 merchant-card p-5">
          <h3 className="font-display font-bold mb-4">Evolução Mensal</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <XAxis dataKey="name" stroke="#6a6a70" fontSize={11}/>
                <YAxis stroke="#6a6a70" fontSize={11}/>
                <Tooltip contentStyle={{background:'#1a1a1e', border:'1px solid #2a2a30'}}/>
                <Bar dataKey="final" fill="#d4af37" name="Final" radius={[4,4,0,0]}/>
                <Bar dataKey="company" fill="#3d5a73" name="Companhia"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="merchant-card p-5">
          <h3 className="font-display font-bold mb-4">Detalhamento Taxas</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]"><span>Base total</span><span className="font-bold">{myStats.totalBase.toFixed(2)}</span></div>
            <div className="flex justify-between p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]"><span>Domiciliar +30% ({approvedSales.filter(s=>s.delivery_type==='domiciliar').length} vendas)</span><span className="text-green-400">+{myStats.deliveryExtra.toFixed(2)}</span></div>
            <div className="flex justify-between p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]"><span>Retirada -15% (se ≥100)</span><span className="text-red-300">{myStats.totalBase>0 ? (myStats.totalFinal - myStats.totalBase - myStats.deliveryExtra + myStats.allyDiscount).toFixed(2) : '0.00'}</span></div>
            <div className="flex justify-between p-2 rounded bg-amber-950/20 border border-amber-900/40"><span>Aliados -10% ({approvedSales.filter(s=>s.is_ally).length})</span><span className="text-amber-300">-{myStats.allyDiscount.toFixed(2)}</span></div>
            <div className="flex justify-between p-3 rounded bg-[#1a1a1e] border border-[var(--border-brass)] font-bold"><span>Final</span><span>{myStats.totalFinal.toFixed(2)} ouro</span></div>

            <div className="pt-3 border-t border-[var(--border)] space-y-1 text-xs">
              <div className="flex justify-between"><span>Mercador 20% base</span><span>{myStats.commission.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Produtor 50% base</span><span>{myStats.producer.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Companhia 30% + taxas</span><span>{myStats.company.toFixed(2)}</span></div>
            </div>

            {isAdmin && (
              <div className="pt-4">
                <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-2">Carteira por Mercador</div>
                <div className="space-y-1 max-h-[160px] overflow-auto">
                  {merchantWallet.map(m=><div key={m.name} className="flex justify-between text-xs p-1.5 rounded hover:bg-[var(--bg-input)]"><span>{m.name}</span><span>{m.commission.toFixed(0)} ouro</span></div>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
