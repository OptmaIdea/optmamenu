-- POS_9 — Financeiro — classificador automático de lançamentos por metadata
--
-- Objetivo:
-- Quando um lançamento do Livro Diário trouxer informações de classificação em metadata,
-- preencher automaticamente as colunas estruturadas criadas para plano de contas e contas financeiras.

CREATE OR REPLACE FUNCTION public.apply_cashbook_entry_metadata_classification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_source_account_id uuid := NULL;
  v_destination_account_id uuid := NULL;
  v_account_plan_code text := NULLIF(trim(COALESCE(NEW.metadata ->> 'account_plan_code', '')), '');
  v_source_account_code text := NULLIF(trim(COALESCE(NEW.metadata ->> 'source_financial_account_code', '')), '');
  v_destination_account_code text := NULLIF(trim(COALESCE(NEW.metadata ->> 'destination_financial_account_code', '')), '');
  v_is_transfer text := NULLIF(trim(COALESCE(NEW.metadata ->> 'is_transfer', '')), '');
  v_affects_cash_drawer text := NULLIF(trim(COALESCE(NEW.metadata ->> 'affects_cash_drawer', '')), '');
  v_affects_financial_result text := NULLIF(trim(COALESCE(NEW.metadata ->> 'affects_financial_result', '')), '');
BEGIN
  IF NEW.metadata IS NULL THEN
    NEW.metadata := '{}'::jsonb;
  END IF;

  IF v_account_plan_code IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.cashbook_account_plan p WHERE p.code = v_account_plan_code) THEN
    NEW.account_plan_code := v_account_plan_code;
  END IF;

  IF v_source_account_code IS NOT NULL THEN
    SELECT id
    INTO v_source_account_id
    FROM public.store_financial_accounts
    WHERE store_id = NEW.store_id
      AND code = v_source_account_code
      AND active = true
    ORDER BY is_default DESC, sort_order, created_at
    LIMIT 1;

    IF v_source_account_id IS NOT NULL THEN
      NEW.source_financial_account_id := v_source_account_id;
    END IF;
  END IF;

  IF v_destination_account_code IS NOT NULL THEN
    SELECT id
    INTO v_destination_account_id
    FROM public.store_financial_accounts
    WHERE store_id = NEW.store_id
      AND code = v_destination_account_code
      AND active = true
    ORDER BY is_default DESC, sort_order, created_at
    LIMIT 1;

    IF v_destination_account_id IS NOT NULL THEN
      NEW.destination_financial_account_id := v_destination_account_id;
    END IF;
  END IF;

  IF lower(COALESCE(v_is_transfer, '')) IN ('true', 't', '1', 'yes', 'sim') THEN
    NEW.is_transfer := true;
  ELSIF lower(COALESCE(v_is_transfer, '')) IN ('false', 'f', '0', 'no', 'nao', 'não') THEN
    NEW.is_transfer := false;
  END IF;

  IF lower(COALESCE(v_affects_cash_drawer, '')) IN ('true', 't', '1', 'yes', 'sim') THEN
    NEW.affects_cash_drawer := true;
  ELSIF lower(COALESCE(v_affects_cash_drawer, '')) IN ('false', 'f', '0', 'no', 'nao', 'não') THEN
    NEW.affects_cash_drawer := false;
  END IF;

  IF lower(COALESCE(v_affects_financial_result, '')) IN ('true', 't', '1', 'yes', 'sim') THEN
    NEW.affects_financial_result := true;
  ELSIF lower(COALESCE(v_affects_financial_result, '')) IN ('false', 'f', '0', 'no', 'nao', 'não') THEN
    NEW.affects_financial_result := false;
  END IF;

  IF NEW.account_plan_code IS NOT NULL
     OR NEW.source_financial_account_id IS NOT NULL
     OR NEW.destination_financial_account_id IS NOT NULL
     OR NEW.affects_cash_drawer IS NOT NULL
     OR NEW.affects_financial_result IS NOT NULL THEN
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'classification_applied_at', now(),
      'classification_source', 'cashbook_entry_metadata_trigger',
      'account_plan_code', NEW.account_plan_code,
      'source_financial_account_id', NEW.source_financial_account_id,
      'destination_financial_account_id', NEW.destination_financial_account_id,
      'is_transfer', NEW.is_transfer,
      'affects_cash_drawer', NEW.affects_cash_drawer,
      'affects_financial_result', NEW.affects_financial_result
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cashbook_entry_metadata_classification ON public.cashbook_entries;

CREATE TRIGGER trg_cashbook_entry_metadata_classification
BEFORE INSERT OR UPDATE OF metadata ON public.cashbook_entries
FOR EACH ROW
EXECUTE FUNCTION public.apply_cashbook_entry_metadata_classification();

-- Backfill genérico para lançamentos já existentes com metadata de classificação.
UPDATE public.cashbook_entries
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'classification_backfill_requested_at', now()
)
WHERE metadata ?| ARRAY[
  'account_plan_code',
  'source_financial_account_code',
  'destination_financial_account_code',
  'affects_cash_drawer',
  'affects_financial_result'
];
