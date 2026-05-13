-- Create table for Standard Weekly Hours
CREATE TABLE IF NOT EXISTS store_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    open_time TIME DEFAULT '09:00',
    close_time TIME DEFAULT '18:00',
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, day_of_week)
);

-- Create table for Exceptions (Holidays, Special Events)
CREATE TABLE IF NOT EXISTS store_schedules_exceptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT TRUE, -- Default to closed (holiday), but can also be open with different hours
    open_time TIME, -- IF is_closed is FALSE, these must be set
    close_time TIME,
    reason TEXT, -- 'Natal', 'Feriado', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, exception_date)
);

-- RLS Policies
ALTER TABLE store_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_schedules_exceptions ENABLE ROW LEVEL SECURITY;

-- Public Read access
CREATE POLICY "Public read access for store_hours" ON store_hours
    FOR SELECT USING (true);

CREATE POLICY "Public read access for store_schedules_exceptions" ON store_schedules_exceptions
    FOR SELECT USING (true);

-- Store Owner write access
CREATE POLICY "Owners can manage store_hours" ON store_hours
    FOR ALL USING (auth.uid() IN (SELECT user_id FROM stores WHERE id = store_id));

CREATE POLICY "Owners can manage store_schedules_exceptions" ON store_schedules_exceptions
    FOR ALL USING (auth.uid() IN (SELECT user_id FROM stores WHERE id = store_id));
