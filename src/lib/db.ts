// Camada de dados UNIFICADA: usa Supabase quando configurado, localStorage como fallback.
// Antes deste módulo, TODOS os dados (mercadores, mercadorias, vendas, estoque) ficavam
// apenas no localStorage do navegador — por isso mercadores registrados via Supabase
// nunca apareciam e nada sincronizava entre dispositivos.
import { supabase, isSupabaseConfigured } from './supabase';
import { localDB, isInvalidName, sanitizeName } from './storage';
import { normalizeName, slugify } from './normalize';
import { Sale, Merchant, Buyer, Product, Destination, UserProfile, StockMovement, StockMovementType } from '../types';

export const isRemote = isSupabaseConfigured && !!supabase;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const asUUID = (v?: string | null): string | null => (v && UUID_RE.test(v) ? v : null);
const num = (v: any, def = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : def; };

// ============================== MAPEADORES (remoto -> app) ==============================

const parseJSON = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v);

const mapMerchant = (r: any): Merchant => ({
  id: r.id,
  name: r.name,
  slug: r.slug || slugify(r.name || ''),
  user_id: r.user_id || undefined,
  email: r.email || undefined,
  total_sales: num(r.total_sales),
  total_base: num(r.total_base),
  total_commission: num(r.total_commission),
  created_at: r.created_at || new Date().toISOString(),
  last_sale_at: r.last_sale_at || undefined,
});

const mapBuyer = (r: any): Buyer => ({
  id: r.id,
  name: r.name,
  normalized_name: r.normalized_name || normalizeName(r.name || ''),
  is_ally: !!r.is_ally,
  ally_house: r.ally_house || null,
  total_spent_base: num(r.total_spent_base),
  total_spent_final: num(r.total_spent_final),
  total_purchases: num(r.total_purchases),
  first_seen: r.first_seen || new Date().toISOString(),
  last_seen: r.last_seen || new Date().toISOString(),
});

const mapProduct = (r: any): Product => ({
  id: r.id,
  name: r.name,
  normalized_name: r.normalized_name || normalizeName(r.name || ''),
  slug: r.slug || slugify(r.name || ''),
  category: r.category || 'Geral',
  cost_price: num(r.cost_price),
  avg_price: num(r.avg_price),
  total_qty: num(r.total_qty),
  total_revenue_base: num(r.total_revenue_base),
  total_revenue_final: num(r.total_revenue_final),
  total_profit: r.total_profit != null ? num(r.total_profit) : undefined,
  stock_quantity: num(r.stock_quantity),
  min_stock: r.min_stock != null ? num(r.min_stock) : 5,
  supplier: r.supplier || undefined,
  location: r.location || undefined,
  created_at: r.created_at || new Date().toISOString(),
});

const mapDestination = (r: any): Destination => ({
  id: r.id,
  name: r.name,
  normalized_name: r.normalized_name || normalizeName(r.name || ''),
  region: r.region || undefined,
  total_deliveries: num(r.total_deliveries),
});

const mapSale = (r: any): Sale => ({
  id: r.id,
  ficha_number: r.ficha_number || undefined,
  raw_text: r.raw_text || '',
  buyer_id: r.buyer_id || '',
  buyer_name: r.buyer_name,
  merchant_id: r.merchant_id || '',
  merchant_name: r.merchant_name,
  product_id: r.product_id || '',
  product_name: r.product_name,
  quantity: num(r.quantity),
  base_value: num(r.base_value),
  final_value: num(r.final_value),
  currency: r.currency || 'ouro',
  delivery_type: r.delivery_type || 'nao_informado',
  destination_id: r.destination_id || undefined,
  destination_name: r.destination_name,
  is_ally: !!r.is_ally,
  ally_house: r.ally_house || null,
  tax_breakdown: parseJSON(r.tax_breakdown) || {},
  status: r.status || 'pendente',
  created_by: r.created_by || undefined,
  approved_by: r.approved_by || undefined,
  created_at: r.created_at || new Date().toISOString(),
  date: r.date_text || r.created_at || new Date().toISOString(),
  date_text: r.date_text || undefined,
});

