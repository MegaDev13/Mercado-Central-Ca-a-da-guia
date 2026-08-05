// LocalStorage fallback quando Supabase não configurado
import { Sale, Merchant, Buyer, Product, Destination, UserProfile, StockMovement } from '../types';
import { normalizeName, slugify } from './normalize';

const KEYS = {
  sales: 'rpg_sales',
  merchants: 'rpg_merchants',
  buyers: 'rpg_buyers',
  products: 'rpg_products',
  destinations: 'rpg_destinations',
  stock_movements: 'rpg_stock_movements',
  user: 'rpg_current_user',
  users: 'rpg_users',
};

function getJSON<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : def;
  } catch { return def; }
}
function setJSON(key: string, val: any) {
  localStorage.setItem(key, JSON.stringify(val));
}

function isInvalidName(name: string): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  if (n.length < 2) return true;
  if (n === 'ia' || n === 'ia,' ) return true;
  if (n.includes('entre os reinos')) return true;
  if (n.includes('conforme as leis')) return true;
  if (n.includes('comerciais vigentes')) return true;
  if (n.length > 100) return true;
  return false;
}

function sanitizeName(name: string): string {
  if (!name) return 'Não informado';
  let s = name.trim();
  s = s.replace(/^ia,\s*/i, '').replace(/^ia\s+/i, '').trim();
  if (isInvalidName(s)) return 'Não informado';
  return s;
}

