-- Function to cancel all pending orders for a specific store
-- Useful when the store closes (emergency or scheduled)
CREATE OR REPLACE FUNCTION cancel_all_pending_orders(p_store_id UUID)
RETURNS TABLE (cancelled_count INT)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (usually postgres/admin), needed to bypass RLS if necessary, but here mainly for consistency
AS $$
DECLARE
    v_count INT;
BEGIN
    -- Update orders that are 'pending' to 'cancelled'
    -- You might want a specific status like 'expired' or 'store_closed_auto' if your enum allows, 
    -- but 'cancelled' is standard.
    WITH updated_rows AS (
        UPDATE orders
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE store_id = p_store_id
          AND status = 'pending' -- Only pending (reserved) orders
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM updated_rows;

    RETURN QUERY SELECT v_count;
END;
$$;
