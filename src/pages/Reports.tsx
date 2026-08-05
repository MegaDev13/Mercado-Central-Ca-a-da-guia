import { useData } from '../contexts/DataContext';
import { exportCSV, exportExcel, exportPDF, exportStockPDF, exportStockExcel } from '../lib/export';
import { Button } from '../components/ui/button';
import { FileSpreadsheet, FileText, FileDown, Boxes, Filter, Calendar, Package, Coins } from 'lucide-react';
import { useState } from 'react';
import { ReportType } from '../types';
import { Input, Label } from '../components/ui/input';

export function ReportsPage() {
  const { approvedSales, merchants, buyers, products, stockMovements } = useData();
  const [activeTab, setActiveTab] = useState<'vendas'|'estoque'>('vendas');
  
  // Filtros vendas
  const [filter, setFilter] = useState<'all'|'daily'|'weekly'|'monthly'|'byMerchant'|'byBuyer'|'byProduct'>('all');
  const [selectedEntity, setSelectedEntity] = useState('');

  // Filtros estoque/relatórios PDF avançados
  const [reportType, setReportType] = useState<ReportType>('estoque_atual');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterMerchant, setFilterMerchant] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const getFilteredSales = ()=>{
    if (filter==='all') return approvedSales;
    if (filter==='daily') {
      const today = new Date().toDateString();
      return approvedSales.filter(s=> new Date(s.created_at).toDateString()===today);
    }
    if (filter==='weekly') {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
      return approvedSales.filter(s=> new Date(s.created_at) >= weekAgo);
    }
    if (filter==='monthly') {
      const m = new Date().getMonth();
      return approvedSales.filter(s=> new Date(s.created_at).getMonth()===m);
    }
    if (filter==='byMerchant' && selectedEntity) return approvedSales.filter(s=> s.merchant_name===selectedEntity);
    if (filter==='byBuyer' && selectedEntity) return approvedSales.filter(s=> s.buyer_name===selectedEntity);
    if (filter==='byProduct' && selectedEntity) return approvedSales.filter(s=> s.product_name===selectedEntity);
    return approvedSales;
  };

  const filteredSales = getFilteredSales();

  const getFilteredProductsForReport = ()=>{
    let list = [...products];
    if (filterProduct) list = list.filter(p=> p.name === filterProduct);
    if (filterCategory) list = list.filter(p=> (p.category||'') === filterCategory);
    return list;
  };

  const handleExportStockPDF = ()=>{
    const prods = getFilteredProductsForReport();
    exportStockPDF(prods, reportType, {
      movements: stockMovements,
      sales: approvedSales,
      filterProduct: filterProduct || undefined,
      merchant: filterMerchant || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      category: filterCategory || undefined,
    }, `relatorio-${reportType}-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const categories = Array.from(new Set(products.map(p=> p.category).filter(Boolean))) as string[];

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Arquivo de Relatórios - Selo Oficial</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Todos os relatórios em PDF com filtros avançados • Estoque, entradas, saídas, lucro, tesouraria</p>

      <div className="flex gap-2 mb-6">
        <button onClick={()=>setActiveTab('vendas')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${activeTab==='vendas'?'brass-gold':'border border-[var(--border)]'}`}><Coins className="w-4 h-4"/> Vendas & Tesouraria</button>
        <button onClick={()=>setActiveTab('estoque')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${activeTab==='estoque'?'brass-gold':'border border-[var(--border)]'}`}><Boxes className="w-4 h-4"/> Estoque & Movimentações</button>
      </div>

      {activeTab==='vendas' && (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <select value={filter} onChange={e=>setFilter(e.target.value as any)} className="h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
              <option value="all">Todas aprovadas</option>
              <option value="daily">Diário (hoje)</option>
              <option value="weekly">Semanal (7 dias)</option>
              <option value="monthly">Mensal (mês atual)</option>
              <option value="byMerchant">Por Mercador</option>
              <option value="byBuyer">Por Comprador</option>
              <option value="byProduct">Por Mercadoria</option>
            </select>

            {filter==='byMerchant' && (
              <select value={selectedEntity} onChange={e=>setSelectedEntity(e.target.value)} className="h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                <option value="">Selecione mercador</option>
                {merchants.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            )}
            {filter==='byBuyer' && (
              <select value={selectedEntity} onChange={e=>setSelectedEntity(e.target.value)} className="h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                <option value="">Selecione comprador</option>
                {buyers.map(b=><option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            )}
            {filter==='byProduct' && (
              <select value={selectedEntity} onChange={e=>setSelectedEntity(e.target.value)} className="h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                <option value="">Selecione mercadoria</option>
                {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            )}

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={()=>exportCSV(filteredSales)}><FileDown className="w-4 h-4 mr-2"/>CSV</Button>
              <Button variant="outline" onClick={()=>exportExcel(filteredSales)}><FileSpreadsheet className="w-4 h-4 mr-2"/>Excel</Button>
              <Button variant="gold" onClick={()=>exportPDF(filteredSales, `relatorio-${filter}.pdf`, `Relatório ${filter}`)}><FileText className="w-4 h-4 mr-2"/>PDF Vendas</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="merchant-card p-4"><div className="text-[11px] uppercase text-[var(--text-muted)]">Registros no filtro</div><div className="font-display text-2xl font-bold">{filteredSales.length}</div></div>
            <div className="merchant-card p-4"><div className="text-[11px] uppercase text-[var(--text-muted)]">Receita Base</div><div className="font-display text-2xl font-bold">{filteredSales.reduce((a,s)=>a+s.base_value,0).toFixed(0)} ouro</div></div>
            <div className="merchant-card p-4"><div className="text-[11px] uppercase text-[var(--text-muted)]">Receita Final</div><div className="font-display text-2xl font-bold">{filteredSales.reduce((a,s)=>a+s.final_value,0).toFixed(0)} ouro</div></div>
            <div className="merchant-card p-4"><div className="text-[11px] uppercase text-[var(--text-muted)]">Lucro Companhia</div><div className="font-display text-2xl font-bold">{filteredSales.reduce((a,s)=>a+s.tax_breakdown.company_final,0).toFixed(0)} ouro</div></div>
          </div>

          <div className="merchant-card p-5">
            <h3 className="font-display font-bold mb-3">Prévia do Relatório ({filteredSales.length} linhas)</h3>
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="w-full text-sm"><thead className="text-[11px] uppercase text-[var(--text-muted)] border-b border-[var(--border)]"><tr><th className="text-left py-2">Data</th><th className="text-left py-2">Comprador</th><th className="text-left py-2">Mercadoria</th><th className="text-left py-2">Base</th><th className="text-left py-2">Final</th><th className="text-left py-2">Mercador</th></tr></thead><tbody>{filteredSales.slice(0,100).map(s=><tr key={s.id} className="border-b border-[var(--border)]/40"><td className="py-1.5">{new Date(s.created_at).toLocaleDateString()}</td><td className="py-1.5">{s.buyer_name}</td><td className="py-1.5">{s.product_name}</td><td className="py-1.5">{s.base_value}</td><td className="py-1.5 font-bold">{s.final_value.toFixed(0)}</td><td className="py-1.5">{s.merchant_name}</td></tr>)}</tbody></table>
            </div>
          </div>
        </>
      )}

      {activeTab==='estoque' && (
        <>
          <div className="merchant-card p-6 mb-6">
            <h3 className="font-display font-bold mb-4 flex items-center gap-2"><Filter className="w-5 h-5"/> Filtros do Relatório em PDF</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label>Tipo de Relatório *</Label>
                <select value={reportType} onChange={e=>setReportType(e.target.value as any)} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                  <option value="estoque_atual">Estoque Atual Completo</option>
                  <option value="baixo_estoque">Baixo Estoque / Zerados</option>
                  <option value="entradas_periodo">Entradas no Período</option>
                  <option value="saidas_periodo">Saídas por Vendas no Período</option>
                  <option value="movimentacoes_completa">Movimentações Completas</option>
                  <option value="lucro_produto">Lucro por Produto</option>
                  <option value="vendas_por_produto">Vendas por Produto/Mercador</option>
                  <option value="tesouraria_completa">Tesouraria Completa</option>
                </select>
              </div>
              <div>
                <Label>Produto (opcional)</Label>
                <select value={filterProduct} onChange={e=>setFilterProduct(e.target.value)} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                  <option value="">Todos produtos</option>
                  {products.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Mercador (para vendas)</Label>
                <select value={filterMerchant} onChange={e=>setFilterMerchant(e.target.value)} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                  <option value="">Todos mercadores</option>
                  {merchants.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Categoria</Label>
                <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="w-full h-10 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 text-sm">
                  <option value="">Todas categorias</option>
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label><Calendar className="w-3 h-3 inline mr-1"/>De</Label><Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></div>
                <div><Label><Calendar className="w-3 h-3 inline mr-1"/>Até</Label><Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <Button variant="gold" onClick={handleExportStockPDF} className="h-11 px-6"><FileText className="w-5 h-5 mr-2"/> Exportar PDF - {reportType.replace('_',' ')}</Button>
              <Button variant="outline" onClick={()=>exportStockExcel(getFilteredProductsForReport(), stockMovements)} className="h-11"><FileSpreadsheet className="w-5 h-5 mr-2"/> Excel Estoque + Movimentações</Button>
              <div className="ml-auto text-xs text-[var(--text-muted)] max-w-[320px]">
                <b>Entrada:</b> registrada em Almoxarifado &gt; Entrada manual<br/>
                <b>Saída:</b> registrada automaticamente ao aprovar ficha de venda<br/>
                PDF inclui cabeçalho Ravenport, selo, filtros aplicados, totais e paginação.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="merchant-card p-5">
              <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Package className="w-4 h-4"/> Prévia Estoque ({getFilteredProductsForReport().length} itens)</h3>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-xs"><thead className="text-[11px] uppercase text-[var(--text-muted)] border-b border-[var(--border)]"><tr><th className="text-left py-2">Item</th><th>Est</th><th>Min</th><th>Custo</th><th>Valor</th><th>Status</th></tr></thead><tbody>{getFilteredProductsForReport().slice(0,50).map(p=><tr key={p.id} className="border-b border-[var(--border)]/30"><td className="py-1.5">{p.name}</td><td className="text-center">{p.stock_quantity}</td><td className="text-center">{p.min_stock}</td><td>{p.cost_price}</td><td>{(p.stock_quantity*(p.cost_price||0)).toFixed(0)}</td><td>{(p.stock_quantity||0)<=0?'ZERADO': (p.stock_quantity||0)<=(p.min_stock||5)?'BAIXO':'OK'}</td></tr>)}</tbody></table>
              </div>
            </div>
            <div className="merchant-card p-5">
              <h3 className="font-display font-bold mb-3">Prévia Movimentações ({stockMovements.length})</h3>
              <div className="overflow-auto max-h-[400px] space-y-1.5">
                {stockMovements.slice(0,30).map(m=>(
                  <div key={m.id} className="flex justify-between text-xs p-2 rounded bg-[var(--bg-input)] border border-[var(--border)]">
                    <span>{new Date(m.created_at).toLocaleDateString()} • {m.product_name} • {m.type} {m.quantity}</span>
                    <span className="text-[var(--text-muted)]">{m.previous_stock}→{m.new_stock}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
