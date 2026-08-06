import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Sale, Merchant, Buyer, Product, Destination, StockMovement, UserProfile } from '../types';
import { normalizeName } from '../lib/normalize';
import * as db from '../lib/db';
import { useAuth } from './AuthContext';

interface DataCtx {
  sales: Sale[];
  merchants: Merchant[];
  buyers: Buyer[];
  products: Product[];
  destinations: Destination[];
  stockMovements: StockMovement[];
  users: UserProfile[];
  pendingSales: Sale[];
  approvedSales: Sale[];
  dataLoading: boolean;
  syncError: string | null;
  isRemote: boolean;
  reload: ()=>Promise<void>;
  addSale: (s: Sale)=>void;
  approveSale: (id:string)=>void;
  rejectSale: (id:string)=>void;
  updateProductCost: (productId:string, cost:number)=>void;
  clearAll: ()=>void;
  resetBlank: ()=>void;
  createMerchant: (name:string)=>Promise<Merchant>;
  deleteMerchant: (id:string)=>void;
  linkMerchantToUser: (merchantId:string, userId:string)=>void;
  createProduct: (data: Partial<Product> & { name: string })=>Promise<Product>;
  deleteProduct: (id:string)=>void;
  updateProduct: (id:string, updates: Partial<Product>)=>Promise<void>;
  adjustStock: (productId:string, delta:number, reason:string, type?: StockMovement['type'], meta?: Partial<StockMovement>)=>Promise<Product | undefined>;
  migrateLocalToSupabase: ()=>Promise<db.MigrationSummary>;
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
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Fila serial: evita corridas ao importar várias fichas de uma vez
  const queue = useRef<Promise<any>>(Promise.resolve());
  const enqueue = useCallback(<T,>(fn: ()=>Promise<T>): Promise<T> => {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(()=>{});
    return next;
  },[]);

  const reload = useCallback(async ()=>{
    try {
      const data = await db.fetchAll();
      setSales(data.sales);
      setMerchants(data.merchants);
      setBuyers(data.buyers);
      setProducts(data.products);
      setDestinations(data.destinations);
      setStockMovements(data.stockMovements);
      setUsers(data.users);
      setSyncError(data.error);
    } catch(e:any) {
      console.error('[DataContext] Falha ao carregar dados:', e);
      setSyncError(e?.message || 'Falha ao carregar dados');
    } finally {
      setDataLoading(false);
    }
  },[]);

  useEffect(()=>{ reload(); },[reload, user?.id]);

  // Executa mutação capturando erro (não quebra a tela); erros aparecem no banner de sincronização
  const run = useCallback((fn: ()=>Promise<void>)=>{
    void enqueue(async()=>{
      try { await fn(); } catch(e:any) {
        console.error('[DataContext] Erro de sincronização:', e);
        setSyncError(e?.message || 'Erro de sincronização');
      }
    });
  },[enqueue]);

  const addSale = (s: Sale)=> run(async()=>{
    const m = await db.ensureMerchant(s.merchant_name);
    const b = await db.ensureBuyer(s.buyer_name, s.is_ally, s.ally_house as any);
    const p = await db.ensureProduct(s.product_name);
    const d = await db.ensureDestination(s.destination_name);
    await db.insertSale({
      ...s,
      merchant_id: m.id,
      buyer_id: b.id,
      product_id: p.id,
      destination_id: d.id,
      created_at: s.created_at || new Date().toISOString(),
    });
    await reload();
  });

  const approveSale = (id:string)=> run(async()=>{
    const sale = sales.find(x=>x.id===id);
    if (!sale || sale.status==='aprovada') return;

    // MERCADOR (agregados)
    let m = merchants.find(mm=> mm.id===sale.merchant_id || normalizeName(mm.name)===normalizeName(sale.merchant_name));
    if (!m) m = await db.ensureMerchant(sale.merchant_name);
    await db.saveMerchantAgg({
      ...m,
      total_sales: (m.total_sales||0) + 1,
      total_base: (m.total_base||0) + sale.base_value,
      total_commission: (m.total_commission||0) + sale.tax_breakdown.merchant_commission,
      last_sale_at: new Date().toISOString(),
    });

    // COMPRADOR
    const b = buyers.find(bb=> bb.id===sale.buyer_id || normalizeName(bb.name)===normalizeName(sale.buyer_name));
    if (b) await db.saveBuyerAgg({
      ...b,
      total_purchases: (b.total_purchases||0) + 1,
      total_spent_base: (b.total_spent_base||0) + sale.base_value,
      total_spent_final: (b.total_spent_final||0) + sale.final_value,
      last_seen: new Date().toISOString(),
    });

    // PRODUTO + BAIXA DE ESTOQUE
    let p = products.find(pp=> pp.id===sale.product_id || normalizeName(pp.name)===normalizeName(sale.product_name));
    if (!p) p = await db.ensureProduct(sale.product_name);
    const totalQty = (p.total_qty||0) + sale.quantity;
    const revenueBase = (p.total_revenue_base||0) + sale.base_value;
    const revenueFinal = (p.total_revenue_final||0) + sale.final_value;
    const prevStock = p.stock_quantity ?? 0;
    const nextStock = prevStock - sale.quantity;
    await db.saveProductAgg({
      ...p,
      total_qty: totalQty,
      total_revenue_base: revenueBase,
      total_revenue_final: revenueFinal,
      avg_price: totalQty>0 ? revenueBase/totalQty : 0,
      stock_quantity: nextStock,
      total_profit: p.cost_price ? revenueFinal - (p.cost_price * totalQty) : p.total_profit,
    });
    await db.addStockMovement({
      product_id: p.id,
      product_name: p.name,
      type: 'saida',
      quantity: sale.quantity,
      previous_stock: prevStock,
      new_stock: nextStock,
      reason: `Venda ${sale.ficha_number || sale.id} - ${sale.buyer_name}`,
      related_sale_id: sale.id,
      related_sale_ficha: sale.ficha_number,
      created_by: user?.id,
      created_by_name: user?.merchant_name,
    } as any);

    // DESTINO
    const d = destinations.find(dd=> dd.id===sale.destination_id || normalizeName(dd.name)===normalizeName(sale.destination_name));
    if (d) await db.saveDestinationAgg({ ...d, total_deliveries: (d.total_deliveries||0) + 1 });

    await db.updateSaleStatus(sale.id, 'aprovada', user?.id);
    await reload();
  });

