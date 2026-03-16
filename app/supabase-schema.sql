-- Run this in your Supabase project: SQL Editor → New query → Paste → Run
-- Enables "access same data from any device" with Row Level Security (RLS)

-- Businesses (one per row; user_id for multi-tenant)
create table if not exists public.businesses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Business',
  address text default '',
  gstin text default '',
  state text default '',
  phone text default '',
  tagline text default '',
  bank_name text default '',
  bank_account_no text default '',
  bank_ifsc text default '',
  upi_id text default '',
  logo text,
  invoice_number_prefix text default 'INV',
  invoice_number_next int default 1,
  invoice_number_include_year boolean default true,
  is_default boolean default false,
  invoice_settings jsonb default '{}',
  created_at timestamptz default now()
);

-- User preference: which business is selected
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_business_id text default ''
);

-- Customers (per business)
create table if not exists public.customers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  name text not null,
  address text default '',
  gstin text default '',
  state text default '',
  phone text default '',
  created_at timestamptz default now()
);

-- Products (per business)
create table if not exists public.products (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  name text not null,
  hsn text default '',
  rate numeric default 0,
  gst_percent numeric default 18,
  unit text default 'Pcs',
  created_at timestamptz default now()
);

-- Invoices (full row as app uses it; items and totals in columns)
create table if not exists public.invoices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  invoice_number text not null,
  customer_id text default '',
  customer_name text default '',
  customer_address text default '',
  customer_gstin text default '',
  customer_state text default '',
  date text default '',
  due_date text default '',
  po_number text default '',
  items jsonb default '[]',
  subtotal numeric default 0,
  discount_total numeric default 0,
  cgst_total numeric default 0,
  sgst_total numeric default 0,
  igst_total numeric default 0,
  round_off numeric default 0,
  grand_total numeric default 0,
  created_at timestamptz default now()
);

-- RLS: users see only their own data
alter table public.businesses enable row level security;
alter table public.user_preferences enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;

create policy "Users can manage own businesses"
  on public.businesses for all using (auth.uid() = user_id);

create policy "Users can manage own preferences"
  on public.user_preferences for all using (auth.uid() = user_id);

create policy "Users can manage own customers"
  on public.customers for all using (auth.uid() = user_id);

create policy "Users can manage own products"
  on public.products for all using (auth.uid() = user_id);

create policy "Users can manage own invoices"
  on public.invoices for all using (auth.uid() = user_id);

-- If you already created the table earlier, run the following to add new business fields:
-- alter table public.businesses add column if not exists tagline text default '';
-- alter table public.businesses add column if not exists bank_name text default '';
-- alter table public.businesses add column if not exists bank_account_no text default '';
-- alter table public.businesses add column if not exists bank_ifsc text default '';
-- alter table public.businesses add column if not exists upi_id text default '';
