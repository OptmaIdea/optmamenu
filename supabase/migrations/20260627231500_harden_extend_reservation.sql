-- Fase 9.14E.3 — Hardening de public.extend_reservation
--
-- Objetivo:
-- Manter compatibilidade com o frontend/admin atual, mas reforçar o corpo da função.
--
-- Mantém:
-- - mesmo nome;
-- - mesmos argumentos;
-- - RETURNS void;
-- - EXECUTE para authenticated.
--
-- Reforça:
-- - auth.uid();
-- - vínculo com loja;
-- - status do pedido;
-- - limite de minutos;
-- - atualização apenas de reservas ativas do pedido/loja.

BEGIN;

CREATE OR REPLACE FUNCTION public.extend_reservation(
  p_order_id uuid,
  p_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order record;
  v_minutes integer;
  v_updated_count integer := 0;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não informado.';
  END IF;

  v_minutes := COALESCE(p_minutes, 0);

  IF v_minutes < 1 OR v_minutes > 120 THEN
    RAISE EXCEPTION 'Tempo de prorrogação inválido. Informe entre 1 e 120 minutos.';
  END IF;

  SELECT
    o.id,
    o.store_id,
    o.status,
    o.order_code
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT public.is_store_member(v_order.store_id) THEN
      RAISE EXCEPTION 'Acesso negado ao pedido informado.';
    END IF;
  END IF;

  IF v_order.status::text NOT IN ('reserved', 'confirmed') THEN
    RAISE EXCEPTION 'Apenas pedidos reservados ou confirmados podem ter reserva prorrogada. Status atual: %.', v_order.status;
  END IF;

  UPDATE public.stock_reservations sr
  SET
    expires_at = GREATEST(sr.expires_at, now()) + (v_minutes || ' minutes')::interval,
    metadata = COALESCE(sr.metadata, '{}'::jsonb) || jsonb_build_object(
      'extended_at', now(),
      'extended_by', auth.uid(),
      'extended_minutes', v_minutes,
      'extended_by_function', 'extend_reservation'
    )
  WHERE sr.order_id = v_order.id
    AND sr.store_id = v_order.store_id
    AND sr.status = 'active';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <= 0 THEN
    RAISE EXCEPTION 'Reserva ativa não encontrada para o pedido informado.';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.extend_reservation(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid, integer) TO service_role;

COMMIT;
