import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { parseFichasBatch } from '../lib/parser';
import { Search, Upload, Filter, Coins, X, User, AlertTriangle } from 'lucide-react';
import { Sale } from '../types';

export function SalesPage() {
  const { sales, addSale, merchants, createMerchant } = useData();
  const { user, isAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [filterDelivery, setFilterDelivery] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>(isAdmin ? 'all' : 'aprovada');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  
  // Admin pode escolher de quem foi a venda
  const [adminMerchantOverride, setAdminMerchantOverride] = useState<string>(''); // vazio = usar da ficha
  const [showNewMerchant, setShowNewMerchant] = useState(false);
  const [newMerchantName, setNewMerchantName] = useState('');

  const filtered = useMemo(()=>{
    let list = isAdmin ? sales : sales.filter(s=> s.merchant_name === user?.merchant_name || s.created_by===user?.id);
    if (filterStatus!=='all') list = list.filter(s=> s.status===filterStatus);
    if (filterDelivery!=='all') list = list.filter(s=> s.delivery_type===filterDelivery);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(s=> [s.buyer_name, s.product_name, s.merchant_name, s.destination_name, s.base_value.toString(), s.final_value.toString()].join(' ').toLowerCase().includes(q));
    }
    return list.sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },[sales, query, filterDelivery, filterStatus, isAdmin, user]);

  const handleCreateMerchantInline = async ()=>{
    if (!newMerchantName.trim()) return;
    try {
      const m = await createMerchant(newMerchantName.trim());
      setAdminMerchantOverride(m.name);
      setNewMerchantName('');
      setShowNewMerchant(false);
    } catch(e:any){ alert(e.message); }
  };

  const handleImport = () => {
    const { sales: parsed, errors } = parseFichasBatch(importText);
    if (parsed.length===0) { alert('Nenhuma ficha válida encontrada. Verifique o formato.'); return; }
    let imported = 0;
    parsed.forEach(p=>{
      // Admin override: se escolheu um mercador, usa esse
      let finalMerchantName = (p as any).merchant_name;
      if (isAdmin && adminMerchantOverride) {
        finalMerchantName = adminMerchantOverride;
      }
      // Se mercador ainda é "Não informado" e admin não escolheu, avisa mas permite
      if (isAdmin && finalMerchantName === 'Não informado' && !adminMerchantOverride) {
        // deixa como está, admin pode editar depois
      }
      const sale: Sale = {
        id: `sale_${Date.now()}_${imported++}_${Math.random().toString(36).slice(2,5)}`,
        ficha_number: (p as any).ficha_number,
        raw_text: (p as any).raw_text,
        buyer_id: '', buyer_name: (p as any).buyer_name,
        merchant_id: '', merchant_name: finalMerchantName,
        product_id: '', product_name: (p as any).product_name,
        quantity: (p as any).quantity, base_value: (p as any).base_value, final_value: (p as any).final_value,
        currency: (p as any).currency, delivery_type: (p as any).delivery_type,
        destination_id: '', destination_name: (p as any).destination_name,
        is_ally: (p as any).is_ally, ally_house: (p as any).ally_house,
        tax_breakdown: (p as any).tax_breakdown,
        status: 'pendente',
        created_by: user?.id,
        created_at: new Date().toISOString(),
        date: (p as any).date,
      };
      // Se admin escolheu override, recalcula? Por enquanto mantém valores, mas recalcula breakdown com merchant override? Não precisa, breakdown é baseado em valor e taxas, não em merchant
      // Porém se mudar mercador, merchant_name é só atribuição
      addSale(sale);
    });
    setImportText('');
    setShowImport(false);
    alert(`${parsed.length} fichas importadas para aprovação. ${isAdmin && adminMerchantOverride ? `Todas atribuídas a ${adminMerchantOverride}.` : 'Respeitado mercador da ficha.'} Erros: ${errors.length}`);
  };

  const handleFile = async(e: React.ChangeEvent<HTMLInputElement>)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer });
      setImportText(res.value);
    } else {
      const text = await file.text();
      setImportText(text);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Livro de Vendas</h1>
          <p className="text-sm text-[var(--text-secondary)]">{filtered.length} registros • {isAdmin ? 'Admin pode escolher mercador ao importar' : 'Suas vendas + aprovadas gerais'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>setShowImport(!showImport)}><Upload className="w-4 h-4 mr-2"/>Importar Fichas</Button>
        </div>
      </div>

      {showImport && (
        <div className="merchant-card p-5 mb-6 animate-fade-in border-[var(--border-brass)]">
          <h3 className="font-display font-bold mb-3">Importar Lote de Fichas</h3>
          
          {isAdmin && (
            <div className="mb-4 p-4 rounded-lg bg-amber-950/10 border border-amber-900/30">
              <div className="font-bold text-sm flex items-center gap-2 mb-2"><User className="w-4 h-4"/> Atribuição de vendedor (ADMIN)</div>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-1">De quem foi essa venda?</div>
                  <select value={adminMerchantOverride} onChange={e=>setAdminMerchantOverride(e.target.value)} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                    <option value="">Usar mercador da ficha (padrão)</option>
                    {merchants.map(m=><option key={m.id} value={m.name}>{m.name} {m.user_id ? '(com login)' : '(sem login)'}</option>)}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={()=>setShowNewMerchant(!showNewMerchant)}>Cadastrar Novo Vendedor</Button>
              </div>
              {showNewMerchant && (
                <div className="mt-3 flex gap-2">
                  <Input value={newMerchantName} onChange={e=>setNewMerchantName(e.target.value)} placeholder="Nome do novo vendedor" className="flex-1"/>
                  <Button size="sm" variant="gold" onClick={handleCreateMerchantInline}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={()=>setShowNewMerchant(false)}>Cancelar</Button>
                </div>
              )}
              <div className="text-[11px] text-amber-200/70 mt-2 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0"/>Se a ficha não tiver mercador ou você quiser atribuir a outro vendedor, escolha aqui. Se não foi de ninguém, cadastre o vendedor e selecione.</div>
            </div>
          )}

          <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={`Cole aqui fichas. Exemplo:\n══════════════════════════════\n📜 ORDEM DE AQUISIÇÃO\n...`} className="w-full h-[200px] rounded-lg bg-[var(--bg-input)] border border-[var(--border)] p-3 text-sm font-mono"></textarea>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Input type="file" accept=".txt,.md,.docx" onChange={handleFile} className="max-w-[300px]"/>
            <Button variant="gold" onClick={handleImport} disabled={!importText}>Processar {importText ? `(${importText.split('ORDEM').length-1 || 1} fichas)` : ''}</Button>
            <Button variant="ghost" onClick={()=>setShowImport(false)}>Fechar</Button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Mercadores: criem conta em Login → Registrar e depois subam fichas em Nova Ficha. Admin pode importar em lote e atribuir vendedor.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"/>
          <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar comprador, mercador, mercadoria..." className="pl-10"/>
        </div>
        <select value={filterDelivery} onChange={e=>setFilterDelivery(e.target.value)} className="h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
          <option value="all">Todas entregas</option>
          <option value="domiciliar">Domiciliar</option>
          <option value="retirada">Retirada</option>
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
          <option value="all">Todos status</option>
          <option value="aprovada">Aprovadas</option>
          <option value="pendente">Pendentes</option>
          <option value="rejeitada">Rejeitadas</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3 max-h-[70vh] overflow-auto pr-1">
          {filtered.map(s=>(
            <button key={s.id} onClick={()=>setSelected(s)} className={`w-full text-left merchant-card p-4 flex justify-between items-center ${selected?.id===s.id?'border-[var(--border-brass)] bg-[var(--bg-card-hover)]':''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{s.product_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--border)]">x{s.quantity}</span>
                  {s.is_ally && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-200 border border-amber-800">ALIADO {s.ally_house}</span>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.status==='aprovada'?'bg-green-900/30 text-green-300 border-green-800': s.status==='pendente'?'bg-amber-900/30 text-amber-200 border-amber-800':'bg-red-900/30 text-red-200' } border`}>{s.status.toUpperCase()}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 truncate">{s.buyer_name} → {s.destination_name} • <b className="text-[var(--text-primary)]">{s.merchant_name}</b> • {new Date(s.created_at).toLocaleDateString()}</div>
              </div>
              <div className="text-right ml-4">
                <div className="font-display font-bold">{s.final_value.toFixed(0)} <span className="text-xs font-sans font-normal text-[var(--text-muted)]">ouro</span></div>
                <div className="text-[11px] text-[var(--text-muted)]">base {s.base_value.toFixed(0)}</div>
              </div>
            </button>
          ))}
          {filtered.length===0 && <div className="merchant-card p-10 text-center text-[var(--text-muted)]">Nenhuma venda. Modo em branco: importe fichas ou peça para mercadores se cadastrarem e subirem fichas.</div>}
        </div>

        <div className="xl:col-span-1">
          {selected ? (
            <div className="merchant-card p-5 sticky top-4 animate-fade-in">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-display font-bold">Ficha {selected.ficha_number?.slice(0,12)}</h3>
                <button onClick={()=>setSelected(null)} className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center"><X className="w-4 h-4"/></button>
              </div>
              <div className="space-y-4 text-sm">
                <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] font-mono text-xs whitespace-pre-wrap max-h-[200px] overflow-auto">{selected.raw_text}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Comprador</div><div className="font-medium">{selected.buyer_name}</div></div>
                  <div><div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Mercador</div><div className="font-medium">{selected.merchant_name} {isAdmin && <span className="text-[10px] text-[var(--text-muted)]">(atribuído)</span>}</div></div>
                  <div><div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Mercadoria</div><div className="font-medium">{selected.product_name} x{selected.quantity}</div></div>
                  <div><div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Destino</div><div className="font-medium">{selected.destination_name}</div></div>
                </div>
                <div className="p-3 rounded-lg bg-[#1a1a1e] border border-[var(--border)]">
                  <div className="font-display font-bold flex items-center gap-2 mb-2"><Coins className="w-4 h-4 text-[#d4af37]"/> Tesouraria</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>Base</span><span>{selected.base_value.toFixed(2)} ouro</span></div>
                    {selected.is_ally && <div className="flex justify-between text-amber-300"><span>Desconto Aliado {selected.ally_house} -10%</span><span>-{selected.tax_breakdown.ally_discount.toFixed(2)}</span></div>}
                    {selected.delivery_type==='domiciliar' && <div className="flex justify-between text-green-300"><span>Entrega +30%</span><span>+{selected.tax_breakdown.delivery_adjustment.toFixed(2)}</span></div>}
                    {selected.delivery_type==='retirada' && selected.base_value>=100 && <div className="flex justify-between text-red-300"><span>Retirada -15%</span><span>{selected.tax_breakdown.delivery_adjustment.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-bold pt-2 border-t border-[var(--border)]"><span>Final</span><span>{selected.final_value.toFixed(2)} ouro</span></div>
                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between"><span>Mercador 20%</span><span>{selected.tax_breakdown.merchant_commission.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Produtor 50%</span><span>{selected.tax_breakdown.producer_share.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Companhia</span><span>{selected.tax_breakdown.company_final.toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="merchant-card p-10 text-center">
              <Filter className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-3"/>
              <div className="font-display font-bold">Selecione uma venda</div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Admin pode escolher de quem foi a venda ao importar. Se não foi de ninguém, cadastre vendedor em Mercadores.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
