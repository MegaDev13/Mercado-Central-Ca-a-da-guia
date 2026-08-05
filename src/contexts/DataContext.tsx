import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Sale, Merchant, Buyer, Product, Destination, StockMovement } from '../types';
import { localDB } from '../lib/storage';
import { normalizeName } from '../lib/normalize';

interface DataCtx {
  sales: Sale[];
  merchants: Merchant[];
  buyers: Buyer[];
  products: Product[];
  destinations: Destination[];
  stockMovements: StockMovement[];
  pendingSales: Sale[];
  approvedSales: Sale[];
  reload: ()=>void;
  addSale: (s: Sale)=>void;
  approveSale: (id:string)=>void;
  rejectSale: (id:string)=>void;
  updateProductCost: (productId:string, cost:number)=>void;
  clearAll: ()=>void;
  resetBlank: ()=>void;
  createMerchant: (name:string)=>Merchant;
  deleteMerchant: (id:string)=>void;
  linkMerchantToUser: (merchantId:string, userId:string)=>void;
  // ESTOQUE
  createProduct: (data: Partial<Product> & { name: string })=>Product;
  deleteProduct: (id:string)=>void;
  updateProduct: (id:string, updates: Partial<Product>)=>void;
  adjustStock: (productId:string, delta:number, reason:string, type?: StockMovement['type'], meta?: Partial<StockMovement>)=>Product;
  stockStats: {
    totalItems: number;
    totalUnits: number;
    totalValue: number;
    lowStock: Product[];
    outOfStock: Product[];
  };
  stats: {
    totalBase: number;
    totalFinal: number;
    totalProfitCompany: number;
    totalCommission: number;
    totalQty: number;
    avgTicket: number;
    biggest: Sale | null;
    smallest: Sale | null;
  }
}

const DataContext = createContext<DataCtx>({} as any);

