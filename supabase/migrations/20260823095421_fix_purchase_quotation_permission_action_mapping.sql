-- Homologação 0D.9 — corrige o mapeamento de autorização das cotações.
--
-- update_purchase_quotation_response() consulta a ação manage_quotation.
-- O helper não mapeava essa ação e retornava false para todos os usuários,
-- bloqueando o fluxo mesmo quando purchases.manage estava concedida.

CREATE OR REPLACE FUNCTION public.user_can_purchase_action(p_store_id uuid, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_permission_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF p_store_id IS NULL THEN
    RETURN false;
  END IF;

  v_permission_code :=
    CASE p_action
      WHEN 'view' THEN 'purchases.view'
      WHEN 'create' THEN 'purchases.create'
      WHEN 'confirm' THEN 'purchases.confirm'
      WHEN 'apply' THEN 'purchases.confirm'
      WHEN 'apply_stock' THEN 'purchases.confirm'
      WHEN 'cancel' THEN 'purchases.cancel'
      WHEN 'delete' THEN 'purchases.cancel'
      WHEN 'manage_quotation' THEN 'purchases.manage'
      ELSE NULL
    END;

  IF v_permission_code IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.user_has_store_permission_v2(
    p_store_id,
    v_permission_code
  );
END;
$function$;