const mapMovement = (r: any): StockMovement => ({
  id: r.id,
  product_id: r.product_id || '',
  product_name: r.product_name,
  type: r.type,
  quantity: num(r.quantity),
  previous_stock: num(r.previous_stock),
  new_stock: num(r.new_stock),
  reason: r.reason || '',
  cost_at_time: r.cost_at_time != null ? num(r.cost_at_time) : undefined,
  related_sale_id: r.related_sale_id || undefined,
  related_sale_ficha: r.related_sale_ficha || undefined,
  created_by: r.created_by || undefined,
  created_by_name: r.created_by_name || undefined,
  created_at: r.created_at || new Date().toISOString(),
});

const mapProfile = (r: any): UserProfile => ({
  id: r.id,
  email: r.email,
  role: r.role === 'admin' ? 'admin' : 'merchant',
  merchant_name: r.merchant_name,
  avatar_url: r.avatar_url || undefined,
  created_at: r.created_at || new Date().toISOString(),
});

// ============================== LINHAS (app -> remoto) ==============================
// ATENÇÃO: só colunas que existem no schema SQL do Supabase. IDs são uuid gerados no banco.

const toMerchantRow = (m: Merchant) => ({
  user_id: asUUID(m.user_id),
  name: m.name,
  normalized_name: normalizeName(m.name),
  email: m.email || null,
  total_sales: num(m.total_sales),
  total_base: num(m.total_base),
  total_commission: num(m.total_commission),
  last_sale_at: m.last_sale_at || null,
});

const toBuyerRow = (b: Buyer) => ({
  name: b.name,
  normalized_name: normalizeName(b.name),
  is_ally: !!b.is_ally,
  ally_house: b.ally_house || null,
  total_spent_base: num(b.total_spent_base),
  total_spent_final: num(b.total_spent_final),
  total_purchases: num(b.total_purchases),
  first_seen: b.first_seen || new Date().toISOString(),
  last_seen: b.last_seen || new Date().toISOString(),
});

const toProductRow = (p: Product) => ({
  name: p.name,
  normalized_name: normalizeName(p.name),
  slug: p.slug || slugify(p.name),
  category: p.category || 'Geral',
  cost_price: num(p.cost_price),
  avg_price: num(p.avg_price),
  total_qty: num(p.total_qty),
  total_revenue_base: num(p.total_revenue_base),
  total_revenue_final: num(p.total_revenue_final),
  total_profit: p.total_profit != null ? num(p.total_profit) : null,
  stock_quantity: num(p.stock_quantity),
  min_stock: p.min_stock != null ? num(p.min_stock) : 5,
  supplier: p.supplier || null,
  location: p.location || null,
});

const toDestinationRow = (d: Destination) => ({
  name: d.name,
  normalized_name: normalizeName(d.name),
  region: d.region || null,
  total_deliveries: num(d.total_deliveries),
});

const toSaleRow = (s: Sale) => ({
  ficha_number: s.ficha_number || null,
  raw_text: s.raw_text,
  buyer_id: asUUID(s.buyer_id),
  buyer_name: s.buyer_name,
  merchant_id: asUUID(s.merchant_id),
  merchant_name: s.merchant_name,
  product_id: asUUID(s.product_id),
  product_name: s.product_name,
  quantity: num(s.quantity),
  base_value: num(s.base_value),
  final_value: num(s.final_value),
  currency: s.currency || 'ouro',
  delivery_type: s.delivery_type || 'nao_informado',
  destination_id: asUUID(s.destination_id),
  destination_name: s.destination_name,
  is_ally: !!s.is_ally,
  ally_house: s.ally_house || null,
  tax_breakdown: s.tax_breakdown,
  status: s.status || 'pendente',
  created_by: asUUID(s.created_by),
  created_at: s.created_at || new Date().toISOString(),
  date_text: (s as any).date_text || s.date || null,
});

