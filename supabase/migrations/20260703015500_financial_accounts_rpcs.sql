-- POS_9 — Financeiro — RPCs seguras para contas financeiras da loja

CREATE OR REPLACE FUNCTION public.list_store_financial_accounts_safe(
  p_store_id uuid,
  p_include_inactive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF v_user_id IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission(p_store_id, 'cashbook.view')
      OR public.user_has_store_permission(p_store_id, 'cashbook.create')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.active DESC, a.sort_order, a.name), '[]'::jsonb)
  INTO v_items
  FROM public.store_financial_accounts a
  WHERE a.store_id = p_store_id
    AND (p_include_inactive OR a.active = true);

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_store_financial_account_safe(
  p_store_id uuid,
  p_account_id uuid DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_account_type text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_is_default boolean DEFAULT false,
  p_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text := lower(regexp_replace(trim(COALESCE(p_code, p_name, '')), '[^a-zA-Z0-9]+', '_', 'g'));
  v_account public.store_financial_accounts%rowtype;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id');
  END IF;

  IF NULLIF(trim(COALESCE(p_name, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_name');
  END IF;

  IF COALESCE(p_account_type, '') NOT IN ('cash_drawer', 'safe', 'bank', 'pix_wallet', 'card_acquirer', 'card_receivable', 'owner', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_account_type');
  END IF;

  IF v_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF v_user_id IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission(p_store_id, 'cashbook.create')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  IF p_is_default THEN
    UPDATE public.store_financial_accounts
    SET is_default = false, updated_at = now()
    WHERE store_id = p_store_id
      AND account_type = p_account_type
      AND (p_account_id IS NULL OR id <> p_account_id);
  END IF;

  IF p_account_id IS NULL THEN
    INSERT INTO public.store_financial_accounts (
      store_id,
      code,
      name,
      account_type,
      description,
      is_default,
      active,
      sort_order,
      metadata
    ) VALUES (
      p_store_id,
      v_code,
      trim(p_name),
      p_account_type,
      NULLIF(trim(COALESCE(p_description, '')), ''),
      COALESCE(p_is_default, false),
      COALESCE(p_active, true),
      COALESCE(p_sort_order, 0),
      COALESCE(p_metadata, '{}'::jsonb)
    )
    ON CONFLICT (store_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      account_type = EXCLUDED.account_type,
      description = EXCLUDED.description,
      is_default = EXCLUDED.is_default,
      active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order,
      metadata = COALESCE(public.store_financial_accounts.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
      updated_at = now()
    RETURNING * INTO v_account;
  ELSE
    UPDATE public.store_financial_accounts
    SET
      code = v_code,
      name = trim(p_name),
      account_type = p_account_type,
      description = NULLIF(trim(COALESCE(p_description, '')), ''),
      is_default = COALESCE(p_is_default, false),
      active = COALESCE(p_active, true),
      sort_order = COALESCE(p_sort_order, sort_order),
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
      updated_at = now()
    WHERE id = p_account_id
      AND store_id = p_store_id
    RETURNING * INTO v_account;

    IF v_account.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'account_not_found');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'account', to_jsonb(v_account));
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_store_financial_account_active_safe(
  p_store_id uuid,
  p_account_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_account public.store_financial_accounts%rowtype;
BEGIN
  IF p_store_id IS NULL OR p_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF v_user_id IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission(p_store_id, 'cashbook.create')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  UPDATE public.store_financial_accounts
  SET active = COALESCE(p_active, true), updated_at = now()
  WHERE id = p_account_id
    AND store_id = p_store_id
  RETURNING * INTO v_account;

  IF v_account.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'account', to_jsonb(v_account));
END;
$function$;

REVOKE ALL ON FUNCTION public.list_store_financial_accounts_safe(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_store_financial_accounts_safe(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_store_financial_accounts_safe(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_store_financial_accounts_safe(uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_store_financial_account_safe(uuid, uuid, text, text, text, text, boolean, boolean, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_store_financial_account_safe(uuid, uuid, text, text, text, text, boolean, boolean, integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_store_financial_account_safe(uuid, uuid, text, text, text, text, boolean, boolean, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_store_financial_account_safe(uuid, uuid, text, text, text, text, boolean, boolean, integer, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.set_store_financial_account_active_safe(uuid, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_store_financial_account_active_safe(uuid, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_store_financial_account_active_safe(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_store_financial_account_active_safe(uuid, uuid, boolean) TO service_role;
