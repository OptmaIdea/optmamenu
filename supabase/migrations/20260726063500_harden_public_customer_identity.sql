-- Harden customer identity created or reused by the public-order flow.
-- Public checkout data identifies an order, but does not prove ownership of an
-- existing customer profile. New public customers are customer-owned and
-- protected from store-side edits of personal data.

DO $$
BEGIN
  IF to_regprocedure('public.create_public_order_by_slug_legacy_internal(text,text,text,text,text,jsonb,jsonb,text,text,text,text)') IS NULL THEN
    ALTER FUNCTION public.create_public_order_by_slug(
      text, text, text, text, text, jsonb, jsonb, text, text, text, text
    ) RENAME TO create_public_order_by_slug_legacy_internal;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_public_customer_identity_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text := nullif(current_setting('app.customer_identity_source', true), '');
BEGIN
  IF v_source IS NULL OR v_source NOT IN ('public_store', 'whatsapp', 'qr_table') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.source := v_source;
    NEW.data_ownership := 'customer_owned';
    NEW.editable_by_store := false;
    NEW.marketing_consent := false;
    NEW.loyalty_opt_in := false;
    NEW.customer_metadata := coalesce(NEW.customer_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'created_by_source', 'create_public_order_by_slug',
        'public_identity_source', v_source,
        'created_at', now(),
        'protected_customer_data', true
      );
    RETURN NEW;
  END IF;

  -- A public checkout is not proof of identity. Preserve all personal and
  -- consent fields when an existing phone is reused by a public order.
  NEW.full_name := OLD.full_name;
  NEW.phone := OLD.phone;
  NEW.email := OLD.email;
  NEW.cpf := OLD.cpf;
  NEW.birth_date := OLD.birth_date;
  NEW.nickname := OLD.nickname;
  NEW.password_hash := OLD.password_hash;
  NEW.contact_preference := OLD.contact_preference;
  NEW.marketing_consent := OLD.marketing_consent;
  NEW.loyalty_opt_in := OLD.loyalty_opt_in;
  NEW.source := OLD.source;
  NEW.data_ownership := OLD.data_ownership;
  NEW.editable_by_store := OLD.editable_by_store;
  NEW.last_login := OLD.last_login;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_public_customer_identity_context ON public.customers;
CREATE TRIGGER trg_enforce_public_customer_identity_context
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_public_customer_identity_context();

CREATE OR REPLACE FUNCTION public.create_public_order_by_slug(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_type text,
  p_sales_channel text,
  p_items jsonb,
  p_delivery_address jsonb DEFAULT '{}'::jsonb,
  p_table_code text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_payment_method_code text DEFAULT 'pending',
  p_delivery_method_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_canonical_slug text;
  v_identity_source text;
BEGIN
  v_store_id := public.resolve_public_store_slug(p_slug);

  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  END IF;

  SELECT s.slug
  INTO v_canonical_slug
  FROM public.stores s
  WHERE s.id = v_store_id
    AND s.public_store_enabled = true;

  IF v_canonical_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  END IF;

  v_identity_source := CASE
    WHEN p_sales_channel IN ('public_store', 'whatsapp', 'qr_table') THEN p_sales_channel
    ELSE 'public_store'
  END;

  PERFORM set_config('app.customer_identity_source', v_identity_source, true);

  RETURN public.create_public_order_by_slug_legacy_internal(
    v_canonical_slug,
    p_customer_name,
    p_customer_phone,
    p_fulfillment_type,
    p_sales_channel,
    p_items,
    p_delivery_address,
    p_table_code,
    p_notes,
    p_payment_method_code,
    p_delivery_method_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order_by_slug_legacy_internal(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_public_order_by_slug(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text
) TO anon, authenticated, service_role;

-- Reclassify only records demonstrably created together with their first
-- public order. The legacy customers.created_at default produced a three-hour
-- displacement, so both direct and corrected differences are considered.
WITH first_public_order AS (
  SELECT DISTINCT ON (o.customer_id)
    o.customer_id,
    o.created_at AS first_public_order_at,
    CASE
      WHEN o.sales_channel IN ('public_store', 'whatsapp', 'qr_table') THEN o.sales_channel
      ELSE 'public_store'
    END AS identity_source
  FROM public.orders o
  WHERE o.customer_id IS NOT NULL
    AND coalesce(o.metadata->>'source', '') = 'public_order_rpc'
  ORDER BY o.customer_id, o.created_at
), candidates AS (
  SELECT c.id, fpo.identity_source, fpo.first_public_order_at
  FROM public.customers c
  JOIN first_public_order fpo ON fpo.customer_id = c.id
  WHERE c.source = 'admin'
    AND c.data_ownership = 'store_managed'
    AND c.editable_by_store = true
    AND (
      coalesce(c.customer_metadata, '{}'::jsonb) = '{}'::jsonb
      OR c.customer_metadata->>'classified_by' = 'customer_identity_hardening_20260726'
    )
    AND least(
      abs(extract(epoch FROM (fpo.first_public_order_at - c.created_at))),
      abs(extract(epoch FROM (fpo.first_public_order_at - (c.created_at - interval '3 hours')))),
      abs(extract(epoch FROM (fpo.first_public_order_at - (c.created_at + interval '3 hours'))))
    ) <= 300
)
UPDATE public.customers c
SET source = candidates.identity_source,
    data_ownership = 'customer_owned',
    editable_by_store = false,
    marketing_consent = false,
    customer_metadata = coalesce(c.customer_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'classified_by', 'customer_identity_hardening_20260726',
        'classified_at', now(),
        'first_public_order_at', candidates.first_public_order_at,
        'protected_customer_data', true,
        'classification_finalized_at', now(),
        'classification_finalized_by', 'harden_public_customer_identity'
      )
FROM candidates
WHERE c.id = candidates.id;

COMMENT ON FUNCTION public.create_public_order_by_slug(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text
) IS 'Public order facade: resolves slug aliases and protects customer-owned identity data.';
