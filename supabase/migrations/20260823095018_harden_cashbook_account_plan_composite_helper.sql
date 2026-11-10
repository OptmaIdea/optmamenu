-- Homologação 0D.8 — fecha o último finding de search_path mutável no schema public.
--
-- Esta sobrecarga recebe uma row cashbook_account_plan e é helper interno de RPCs
-- SECURITY DEFINER. O frontend utiliza a sobrecarga pública por código (text), não
-- esta variante composta. Mantemos apenas service_role como grant explícito.

ALTER FUNCTION public.is_cashbook_account_plan_system_protected(public.cashbook_account_plan)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.is_cashbook_account_plan_system_protected(public.cashbook_account_plan)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_cashbook_account_plan_system_protected(public.cashbook_account_plan)
  TO service_role;
