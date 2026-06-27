-- Fase 9.14D — Hardening pontual de funções públicas intencionais
--
-- Objetivo:
-- Manter públicas as funções necessárias ao fluxo de loja/cliente,
-- mas reduzir exposição de dados e exigir loja pública habilitada onde faltava.
--
-- Ajustes:
-- - get_store_by_slug: exige public_store_enabled=true;
-- - customer_login_with_password: exige loja pública e retorna payload reduzido;
-- - send_customer_otp: exige loja pública;
-- - verify_customer_otp: exige loja pública e retorna payload reduzido;
-- - get_public_customer_loyalty_by_phone: reduz payload público;
-- - cancel_reserved_public_order: revoga anon/PUBLIC, pois a função bloqueia anon no corpo.

BEGIN;

-- =========================================================
-- get_store_by_slug: restringe a lojas públicas
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_store_by_slug(p_slug text)
RETURNS TABLE(
  id uuid,
  slug text,
  name text,
  description text,
  logo_url text,
  phone_number text,
  theme_config jsonb,
  address jsonb,
  contacts jsonb,
  config jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    s.id,
    s.slug,
    s.name,
    s.description,
    s.logo_url,
    s.phone_number,
    s.theme_config,
    s.address,
    s.contacts,
    s.config
  FROM public.stores s
  WHERE lower(trim(s.slug)) = lower(trim(p_slug))
    AND s.public_store_enabled = true
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_store_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_store_by_slug(text) TO service_role;

-- =========================================================
-- customer_login_with_password: loja pública + payload reduzido
-- =========================================================

CREATE OR REPLACE FUNCTION public.customer_login_with_password(
  p_phone text,
  p_password text,
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_phone text;
  v_customer public.customers%rowtype;
  v_customer_json jsonb;
BEGIN
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('customer', null);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = p_store_id
      AND s.public_store_enabled = true
  ) THEN
    RETURN jsonb_build_object('customer', null);
  END IF;

  IF length(v_phone) < 10 OR length(v_phone) > 14 THEN
    RETURN jsonb_build_object('customer', null);
  END IF;

  IF length(coalesce(p_password, '')) < 4 THEN
    RETURN jsonb_build_object('customer', null);
  END IF;

  SELECT c.*
    INTO v_customer
  FROM public.customers c
  WHERE c.phone = v_phone
    AND c.store_id = p_store_id
    AND COALESCE(c.status, 'active') = 'active'
    AND c.password_hash IS NOT NULL
    AND c.password_hash = crypt(p_password, c.password_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('customer', null);
  END IF;

  v_customer_json := jsonb_build_object(
    'id', v_customer.id,
    'store_id', v_customer.store_id,
    'full_name', v_customer.full_name,
    'phone', v_customer.phone,
    'is_whatsapp', COALESCE(v_customer.is_whatsapp, false),
    'contact_preference', v_customer.contact_preference,
    'loyalty_points', COALESCE(v_customer.loyalty_points, 0),
    'loyalty_tier', COALESCE(v_customer.loyalty_tier, 'Bronze'),
    'current_tier_id', v_customer.current_tier_id,
    'loyalty_opt_in', COALESCE(v_customer.loyalty_opt_in, false),
    'status', COALESCE(v_customer.status, 'active')
  );

  RETURN jsonb_build_object('customer', v_customer_json);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.customer_login_with_password(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_login_with_password(text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_login_with_password(text, text, uuid) TO service_role;

-- =========================================================
-- send_customer_otp: exige loja pública
-- =========================================================

CREATE OR REPLACE FUNCTION public.send_customer_otp(p_phone text, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_phone text;
  v_otp text;
  v_hash text;
  v_expires_at timestamptz;
  v_recent_count integer;
BEGIN
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível enviar o código.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = p_store_id
      AND s.public_store_enabled = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Não foi possível enviar o código.');
  END IF;

  IF length(v_phone) < 10 OR length(v_phone) > 14 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Telefone inválido.');
  END IF;

  SELECT COUNT(*)
    INTO v_recent_count
  FROM public.customer_otps co
  WHERE co.store_id = p_store_id
    AND co.phone = v_phone
    AND co.created_at >= now() - interval '10 minutes';

  IF v_recent_count >= 3 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'rateLimited', true,
      'message', 'Muitas tentativas recentes. Aguarde alguns minutos.'
    );
  END IF;

  v_expires_at := now() + interval '5 minutes';
  v_otp := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_hash := crypt(v_otp, gen_salt('bf'));

  DELETE FROM public.customer_otps
  WHERE phone = v_phone
    AND store_id = p_store_id
    AND verified = false;

  INSERT INTO public.customer_otps (
    phone,
    store_id,
    otp_code,
    expires_at,
    verified,
    attempts
  )
  VALUES (
    v_phone,
    p_store_id,
    v_hash,
    v_expires_at,
    false,
    0
  );

  RETURN jsonb_build_object(
    'ok', true,
    'expiresAt', v_expires_at
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_customer_otp(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_customer_otp(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.send_customer_otp(text, uuid) TO service_role;

-- =========================================================
-- verify_customer_otp: loja pública + payload reduzido
-- =========================================================

CREATE OR REPLACE FUNCTION public.verify_customer_otp(
  p_phone text,
  p_otp text,
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_phone text;
  v_otp text;
  v_row public.customer_otps%rowtype;
  v_customer public.customers%rowtype;
  v_is_new boolean := true;
  v_customer_json jsonb;
BEGIN
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_otp := regexp_replace(coalesce(p_otp, ''), '\D', '', 'g');

  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = p_store_id
      AND s.public_store_enabled = true
  ) THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  IF length(v_phone) < 10 OR length(v_phone) > 14 THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  IF length(v_otp) <> 6 THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  SELECT *
    INTO v_row
  FROM public.customer_otps
  WHERE phone = v_phone
    AND store_id = p_store_id
    AND verified = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  IF v_row.attempts >= 5 THEN
    RETURN jsonb_build_object(
      'isValid', false,
      'locked', true
    );
  END IF;

  UPDATE public.customer_otps
  SET attempts = attempts + 1
  WHERE id = v_row.id;

  IF crypt(v_otp, v_row.otp_code) <> v_row.otp_code THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  UPDATE public.customer_otps
  SET verified = true
  WHERE id = v_row.id;

  SELECT *
    INTO v_customer
  FROM public.customers
  WHERE phone = v_phone
    AND store_id = p_store_id
    AND COALESCE(status, 'active') = 'active'
  LIMIT 1;

  IF FOUND THEN
    v_is_new := false;
    v_customer_json := jsonb_build_object(
      'id', v_customer.id,
      'store_id', v_customer.store_id,
      'full_name', v_customer.full_name,
      'phone', v_customer.phone,
      'is_whatsapp', COALESCE(v_customer.is_whatsapp, false),
      'contact_preference', v_customer.contact_preference,
      'loyalty_points', COALESCE(v_customer.loyalty_points, 0),
      'loyalty_tier', COALESCE(v_customer.loyalty_tier, 'Bronze'),
      'current_tier_id', v_customer.current_tier_id,
      'loyalty_opt_in', COALESCE(v_customer.loyalty_opt_in, false),
      'status', COALESCE(v_customer.status, 'active')
    );

    RETURN jsonb_build_object(
      'isValid', true,
      'isNewUser', v_is_new,
      'customer', v_customer_json
    );
  END IF;

  RETURN jsonb_build_object(
    'isValid', true,
    'isNewUser', v_is_new,
    'customer', null
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_customer_otp(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_customer_otp(text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_customer_otp(text, text, uuid) TO service_role;

-- =========================================================
-- get_public_customer_loyalty_by_phone: payload reduzido
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_public_customer_loyalty_by_phone(
  p_slug text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
  v_phone text;
  v_customer record;
  v_program record;
  v_current_tier record;
  v_next_tier record;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_slug');
  END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  IF length(v_phone) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone');
  END IF;

  SELECT s.id
  INTO v_store_id
  FROM public.stores s
  WHERE s.slug = lower(trim(p_slug))
    AND s.public_store_enabled = true
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  END IF;

  SELECT
    c.loyalty_points,
    c.loyalty_tier,
    c.current_tier_id,
    c.loyalty_opt_in,
    c.last_point_activity_at,
    c.phone
  INTO v_customer
  FROM public.customers c
  WHERE c.store_id = v_store_id
    AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = v_phone
    AND COALESCE(c.status, 'active') = 'active'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_customer.phone IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'found', false,
      'message', 'Cliente ainda não encontrado para este WhatsApp.',
      'loyalty', NULL
    );
  END IF;

  SELECT
    fp.id,
    fp.name,
    COALESCE(fp.is_active, false) AS is_active,
    COALESCE(fp.points_per_currency, 1) AS points_per_currency,
    COALESCE(fp.min_points_redemption, 0) AS min_points_redemption,
    COALESCE(fp.points_validity_months, 12) AS points_validity_months
  INTO v_program
  FROM public.fidelity_programs fp
  WHERE fp.store_id = v_store_id
    AND fp.is_active = true
  LIMIT 1;

  SELECT
    ft.id,
    ft.name,
    ft.min_points,
    ft.multiplier,
    ft.color,
    ft.position
  INTO v_current_tier
  FROM public.fidelity_tiers ft
  WHERE ft.store_id = v_store_id
    AND ft.min_points <= COALESCE(v_customer.loyalty_points, 0)
  ORDER BY ft.min_points DESC
  LIMIT 1;

  SELECT
    ft.id,
    ft.name,
    ft.min_points,
    ft.multiplier,
    ft.color,
    ft.position
  INTO v_next_tier
  FROM public.fidelity_tiers ft
  WHERE ft.store_id = v_store_id
    AND ft.min_points > COALESCE(v_customer.loyalty_points, 0)
  ORDER BY ft.min_points ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'found', true,
    'loyalty', jsonb_build_object(
      'customer', jsonb_build_object(
        'phone_last4', right(v_customer.phone, 4),
        'loyalty_opt_in', COALESCE(v_customer.loyalty_opt_in, false),
        'last_point_activity_at', v_customer.last_point_activity_at
      ),
      'program', jsonb_build_object(
        'id', v_program.id,
        'name', v_program.name,
        'is_active', COALESCE(v_program.is_active, false),
        'points_per_currency', COALESCE(v_program.points_per_currency, 1),
        'min_points_redemption', COALESCE(v_program.min_points_redemption, 0),
        'points_validity_months', COALESCE(v_program.points_validity_months, 12)
      ),
      'points', COALESCE(v_customer.loyalty_points, 0),
      'current_tier', CASE
        WHEN v_current_tier.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', v_current_tier.id,
          'name', v_current_tier.name,
          'min_points', v_current_tier.min_points,
          'multiplier', v_current_tier.multiplier,
          'color', v_current_tier.color,
          'position', v_current_tier.position
        )
      END,
      'next_tier', CASE
        WHEN v_next_tier.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', v_next_tier.id,
          'name', v_next_tier.name,
          'min_points', v_next_tier.min_points,
          'points_to_next_tier', GREATEST(0, v_next_tier.min_points - COALESCE(v_customer.loyalty_points, 0)),
          'multiplier', v_next_tier.multiplier,
          'color', v_next_tier.color,
          'position', v_next_tier.position
        )
      END,
      'recent_transactions', '[]'::jsonb
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_public_customer_loyalty_by_phone(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_customer_loyalty_by_phone(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_customer_loyalty_by_phone(text, text) TO service_role;

-- =========================================================
-- cancel_reserved_public_order: remove exposição anon
-- =========================================================

REVOKE EXECUTE ON FUNCTION public.cancel_reserved_public_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_reserved_public_order(uuid, text) TO service_role;

COMMIT;