  const rejectSale = (id:string)=> run(async()=>{
    const sale = sales.find(x=>x.id===id);
    if (!sale) return;
    await db.updateSaleStatus(id, 'rejeitada', user?.id);
    await reload();
  });

  const updateProductCost = (productId:string, cost:number)=> run(async()=>{
    const p = products.find(x=>x.id===productId);
    if (!p) return;
    const total_profit = (p.total_qty||0) > 0 ? (p.total_revenue_final||0) - (cost * (p.total_qty||0)) : p.total_profit;
    await db.saveProductAgg({ ...p, cost_price: cost, total_profit });
    await reload();
  });

  const clearAll = ()=>{
    if (!confirm('Apagar TODOS os registros mercantis? Esta ação não pode ser desfeita.')) return;
    run(async()=>{ await db.clearAllData(); await reload(); });
  };

  const resetBlank = ()=>{
    if (!confirm('Deixar tudo em BRANCO? Isso apagará vendas, mercadores, compradores, produtos, destinos e movimentações de estoque. Usuários de login serão mantidos. Ideal para entrega inicial.')) return;
    run(async()=>{
      await db.clearAllData();
      await reload();
      alert('✅ Sistema zerado! Agora está em branco. Mercadores podem se cadastrar quando forem subir fichas. Admin pode cadastrar vendedores em Mercadores e itens em Estoque.');
    });
  };

  const createMerchant = async (name:string)=>{
    const m = await enqueue(()=> db.createMerchant(name));
    await reload();
    return m;
  };

  const deleteMerchant = (id:string)=>{
    if (!confirm('Excluir vendedor? Vendas antigas manterão o nome, mas o vendedor sairá da lista.')) return;
    run(async()=>{ await db.deleteMerchant(id); await reload(); });
  };

  const linkMerchantToUser = (merchantId:string, userId:string)=> run(async()=>{
    await db.linkMerchantToUser(merchantId, userId);
    await reload();
  });

  const createProduct = async (data: Partial<Product> & { name: string })=>{
    const p = await enqueue(()=> db.createProduct(data));
    await reload();
    return p;
  };

  const deleteProduct = (id:string)=>{
    if (!confirm('Excluir item do estoque? Histórico de movimentações será mantido, mas item sai da lista.')) return;
    run(async()=>{ await db.deleteProduct(id); await reload(); });
  };

  const updateProduct = async (id:string, updates: Partial<Product>)=>{
    await enqueue(()=> db.updateProductInfo(id, updates));
    await reload();
  };

  const adjustStock = async (productId:string, delta:number, reason:string, type: StockMovement['type']='ajuste', meta?: Partial<StockMovement>)=>{
    try {
      const p = await enqueue(()=> db.adjustStock(productId, delta, reason, type, meta));
      await reload();
      return p;
    } catch(e:any) {
      setSyncError(e?.message || 'Erro de sincronização');
      throw e;
    }
  };

  const migrateLocalToSupabase = async ()=>{
    const result = await db.migrateLocalToSupabase();
    await reload();
    return result;
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

  return <DataContext.Provider value={{sales, merchants, buyers, products, destinations, stockMovements, users, pendingSales, approvedSales, dataLoading, syncError, isRemote: db.isRemote, reload, addSale, approveSale, rejectSale, updateProductCost, clearAll, resetBlank, createMerchant, deleteMerchant, linkMerchantToUser, createProduct, deleteProduct, updateProduct, adjustStock, migrateLocalToSupabase, stockStats, stats}}>{children}</DataContext.Provider>;
}

export const useData = ()=> useContext(DataContext);
