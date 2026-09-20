CREATE OR REPLACE FUNCTION public.customer_login_with_password(p_phone text, p_password text, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_norm jsonb;
  v_match text;
  v_customer record;
  v_failed_attempts integer;
BEGIN
  IF p_store_id IS NULL OR length(coalesce(p_password, '')) < 4 THEN
    RETURN jsonb_build_object('customer', NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = p_store_id
      AND s.public_store_enabled = true
  ) THEN
    RETURN jsonb_build_object('customer', NULL);
  END IF;

  v_norm := public.normalize_br_customer_phone(p_phone);
  v_match := nullif(v_norm->>'match_key', '');
  IF v_match IS NULL OR coalesce((v_norm->>'valid')::boolean, false) = false THEN
    RETURN jsonb_build_object('customer', NULL);
  END IF;

  SELECT
    c.id, c.store_id, c.full_name, c.nickname, c.phone, c.email, c.cpf, c.birth_date,
    c.is_whatsapp, c.contact_preference, c.loyalty_points, c.loyalty_tier,
    c.current_tier_id, c.loyalty_opt_in, c.marketing_consent, c.email_verified,
    c.status, c.person_type, c.phone_verified_at,
    cr.password_hash, cr.failed_attempts, cr.locked_until
  INTO v_customer
  FROM public.customers c
  JOIN public.customer_credentials cr ON cr.customer_id = c.id
  WHERE c.store_id = p_store_id
    AND c.phone_match_key = v_match
    AND c.status = 'active'
  LIMIT 1
  FOR UPDATE OF c, cr;

  IF NOT FOUND OR v_customer.password_hash IS NULL THEN
    RETURN jsonb_build_object('customer', NULL);
  END IF;

  IF v_customer.locked_until IS NOT NULL AND v_customer.locked_until > now() THEN
    RETURN jsonb_build_object('customer', NULL);
  END IF;

  IF v_customer.password_hash <> crypt(p_password, v_customer.password_hash) THEN
    v_failed_attempts := coalesce(v_customer.failed_attempts, 0) + 1;

    UPDATE public.customer_credentials
    SET
      failed_attempts = v_failed_attempts,
      locked_until = CASE
        WHEN v_failed_attempts >= 5 THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      updated_at = now()
    WHERE customer_id = v_customer.id;

    RETURN jsonb_build_object('customer', NULL);
  END IF;

  UPDATE public.customers
  SET
    last_login = now(),
    identity_verified_at = coalesce(identity_verified_at, now())
  WHERE id = v_customer.id
    AND store_id = p_store_id;

  UPDATE public.customer_credentials
  SET failed_attempts = 0, locked_until = NULL, updated_at = now()
  WHERE customer_id = v_customer.id;

  RETURN jsonb_build_object('customer', jsonb_build_object(
    'id', v_customer.id,
    'store_id', v_customer.store_id,
    'full_name', v_customer.full_name,
    'nickname', v_customer.nickname,
    'phone', v_customer.phone,
    'email', v_customer.email,
    'cpf', v_customer.cpf,
    'birth_date', v_customer.birth_date,
    'is_whatsapp', coalesce(v_customer.is_whatsapp, false),
    'contact_preference', v_customer.contact_preference,
    'loyalty_points', coalesce(v_customer.loyalty_points, 0),
    'loyalty_tier', coalesce(v_customer.loyalty_tier, 'Bronze'),
    'current_tier_id', v_customer.current_tier_id,
    'loyalty_opt_in', coalesce(v_customer.loyalty_opt_in, false),
    'marketing_consent', coalesce(v_customer.marketing_consent, false),
    'email_verified', coalesce(v_customer.email_verified, false),
    'status', v_customer.status,
    'person_type', v_customer.person_type,
    'phone_verified', v_customer.phone_verified_at IS NOT NULL
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_customer_otp(p_phone text, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_norm jsonb;
  v_phone text;
  v_entropy bytea;
  v_random_number bigint;
  v_otp text;
  v_hash text;
  v_expires_at timestamptz;
  v_recent_count integer;
BEGIN
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

  v_norm := public.normalize_br_customer_phone(p_phone);
  IF coalesce((v_norm->>'valid')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Telefone inválido.');
  END IF;

  v_phone := nullif(v_norm->>'e164', '');
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Telefone inválido.');
  END IF;

  SELECT count(*)
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

  -- Invalida códigos anteriores sem apagar o histórico necessário ao rate limit.
  UPDATE public.customer_otps
  SET
    used = true,
    consumed_at = coalesce(consumed_at, now())
  WHERE phone = v_phone
    AND store_id = p_store_id
    AND coalesce(verified, false) = false
    AND coalesce(used, false) = false;

  v_expires_at := now() + interval '5 minutes';

  -- Geração criptograficamente forte; evita o PRNG não criptográfico random().
  v_entropy := gen_random_bytes(4);
  v_random_number :=
      get_byte(v_entropy, 0)::bigint * 16777216
    + get_byte(v_entropy, 1)::bigint * 65536
    + get_byte(v_entropy, 2)::bigint * 256
    + get_byte(v_entropy, 3)::bigint;
  v_otp := lpad((v_random_number % 1000000)::text, 6, '0');
  v_hash := crypt(v_otp, gen_salt('bf'));

  INSERT INTO public.customer_otps (
    phone,
    store_id,
    otp_code,
    otp_hash,
    expires_at,
    verified,
    attempts,
    used,
    last_sent_at,
    purpose,
    metadata
  )
  VALUES (
    v_phone,
    p_store_id,
    v_hash,
    v_hash,
    v_expires_at,
    false,
    0,
    false,
    now(),
    'login',
    jsonb_build_object('generator', 'pgcrypto_gen_random_bytes')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'expiresAt', v_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_customer_otp(p_phone text, p_otp text, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_norm jsonb;
  v_match text;
  v_phone text;
  v_otp text;
  v_hash text;
  v_row public.customer_otps%rowtype;
  v_customer public.customers%rowtype;
  v_is_new boolean := true;
  v_customer_json jsonb;
  v_next_attempts integer;
BEGIN
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

  v_norm := public.normalize_br_customer_phone(p_phone);
  IF coalesce((v_norm->>'valid')::boolean, false) = false THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  v_phone := nullif(v_norm->>'e164', '');
  v_match := nullif(v_norm->>'match_key', '');
  v_otp := regexp_replace(coalesce(p_otp, ''), '\D', '', 'g');

  IF v_phone IS NULL OR v_match IS NULL OR length(v_otp) <> 6 THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  SELECT *
  INTO v_row
  FROM public.customer_otps
  WHERE phone = v_phone
    AND store_id = p_store_id
    AND coalesce(verified, false) = false
    AND coalesce(used, false) = false
    AND purpose = 'login'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('isValid', false);
  END IF;

  IF v_row.attempts >= 5 THEN
    UPDATE public.customer_otps
    SET used = true, consumed_at = coalesce(consumed_at, now())
    WHERE id = v_row.id;

    RETURN jsonb_build_object('isValid', false, 'locked', true);
  END IF;

  v_hash := coalesce(v_row.otp_hash, v_row.otp_code);
  v_next_attempts := v_row.attempts + 1;

  IF v_hash IS NULL OR crypt(v_otp, v_hash) <> v_hash THEN
    UPDATE public.customer_otps
    SET
      attempts = v_next_attempts,
      used = CASE WHEN v_next_attempts >= 5 THEN true ELSE used END,
      consumed_at = CASE
        WHEN v_next_attempts >= 5 THEN coalesce(consumed_at, now())
        ELSE consumed_at
      END
    WHERE id = v_row.id;

    RETURN jsonb_build_object(
      'isValid', false,
      'locked', v_next_attempts >= 5
    );
  END IF;

  UPDATE public.customer_otps
  SET
    attempts = v_next_attempts,
    verified = true,
    used = true,
    verified_at = now(),
    consumed_at = now()
  WHERE id = v_row.id;

  SELECT *
  INTO v_customer
  FROM public.customers
  WHERE phone_match_key = v_match
    AND store_id = p_store_id
    AND coalesce(status, 'active') = 'active'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_is_new := false;

    UPDATE public.customers
    SET
      phone_verified_at = coalesce(phone_verified_at, now()),
      identity_verified_at = coalesce(identity_verified_at, now())
    WHERE id = v_customer.id
      AND store_id = p_store_id;

    v_customer_json := jsonb_build_object(
      'id', v_customer.id,
      'store_id', v_customer.store_id,
      'full_name', v_customer.full_name,
      'phone', v_customer.phone,
      'is_whatsapp', coalesce(v_customer.is_whatsapp, false),
      'contact_preference', v_customer.contact_preference,
      'loyalty_points', coalesce(v_customer.loyalty_points, 0),
      'loyalty_tier', coalesce(v_customer.loyalty_tier, 'Bronze'),
      'current_tier_id', v_customer.current_tier_id,
      'loyalty_opt_in', coalesce(v_customer.loyalty_opt_in, false),
      'status', coalesce(v_customer.status, 'active')
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
    'customer', NULL
  );
END;
$function$;