const toMovementRow = (mov: Partial<StockMovement> & { product_name: string; type: StockMovementType; reason: string }) => {
  const row: any = {
    product_id: asUUID(mov.product_id),
    product_name: mov.product_name,
    type: mov.type,
    quantity: num(mov.quantity),
    previous_stock: num(mov.previous_stock),
    new_stock: num(mov.new_stock),
    reason: mov.reason,
    cost_at_time: mov.cost_at_time != null ? num(mov.cost_at_time) : null,
    related_sale_id: asUUID(mov.related_sale_id),
    related_sale_ficha: mov.related_sale_ficha || null,
    created_by: asUUID(mov.created_by),
    created_by_name: mov.created_by_name || null,
  };
  if (mov.created_at) row.created_at = mov.created_at;
  return row;
};

// ============================== HELPERS REMOTOS ==============================

async function selectByNorm(table: string, norm: string): Promise<any | null> {
  const { data, error } = await supabase.from(table).select('*').eq('normalized_name', norm).limit(1);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data && data.length ? data[0] : null;
}

async function insertAndReturn(table: string, row: any, dupNorm?: string): Promise<any> {
  const { data, error } = await supabase.from(table).insert(row).select().limit(1);
  if (error) {
    // Corrida/duplicado: tenta reler pelo nome normalizado
    if (dupNorm) {
      const again = await selectByNorm(table, dupNorm);
      if (again) return again;
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return data[0];
}

// ============================== LEITURA GERAL ==============================

export interface FetchAllResult {
  sales: Sale[];
  merchants: Merchant[];
  buyers: Buyer[];
  products: Product[];
  destinations: Destination[];
  stockMovements: StockMovement[];
  users: UserProfile[];
  error: string | null;
}

export async function fetchAll(): Promise<FetchAllResult> {
  if (!isRemote) {
    localDB.cleanupInvalid();
    return {
      sales: localDB.getSales(),
      merchants: localDB.getMerchants(),
      buyers: localDB.getBuyers(),
      products: localDB.getProducts(),
      destinations: localDB.getDestinations(),
      stockMovements: localDB.getStockMovements(),
      users: localDB.getUsers(),
      error: null,
    };
  }

  const errors: string[] = [];
  const q = async <T,>(label: string, run: () => Promise<{ data: any; error: any }>, map: (r: any) => T): Promise<T[]> => {
    try {
      const { data, error } = await run();
      if (error) { errors.push(`${label}: ${error.message}`); return []; }
      return (data || []).map(map);
    } catch (e: any) {
      errors.push(`${label}: ${e?.message || 'falha de rede'}`);
      return [];
    }
  };

  const [sales, merchants, buyers, products, destinations, stockMovements, users] = await Promise.all([
    q('sales', () => supabase.from('sales').select('*').order('created_at', { ascending: true }), mapSale),
    q('merchants', () => supabase.from('merchants').select('*').order('created_at', { ascending: true }), mapMerchant),
    q('buyers', () => supabase.from('buyers').select('*').order('first_seen', { ascending: true }), mapBuyer),
    q('products', () => supabase.from('products').select('*').order('created_at', { ascending: true }), mapProduct),
    q('destinations', () => supabase.from('destinations').select('*').order('name', { ascending: true }), mapDestination),
    q('stock_movements', () => supabase.from('stock_movements').select('*').order('created_at', { ascending: false }), mapMovement),
    q('profiles', () => supabase.from('profiles').select('*'), mapProfile),
  ]);

  const valid = (x: { name: string }) => !isInvalidName(x.name);
  return {
    sales: sales.filter(s => !isInvalidName(s.merchant_name) && !isInvalidName(s.buyer_name)),
    merchants: merchants.filter(valid),
    buyers: buyers.filter(valid),
    products: products.filter(valid),
    destinations: destinations.filter(valid),
    stockMovements,
    users,
    error: errors.length ? errors.join(' • ') : null,
  };
}

// ============================== ENSURE (busca ou cria) ==============================

export async function ensureMerchant(name: string, userId?: string, email?: string): Promise<Merchant> {
  if (!isRemote) return localDB.ensureMerchant(name, userId);
  const sanitized = sanitizeName(name);
  const norm = normalizeName(sanitized);
  const found = await selectByNorm('merchants', norm);
  if (found) {
    const patch: any = {};
    if (userId && !found.user_id) patch.user_id = asUUID(userId);
    if (email && !found.email) patch.email = email;
    if (Object.keys(patch).length) await supabase.from('merchants').update(patch).eq('id', found.id);
    return mapMerchant({ ...found, ...patch });
  }
  const row = await insertAndReturn('merchants', {
    user_id: asUUID(userId),
    name: sanitized,
    normalized_name: norm,
    email: email || null,
  }, norm);
  return mapMerchant(row);
}

export async function ensureBuyer(name: string, isAlly: boolean, house?: any): Promise<Buyer> {
  if (!isRemote) return localDB.ensureBuyer(name, isAlly, house);
  const sanitized = sanitizeName(name);
  const norm = normalizeName(sanitized);
  const found = await selectByNorm('buyers', norm);
  if (found) {
    if (isAlly && !found.is_ally) {
      await supabase.from('buyers').update({ is_ally: true, ally_house: house || null }).eq('id', found.id);
      found.is_ally = true; found.ally_house = house || null;
    }
    return mapBuyer(found);
  }
  const row = await insertAndReturn('buyers', {
    name: sanitized,
    normalized_name: norm,
    is_ally: !!isAlly,
    ally_house: house || null,
  }, norm);
  return mapBuyer(row);
}

export async function ensureProduct(name: string): Promise<Product> {
  if (!isRemote) return localDB.ensureProduct(name);
  const sanitized = sanitizeName(name);
  const norm = normalizeName(sanitized);
  const found = await selectByNorm('products', norm);
  if (found) return mapProduct(found);
  const row = await insertAndReturn('products', {
    name: sanitized,
    normalized_name: norm,
    slug: slugify(sanitized),
  }, norm);
  return mapProduct(row);
}

export async function ensureDestination(name: string): Promise<Destination> {
  if (!isRemote) return localDB.ensureDestination(name);
  const sanitized = sanitizeName(name);
  const norm = normalizeName(sanitized);
  const found = await selectByNorm('destinations', norm);
  if (found) return mapDestination(found);
  const row = await insertAndReturn('destinations', {
    name: sanitized,
    normalized_name: norm,
  }, norm);
  return mapDestination(row);
}

// ============================== VENDAS ==============================

export async function insertSale(s: Sale): Promise<Sale> {
  if (!isRemote) {
    const all = [...localDB.getSales(), s];
    localDB.saveSales(all);
    return s;
  }
  const row = await insertAndReturn('sales', toSaleRow(s));
  return mapSale(row);
}

export async function updateSaleStatus(id: string, status: Sale['status'], approvedBy?: string): Promise<void> {
  if (!isRemote) {
    const all = localDB.getSales();
    const idx = all.findIndex(s => s.id === id);
    if (idx >= 0) {
      all[idx].status = status;
      if (approvedBy) all[idx].approved_by = approvedBy;
      localDB.saveSales(all);
    }
    return;
  }
  const patch: any = { status };
  if (approvedBy && asUUID(approvedBy)) patch.approved_by = asUUID(approvedBy);
  const { error } = await supabase.from('sales').update(patch).eq('id', id);
  if (error) throw new Error(`sales: ${error.message}`);
}

// ============================== AGREGAÇÕES (save full entity) ==============================

function localReplace<T extends { id: string }>(get: () => T[], save: (x: T[]) => void, entity: T) {
  const all = get();
  const idx = all.findIndex(x => x.id === entity.id);
  if (idx >= 0) { all[idx] = entity; } else { all.push(entity); }
  save(all);
}

export async function saveMerchantAgg(m: Merchant): Promise<void> {
  if (!isRemote) { localReplace(localDB.getMerchants, localDB.saveMerchants, m); return; }
  const { error } = await supabase.from('merchants').update(toMerchantRow(m)).eq('id', m.id);
  if (error) throw new Error(`merchants: ${error.message}`);
}

export async function saveBuyerAgg(b: Buyer): Promise<void> {
  if (!isRemote) { localReplace(localDB.getBuyers, localDB.saveBuyers, b); return; }
  const { error } = await supabase.from('buyers').update(toBuyerRow(b)).eq('id', b.id);
  if (error) throw new Error(`buyers: ${error.message}`);
}

export async function saveProductAgg(p: Product): Promise<void> {
  if (!isRemote) { localReplace(localDB.getProducts, localDB.saveProducts, p); return; }
  const { error } = await supabase.from('products').update(toProductRow(p)).eq('id', p.id);
  if (error) throw new Error(`products: ${error.message}`);
}

export async function saveDestinationAgg(d: Destination): Promise<void> {
  if (!isRemote) { localReplace(localDB.getDestinations, localDB.saveDestinations, d); return; }
  const { error } = await supabase.from('destinations').update(toDestinationRow(d)).eq('id', d.id);
  if (error) throw new Error(`destinations: ${error.message}`);
}

// ============================== MERCADORES ==============================

export async function createMerchant(name: string): Promise<Merchant> {
  const sanitized = sanitizeName(name);
  if (sanitized === 'Não informado') throw new Error('Nome de mercador inválido');
  if (!isRemote) return localDB.createMerchant(name);
  const norm = normalizeName(sanitized);
  const existing = await selectByNorm('merchants', norm);
  if (existing) throw new Error('Mercador já cadastrado');
  const row = await insertAndReturn('merchants', {
    name: sanitized,
    normalized_name: norm,
  }, norm);
  return mapMerchant(row);
}

export async function deleteMerchant(id: string): Promise<void> {
  if (!isRemote) { localDB.deleteMerchant(id); return; }
  const { error } = await supabase.from('merchants').delete().eq('id', id);
  if (error) throw new Error(`merchants: ${error.message}`);
}

export async function linkMerchantToUser(merchantId: string, userId: string): Promise<void> {
  if (!isRemote) { localDB.linkMerchantToUser(merchantId, userId); return; }
  const { error } = await supabase.from('merchants').update({ user_id: asUUID(userId) }).eq('id', merchantId);
  if (error) throw new Error(`merchants: ${error.message}`);
}

// ============================== PRODUTOS / ESTOQUE ==============================

export async function createProduct(data: Partial<Product> & { name: string }): Promise<Product> {
  if (!isRemote) return localDB.createProduct(data);
  const sanitized = sanitizeName(data.name);
  const norm = normalizeName(sanitized);
  const existing = await selectByNorm('products', norm);
  if (existing) throw new Error('Item já existe no estoque');
  const stock = num(data.stock_quantity);
  const row = await insertAndReturn('products', {
    name: sanitized,
    normalized_name: norm,
    slug: slugify(sanitized),
    category: data.category || 'Geral',
    cost_price: num(data.cost_price),
    stock_quantity: stock,
    min_stock: data.min_stock != null ? num(data.min_stock) : 5,
    supplier: data.supplier || null,
    location: data.location || null,
  }, norm);
  const created = mapProduct(row);
  if (stock > 0) {
    await addStockMovement({
      product_id: created.id,
      product_name: created.name,
      type: 'entrada',
      quantity: stock,
      previous_stock: 0,
      new_stock: stock,
      reason: 'Cadastro inicial',
      cost_at_time: created.cost_price,
    });
  }
  return created;
}

export async function deleteProduct(id: string): Promise<void> {
  if (!isRemote) { localDB.deleteProduct(id); return; }
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(`products: ${error.message}`);
}

export async function updateProductInfo(id: string, updates: Partial<Product>): Promise<void> {
  if (!isRemote) { localDB.updateProduct(id, updates); return; }
  const patch: any = {};
  if (updates.name !== undefined) { patch.name = updates.name; patch.normalized_name = normalizeName(updates.name); patch.slug = slugify(updates.name); }
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.stock_quantity !== undefined) patch.stock_quantity = num(updates.stock_quantity);
  if (updates.min_stock !== undefined) patch.min_stock = num(updates.min_stock);
  if (updates.cost_price !== undefined) patch.cost_price = num(updates.cost_price);
  if (updates.supplier !== undefined) patch.supplier = updates.supplier || null;
  if (updates.location !== undefined) patch.location = updates.location || null;
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw new Error(`products: ${error.message}`);
}

export async function addStockMovement(mov: Omit<StockMovement, 'id' | 'created_at'> & Partial<Pick<StockMovement, 'id' | 'created_at'>>): Promise<StockMovement> {
  if (!isRemote) return localDB.addStockMovement(mov);
  const row = await insertAndReturn('stock_movements', toMovementRow(mov as any));
  return mapMovement(row);
}

export async function adjustStock(
  productId: string,
  quantityDelta: number,
  reason: string,
  type: StockMovementType = 'ajuste',
  meta?: Partial<StockMovement>,
): Promise<Product> {
  if (!isRemote) return localDB.adjustStock(productId, quantityDelta, reason, type, meta);
  const { data, error } = await supabase.from('products').select('*').eq('id', productId).limit(1);
  if (error) throw new Error(`products: ${error.message}`);
  if (!data || !data.length) throw new Error('Produto não encontrado');
  const prod = mapProduct(data[0]);
  const prev = num(prod.stock_quantity);
  const next = prev + quantityDelta;
  const patch: any = { stock_quantity: next };
  if (meta?.cost_at_time !== undefined && meta?.cost_at_time !== null) patch.cost_price = num(meta.cost_at_time);
  const { error: uerr } = await supabase.from('products').update(patch).eq('id', productId);
  if (uerr) throw new Error(`products: ${uerr.message}`);
  await addStockMovement({
    product_id: productId,
    product_name: prod.name,
    type,
    quantity: Math.abs(quantityDelta),
    previous_stock: prev,
    new_stock: next,
    reason,
    cost_at_time: meta?.cost_at_time ?? prod.cost_price,
    related_sale_id: meta?.related_sale_id,
    related_sale_ficha: meta?.related_sale_ficha,
    created_by: meta?.created_by,
    created_by_name: meta?.created_by_name,
  } as any);
  return { ...prod, stock_quantity: next, cost_price: patch.cost_price ?? prod.cost_price };
}

// ============================== LIMPEZA ==============================

export async function clearAllData(): Promise<void> {
  localDB.resetBlank();
  if (!isRemote) return;
  // Ordem respeita FKs: filhos primeiro
  const order = ['stock_movements', 'sales', 'destinations', 'products', 'buyers', 'merchants'];
  for (const t of order) {
    const { error } = await supabase.from(t).delete().neq('id', ZERO_UUID);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
}

// ============================== MIGRAÇÃO localStorage -> Supabase ==============================

export interface MigrationSummary {
  profilesLinked: number;
  merchants: number;
  buyers: number;
  products: number;
  destinations: number;
  sales: number;
  movements: number;
  skipped: number;
  errors: string[];
}

export function localDataSummary() {
  const s = {
    sales: localDB.getSales().length,
    merchants: localDB.getMerchants().length,
    buyers: localDB.getBuyers().length,
    products: localDB.getProducts().length,
    destinations: localDB.getDestinations().length,
    movements: localDB.getStockMovements().length,
  };
  return { ...s, total: s.sales + s.merchants + s.buyers + s.products + s.destinations + s.movements };
}

export async function migrateLocalToSupabase(): Promise<MigrationSummary> {
  if (!isRemote) throw new Error('Supabase não está configurado neste ambiente.');
  const summary: MigrationSummary = { profilesLinked: 0, merchants: 0, buyers: 0, products: 0, destinations: 0, sales: 0, movements: 0, skipped: 0, errors: [] };
  const pushErr = (ctx: string, e: any) => summary.errors.push(`${ctx}: ${e?.message || e}`);

  // 0) Perfis do Supabase -> mercadores (resolve "mercador registrado não aparece")
  try {
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    for (const p of profiles || []) {
      if (!p.merchant_name || isInvalidName(p.merchant_name)) continue;
      try {
        const existing = await selectByNorm('merchants', normalizeName(p.merchant_name));
        await ensureMerchant(p.merchant_name, p.id, p.email);
        if (!existing) summary.profilesLinked++;
      } catch (e) { pushErr(`perfil ${p.email}`, e); }
    }
  } catch (e) { pushErr('profiles', e); }

  // 1) Entidades locais -> Supabase preservando totais/estoque
  for (const m of localDB.getMerchants()) {
    try {
      const existing = await selectByNorm('merchants', normalizeName(m.name));
      if (existing) { summary.skipped++; continue; }
      const { error } = await supabase.from('merchants').insert(toMerchantRow(m));
      if (error) { pushErr(`mercador ${m.name}`, error); continue; }
      summary.merchants++;
    } catch (e) { pushErr(`mercador ${m.name}`, e); }
  }
  for (const b of localDB.getBuyers()) {
    try {
      const existing = await selectByNorm('buyers', normalizeName(b.name));
      if (existing) { summary.skipped++; continue; }
      const { error } = await supabase.from('buyers').insert(toBuyerRow(b));
      if (error) { pushErr(`comprador ${b.name}`, error); continue; }
      summary.buyers++;
    } catch (e) { pushErr(`comprador ${b.name}`, e); }
  }
  for (const p of localDB.getProducts()) {
    try {
      const existing = await selectByNorm('products', normalizeName(p.name));
      if (existing) { summary.skipped++; continue; }
      const { error } = await supabase.from('products').insert(toProductRow(p));
      if (error) { pushErr(`produto ${p.name}`, error); continue; }
      summary.products++;
    } catch (e) { pushErr(`produto ${p.name}`, e); }
  }
  for (const d of localDB.getDestinations()) {
    try {
      const existing = await selectByNorm('destinations', normalizeName(d.name));
      if (existing) { summary.skipped++; continue; }
      const { error } = await supabase.from('destinations').insert(toDestinationRow(d));
      if (error) { pushErr(`destino ${d.name}`, error); continue; }
      summary.destinations++;
    } catch (e) { pushErr(`destino ${d.name}`, e); }
  }

  // 2) Vendas (dedup por ficha_number / raw_text)
  try {
    const { data: existingSales } = await supabase.from('sales').select('ficha_number, raw_text');
    const fichas = new Set((existingSales || []).map((s: any) => s.ficha_number).filter(Boolean));
    const raws = new Set((existingSales || []).map((s: any) => s.raw_text).filter(Boolean));
    for (const s of localDB.getSales()) {
      try {
        if ((s.ficha_number && fichas.has(s.ficha_number)) || (s.raw_text && raws.has(s.raw_text))) { summary.skipped++; continue; }
        const m = await ensureMerchant(s.merchant_name);
        const b = await ensureBuyer(s.buyer_name, s.is_ally, s.ally_house as any);
        const p = await ensureProduct(s.product_name);
        const d = await ensureDestination(s.destination_name);
        const { error } = await supabase.from('sales').insert(toSaleRow({
          ...s, merchant_id: m.id, buyer_id: b.id, product_id: p.id, destination_id: d.id,
        }));
        if (error) { pushErr(`venda ${s.ficha_number || s.id}`, error); continue; }
        summary.sales++;
        if (s.ficha_number) fichas.add(s.ficha_number);
        if (s.raw_text) raws.add(s.raw_text);
      } catch (e) { pushErr(`venda ${s.ficha_number || s.id}`, e); }
    }
  } catch (e) { pushErr('vendas', e); }

  // 3) Movimentações de estoque
  for (const mov of localDB.getStockMovements()) {
    try {
      const p = await ensureProduct(mov.product_name);
      const { error } = await supabase.from('stock_movements').insert(toMovementRow({ ...mov, product_id: p.id } as any));
      if (error) { pushErr('movimentação', error); continue; }
      summary.movements++;
    } catch (e) { pushErr('movimentação', e); }
  }

  return summary;
}
