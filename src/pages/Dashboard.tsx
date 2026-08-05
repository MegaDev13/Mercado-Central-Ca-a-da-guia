import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Coins, TrendingUp, ScrollText, Crown, Package, Users, ArrowUpRight, Medal, Scale } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function DashboardPage({onNavigate}:{onNavigate:(id:string)=>void}) {
  const { stats, approvedSales, merchants, buyers, products, pendingSales } = useData();
  const { isAdmin } = useAuth();

  const lastSales = [...approvedSales].sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0,6);

  const merchantRanking = [...merchants].sort((a,b)=> b.total_base - a.total_base).slice(0,5);
  const buyerRanking = [...buyers].sort((a,b)=> b.total_spent_final - a.total_spent_final).slice(0,5);
  const productRanking = [...products].sort((a,b)=> b.total_revenue_final - a.total_revenue_final).slice(0,5);

  const dailyData = (()=> {
    const map = new Map<string, number>();
    approvedSales.forEach(s=>{
      const d = new Date(s.created_at);
      const key = `${d.getDate()}/${d.getMonth()+1}`;
      map.set(key, (map.get(key)||0)+s.final_value);
    });
    return Array.from(map.entries()).slice(-12).map(([name,value])=>({name,value}));
  })();

  const deliverySplit = [
    { name:'Domiciliar', value: approvedSales.filter(s=>s.delivery_type==='domiciliar').length },
    { name:'Retirada', value: approvedSales.filter(s=>s.delivery_type==='retirada').length },
    { name:'Aliados', value: approvedSales.filter(s=>s.is_ally).length },
  ];

  const kpis = [
    { label:'Receita Final', value:`${stats.totalFinal.toLocaleString('pt-BR',{maximumFractionDigits:0})} ouro`, sub:`Base ${stats.totalBase.toLocaleString()}`, icon: Coins, color:'text-[#d4af37]' },
    { label:'Lucro Companhia', value:`${stats.totalProfitCompany.toLocaleString('pt-BR',{maximumFractionDigits:0})} ouro`, sub:`Após repartição`, icon: Scale, color:'text-[#5a7a52]' },
    { label:'Vendas Aprovadas', value: approvedSales.length.toString(), sub:`${pendingSales.length} pendentes`, icon: ScrollText, color:'text-[#3d5a73]' },
    { label:'Ticket Médio', value:`${stats.avgTicket.toFixed(1)} ouro`, sub:`Maior ${stats.biggest? stats.biggest.final_value.toFixed(0):0}`, icon: TrendingUp, color:'text-[#8b2e3f]' },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Mesa do Tesoureiro</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Visão consolidada do livro oficial da Companhia Ravenport • Atualizado em tempo real</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>onNavigate('newficha')} className="h-9 px-4 rounded-lg brass-gold text-sm font-bold flex items-center gap-2">
            <span className="text-lg">✦</span> Nova Ficha
          </button>
          <button onClick={()=>onNavigate('approvals')} className="h-9 px-4 rounded-lg border border-[var(--border)] text-sm flex items-center gap-2">
            Aprovações {pendingSales.length>0 && <span className="bg-red-900 text-red-100 px-2 py-0.5 rounded-full text-xs">{pendingSales.length}</span>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k,i)=>(
          <div key={i} className="merchant-card p-5 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className={`w-9 h-9 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center ${k.color}`}><k.icon className="w-5 h-5"/></div>
              <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)]"/>
            </div>
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">{k.label}</div>
              <div className="font-display text-2xl font-bold mt-1">{k.value}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 merchant-card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-bold">Receita por Período</h3>
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Últimos dias</span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis dataKey="name" stroke="#6a6a70" fontSize={11}/>
                <YAxis stroke="#6a6a70" fontSize={11}/>
                <Tooltip contentStyle={{background:'#1a1a1e', border:'1px solid #2a2a30', borderRadius:8}}/>
                <Bar dataKey="value" fill="#d4af37" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="merchant-card p-5">
          <h3 className="font-display font-bold mb-4">Repartição</h3>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[
                  {name:'Mercadores 20%', value: stats.totalCommission},
                  {name:'Produtores 50%', value: stats.totalBase*0.5},
                  {name:'Companhia', value: stats.totalProfitCompany},
                ]} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} >
                  <Cell fill="#d4af37" />
                  <Cell fill="#5a7a52" />
                  <Cell fill="#3d5a73" />
                </Pie>
                <Tooltip contentStyle={{background:'#1a1a1e', border:'1px solid #2a2a30'}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#d4af37]"/>Mercadores 20%</span><span>{stats.totalCommission.toFixed(0)} ouro</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#5a7a52]"/>Produtores 50%</span><span>{(stats.totalBase*0.5).toFixed(0)} ouro</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3d5a73]"/>Companhia</span><span>{stats.totalProfitCompany.toFixed(0)} ouro</span></div>
            <div className="flex justify-between pt-2 border-t border-[var(--border)]"><span>Entrega/Taxas</span><span>{deliverySplit[0].value} domic. • {deliverySplit[1].value} ret.</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="merchant-card p-5">
          <div className="flex justify-between mb-3">
            <h4 className="font-display font-bold flex items-center gap-2"><Medal className="w-4 h-4 text-[#d4af37]"/> Mercador do Mês</h4>
            <button onClick={()=>onNavigate('merchants')} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Ver todos</button>
          </div>
          <div className="space-y-3">
            {merchantRanking.map((m,i)=>(
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center text-xs font-bold">{i+1}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{m.total_sales} vendas • {m.total_commission.toFixed(0)} ouro ganho</div>
                </div>
                <div className="text-sm font-bold">{m.total_base.toFixed(0)}</div>
              </div>
            ))}
            {merchantRanking.length===0 && <div className="text-sm text-[var(--text-muted)] text-center py-8">Nenhum mercador ainda</div>}
          </div>
        </div>

        <div className="merchant-card p-5">
          <div className="flex justify-between mb-3">
            <h4 className="font-display font-bold flex items-center gap-2"><Crown className="w-4 h-4 text-[#8b2e3f]"/> Maiores Compradores</h4>
            <button onClick={()=>onNavigate('buyers')} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Ver todos</button>
          </div>
          <div className="space-y-3">
            {buyerRanking.map((b,i)=>(
              <div key={b.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold">{b.is_ally?'♛':i+1}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium truncate flex items-center gap-1">{b.name} {b.is_ally && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30">{b.ally_house || 'Aliado'}</span>}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{b.total_purchases} compras • {b.total_spent_final.toFixed(0)} ouro final</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="merchant-card p-5">
          <div className="flex justify-between mb-3">
            <h4 className="font-display font-bold flex items-center gap-2"><Package className="w-4 h-4 text-[#5a7a52]"/> Mercadorias Top</h4>
            <button onClick={()=>onNavigate('products')} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Ver todas</button>
          </div>
          <div className="space-y-3">
            {productRanking.map((p)=>(
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center"><Package className="w-4 h-4"/></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{p.total_qty} unid • média {p.avg_price.toFixed(1)} ouro</div>
                </div>
                <div className="text-sm font-bold">{p.total_revenue_final.toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 merchant-card p-5">
          <h4 className="font-display font-bold mb-4">Últimas Vendas Aprovadas</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                <tr><th className="text-left py-2 font-medium">Comprador</th><th className="text-left py-2 font-medium">Mercadoria</th><th className="text-left py-2 font-medium">Base</th><th className="text-left py-2 font-medium">Final</th><th className="text-left py-2 font-medium">Mercador</th></tr>
              </thead>
              <tbody>
                {lastSales.map(s=>(
                  <tr key={s.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--bg-input)]/50">
                    <td className="py-2.5 truncate max-w-[160px]">{s.buyer_name}</td>
                    <td className="py-2.5">{s.product_name} x{s.quantity}</td>
                    <td className="py-2.5">{s.base_value.toFixed(0)}</td>
                    <td className="py-2.5 font-bold">{s.final_value.toFixed(0)}</td>
                    <td className="py-2.5 text-[var(--text-secondary)]">{s.merchant_name}</td>
                  </tr>
                ))}
                {lastSales.length===0 && <tr><td colSpan={5} className="py-10 text-center text-[var(--text-muted)]">Sem vendas aprovadas ainda</td></tr>}
              </tbody>
            </table>
          </div>
          {isAdmin && pendingSales.length>0 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 text-sm flex justify-between items-center">
              <span>{pendingSales.length} fichas aguardando aprovação do Tesoureiro</span>
              <button onClick={()=>onNavigate('approvals')} className="px-3 py-1 rounded bg-amber-900 text-amber-100 text-xs">Aprovar agora</button>
            </div>
          )}
        </div>

        <div className="merchant-card p-5">
          <h4 className="font-display font-bold mb-4">Tesouraria Rápida</h4>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]">
              <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Regra Atual</div>
              <div className="mt-1 leading-relaxed">
                • Domiciliar +30%<br/>
                • Retirada -15% (se ≥100 ouro)<br/>
                • Aliados Gardener/Lannister/Stark -10% independente<br/>
                • Mercador 20% da base<br/>
                • Produtor 50% da base<br/>
                • Companhia 30% + taxas
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-[var(--bg-input)]"><div className="text-[11px] text-[var(--text-muted)] uppercase">Aliados</div><div className="font-bold text-lg">{approvedSales.filter(s=>s.is_ally).length}</div></div>
              <div className="p-3 rounded-lg bg-[var(--bg-input)]"><div className="text-[11px] text-[var(--text-muted)] uppercase">Domiciliar</div><div className="font-bold text-lg">{approvedSales.filter(s=>s.delivery_type==='domiciliar').length}</div></div>
            </div>
            <button onClick={()=>onNavigate('treasury')} className="w-full h-10 rounded-lg border border-[var(--border)] text-sm">Ver Tesouraria Completa</button>
          </div>
        </div>
      </div>
    </div>
  );
}
