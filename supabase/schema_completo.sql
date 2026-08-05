-- COLE ESTE ARQUIVO NO SQL EDITOR DO SUPABASE

-- Enable UUID
create extension if not exists "uuid-ossp";

-- 1) Profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text check (role in ('admin','merchant')) default 'merchant',
  merchant_name text not null,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- 2) Buyers
create table if not exists buyers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  normalized_name text not null,
  is_ally boolean default false,
  ally_house text,
  total_spent_base numeric default 0,
  total_spent_final numeric default 0,
  total_purchases int default 0,
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  unique(normalized_name)
);

-- 3) Merchants
create table if not exists merchants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  name text not null,
  normalized_name text not null,
  email text,
  total_sales int default 0,
  total_base numeric default 0,
  total_commission numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  last_sale_at timestamptz,
  unique(normalized_name)
);

-- 4) Products com estoque
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  normalized_name text not null,
  slug text not null,
  category text default 'Geral',
  cost_price numeric default 0,
  avg_price numeric default 0,
  total_qty numeric default 0,
  total_revenue_base numeric default 0,
  total_revenue_final numeric default 0,
  total_profit numeric default 0,
  stock_quantity numeric default 0,
  min_stock numeric default 5,
  supplier text,
  location text,
  created_at timestamptz default now(),
  unique(normalized_name)
);

-- 5) Destinations
create table if not exists destinations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  normalized_name text not null,
  region text,
  total_deliveries int default 0,
  unique(normalized_name)
);

-- 6) Sales
create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  ficha_number text,
  raw_text text not null,
  buyer_id uuid references buyers(id),
  buyer_name text not null,
  merchant_id uuid references merchants(id),
  merchant_name text not null,
  product_id uuid references products(id),
  product_name text not null,
  quantity numeric not null,
  base_value numeric not null,
  final_value numeric not null,
  currency text default 'ouro',
  delivery_type text check (delivery_type in ('domiciliar','retirada','nao_informado')) default 'nao_informado',
  destination_id uuid references destinations(id),
  destination_name text not null,
  is_ally boolean default false,
  ally_house text,
  tax_breakdown jsonb not null,
  status text check (status in ('pendente','aprovada','rejeitada')) default 'pendente',
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz default now(),
  date_text text
);

-- 7) Stock Movements
create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  product_name text not null,
  type text check (type in ('entrada','saida','ajuste','perda','devolucao')) not null,
  quantity numeric not null,
  previous_stock numeric not null,
  new_stock numeric not null,
  reason text not null,
  cost_at_time numeric,
  related_sale_id uuid references sales(id),
  related_sale_ficha text,
  created_by uuid references profiles(id),
  created_by_name text,
  created_at timestamptz default now()
);

-- Índices
create index if not exists idx_sales_status on sales(status);
create index if not exists idx_sales_created_at on sales(created_at);
create index if not exists idx_products_stock on products(stock_quantity);
create index if not exists idx_stock_mov_product on stock_movements(product_id);
create index if not exists idx_stock_mov_created on stock_movements(created_at);

-- RLS
alter table profiles enable row level security;
alter table sales enable row level security;
alter table buyers enable row level security;
alter table merchants enable row level security;
alter table products enable row level security;
alter table destinations enable row level security;
alter table stock_movements enable row level security;

drop policy if exists "allow all" on profiles;
drop policy if exists "allow all" on buyers;
drop policy if exists "allow all" on merchants;
drop policy if exists "allow all" on products;
drop policy if exists "allow all" on destinations;
drop policy if exists "allow all" on sales;
drop policy if exists "allow all" on stock_movements;

create policy "allow all" on profiles for all using (true) with check (true);
create policy "allow all" on buyers for all using (true) with check (true);
create policy "allow all" on merchants for all using (true) with check (true);
create policy "allow all" on products for all using (true) with check (true);
create policy "allow all" on destinations for all using (true) with check (true);
create policy "allow all" on sales for all using (true) with check (true);
create policy "allow all" on stock_movements for all using (true) with check (true);
