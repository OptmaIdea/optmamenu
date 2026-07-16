-- POS_9 / v0.9.14 — RPC de estorno de transferência recebida V3
-- Correção sobre V2:
-- - remove dependência de public.is_store_member(uuid, uuid), que não existe neste schema;
-- - valida vínculo ativo diretamente em public.store_members.
--
-- Uso: rode este arquivo no SQL Editor do Supabase para substituir a função existente.

CREATE OR REPLACE FUNCTION public.reverse_received_stock_transfer(
  p_transfer_id uuid,
  p_reason text
)
RETURNS TABLE(
  transfer_id uuid,
  transfer_code text,
  status text,
  reversed_at timestamptz,
  total_reversed numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.stock_transfers%ROWTYPE;
  v_item record;
  v_destination_balance numeric;
  v_origin_previous numeric;
  v_origin_new numeric;
  v_destination_previous numeric;
  v_destination_new numeric;
  v_total_reversed numeric := 0;
  v_user_id uuid := auth.uid();
  v_reversed_at timestamptz := now();
BEGIN
  IF p_transfer_id IS NULL THEN
    RAISE EXCEPTION 'Informe a transferência para estorno.';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do estorno.';
  END IF;

  SELECT *
    INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada.';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.store_members sm
    WHERE sm.store_id = v_transfer.store_id
      AND sm.user_id = v_user_id
      AND sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você não tem acesso a esta loja.';
  END IF;

  IF v_transfer.status::text <> 'received' THEN
    RAISE EXCEPTION 'Somente transferências recebidas podem ser estornadas por este fluxo.';
  END IF;

  IF COALESCE((v_transfer.metadata ->> 'reversed')::boolean, false) THEN
    RAISE EXCEPTION 'Esta transferência já foi estornada.';
  END IF;

  PERFORM 1
  FROM public.stock_transfer_items
  WHERE transfer_id = p_transfer_id
  FOR UPDATE;

  FOR v_item IN
    SELECT id, product_id, variant_id, received_qty
    FROM public.stock_transfer_items
    WHERE transfer_id = p_transfer_id
      AND received_qty > 0
    ORDER BY created_at, id
  LOOP
    SELECT COALESCE(on_hand, 0)
      INTO v_destination_balance
    FROM public.inventory_location_balances
    WHERE store_id = v_transfer.store_id
      AND location_id = v_transfer.destination_location_id
      AND product_id = v_item.product_id
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_item.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    FOR UPDATE;

    IF COALESCE(v_destination_balance, 0) < v_item.received_qty THEN
      RAISE EXCEPTION 'Não há saldo suficiente no destino para estornar a transferência. Produto: %, saldo atual: %, necessário: %.',
        v_item.product_id,
        COALESCE(v_destination_balance, 0),
        v_item.received_qty;
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT id, product_id, variant_id, received_qty, unit_cost
    FROM public.stock_transfer_items
    WHERE transfer_id = p_transfer_id
      AND received_qty > 0
    ORDER BY created_at, id
  LOOP
    SELECT COALESCE(on_hand, 0)
      INTO v_destination_previous
    FROM public.inventory_location_balances
    WHERE store_id = v_transfer.store_id
      AND location_id = v_transfer.destination_location_id
      AND product_id = v_item.product_id
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_item.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    FOR UPDATE;

    v_destination_new := COALESCE(v_destination_previous, 0) - v_item.received_qty;

    UPDATE public.inventory_location_balances
    SET on_hand = v_destination_new,
        updated_at = now()
    WHERE store_id = v_transfer.store_id
      AND location_id = v_transfer.destination_location_id
      AND product_id = v_item.product_id
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_item.variant_id, '00000000-0000-0000-0000-000000000000'::uuid);

    INSERT INTO public.stock_movements (
      store_id, product_id, quantity, type, reason, user_id,
      previous_stock, new_stock, affects_physical, source, source_id,
      reason_code, metadata, created_by, location_id,
      from_location_id, to_location_id, transfer_id
    ) VALUES (
      v_transfer.store_id,
      v_item.product_id,
      -v_item.received_qty,
      'exit',
      p_reason,
      v_user_id,
      v_destination_previous,
      v_destination_new,
      true,
      'stock_transfer_reversal',
      v_transfer.id,
      'transfer_received_reversal_destination',
      jsonb_build_object(
        'transfer_id', v_transfer.id,
        'transfer_item_id', v_item.id,
        'transfer_code', v_transfer.transfer_code,
        'reversal_reason', p_reason,
        'reversal_side', 'destination',
        'origin', 'reverse_received_stock_transfer'
      ),
      v_user_id,
      v_transfer.destination_location_id,
      v_transfer.destination_location_id,
      v_transfer.source_location_id,
      v_transfer.id
    );

    INSERT INTO public.inventory_location_balances (
      store_id, location_id, product_id, variant_id, on_hand, reserved, updated_at
    )
    SELECT
      v_transfer.store_id,
      v_transfer.source_location_id,
      v_item.product_id,
      v_item.variant_id,
      0,
      0,
      now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.inventory_location_balances b
      WHERE b.store_id = v_transfer.store_id
        AND b.location_id = v_transfer.source_location_id
        AND b.product_id = v_item.product_id
        AND COALESCE(b.variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_item.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

    SELECT COALESCE(on_hand, 0)
      INTO v_origin_previous
    FROM public.inventory_location_balances
    WHERE store_id = v_transfer.store_id
      AND location_id = v_transfer.source_location_id
      AND product_id = v_item.product_id
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_item.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    FOR UPDATE;

    v_origin_new := COALESCE(v_origin_previous, 0) + v_item.received_qty;

    UPDATE public.inventory_location_balances
    SET on_hand = v_origin_new,
        updated_at = now()
    WHERE store_id = v_transfer.store_id
      AND location_id = v_transfer.source_location_id
      AND product_id = v_item.product_id
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_item.variant_id, '00000000-0000-0000-0000-000000000000'::uuid);

    INSERT INTO public.stock_movements (
      store_id, product_id, quantity, type, reason, user_id,
      previous_stock, new_stock, affects_physical, source, source_id,
      reason_code, metadata, created_by, location_id,
      from_location_id, to_location_id, transfer_id
    ) VALUES (
      v_transfer.store_id,
      v_item.product_id,
      v_item.received_qty,
      'entry',
      p_reason,
      v_user_id,
      v_origin_previous,
      v_origin_new,
      true,
      'stock_transfer_reversal',
      v_transfer.id,
      'transfer_received_reversal_origin',
      jsonb_build_object(
        'transfer_id', v_transfer.id,
        'transfer_item_id', v_item.id,
        'transfer_code', v_transfer.transfer_code,
        'reversal_reason', p_reason,
        'reversal_side', 'origin',
        'origin', 'reverse_received_stock_transfer'
      ),
      v_user_id,
      v_transfer.source_location_id,
      v_transfer.destination_location_id,
      v_transfer.source_location_id,
      v_transfer.id
    );

    v_total_reversed := v_total_reversed + v_item.received_qty;
  END LOOP;

  IF v_total_reversed <= 0 THEN
    RAISE EXCEPTION 'A transferência não possui quantidade recebida para estornar.';
  END IF;

  UPDATE public.stock_transfer_items
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'reversed', true,
        'reversed_at', v_reversed_at,
        'reversed_by', v_user_id,
        'reversal_reason', p_reason
      ),
      updated_at = now()
  WHERE transfer_id = p_transfer_id;

  UPDATE public.stock_transfers
  SET status = 'cancelled'::public.stock_transfer_status,
      cancelled_at = v_reversed_at,
      cancel_reason = p_reason,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'reversed', true,
        'reversed_at', v_reversed_at,
        'reversed_by', v_user_id,
        'reversal_reason', p_reason,
        'previous_status', v_transfer.status::text,
        'reversal_kind', 'received_transfer_reversal',
        'total_reversed', v_total_reversed
      ),
      updated_at = now()
  WHERE id = p_transfer_id;

  RETURN QUERY
  SELECT v_transfer.id,
         v_transfer.transfer_code,
         'cancelled'::text,
         v_reversed_at,
         v_total_reversed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_received_stock_transfer(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.reverse_received_stock_transfer(uuid, text)
IS 'Estorna transferência recebida: remove do destino, devolve para origem, registra movimentos inversos e preserva histórico. V3 usa store_members para validar vínculo ativo.';