export const localDB = {
  getUsers(): UserProfile[] {
    const defaults = [
      { id: 'admin-1', email: 'admin@ravenport.com', role: 'admin' as const, merchant_name: 'Lorde Tesoureiro', created_at: new Date().toISOString() },
    ];
    return getJSON(KEYS.users, defaults as UserProfile[]);
  },
  saveUsers(users: UserProfile[]) { setJSON(KEYS.users, users); },

  getCurrentUser(): UserProfile | null { return getJSON(KEYS.user, null); },
  setCurrentUser(u: UserProfile | null) { setJSON(KEYS.user, u); },

  getSales(): Sale[] { return getJSON(KEYS.sales, [] as Sale[]); },
  saveSales(sales: Sale[]) { setJSON(KEYS.sales, sales); },

  getMerchants(): Merchant[] { 
    const all = getJSON<Merchant[]>(KEYS.merchants, [] as Merchant[]);
    const cleaned = all.filter(m => !isInvalidName(m.name));
    if (cleaned.length !== all.length) setJSON(KEYS.merchants, cleaned);
    return cleaned;
  },
  saveMerchants(m: Merchant[]) { 
    const filtered = m.filter(x => !isInvalidName(x.name));
    setJSON(KEYS.merchants, filtered); 
  },

  getBuyers(): Buyer[] { 
    const all = getJSON<Buyer[]>(KEYS.buyers, [] as Buyer[]);
    const cleaned = all.filter(b => !isInvalidName(b.name));
    if (cleaned.length !== all.length) setJSON(KEYS.buyers, cleaned);
    return cleaned;
  },
  saveBuyers(b: Buyer[]) { setJSON(KEYS.buyers, b.filter(x=> !isInvalidName(x.name))); },

  getProducts(): Product[] { 
    const all = getJSON<Product[]>(KEYS.products, [] as Product[]);
    const migrated = all.map(p => ({
      ...p,
      stock_quantity: (p as any).stock_quantity ?? 0,
      min_stock: (p as any).min_stock ?? 5,
      category: (p as any).category || 'Geral',
    } as Product));
    const cleaned = migrated.filter(p => !isInvalidName(p.name));
    if (cleaned.length !== all.length || JSON.stringify(cleaned) !== JSON.stringify(all)) setJSON(KEYS.products, cleaned);
    return cleaned;
  },
  saveProducts(p: Product[]) { setJSON(KEYS.products, p.filter(x=> !isInvalidName(x.name))); },

  getDestinations(): Destination[] { 
    const all = getJSON<Destination[]>(KEYS.destinations, [] as Destination[]);
    const cleaned = all.filter(d => !isInvalidName(d.name));
    if (cleaned.length !== all.length) setJSON(KEYS.destinations, cleaned);
    return cleaned;
  },
  saveDestinations(d: Destination[]) { setJSON(KEYS.destinations, d.filter(x=> !isInvalidName(x.name))); },

  getStockMovements(): StockMovement[] {
    return getJSON<StockMovement[]>(KEYS.stock_movements, []);
  },
  saveStockMovements(movs: StockMovement[]) {
    setJSON(KEYS.stock_movements, movs);
  },

  cleanupInvalid() {
    try {
      let sales = getJSON<Sale[]>(KEYS.sales, []);
      const beforeSales = sales.length;
      sales = sales.filter(s => 
        !isInvalidName(s.merchant_name) && 
        !isInvalidName(s.buyer_name) &&
        s.merchant_name.toLowerCase() !== 'ia' &&
        !s.merchant_name.toLowerCase().includes('entre os reinos')
      );
      if (sales.length !== beforeSales) setJSON(KEYS.sales, sales);
      this.getMerchants();
      this.getBuyers();
      this.getProducts();
      this.getDestinations();
    } catch {}
  },

  resetBlank() {
    localStorage.removeItem(KEYS.sales);
    localStorage.removeItem(KEYS.merchants);
    localStorage.removeItem(KEYS.buyers);
    localStorage.removeItem(KEYS.products);
    localStorage.removeItem(KEYS.destinations);
    localStorage.removeItem(KEYS.stock_movements);
  },

  resetAllInclusive() {
    localStorage.removeItem(KEYS.sales);
    localStorage.removeItem(KEYS.merchants);
    localStorage.removeItem(KEYS.buyers);
    localStorage.removeItem(KEYS.products);
    localStorage.removeItem(KEYS.destinations);
    localStorage.removeItem(KEYS.stock_movements);
    localStorage.removeItem(KEYS.users);
    localStorage.removeItem(KEYS.user);
  },

  createMerchant(name: string): Merchant {
    const sanitized = sanitizeName(name);
    if (sanitized === 'Não informado') throw new Error('Nome de mercador inválido');
    const merchants = this.getMerchants();
    const norm = normalizeName(sanitized);
    if (merchants.some(m => normalizeName(m.name) === norm)) throw new Error('Mercador já cadastrado');
    const newM: Merchant = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name: sanitized,
      slug: slugify(sanitized),
      total_sales: 0,
      total_base: 0,
      total_commission: 0,
      created_at: new Date().toISOString(),
    };
    merchants.push(newM);
    this.saveMerchants(merchants);
    return newM;
  },

  deleteMerchant(id: string) {
    let merchants = this.getMerchants();
    merchants = merchants.filter(m => m.id !== id);
    this.saveMerchants(merchants);
  },

  linkMerchantToUser(merchantId: string, userId: string) {
    const merchants = this.getMerchants();
    const idx = merchants.findIndex(m => m.id === merchantId);
    if (idx >= 0) {
      merchants[idx].user_id = userId;
      this.saveMerchants(merchants);
    }
  },

  ensureMerchant(name: string, userId?: string): Merchant {
    const sanitized = sanitizeName(name);
    const merchants = this.getMerchants();
    const norm = normalizeName(sanitized);
    let found = merchants.find(m => normalizeName(m.name) === norm);
    if (found) {
      if (userId && !found.user_id) {
        found.user_id = userId;
        this.saveMerchants(merchants);
      }
      return found;
    }
    if (sanitized === 'Não informado') {
      const existing = merchants.find(m => m.name === 'Não informado');
      if (existing) return existing;
    }
    const newM: Merchant = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name: sanitized,
      slug: slugify(sanitized),
      user_id: userId,
      total_sales: 0,
      total_base: 0,
      total_commission: 0,
      created_at: new Date().toISOString(),
    };
    merchants.push(newM);
    this.saveMerchants(merchants);
    return newM;
  },

  ensureBuyer(name: string, isAlly: boolean, house?: any): Buyer {
    const sanitized = sanitizeName(name);
    const buyers = this.getBuyers();
    const norm = normalizeName(sanitized);
    let found = buyers.find(b => normalizeName(b.name) === norm);
    if (found) {
      if (isAlly) { found.is_ally = true; found.ally_house = house; this.saveBuyers(buyers); }
      return found;
    }
    const newB: Buyer = {
      id: `b_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name: sanitized,
      normalized_name: norm,
      is_ally: isAlly,
      ally_house: house || null,
      total_spent_base: 0,
      total_spent_final: 0,
      total_purchases: 0,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    buyers.push(newB);
    this.saveBuyers(buyers);
    return newB;
  },

  ensureProduct(name: string): Product {
    const sanitized = sanitizeName(name);
    const products = this.getProducts();
    const norm = normalizeName(sanitized);
    let found = products.find(p => normalizeName(p.name) === norm);
    if (found) return found;
    const newP: Product = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name: sanitized,
      normalized_name: norm,
      slug: slugify(sanitized),
      avg_price: 0,
      stock_quantity: 0,
      min_stock: 5,
      total_qty: 0,
      total_revenue_base: 0,
      total_revenue_final: 0,
      created_at: new Date().toISOString(),
    };
    products.push(newP);
    this.saveProducts(products);
    return newP;
  },

  ensureDestination(name: string): Destination {
    const sanitized = sanitizeName(name);
    const dests = this.getDestinations();
    const norm = normalizeName(sanitized);
    let found = dests.find(d => normalizeName(d.name) === norm);
    if (found) return found;
    const newD: Destination = {
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name: sanitized,
      normalized_name: norm,
      total_deliveries: 0,
    };
    dests.push(newD);
    this.saveDestinations(dests);
    return newD;
  },

  // ESTOQUE
  createProduct(data: Partial<Product> & { name: string }): Product {
    const sanitized = sanitizeName(data.name);
    const products = this.getProducts();
    const norm = normalizeName(sanitized);
    if (products.some(p => normalizeName(p.name) === norm)) throw new Error('Item já existe no estoque');
    const newP: Product = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name: sanitized,
      normalized_name: norm,
      slug: slugify(sanitized),
      category: data.category || 'Geral',
      cost_price: data.cost_price ?? 0,
      stock_quantity: data.stock_quantity ?? 0,
      min_stock: data.min_stock ?? 5,
      supplier: data.supplier,
      location: data.location,
      avg_price: 0,
      total_qty: 0,
      total_revenue_base: 0,
      total_revenue_final: 0,
      created_at: new Date().toISOString(),
    };
    products.push(newP);
    this.saveProducts(products);
    // cria movimento inicial se tem estoque
    if (newP.stock_quantity > 0) {
      this.addStockMovement({
        product_id: newP.id,
        product_name: newP.name,
        type: 'entrada',
        quantity: newP.stock_quantity,
        previous_stock: 0,
        new_stock: newP.stock_quantity,
        reason: 'Cadastro inicial',
        cost_at_time: newP.cost_price,
      } as any);
    }
    return newP;
  },

  deleteProduct(id: string) {
    const products = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(products);
    // mantém movimentos para histórico
  },

  updateProduct(id: string, updates: Partial<Product>) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx >= 0) {
      products[idx] = { ...products[idx], ...updates, normalized_name: updates.name ? normalizeName(updates.name) : products[idx].normalized_name };
      this.saveProducts(products);
    }
  },

  adjustStock(productId: string, quantityDelta: number, reason: string, type: 'entrada' | 'saida' | 'ajuste' | 'perda' | 'devolucao' = 'ajuste', meta?: Partial<StockMovement>) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === productId);
    if (idx < 0) throw new Error('Produto não encontrado');
    const prod = products[idx];
    const prev = prod.stock_quantity;
    const next = prev + quantityDelta;
    prod.stock_quantity = next;
    if (meta?.cost_at_time !== undefined) prod.cost_price = meta.cost_at_time;
    this.saveProducts(products);

    this.addStockMovement({
      product_id: prod.id,
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
    return prod;
  },

  addStockMovement(mov: Omit<StockMovement, 'id' | 'created_at'> & Partial<Pick<StockMovement, 'id' | 'created_at'>>): StockMovement {
    const movs = this.getStockMovements();
    const newMov: StockMovement = {
      id: mov.id || `mov_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      created_at: mov.created_at || new Date().toISOString(),
      ...mov,
    } as StockMovement;
    movs.unshift(newMov);
    this.saveStockMovements(movs);
    return newMov;
  },

  seedIfEmpty() {}
};
