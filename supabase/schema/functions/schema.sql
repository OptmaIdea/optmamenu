-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. CLEANUP (WARNING: DELETES ALL DATA)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS stores CASCADE;

-- 1. STORES Table (Multi-tenant root)
CREATE TABLE stores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL, -- Owner of the store
    slug TEXT NOT NULL UNIQUE, -- URL identifier (e.g., 'gelinhares')
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    phone_number TEXT, -- For WhatsApp integration
    theme_config JSONB DEFAULT '{}'::jsonb -- Stores colors, font preference, etc.
);

-- 2. CATEGORIES Table
CREATE TABLE categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true
);

-- 3. PRODUCTS Table
CREATE TABLE products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0
);

-- 4. Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- STORES Policies
-- Everyone can view stores (needed for the public store page)
CREATE POLICY "Public stores are viewable by everyone" 
ON stores FOR SELECT 
USING (true);

-- Users can only insert/update/delete their own store
CREATE POLICY "Users can manage their own store" 
ON stores FOR ALL 
USING (auth.uid() = user_id);

-- CATEGORIES Policies
-- Public read access
CREATE POLICY "Public categories are viewable by everyone" 
ON categories FOR SELECT 
USING (true);

-- Write access linked to store ownership
CREATE POLICY "Users can manage categories of their store" 
ON categories FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM stores 
        WHERE stores.id = categories.store_id 
        AND stores.user_id = auth.uid()
    )
);

-- PRODUCTS Policies
-- Public read access
CREATE POLICY "Public products are viewable by everyone" 
ON products FOR SELECT 
USING (true);

-- Write access linked to store ownership
CREATE POLICY "Users can manage products of their store" 
ON products FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM stores 
        WHERE stores.id = products.store_id 
        AND stores.user_id = auth.uid()
    )
);

-- Storage Buckets Setup (Run this in SQL Editor separately if bucket creates fail, but policies are key)
-- Note: Bucket creation is usually done via UI, but policies here:
-- Policy to allow public read of 'store-assets' bucket
-- Policy to allow authenticated upload to 'store-assets' bucket
