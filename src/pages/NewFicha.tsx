import { useState, useEffect } from 'react';
import { Input, Label } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { calculateTaxes } from '../lib/taxEngine';
import { generateFichaText } from '../lib/parser';
import { detectAlly } from '../lib/normalize';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Sale } from '../types';
import { Coins, Copy, Check, ScrollText, User, Plus } from 'lucide-react';

export function NewFichaPage() {
  const { addSale, merchants, createMerchant } = useData();
  const { user, isAdmin } = useAuth();
  const [form, setForm] = useState({
    buyer_name: '',
    product_name: '',
    quantity: 1,
    base_value: 100,
    delivery_type: 'domiciliar' as any,
    destination_name: '',
    merchant_name: user?.merchant_name || '',
    is_ally_manual: false,
  });

  // Atualiza mercador quando user muda (modo em branco)
  useEffect(()=>{
    if (!isAdmin && user?.merchant_name) {
      setForm(f=>({...f, merchant_name: user.merchant_name||''}));
    }
  },[user, isAdmin]);

  const [copied, setCopied] = useState(false);
  const [lastFicha, setLastFicha] = useState<string>('');
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showNewMerchant, setShowNewMerchant] = useState(false);
  const [newMerchantName, setNewMerchantName] = useState('');

  const allyInfo = detectAlly(form.buyer_name);
  const isAlly = allyInfo.isAlly || form.is_ally_manual;

  const breakdown = calculateTaxes({
    base_value: form.base_value,
    delivery_type: form.delivery_type,
    is_ally: isAlly,
    ally_house: allyInfo.house,
  });

  const handleCreateMerchantInline = async ()=>{
    if (!newMerchantName.trim()) return;
    try {
      const m = await createMerchant(newMerchantName.trim());
      setForm({...form, merchant_name: m.name});
      setNewMerchantName('');
      setShowNewMerchant(false);
    } catch(e:any){ alert(e.message); }
  };

  const handleGenerate = () => {
    if (!form.buyer_name || !form.product_name) { alert('Preencha comprador e mercadoria'); return; }
    if (isAdmin && !form.merchant_name) { alert('Admin: selecione de quem foi a venda'); return; }
    const saleData = {
      buyer_name: form.buyer_name,
      product_name: form.product_name,
      quantity: form.quantity,
      base_value: form.base_value,
      delivery_type: form.delivery_type,
      destination_name: form.destination_name || 'Não informado',
      merchant_name: form.merchant_name || user?.merchant_name || 'Mercador',
      is_ally: isAlly,
      ally_house: allyInfo.house,
    };
    const text = generateFichaText(saleData as any);
    setLastFicha(text);

    const sale: Sale = {
      id: `sale_${Date.now()}`,
      ficha_number: `F-${Date.now()}`,
      raw_text: text,
      buyer_id: '', buyer_name: saleData.buyer_name,
      merchant_id: '', merchant_name: saleData.merchant_name,
      product_id: '', product_name: saleData.product_name,
      quantity: saleData.quantity, base_value: saleData.base_value, final_value: breakdown.final_value,
      currency: 'ouro',
      delivery_type: saleData.delivery_type,
      destination_id: '', destination_name: saleData.destination_name,
      is_ally: isAlly, ally_house: allyInfo.house,
      tax_breakdown: breakdown,
      status: 'pendente',
      created_by: user?.id,
      created_at: new Date().toISOString(),
      date: new Date().toISOString(),
    };
    setLastSale(sale);
  };

  const handleSubmitForApproval = () => {
    if (!lastSale) { handleGenerate(); return; }
    addSale(lastSale);
    alert(`Ficha enviada! ${isAdmin ? `Atribuída a ${lastSale.merchant_name} e em aprovação.` : 'Aguardando aprovação do Tesoureiro.'} Saída do estoque será automática ao aprovar.`);
    setLastFicha('');
    setLastSale(null);
    setForm({ ...form, buyer_name:'', product_name:'', quantity:1, base_value:100, destination_name:'' });
  };

  const copy = async()=>{
    await navigator.clipboard.writeText(lastFicha);
    setCopied(true);
    setTimeout(()=>setCopied(false),1500);
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <h1 className="font-display text-2xl font-bold">Preenchimento de Ficha Mercante</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        {isAdmin 
          ? 'Modo Admin: escolha de quem foi a venda, cadastre novos vendedores se necessário. Estoque baixa automático ao aprovar.' 
          : 'Modo Mercador (em branco): sua conta foi criada ao registrar. Preencha a ficha, ela vai para aprovação do Tesoureiro e baixa do estoque ao aprovar.'}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="merchant-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ScrollText className="w-5 h-5 text-[#d4af37]"/>
            <span className="font-display font-bold">Formulário da Ordem</span>
            {isAdmin && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/20 text-amber-300 border border-amber-800">ADMIN</span>}
          </div>

          <div className="space-y-1.5">
            <Label>Comprador *</Label>
            <Input value={form.buyer_name} onChange={e=>setForm({...form, buyer_name:e.target.value})} placeholder="Lord Aryon Lorrengreen, Stark, Lannister..."/>
            {allyInfo.isAlly && <div className="text-xs text-amber-300">Detectado como Aliado: {allyInfo.house} → desconto 10% automático</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mercadoria * (deve existir no estoque)</Label>
              <Input value={form.product_name} onChange={e=>setForm({...form, product_name:e.target.value})} placeholder="Cordas, Espadas..."/>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={form.quantity} onChange={e=>setForm({...form, quantity: Number(e.target.value)})}/>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Valor Base (antes de taxas) - moedas de ouro *</Label>
            <Input type="number" value={form.base_value} onChange={e=>setForm({...form, base_value:Number(e.target.value)})}/>
            <p className="text-[11px] text-[var(--text-muted)]">Se abaixo de 100, não aplica desconto de retirada.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de Entrega</Label>
              <select value={form.delivery_type} onChange={e=>setForm({...form, delivery_type:e.target.value as any})} className="h-10 w-full rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                <option value="domiciliar">Domiciliar (+30%)</option>
                <option value="retirada">Retirada (-15% se ≥100)</option>
                <option value="nao_informado">Não informado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Reino de Destino</Label>
              <Input value={form.destination_name} onChange={e=>setForm({...form, destination_name:e.target.value})} placeholder="Portões da Muralha..."/>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><User className="w-3 h-3"/> Mercador Responsável {isAdmin ? '(ADMIN escolhe)' : '(seu login)'}</Label>
            {isAdmin ? (
              <div className="space-y-2">
                <select value={form.merchant_name} onChange={e=>setForm({...form, merchant_name:e.target.value})} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                  <option value="">Selecione de quem foi a venda...</option>
                  {merchants.map(m=><option key={m.id} value={m.name}>{m.name} {m.user_id ? '(com login)' : '(sem login)'}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={()=>setShowNewMerchant(!showNewMerchant)}><Plus className="w-3 h-3 mr-1"/>Cadastrar Novo Vendedor</Button>
                  {form.merchant_name && <span className="text-xs text-[var(--text-secondary)] flex items-center">Selecionado: <b className="ml-1 text-[var(--text-primary)]">{form.merchant_name}</b></span>}
                </div>
                {showNewMerchant && (
                  <div className="flex gap-2 p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]">
                    <Input value={newMerchantName} onChange={e=>setNewMerchantName(e.target.value)} placeholder="Nome novo vendedor" className="flex-1"/>
                    <Button size="sm" variant="gold" onClick={handleCreateMerchantInline}>Salvar</Button>
                  </div>
                )}
                <p className="text-[11px] text-[var(--text-muted)]">Se não foi de ninguém, cadastre o vendedor acima. Se foi de vendedor existente, selecione.</p>
              </div>
            ) : (
              <Input value={form.merchant_name} readOnly className="bg-[var(--bg-card)] opacity-70" placeholder={user?.merchant_name||'Seu nome'}/>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] cursor-pointer">
            <input type="checkbox" checked={form.is_ally_manual} onChange={e=>setForm({...form, is_ally_manual:e.target.checked})} />
            <span>Marcar como Aliado manualmente (Gardener, Lannister, Stark)</span>
          </label>

          <div className="flex gap-2">
            <Button variant="gold" onClick={handleGenerate} className="flex-1">Calcular & Gerar Ficha</Button>
            <Button variant="outline" onClick={()=>setForm({buyer_name:'',product_name:'',quantity:1,base_value:100,delivery_type:'domiciliar',destination_name:'',merchant_name: isAdmin ? '' : user?.merchant_name||'',is_ally_manual:false})}>Limpar</Button>
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]">
            <div className="font-display font-bold flex items-center gap-2"><Coins className="w-4 h-4 text-[#d4af37]"/> Tesouraria Automática + Estoque</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Base</span><b>{breakdown.base_value.toFixed(2)} ouro</b></div>
              {breakdown.is_ally && <div className="flex justify-between text-amber-300"><span>Aliado -10%</span><span>-{breakdown.ally_discount.toFixed(2)}</span></div>}
              {breakdown.delivery_type==='domiciliar' ? <div className="flex justify-between text-green-300"><span>Domiciliar +30%</span><span>+{breakdown.delivery_adjustment.toFixed(2)}</span></div> :
                breakdown.delivery_type==='retirada' && breakdown.base_value>=100 ? <div className="flex justify-between text-red-300"><span>Retirada -15%</span><span>{breakdown.delivery_adjustment.toFixed(2)}</span></div> : null}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-[var(--border)]"><span>Final</span><span>{breakdown.final_value.toFixed(2)} ouro</span></div>
              <div className="pt-2 text-xs space-y-1 text-[var(--text-secondary)]">
                <div className="flex justify-between"><span>Mercador 20% base</span><span>{breakdown.merchant_commission.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Produtor 50% base</span><span>{breakdown.producer_share.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Companhia</span><span>{breakdown.company_final.toFixed(2)}</span></div>
                <div className="flex justify-between pt-1 border-t border-[var(--border)] text-[10px]"><span>Estoque: ao aprovar, baixa {form.quantity} unid de {form.product_name || 'produto'}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="merchant-card p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-display font-bold">Ficha Gerada (Oficial)</h3>
            {lastFicha && <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="w-4 h-4 mr-1"/> : <Copy className="w-4 h-4 mr-1"/>} {copied?'Copiado':'Copiar'}</Button>}
          </div>
          {lastFicha ? (
            <>
              <pre className="whitespace-pre-wrap font-mono text-xs p-4 rounded-lg bg-[#111113] border border-[var(--border)] max-h-[460px] overflow-auto">{lastFicha}</pre>
              <div className="mt-4 flex gap-2">
                <Button variant="gold" onClick={handleSubmitForApproval} className="flex-1">Enviar para Aprovação → Baixa Estoque Automática</Button>
                <Button variant="outline" onClick={copy}>Copiar</Button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-2">Mercadores: conta criada ao registrar. Admin escolhe vendedor. Saída do estoque automática ao aprovar.</p>
            </>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-[var(--border)] rounded-lg">
              <ScrollText className="w-10 h-10 text-[var(--text-muted)] mb-3"/>
              <div className="font-display font-bold">Nenhuma ficha ainda</div>
              <div className="text-sm text-[var(--text-muted)]">Preencha e gere. Em modo em branco, tudo começa zerado.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
