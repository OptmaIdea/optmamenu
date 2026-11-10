-- Bloqueio de cancelamento inseguro (P0, mitigação pré-RC).
-- Não substitui o futuro fluxo de retorno, estoque, financeiro e estorno atômico.
CREATE OR REPLACE FUNCTION public.admin_cancel_public_order_safe(
    p_order_id uuid,
    p_reason text DEFAULT 'Cancelado pelo painel administrativo'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_store_id uuid;
    v_status text;
    v_payment_status text;
    v_role text := COALESCE(auth.role(), '');
BEGIN
    IF p_order_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'missing_order_id');
    END IF;
    SELECT o.store_id, o.status::text, o.payment_status
      INTO v_store_id, v_status, v_payment_status
      FROM public.orders o
     WHERE o.id = p_order_id
     FOR UPDATE;
    IF v_store_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
    END IF;
    IF v_role IN ('anon', 'authenticated')
       AND (auth.uid() IS NULL OR NOT (
           public.app_is_store_owner(v_store_id)
           OR public.user_has_store_permission(v_store_id, 'orders.cancel')
           OR public.user_has_store_permission(v_store_id, 'orders.manage')
       ))
    THEN
        RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
    IF v_status = 'cancelled' THEN
        RETURN public.admin_cancel_public_order_safe_internal_0d(p_order_id, p_reason);
    END IF;
    IF v_status = 'out_for_delivery' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'delivery_return_reversal_required',
            'message', 'Pedido já saiu para entrega: é necessário fluxo específico de retorno e reversão de estoque, financeiro e pagamento.');
    END IF;
    IF COALESCE(v_payment_status, 'pending') NOT IN ('pending', 'failed') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'refund_workflow_required',
            'message', 'Pedido com pagamento confirmado ou em estorno: o cancelamento exige o fluxo financeiro de estorno seguro.');
    END IF;
    RETURN public.admin_cancel_public_order_safe_internal_0d(p_order_id, p_reason);
END;
$function$;
COMMENT ON FUNCTION public.admin_cancel_public_order_safe(uuid,text) IS
    'Cancelamento simples apenas pré-despacho e sem pagamento a estornar. Bloqueia pedido em rota e pagamento confirmado até existir RPC transacional completa.';
