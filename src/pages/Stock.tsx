import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Input, Label } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Package, Plus, Trash2, Edit3, ArrowUp, ArrowDown, AlertTriangle, Search, Boxes } from 'lucide-react';

export function StockPage() {
  const { products, stockMovements, createProduct, deleteProduct, updateProduct, adjustStock, stockStats } = useData();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name:'', category:'Geral', stock_quantity:0, min_stock:5, cost_price:0, supplier:'', location:'' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [movementForm, setMovementForm] = useState({ productId:'', type:'entrada' as any, quantity:1, reason:'', cost:'' });

  const filtered = products.filter(p=> p.name.toLowerCase().includes(query.toLowerCase()) || (p.category||'').toLowerCase().includes(query.toLowerCase()));

  const handleCreate = ()=>{
    if (!form.name) return alert('Informe nome do item');
    try {
      createProduct({ name: form.name, category: form.category, stock_quantity: Number(form.stock_quantity), min_stock: Number(form.min_stock), cost_price: Number(form.cost_price), supplier: form.supplier, location: form.location });
      setForm({ name:'', category:'Geral', stock_quantity:0, min_stock:5, cost_price:0, supplier:'', location:'' });
      setShowCreate(false);
    } catch(e:any){ alert(e.message); }
  };

  const startEdit = (p:any)=>{
    setEditingId(p.id);
    setEditForm({ name: p.name, category: p.category, stock_quantity: p.stock_quantity, min_stock: p.min_stock, cost_price: p.cost_price, supplier: p.supplier, location: p.location });
  };

  const saveEdit = ()=>{
    if (!editingId) return;
    updateProduct(editingId, { name: editForm.name, category: editForm.category, stock_quantity: Number(editForm.stock_quantity), min_stock: Number(editForm.min_stock), cost_price: Number(editForm.cost_price), supplier: editForm.supplier, location: editForm.location });
    setEditingId(null);
  };

  const handleMovement = ()=>{
    if (!movementForm.productId) return alert('Selecione produto');
    const qty = Number(movementForm.quantity);
    if (!qty || qty<=0) return alert('Quantidade inválida');
    let delta = qty;
    let type = movementForm.type;
    if (type==='saida' || type==='perda') delta = -Math.abs(qty);
    else delta = Math.abs(qty);
    try {
      adjustStock(movementForm.productId, delta, movementForm.reason || (type==='entrada' ? 'Entrada manual' : 'Saída manual'), type, { cost_at_time: movementForm.cost ? Number(movementForm.cost) : undefined, created_by: user?.id, created_by_name: user?.merchant_name });
      setMovementForm({ productId:'', type:'entrada', quantity:1, reason:'', cost:'' });
    } catch(e:any){ alert(e.message); }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto">
      <div className="flex flex-wrap justify-between gap-4 items-start mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3"><Boxes className="w-8 h-8 text-[#d4af37]"/> Almoxarifado da Companhia</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Entrada manual, saída automática por fichas de venda, edição, alertas e relatórios em PDF</p>
        </div>
        <Button variant="gold" onClick={()=>setShowCreate(!showCreate)}><Plus className="w-4 h-4 mr-2"/>Cadastrar Item</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="merchant-card p-4"><div className="text-[11px] uppercase text-[var(--text-muted)]">Itens Únicos</div><div className="font-display text-2xl font-bold">{stockStats.totalItems}</div><div className="text-xs text-[var(--text-secondary)]">tipos cadastrados</div></div>
        <div className="merchant-card p-4"><div className="text-[11px] uppercase text-[var(--text-muted)]">Unidades em Estoque</div><div className="font-display text-2xl font-bold">{stockStats.totalUnits}</div><div className="text-xs text-[var(--text-secondary)]">soma total</div></div>
        <div className="merchant-card p-4"><div className="text-[11px] uppercase text-[var(--text-muted)]">Valor em Estoque (custo)</div><div className="font-display text-2xl font-bold">{stockStats.totalValue.toFixed(0)} ouro</div><div className="text-xs text-[var(--text-secondary)]">custo * qtd</div></div>
        <div className="merchant-card p-4 border-amber-900/40"><div className="text-[11px] uppercase text-amber-300">Alertas</div><div className="font-display text-2xl font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400"/>{stockStats.lowStock.length} baixo • {stockStats.outOfStock.length} zerado</div><div className="text-xs text-[var(--text-secondary)]">min_stock = limite</div></div>
      </div>

      {showCreate && (
        <div className="merchant-card p-6 mb-6 animate-fade-in">
          <h3 className="font-display font-bold mb-4">Cadastrar Novo Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Espadas, Cordas..."/></div>
            <div><Label>Categoria</Label><Input value={form.category} onChange={e=>setForm({...form, category:e.target.value})} placeholder="Armas, Provisões..."/></div>
            <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={e=>setForm({...form, supplier:e.target.value})} placeholder="Forja Blacksmith"/></div>
            <div><Label>Qtd Inicial</Label><Input type="number" value={form.stock_quantity} onChange={e=>setForm({...form, stock_quantity: Number(e.target.value)})}/></div>
            <div><Label>Estoque Mínimo (alerta)</Label><Input type="number" value={form.min_stock} onChange={e=>setForm({...form, min_stock: Number(e.target.value)})}/></div>
            <div><Label>Custo por unidade (ouro)</Label><Input type="number" value={form.cost_price} onChange={e=>setForm({...form, cost_price: Number(e.target.value)})}/></div>
            <div><Label>Localização no depósito</Label><Input value={form.location} onChange={e=>setForm({...form, location:e.target.value})} placeholder="Prateleira B2, Baú 3..."/></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="gold" onClick={handleCreate}>Salvar Item</Button>
            <Button variant="outline" onClick={()=>setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"/>
              <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar item por nome ou categoria..." className="pl-10"/>
            </div>
          </div>

          <div className="space-y-3 max-h-[75vh] overflow-auto pr-1">
            {filtered.map(p=>{
              const isLow = (p.stock_quantity||0) <= (p.min_stock||5) && (p.stock_quantity||0) >0;
              const isOut = (p.stock_quantity||0) <=0;
              const isEditing = editingId===p.id;
              return (
                <div key={p.id} className={`merchant-card p-4 ${isOut?'border-red-900/50 bg-red-950/10': isLow?'border-amber-900/40 bg-amber-950/10':''}`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Input value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} placeholder="Nome"/>
                        <Input value={editForm.category} onChange={e=>setEditForm({...editForm, category:e.target.value})} placeholder="Categoria"/>
                        <Input type="number" value={editForm.stock_quantity} onChange={e=>setEditForm({...editForm, stock_quantity:e.target.value})} placeholder="Qtd"/>
                        <Input type="number" value={editForm.min_stock} onChange={e=>setEditForm({...editForm, min_stock:e.target.value})} placeholder="Min"/>
                        <Input type="number" value={editForm.cost_price} onChange={e=>setEditForm({...editForm, cost_price:e.target.value})} placeholder="Custo"/>
                        <Input value={editForm.supplier} onChange={e=>setEditForm({...editForm, supplier:e.target.value})} placeholder="Fornecedor"/>
                        <Input value={editForm.location} onChange={e=>setEditForm({...editForm, location:e.target.value})} placeholder="Local"/>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="gold" onClick={saveEdit}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={()=>setEditingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isOut?'bg-red-950 border-red-900 text-red-300': isLow?'bg-amber-950 border-amber-800 text-amber-300':'bg-[var(--bg-input)] border-[var(--border)]'}`}><Package className="w-6 h-6"/></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border)]">{p.category}</span>
                          {isLow && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-200 border border-amber-800">BAIXO</span>}
                          {isOut && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-200 border border-red-800">ZERADO</span>}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">
                          Estoque: <b className={isOut?'text-red-300': isLow?'text-amber-300':''}>{p.stock_quantity}</b> unid • Min: {p.min_stock} • Custo: {p.cost_price||0} ouro • Valor total: {((p.stock_quantity||0)*(p.cost_price||0)).toFixed(0)} ouro • Vendidos: {p.total_qty}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">Fornecedor: {p.supplier||'—'} • Local: {p.location||'—'} • Categoria: {p.category}</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="outline" onClick={()=>startEdit(p)}><Edit3 className="w-4 h-4"/></Button>
                        <Button size="sm" variant="ghost" className="text-red-300 hover:bg-red-950/20" onClick={()=>deleteProduct(p.id)}><Trash2 className="w-4 h-4"/></Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length===0 && <div className="merchant-card p-12 text-center text-[var(--text-muted)]">Nenhum item. Cadastre itens para começar o estoque. Modo entrega em branco: tudo zerado até você cadastrar.</div>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="merchant-card p-5">
            <h3 className="font-display font-bold mb-3 flex items-center gap-2"><ArrowUp className="w-4 h-4"/> Entrada / Ajuste Manual</h3>
            <div className="space-y-3">
              <div><Label>Produto</Label>
                <select value={movementForm.productId} onChange={e=>setMovementForm({...movementForm, productId:e.target.value})} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                  <option value="">Selecione</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name} (atual {p.stock_quantity})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Tipo</Label>
                  <select value={movementForm.type} onChange={e=>setMovementForm({...movementForm, type:e.target.value as any})} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                    <option value="entrada">Entrada (compra/fornecedor)</option>
                    <option value="saida">Saída manual</option>
                    <option value="ajuste">Ajuste (correção)</option>
                    <option value="perda">Perda/Quebra</option>
                    <option value="devolucao">Devolução</option>
                  </select>
                </div>
                <div><Label>Quantidade</Label><Input type="number" value={movementForm.quantity} onChange={e=>setMovementForm({...movementForm, quantity: Number(e.target.value)})}/></div>
              </div>
              <div><Label>Motivo / Obs</Label><Input value={movementForm.reason} onChange={e=>setMovementForm({...movementForm, reason:e.target.value})} placeholder="Compra lote, correção inventário..."/></div>
              <div><Label>Custo (opcional atualiza custo produto)</Label><Input type="number" value={movementForm.cost} onChange={e=>setMovementForm({...movementForm, cost:e.target.value})} placeholder="Deixe vazio para manter"/></div>
              <Button variant="gold" className="w-full" onClick={handleMovement}><ArrowDown className="w-4 h-4 mr-2"/> Registrar Movimentação</Button>
              <p className="text-[11px] text-[var(--text-muted)]">Saída automática já é registrada quando admin aprova uma ficha de venda. Não precisa lançar venda manual aqui.</p>
            </div>
          </div>

          <div className="merchant-card p-5">
            <h3 className="font-display font-bold mb-3">Histórico de Movimentações</h3>
            <div className="space-y-2 max-h-[400px] overflow-auto pr-1 text-xs">
              {stockMovements.slice(0,50).map(m=>(
                <div key={m.id} className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] flex justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${m.type==='entrada'?'bg-green-950/30 text-green-300 border-green-900': m.type==='saida'?'bg-red-950/30 text-red-300 border-red-900': m.type==='ajuste'?'bg-amber-950/30 text-amber-300 border-amber-800':'bg-[var(--bg-card)] border-[var(--border)]'}`}>{m.type.toUpperCase()}</span>
                      <span className="font-bold truncate">{m.product_name}</span>
                      <span className={m.quantity>0?'text-green-400':'text-red-400'}>{m.type==='entrada'||m.type==='devolucao'?`+${m.quantity}`:`-${m.quantity}`}</span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">{m.reason} • {new Date(m.created_at).toLocaleString()}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Antes {m.previous_stock} → Depois {m.new_stock} {m.related_sale_ficha && `• ${m.related_sale_ficha}`}</div>
                  </div>
                </div>
              ))}
              {stockMovements.length===0 && <div className="text-center text-[var(--text-muted)] py-8">Sem movimentações ainda. Cadastre itens e faça entradas.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
