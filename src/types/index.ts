export type Role = 'admin' | 'merchant';

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  merchant_name?: string;
  avatar_url?: string;
  created_at: string;
}

export type DeliveryType = 'domiciliar' | 'retirada' | 'nao_informado';
export type CurrencyType = 'ouro' | 'prata' | 'bronze' | 'mista' | 'nao_informado';
export type SaleStatus = 'pendente' | 'aprovada' | 'rejeitada';

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  user_id?: string;
  email?: string;
  total_sales: number;
  total_base: number;
  total_commission: number;
  avatar?: string;
  created_at: string;
  last_sale_at?: string;
}

export interface Buyer {
  id: string;
  name: string;
  normalized_name: string;
  is_ally: boolean;
  ally_house?: 'Gardener' | 'Lannister' | 'Stark' | null;
  total_spent_base: number;
  total_spent_final: number;
  total_purchases: number;
  first_seen: string;
  last_seen: string;
}

export interface Product {
  id: string;
  name: string;
  normalized_name: string;
  slug: string;
  category?: string;
  cost_price?: number;
  avg_price: number;
  total_qty: number; // total vendido histórico
  total_revenue_base: number;
  total_revenue_final: number;
  total_profit?: number;
  created_at: string;
  // ESTOQUE NOVO
  stock_quantity: number; // estoque atual em mãos
  min_stock: number; // alerta de estoque baixo
  supplier?: string;
  location?: string;
}

export type StockMovementType = 'entrada' | 'saida' | 'ajuste' | 'perda' | 'devolucao';

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  type: StockMovementType;
  quantity: number; // positivo para entrada, negativo para saída internamente mas exibido como pos
  previous_stock: number;
  new_stock: number;
  reason: string;
  cost_at_time?: number;
  related_sale_id?: string;
  related_sale_ficha?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface Destination {
  id: string;
  name: string;
  normalized_name: string;
  region?: string;
  total_deliveries: number;
}

export interface TaxBreakdown {
  base_value: number;
  is_ally: boolean;
  ally_house?: string | null;
  ally_discount: number;
  delivery_type: DeliveryType;
  delivery_adjustment: number;
  final_value: number;
  merchant_commission: number;
  producer_share: number;
  company_share_base: number;
  company_extra: number;
  company_final: number;
  total_profit_company: number;
}

export interface Sale {
  id: string;
  ficha_number?: string;
  raw_text: string;
  buyer_id: string;
  buyer_name: string;
  merchant_id: string;
  merchant_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  base_value: number;
  final_value: number;
  currency: CurrencyType;
  delivery_type: DeliveryType;
  destination_id?: string;
  destination_name: string;
  is_ally: boolean;
  ally_house?: string | null;
  tax_breakdown: TaxBreakdown;
  status: SaleStatus;
  created_by?: string;
  approved_by?: string;
  created_at: string;
  date: string;
  date_text?: string; // nome da coluna no Supabase (mapeado para `date` no app)
}

export interface ImportResult {
  total: number;
  parsed: Sale[];
  errors: { index: number; raw: string; error: string }[];
}

export type ReportType = 
  | 'estoque_atual'
  | 'entradas_periodo'
  | 'saidas_periodo'
  | 'movimentacoes_completa'
  | 'baixo_estoque'
  | 'lucro_produto'
  | 'vendas_por_produto'
  | 'tesouraria_completa';
