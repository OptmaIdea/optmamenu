-- Add loyalty points to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;

-- Create loyalty transactions table
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    order_id UUID REFERENCES public.orders(id), -- Nullable (manual adjustments)
    amount INTEGER NOT NULL, -- Positive = earn, Negative = spend
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Transactions
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own loyalty history" 
ON public.loyalty_transactions FOR SELECT 
USING (auth.uid() = user_id);

-- Trigger to update profile points summary
CREATE OR REPLACE FUNCTION update_loyalty_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET loyalty_points = (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.loyalty_transactions
        WHERE user_id = NEW.user_id
    )
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_loyalty_transaction
AFTER INSERT OR DELETE ON public.loyalty_transactions
FOR EACH ROW EXECUTE FUNCTION update_loyalty_balance();

-- Function to award points on order delivery
-- Rate: 1 Point per R$ 1.00 spent
CREATE OR REPLACE FUNCTION award_points_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        INSERT INTO public.loyalty_transactions (user_id, order_id, amount, description)
        VALUES (
            NEW.user_id, 
            NEW.id, 
            FLOOR(NEW.total)::INTEGER, -- 1 point per 1.00 currency unit
            'Pontos por compra - Pedido #' || SUBSTRING(NEW.id::text, 1, 6)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on Orders
DROP TRIGGER IF EXISTS on_order_delivered_award_points ON public.orders;
CREATE TRIGGER on_order_delivered_award_points
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION award_points_on_delivery();
