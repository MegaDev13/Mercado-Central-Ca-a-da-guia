import { Sale, Product, StockMovement, ReportType } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportCSV(sales: Sale[], filename='vendas.csv') {
  const headers = ['Data','Comprador','Mercadoria','Qtd','Base','Final','Entrega','Aliado','Mercador','Destino','Status'];
  const rows = sales.map(s=>[
    s.created_at,
    s.buyer_name,
    s.product_name,
    s.quantity,
    s.base_value,
    s.final_value,
    s.delivery_type,
    s.is_ally?'Sim':'Não',
    s.merchant_name,
    s.destination_name,
    s.status
  ]);
  const csv = [headers, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
}

export function exportExcel(sales: Sale[], filename='vendas.xlsx') {
  const data = sales.map(s=>({
    Data: s.created_at,
    Comprador: s.buyer_name,
    Mercadoria: s.product_name,
    Quantidade: s.quantity,
    ValorBase: s.base_value,
    ValorFinal: s.final_value,
    Moeda: s.currency,
    Entrega: s.delivery_type,
    Aliado: s.is_ally? `${s.ally_house||'Sim'}`:'Não',
    Mercador: s.merchant_name,
    Destino: s.destination_name,
    ComissaoMercador: s.tax_breakdown.merchant_commission,
    ParteProdutor: s.tax_breakdown.producer_share,
    ParteCompanhia: s.tax_breakdown.company_final,
    Status: s.status,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
  XLSX.writeFile(wb, filename);
}

export function exportPDF(sales: Sale[], filename='relatorio.pdf', title='Relatório Mercante') {
  const doc = new jsPDF();
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} - Total: ${sales.length} vendas`, 14, 28);
  const totalBase = sales.reduce((a,s)=>a+s.base_value,0);
  const totalFinal = sales.reduce((a,s)=>a+s.final_value,0);
  doc.text(`Receita Base: ${totalBase.toFixed(2)} ouro | Receita Final: ${totalFinal.toFixed(2)} ouro`, 14, 34);

  autoTable(doc, {
    startY: 40,
    head: [['Data','Comprador','Mercadoria','Qtd','Base','Final','Mercador']],
    body: sales.slice(0,200).map(s=>[new Date(s.created_at).toLocaleDateString(), s.buyer_name.slice(0,18), s.product_name.slice(0,18), s.quantity.toString(), s.base_value.toFixed(0), s.final_value.toFixed(0), s.merchant_name.slice(0,14)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26,26,26] },
  });
  doc.save(filename);
}

// === NOVOS RELATÓRIOS DE ESTOQUE EM PDF COM FILTROS ===

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  // brasão simples
  doc.setFillColor(212,175,55);
  doc.rect(0,0,210,18,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(10,10,11);
  doc.text('RAVENPORT - Companhia Mercante', 14, 11);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text('Livro Oficial • 847 E.L.', 140, 11);
  doc.setTextColor(0,0,0);
  doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text(title, 14, 28);
  if (subtitle) {
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(subtitle, 14, 33);
  }
  doc.setFontSize(8); doc.setTextColor(100,100,100);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} • Selo de cera vermelha autenticado`, 14, 38);
  doc.setTextColor(0,0,0);
  return 42;
}

export function exportStockPDF(
  products: Product[],
  type: ReportType,
  options: {
    movements?: StockMovement[],
    sales?: Sale[],
    filterProduct?: string,
    dateFrom?: string,
    dateTo?: string,
    merchant?: string,
    category?: string,
  } = {},
  filename='relatorio-estoque.pdf'
) {
  const doc = new jsPDF();
  let startY = addHeader(doc, `Relatório: ${getReportLabel(type)}`, getFilterDescription(options));

  if (type === 'estoque_atual') {
    const body = products.map(p=>[
      p.name.slice(0,22),
      p.category||'Geral',
      (p.stock_quantity||0).toString(),
      (p.min_stock||0).toString(),
      (p.cost_price||0).toFixed(0),
      ((p.stock_quantity||0)*(p.cost_price||0)).toFixed(0),
      p.supplier?.slice(0,12)||'-',
      p.location?.slice(0,10)||'-',
      (p.stock_quantity||0) <=0 ? 'ZERADO' : (p.stock_quantity||0) <= (p.min_stock||5) ? 'BAIXO' : 'OK'
    ]);
    autoTable(doc, {
      startY,
      head: [['Item','Cat','Estoque','Min','Custo','Valor Total','Forn','Local','Status']],
      body,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [26,26,30] },
      columnStyles: { 2: { halign: 'center' }, 8: { halign: 'center' } }
    });
  }

  else if (type === 'baixo_estoque') {
    const low = products.filter(p=> (p.stock_quantity||0) <= (p.min_stock||5));
    autoTable(doc, {
      startY,
      head: [['Item','Estoque','Min','Falta','Custo','Fornecedor','Ação Sugerida']],
      body: low.map(p=>[
        p.name,
        (p.stock_quantity||0).toString(),
        (p.min_stock||0).toString(),
        Math.max(0, (p.min_stock||5)*2 - (p.stock_quantity||0)).toString(),
        (p.cost_price||0).toFixed(0),
        p.supplier||'-',
        (p.stock_quantity||0)<=0 ? 'COMPRA URGENTE' : 'Repor'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139,46,63] }
    });
  }

  else if (type === 'entradas_periodo' || type === 'saidas_periodo' || type === 'movimentacoes_completa') {
    const movs = (options.movements||[]).filter(m=>{
      if (options.filterProduct && m.product_name !== options.filterProduct) return false;
      if (type==='entradas_periodo' && m.type!=='entrada' && m.type!=='devolucao') return false;
      if (type==='saidas_periodo' && m.type!=='saida' && m.type!=='perda') return false;
      if (options.dateFrom && new Date(m.created_at) < new Date(options.dateFrom)) return false;
      if (options.dateTo && new Date(m.created_at) > new Date(options.dateTo)) return false;
      return true;
    });
    autoTable(doc, {
      startY,
      head: [['Data','Item','Tipo','Qtd','Antes','Depois','Motivo','Responsável']],
      body: movs.slice(0,300).map(m=>[
        new Date(m.created_at).toLocaleDateString(),
        m.product_name.slice(0,18),
        m.type.toUpperCase(),
        m.quantity.toString(),
        m.previous_stock.toString(),
        m.new_stock.toString(),
        m.reason.slice(0,28),
        m.created_by_name?.slice(0,12)||'-'
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [61,42,29] }
    });
    const totalEntrada = movs.filter(m=>m.type==='entrada').reduce((a,m)=>a+m.quantity,0);
    const totalSaida = movs.filter(m=>m.type==='saida').reduce((a,m)=>a+m.quantity,0);
    const finalY = (doc as any).lastAutoTable?.finalY || startY+10;
    doc.setFontSize(9);
    doc.text(`Total Entradas: ${totalEntrada} | Total Saídas: ${totalSaida} | Saldo Movimentações: ${totalEntrada-totalSaida}`, 14, finalY+8);
  }

  else if (type === 'lucro_produto') {
    autoTable(doc, {
      startY,
      head: [['Produto','Vendidos','Custo Unit','Receita Base','Receita Final','Lucro Est.','Margem','Em Estoque']],
      body: products.map(p=>{
        const custoTotal = (p.total_qty||0)*(p.cost_price||0);
        const lucro = (p.total_revenue_final||0) - custoTotal;
        const margem = (p.total_revenue_final||0) >0 ? (lucro/(p.total_revenue_final||1)*100).toFixed(1)+'%' : '-';
        return [
          p.name.slice(0,18),
          (p.total_qty||0).toString(),
          (p.cost_price||0).toFixed(0),
          (p.total_revenue_base||0).toFixed(0),
          (p.total_revenue_final||0).toFixed(0),
          lucro.toFixed(0),
          margem,
          (p.stock_quantity||0).toString()
        ];
      }),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [44,62,80] }
    });
  }

  else if (type === 'vendas_por_produto') {
    const sales = (options.sales||[]).filter(s=>{
      if (options.filterProduct && s.product_name !== options.filterProduct) return false;
      if (options.merchant && s.merchant_name !== options.merchant) return false;
      if (options.dateFrom && new Date(s.created_at) < new Date(options.dateFrom)) return false;
      if (options.dateTo && new Date(s.created_at) > new Date(options.dateTo)) return false;
      return true;
    });
    autoTable(doc, {
      startY,
      head: [['Data','Produto','Qtd','Comprador','Mercador','Base','Final','Lucro Cia']],
      body: sales.slice(0,300).map(s=>[
        new Date(s.created_at).toLocaleDateString(),
        s.product_name.slice(0,16),
        s.quantity.toString(),
        s.buyer_name.slice(0,14),
        s.merchant_name.slice(0,12),
        s.base_value.toFixed(0),
        s.final_value.toFixed(0),
        s.tax_breakdown.company_final.toFixed(0)
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [26,26,30] }
    });
  }

  else if (type === 'tesouraria_completa') {
    const sales = options.sales||[];
    const totalBase = sales.reduce((a,s)=>a+s.base_value,0);
    const totalFinal = sales.reduce((a,s)=>a+s.final_value,0);
    const totalComissao = sales.reduce((a,s)=>a+s.tax_breakdown.merchant_commission,0);
    const totalProd = sales.reduce((a,s)=>a+s.tax_breakdown.producer_share,0);
    const totalCia = sales.reduce((a,s)=>a+s.tax_breakdown.company_final,0);
    doc.setFontSize(10);
    doc.text(`Base: ${totalBase.toFixed(0)} | Final: ${totalFinal.toFixed(0)} | Mercador 20%: ${totalComissao.toFixed(0)} | Produtor 50%: ${totalProd.toFixed(0)} | Companhia: ${totalCia.toFixed(0)}`, 14, startY);
    startY+=8;
    autoTable(doc, {
      startY,
      head: [['Data','Item','Qtd','Base','Ally -10%','Entrega','Final','Merc(20%)','Prod(50%)','Cia']],
      body: sales.slice(0,250).map(s=>[
        new Date(s.created_at).toLocaleDateString(),
        s.product_name.slice(0,12),
        s.quantity.toString(),
        s.base_value.toFixed(0),
        s.tax_breakdown.ally_discount.toFixed(0),
        s.tax_breakdown.delivery_adjustment.toFixed(0),
        s.final_value.toFixed(0),
        s.tax_breakdown.merchant_commission.toFixed(0),
        s.tax_breakdown.producer_share.toFixed(0),
        s.tax_breakdown.company_final.toFixed(0)
      ]),
      styles: { fontSize: 6 },
      headStyles: { fillColor: [61,42,29] }
    });
  }

  // rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i=1;i<=pageCount;i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(120,120,120);
    doc.text(`Página ${i}/${pageCount} • Companhia Ravenport • Selo Oficial`, 14, 290);
  }

  doc.save(filename);
}

function getReportLabel(t: ReportType): string {
  const map: Record<ReportType,string> = {
    estoque_atual: 'Estoque Atual Completo',
    entradas_periodo: 'Entradas no Período',
    saidas_periodo: 'Saídas por Vendas no Período',
    movimentacoes_completa: 'Movimentações Completas (Entrada/Saída/Ajuste)',
    baixo_estoque: 'Itens com Baixo Estoque / Zerados',
    lucro_produto: 'Lucro por Produto',
    vendas_por_produto: 'Vendas por Produto / Mercador',
    tesouraria_completa: 'Tesouraria Completa com Repartição'
  };
  return map[t] || t;
}

function getFilterDescription(opts: any): string {
  const parts: string[] = [];
  if (opts.filterProduct) parts.push(`Produto: ${opts.filterProduct}`);
  if (opts.merchant) parts.push(`Mercador: ${opts.merchant}`);
  if (opts.category) parts.push(`Categoria: ${opts.category}`);
  if (opts.dateFrom) parts.push(`De: ${new Date(opts.dateFrom).toLocaleDateString()}`);
  if (opts.dateTo) parts.push(`Até: ${new Date(opts.dateTo).toLocaleDateString()}`);
  if (parts.length===0) return 'Sem filtros • Todos os registros';
  return parts.join(' • ');
}

export function exportStockExcel(products: Product[], movements: StockMovement[], filename='estoque.xlsx') {
  const ws1 = XLSX.utils.json_to_sheet(products.map(p=>({
    Item: p.name,
    Categoria: p.category,
    Estoque: p.stock_quantity,
    Minimo: p.min_stock,
    Custo: p.cost_price,
    ValorTotal: (p.stock_quantity||0)*(p.cost_price||0),
    Vendidos: p.total_qty,
    ReceitaBase: p.total_revenue_base,
    ReceitaFinal: p.total_revenue_final,
    Fornecedor: p.supplier,
    Local: p.location,
  })));
  const ws2 = XLSX.utils.json_to_sheet(movements.map(m=>({
    Data: m.created_at,
    Item: m.product_name,
    Tipo: m.type,
    Qtd: m.quantity,
    Antes: m.previous_stock,
    Depois: m.new_stock,
    Motivo: m.reason,
    VendaRelacionada: m.related_sale_ficha||'',
    Responsavel: m.created_by_name||'',
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Estoque');
  XLSX.utils.book_append_sheet(wb, ws2, 'Movimentacoes');
  XLSX.writeFile(wb, filename);
}