export function DataProvider({children}:{children:React.ReactNode}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const reload = ()=>{
    localDB.cleanupInvalid();
    setSales(localDB.getSales());
    setMerchants(localDB.getMerchants());
    setBuyers(localDB.getBuyers());
    setProducts(localDB.getProducts());
    setDestinations(localDB.getDestinations());
    setStockMovements(localDB.getStockMovements());
  };

  useEffect(()=>{ reload(); },[]);

  const addSale = (s: Sale)=>{
    const m = localDB.ensureMerchant(s.merchant_name);
    const b = localDB.ensureBuyer(s.buyer_name, s.is_ally, s.ally_house as any);
    const p = localDB.ensureProduct(s.product_name);
    const d = localDB.ensureDestination(s.destination_name);

    const enriched: Sale = {
      ...s,
      id: s.id || `sale_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      merchant_id: m.id,
      buyer_id: b.id,
      product_id: p.id,
      destination_id: d.id,
      created_at: new Date().toISOString(),
    };

    const allSales = [...localDB.getSales(), enriched];
    localDB.saveSales(allSales);
    setSales(allSales);
    reload();
  };

  const approveSale = (id:string)=>{
    const all = localDB.getSales();
    const sale = all.find(s=>s.id===id);
    if (!sale) return;
    sale.status = 'aprovada';
    localDB.saveSales(all);

    // MERCHANT AGG
    const merchants = localDB.getMerchants();
    let m = merchants.find(mm=> mm.id===sale.merchant_id || normalizeName(mm.name)===normalizeName(sale.merchant_name));
    if (!m) m = localDB.ensureMerchant(sale.merchant_name);
    const mIdx = merchants.findIndex(x=>x.id===m!.id);
    if (mIdx>=0) {
      merchants[mIdx].total_sales += 1;
      merchants[mIdx].total_base += sale.base_value;
      merchants[mIdx].total_commission += sale.tax_breakdown.merchant_commission;
      merchants[mIdx].last_sale_at = new Date().toISOString();
    }
    localDB.saveMerchants(merchants);

    // BUYER
    const buyers = localDB.getBuyers();
    const bIdx = buyers.findIndex(b=>b.id===sale.buyer_id);
    if (bIdx>=0) {
      buyers[bIdx].total_purchases += 1;
      buyers[bIdx].total_spent_base += sale.base_value;
      buyers[bIdx].total_spent_final += sale.final_value;
      buyers[bIdx].last_seen = new Date().toISOString();
    }
    localDB.saveBuyers(buyers);

    // PRODUCT + ESTOQUE SAÍDA
    const products = localDB.getProducts();
    const pIdx = products.findIndex(p=>p.id===sale.product_id || normalizeName(p.name)===normalizeName(sale.product_name));
    if (pIdx>=0) {
      products[pIdx].total_qty += sale.quantity;
      products[pIdx].total_revenue_base += sale.base_value;
      products[pIdx].total_revenue_final += sale.final_value;
      const totalQty = products[pIdx].total_qty || sale.quantity;
      products[pIdx].avg_price = products[pIdx].total_revenue_base / totalQty;
      if (products[pIdx].cost_price) {
        products[pIdx].total_profit = products[pIdx].total_revenue_final - (products[pIdx].cost_price! * products[pIdx].total_qty);
      }
      // ESTOQUE: baixa automática
      const prev = products[pIdx].stock_quantity ?? 0;
      const next = prev - sale.quantity;
      products[pIdx].stock_quantity = next;
      localDB.saveProducts(products);
      // movimento
      localDB.addStockMovement({
        product_id: products[pIdx].id,
        product_name: products[pIdx].name,
        type: 'saida',
        quantity: sale.quantity,
        previous_stock: prev,
        new_stock: next,
        reason: `Venda ${sale.ficha_number || sale.id} - ${sale.buyer_name}`,
        related_sale_id: sale.id,
        related_sale_ficha: sale.ficha_number,
      } as any);
    } else {
      // se produto não achado, tenta ensure e depois baixa
      const p = localDB.ensureProduct(sale.product_name);
      const allProds = localDB.getProducts();
      const idx = allProds.findIndex(x=>x.id===p.id);
      if (idx>=0) {
        const prev = allProds[idx].stock_quantity ?? 0;
        const next = prev - sale.quantity;
        allProds[idx].stock_quantity = next;
        allProds[idx].total_qty += sale.quantity;
        allProds[idx].total_revenue_base += sale.base_value;
        allProds[idx].total_revenue_final += sale.final_value;
        localDB.saveProducts(allProds);
        localDB.addStockMovement({
          product_id: allProds[idx].id,
          product_name: allProds[idx].name,
          type: 'saida',
          quantity: sale.quantity,
          previous_stock: prev,
          new_stock: next,
          reason: `Venda ${sale.ficha_number} - ${sale.buyer_name}`,
          related_sale_id: sale.id,
        } as any);
      }
    }

    const dests = localDB.getDestinations();
    const dIdx = dests.findIndex(d=>d.id===sale.destination_id);
    if (dIdx>=0) dests[dIdx].total_deliveries += 1;
    localDB.saveDestinations(dests);

    reload();
  };

  const rejectSale = (id:string)=>{
    const all = localDB.getSales();
    const sale = all.find(s=>s.id===id);
    if (!sale) return;
    sale.status = 'rejeitada';
    localDB.saveSales(all);
    reload();
  };

  const updateProductCost = (productId:string, cost:number)=>{
    const prods = localDB.getProducts();
    const idx = prods.findIndex(p=>p.id===productId);
    if (idx>=0) {
      prods[idx].cost_price = cost;
      if (prods[idx].total_qty>0) {
        prods[idx].total_profit = prods[idx].total_revenue_final - (cost * prods[idx].total_qty);
      }
      localDB.saveProducts(prods);
      reload();
    }
  };

  const clearAll = ()=>{
    if (!confirm('Apagar TODOS os registros mercantis? Esta ação não pode ser desfeita.')) return;
    localStorage.removeItem('rpg_sales');
    localStorage.removeItem('rpg_merchants');
    localStorage.removeItem('rpg_buyers');
    localStorage.removeItem('rpg_products');
    localStorage.removeItem('rpg_destinations');
    localStorage.removeItem('rpg_stock_movements');
    reload();
  };

  const resetBlank = ()=>{
    if (!confirm('Deixar tudo em BRANCO? Isso apagará vendas, mercadores, compradores, produtos, destinos e movimentações de estoque. Usuários de login serão mantidos. Ideal para entrega inicial.')) return;
    localDB.resetBlank();
    reload();
    alert('✅ Sistema zerado! Agora está em branco. Mercadores podem se cadastrar quando forem subir fichas. Admin pode cadastrar vendedores em Mercadores e itens em Estoque.');
  };

  const createMerchant = (name:string)=>{
    const m = localDB.createMerchant(name);
    reload();
    return m;
  };

  const deleteMerchant = (id:string)=>{
    if (!confirm('Excluir vendedor? Vendas antigas manterão o nome, mas o vendedor sairá da lista.')) return;
    localDB.deleteMerchant(id);
    reload();
  };

  const linkMerchantToUser = (merchantId:string, userId:string)=>{
    localDB.linkMerchantToUser(merchantId, userId);
    reload();
  };

  const createProduct = (data: Partial<Product> & { name: string })=>{
    const p = localDB.createProduct(data);
    reload();
    return p;
  };

  const deleteProduct = (id:string)=>{
    if (!confirm('Excluir item do estoque? Histórico de movimentações será mantido, mas item sai da lista.')) return;
    localDB.deleteProduct(id);
    reload();
  };

  const updateProduct = (id:string, updates: Partial<Product>)=>{
    localDB.updateProduct(id, updates);
    reload();
  };

  const adjustStock = (productId:string, delta:number, reason:string, type: StockMovement['type']='ajuste', meta?: Partial<StockMovement>)=>{
    const p = localDB.adjustStock(productId, delta, reason, type, meta);
    reload();
    return p;
  };

  const pendingSales = useMemo(()=> sales.filter(s=>s.status==='pendente'),[sales]);
  const approvedSales = useMemo(()=> sales.filter(s=>s.status==='aprovada'),[sales]);

  const stats = useMemo(()=>{
    const approved = sales.filter(s=>s.status==='aprovada');
    if (approved.length===0) return { totalBase:0, totalFinal:0, totalProfitCompany:0, totalCommission:0, totalQty:0, avgTicket:0, biggest:null as any, smallest:null as any };
    const totalBase = approved.reduce((a,s)=>a+s.base_value,0);
    const totalFinal = approved.reduce((a,s)=>a+s.final_value,0);
    const totalProfitCompany = approved.reduce((a,s)=>a+s.tax_breakdown.company_final,0);
    const totalCommission = approved.reduce((a,s)=>a+s.tax_breakdown.merchant_commission,0);
    const totalQty = approved.reduce((a,s)=>a+s.quantity,0);
    const avgTicket = totalFinal / approved.length;
    const biggest = approved.reduce((max,s)=> s.final_value>max.final_value?s:max, approved[0]);
    const smallest = approved.reduce((min,s)=> s.final_value<min.final_value?s:min, approved[0]);
    return { totalBase, totalFinal, totalProfitCompany, totalCommission, totalQty, avgTicket, biggest, smallest };
  },[sales]);

  const stockStats = useMemo(()=>{
    const totalItems = products.length;
    const totalUnits = products.reduce((a,p)=> a + (p.stock_quantity||0),0);
    const totalValue = products.reduce((a,p)=> a + (p.stock_quantity||0)*(p.cost_price||0),0);
    const lowStock = products.filter(p=> (p.stock_quantity||0) >0 && (p.stock_quantity||0) <= (p.min_stock||5));
    const outOfStock = products.filter(p=> (p.stock_quantity||0) <=0);
    return { totalItems, totalUnits, totalValue, lowStock, outOfStock };
  },[products]);

  return <DataContext.Provider value={{sales, merchants, buyers, products, destinations, stockMovements, pendingSales, approvedSales, reload, addSale, approveSale, rejectSale, updateProductCost, clearAll, resetBlank, createMerchant, deleteMerchant, linkMerchantToUser, createProduct, deleteProduct, updateProduct, adjustStock, stockStats, stats}}>{children}</DataContext.Provider>;
}

export const useData = ()=> useContext(DataContext);
