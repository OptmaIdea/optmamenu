-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Global Types
create type order_status as enum ('reserved', 'confirmed', 'completed', 'cancelled');
create type payment_method as enum ('pix', 'cash', 'card', 'pending');
create type promo_type as enum ('percentage', 'fixed');

-- PROFILES (Users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  phone text unique,
  name text,
  address text,
  district text, -- Bairro
  city text default 'São João Nepomuceno',
  birthData date,
  cpf text,
  points integer default 0,
  accepted_policy boolean default false,
  accepted_promo boolean default false,
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- CATEGORIES
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  image_url text,
  slug text unique,
  order_index integer default 0,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PRODUCTS
create table products (
  id uuid default uuid_generate_v4() primary key,
  category_id uuid references categories(id),
  name text not null,
  description text,
  price decimal(10,2) not null,
  images text[], -- Array of image URLs
  video_url text,
  allergens text[], -- Array of strings e.g., ['LEITE', 'AMENDOIM']
  featured boolean default false,
  sales_count integer default 0,
  stock_quantity integer default 0,
  rating_avg decimal(3,2) default 0,
  review_count integer default 0,
  active boolean default true,
  nutritional_info jsonb, -- JSON for extra details
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- REVIEWS (Product Reviews)
create table reviews (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null, -- Can range from anonymous to logged in potentially, but linked to profile if possible
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  approved boolean default false, -- Moderation
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PROMOTIONS
create table promotions (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  type promo_type not null,
  value decimal(10,2) not null,
  category_id uuid references categories(id),
  product_id uuid references products(id),
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORDERS
create table orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id),
  customer_name text, -- For guest checkout if needed
  customer_phone text, -- For guest checkout if needed
  status order_status default 'reserved',
  total decimal(10,2) not null default 0,
  payment_method payment_method default 'pending',
  proof_url text, -- For Pix receipt
  created_at timestamp with time zone default timezone('utc'::text, now()) not null, -- reservation time
  confirmed_at timestamp with time zone,
  completed_at timestamp with time zone,
  delivery_address text -- Snapshot of address
);

-- ORDER ITEMS
create table order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer not null,
  unit_price decimal(10,2) not null, -- Snapshot of price at time of order
  discount decimal(10,2) default 0 -- Applied discount
);

-- STOCK RESERVATIONS (Temporary hold)
create table stock_reservations (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS POLICIES
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table reviews enable row level security;
alter table promotions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table stock_reservations enable row level security;

-- Public Read Policies
create policy "Public can view active categories" on categories for select using (active = true);
create policy "Public can view active products" on products for select using (active = true);
create policy "Public can view approved reviews" on reviews for select using (approved = true);
create policy "Public can view active promotions" on promotions for select using (active = true);

-- User Policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Users can view own orders" on orders for select using (auth.uid() = user_id);
create policy "Users can create orders" on orders for insert with check (auth.uid() = user_id);

create policy "Users can create reviews" on reviews for insert with check (auth.uid() = user_id);

-- Triggers

-- Handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone, name)
  values (new.id, new.phone, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Initial Seed Data (Optional, kept separate usually but adding basic structure hint)
