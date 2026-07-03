-- POS_9 — Financeiro — resolução de ocorrência com reposição no caixa
--
-- Regra:
-- - o fechamento original não é alterado;
-- - a ocorrência é resolvida;
-- - se houver reposição financeira, cria entrada no Livro Diário atual;
-- - a entrada fica vinculada à ocorrência e ao fechamento via metadata.

CREATE OR REPLACE FUNCTION public.resolve_cashbook_closing_occurrence_safe(
  p_store_id uuid,
  p_occurrence_id uuid,
  p_status text,
  p_resolution_type text,
  p_resolution_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_saved public.cashbook_closing_occurrences%rowtype;
  v_status text := COALESCE(NULLIF(trim(p_status), ''), 'resolved');
  v_financial_effect text := COALESCE(NULLIF(trim(COALESCE(p_metadata ->> 'financial_effect', '')), ''), 'none');
  v_replenishment_amount numeric(14,2) := NULL;
  v_payment_method_code text := COALESCE(NULLIF(trim(COALESCE(p_metadata ->> 'payment_method_code', '')), ''), 'cash');
  v_occurred_at timestamptz := COALESCE(NULLIF(trim(COALESCE(p_metadata ->> 'occurred_at', '')), '')::timestamptz, now());
  v_cashbook_result jsonb := NULL;
BEGIN
  IF p_store_id IS NULL OR p_occurrence_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  END IF;

  IF v_status NOT IN ('waiting_external_confirmation', 'under_review', 'resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF v_status IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment')
     AND NULLIF(trim(COALESCE(p_resolution_notes, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resolution_notes_required', 'message', 'Informe uma observacao para resolver a ocorrencia.');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF v_user_id IS NULL
       OR NOT (
         public.app_is_store_owner(p_store_id)
         OR public.user_has_store_permission(p_store_id, 'cashbook.create')
       ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  SELECT *
  INTO v_saved
  FROM public.cashbook_closing_occurrences
  WHERE id = p_occurrence_id
    AND store_id = p_store_id
  FOR UPDATE;

  IF v_saved.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'occurrence_not_found');
  END IF;

  IF v_financial_effect = 'cash_replenishment' THEN
    IF v_status <> 'resolved' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'cash_replenishment_requires_resolved_status',
        'message', 'Reposicao de valor exige status resolvida.'
      );
    END IF;

    IF v_saved.divergence_type <> 'shortage' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'cash_replenishment_only_for_shortage',
        'message', 'Reposicao de valor so se aplica a divergencia por falta.'
      );
    END IF;

    IF COALESCE(v_saved.metadata ->> 'replenishment_cashbook_created', 'false') = 'true' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'cash_replenishment_already_created',
        'message', 'Esta ocorrencia ja possui reposicao financeira registrada.'
      );
    END IF;

    v_replenishment_amount := COALESCE(
      NULLIF(trim(COALESCE(p_metadata ->> 'replenishment_amount', '')), '')::numeric,
      abs(COALESCE(v_saved.difference_total, 0))
    );

    IF v_replenishment_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_replenishment_amount');
    END IF;

    IF v_replenishment_amount > abs(COALESCE(v_saved.difference_total, 0)) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'replenishment_amount_greater_than_difference',
        'message', 'O valor reposto nao pode ser maior que a diferenca da ocorrencia.'
      );
    END IF;

    SELECT public.create_cashbook_entry(
      p_store_id := p_store_id,
      p_type := 'manual_income',
      p_direction := 'in',
      p_amount := v_replenishment_amount,
      p_description := 'Reposicao de divergencia de fechamento ' || to_char(v_saved.closing_date, 'DD/MM/YYYY'),
      p_payment_method_code := v_payment_method_code,
      p_notes := p_resolution_notes,
      p_occurred_at := v_occurred_at,
      p_metadata := jsonb_build_object(
        'source', 'cashbook_closing_occurrence_resolution',
        'financial_effect', 'cash_replenishment',
        'occurrence_id', v_saved.id,
        'closing_id', v_saved.closing_id,
        'closing_date', v_saved.closing_date,
        'difference_total', v_saved.difference_total,
        'replenishment_amount', v_replenishment_amount,
        'resolved_by', v_user_id
      )
    ) INTO v_cashbook_result;
  END IF;

  UPDATE public.cashbook_closing_occurrences
  SET
    status = v_status,
    resolution_type = NULLIF(trim(COALESCE(p_resolution_type, '')), ''),
    resolution_notes = NULLIF(trim(COALESCE(p_resolution_notes, '')), ''),
    resolved_by = CASE WHEN v_status IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment') THEN v_user_id ELSE resolved_by END,
    resolved_at = CASE WHEN v_status IN ('resolved', 'cancelled', 'converted_to_loss', 'converted_to_adjustment') THEN now() ELSE resolved_at END,
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'last_resolution_update_at', now(),
        'last_resolution_update_by', v_user_id,
        'last_resolution_metadata', COALESCE(p_metadata, '{}'::jsonb)
      )
      || CASE WHEN v_cashbook_result IS NOT NULL THEN jsonb_build_object(
        'replenishment_cashbook_created', true,
        'replenishment_cashbook_created_at', now(),
        'replenishment_cashbook_result', v_cashbook_result,
        'replenishment_amount', v_replenishment_amount,
        'replenishment_payment_method_code', v_payment_method_code
      ) ELSE '{}'::jsonb END,
    updated_at = now()
  WHERE id = p_occurrence_id
    AND store_id = p_store_id
  RETURNING * INTO v_saved;

  RETURN jsonb_build_object(
    'ok', true,
    'occurrence', to_jsonb(v_saved),
    'cashbook_result', v_cashbook_result
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', SQLERRM);
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_cashbook_closing_occurrence_safe(uuid, uuid, text, text, text, jsonb) TO service_role;
