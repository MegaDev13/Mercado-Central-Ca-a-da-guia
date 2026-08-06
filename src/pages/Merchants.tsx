import { useData } from '../contexts/DataContext';
import { useState } from 'react';
import { Input, Label } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Plus, Trash2, User, Link2, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function MerchantsPage() {
  const { merchants, sales, users, createMerchant, deleteMerchant, linkMerchantToUser } = useData();
  const { isAdmin } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');

  const selMerchant = merchants.find(m=>m.id===selected);
  const merchantSales = sales.filter(s=> s.merchant_id===selected || s.merchant_name===selMerchant?.name).filter(s=>s.status==='aprovada');

  const filtered = merchants.filter(m=> m.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.total_base-a.total_base);

  const handleCreate = async ()=>{
    if (!newName.trim()) return alert('Informe nome');
    try {
      await createMerchant(newName.trim());
      setNewName('');
    } catch(e:any){ alert(e.message); }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Mercadores da Companhia</h1>
          <p className="text-sm text-[var(--text-secondary)]">Modo entrega em branco: cadastre vendedores aqui. Mercadores também podem se auto-cadastrar quando forem subir fichas.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Novo mercador: ex: Bran Crowley" className="w-[260px]"/>
            <Button variant="gold" onClick={handleCreate}><Plus className="w-4 h-4 mr-1"/>Cadastrar</Button>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"/>
          <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar mercador..." className="pl-10"/>
        </div>
        <div className="text-xs text-[var(--text-muted)] flex items-center px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
          {merchants.length} vendedores • {users.filter(u=>u.role==='merchant').length} com login
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3 max-h-[75vh] overflow-auto pr-1">
          {filtered.map(m=>{
            const linkedUser = users.find(u=> u.id===m.user_id || u.merchant_name===m.name);
            return (
              <div key={m.id} className={`merchant-card p-4 ${selected===m.id?'border-[var(--border-brass)]':''}`}>
                <button onClick={()=>setSelected(m.id)} className="w-full text-left flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center font-bold">{m.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate flex items-center gap-2">{m.name} {linkedUser && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/20 text-green-300 border border-green-800 flex items-center gap-1"><User className="w-3 h-3"/>COM LOGIN</span>}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{m.total_sales} vendas • {m.total_commission.toFixed(0)} ouro carteira</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Base {m.total_base.toFixed(0)} • {linkedUser ? `Login: ${linkedUser.email}` : 'Sem login ainda'}</div>
                  </div>
                </button>
                {isAdmin && (
                  <div className="flex gap-1.5 mt-2">
                    {!linkedUser && (
                      <select onChange={e=>{
                        if (e.target.value) { linkMerchantToUser(m.id, e.target.value); e.target.value=''; }
                      }} className="flex-1 h-7 rounded bg-[var(--bg-input)] border border-[var(--border)] text-[11px] px-1">
                        <option value="">Vincular login existente...</option>
                        {users.filter(u=>u.role==='merchant').map(u=><option key={u.id} value={u.id}>{u.merchant_name} ({u.email})</option>)}
                      </select>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-red-300" onClick={()=>deleteMerchant(m.id)}><Trash2 className="w-3 h-3"/> Excluir</Button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length===0 && (
            <div className="merchant-card p-8 text-center">
              <div className="text-[var(--text-muted)] mb-2">Nenhum mercador cadastrado.</div>
              <div className="text-xs text-[var(--text-secondary)] mb-3">Modo em branco: cadastre aqui ou deixe mercadores se cadastrarem sozinhos ao subir ficha (Login → Registrar mercador).</div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nome do vendedor"/>
                  <Button variant="gold" size="sm" onClick={handleCreate}>Cadastrar</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selMerchant ? (
            <div className="space-y-4">
              <div className="merchant-card p-6">
                <div className="flex justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-bold">{selMerchant.name}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Carteira: 20% da base antes de taxas • Vinculado: {selMerchant.user_id ? 'Sim' : 'Não'}</p>
                    <div className="mt-2 flex gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)]">ID: {selMerchant.id.slice(0,8)}</span>
                      <span className="px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)]">Criado: {new Date(selMerchant.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d4af37] to-[#8a6d16] flex items-center justify-center font-deco text-black font-bold text-xl">{selMerchant.name[0]}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Faturado Base</div><div className="font-bold text-lg">{selMerchant.total_base.toFixed(0)} ouro</div></div>
                  <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Carteira 20%</div><div className="font-bold text-lg">{selMerchant.total_commission.toFixed(0)} ouro</div></div>
                  <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Vendas</div><div className="font-bold text-lg">{selMerchant.total_sales}</div></div>
                  <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]"><div className="text-[11px] uppercase text-[var(--text-muted)]">Ticket Médio</div><div className="font-bold text-lg">{merchantSales.length? (merchantSales.reduce((a,s)=>a+s.final_value,0)/merchantSales.length).toFixed(0):0}</div></div>
                </div>
              </div>

              <div className="merchant-card p-5">
                <h3 className="font-display font-bold mb-3">Histórico Completo (aprovadas)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase text-[var(--text-muted)] border-b border-[var(--border)]"><tr><th className="text-left py-2">Data</th><th className="text-left py-2">Comprador</th><th className="text-left py-2">Mercadoria</th><th className="text-left py-2">Base</th><th className="text-left py-2">Final</th><th className="text-left py-2">Comissão</th></tr></thead>
                    <tbody>{merchantSales.map(s=><tr key={s.id} className="border-b border-[var(--border)]/50"><td className="py-2">{new Date(s.created_at).toLocaleDateString()}</td><td className="py-2">{s.buyer_name}</td><td className="py-2">{s.product_name} x{s.quantity}</td><td className="py-2">{s.base_value}</td><td className="py-2">{s.final_value.toFixed(0)}</td><td className="py-2 font-bold">{s.tax_breakdown.merchant_commission.toFixed(0)}</td></tr>)}
                    {merchantSales.length===0 && <tr><td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">Sem vendas aprovadas - quando subir ficha e admin aprovar, aparece aqui e na carteira</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : <div className="merchant-card p-12 text-center text-[var(--text-muted)]">Selecione um mercador para ver perfil completo. Admin pode cadastrar novos vendedores no topo ou excluir com o botão Excluir.</div>}
        </div>
      </div>
    </div>
  );
}
