-- Permit Realtime SELECT only to store owners or staff with loyalty.view/manage.
-- Customer self-service SELECT policy remains unchanged.
CREATE OR REPLACE FUNCTION public.can_view_loyalty_transaction_staff_safe(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_store_id uuid;
BEGIN
    IF auth.uid() IS NULL OR p_customer_id IS NULL
       OR public.app_current_role()='customer' THEN
        RETURN false;
    END IF;
    SELECT c.store_id INTO v_store_id FROM public.customers c WHERE c.id=p_customer_id LIMIT 1;
    IF v_store_id IS NULL THEN RETURN false; END IF;
    RETURN public.app_is_store_owner(v_store_id)
        OR public.user_has_store_permission_v2(v_store_id,'loyalty.view')
        OR public.user_has_store_permission_v2(v_store_id,'loyalty.manage');
END;
$$;
REVOKE ALL ON FUNCTION public.can_view_loyalty_transaction_staff_safe(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_loyalty_transaction_staff_safe(uuid) TO authenticated,service_role;
DROP POLICY IF EXISTS loyalty_transactions_staff_select_realtime ON public.loyalty_transactions;
CREATE POLICY loyalty_transactions_staff_select_realtime
ON public.loyalty_transactions FOR SELECT TO authenticated
USING (public.can_view_loyalty_transaction_staff_safe(customer_id));