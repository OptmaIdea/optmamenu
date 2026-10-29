
CREATE OR REPLACE FUNCTION public.get_cashbook_summary(p_store_id uuid, p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_in numeric := 0;
  v_total_out numeric := 0;
  v_balance numeric := 0;
  v_by_payment jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store_id');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT public.is_store_member(p_store_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'in' AND status = 'confirmed' AND affects_balance = true AND COALESCE(affects_financial_result, true) = true AND COALESCE(is_transfer, false) = false), 0),
    COALESCE(SUM(amount) FILTER (WHERE direction = 'out' AND status = 'confirmed' AND affects_balance = true AND COALESCE(affects_financial_result, true) = true AND COALESCE(is_transfer, false) = false), 0)
  INTO v_total_in, v_total_out
  FROM public.cashbook_entries
  WHERE store_id = p_store_id
    AND entry_date BETWEEN p_start_date AND p_end_date;

  v_balance := v_total_in - v_total_out;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'payment_method_code', payment_method_code,
        'payment_method', payment_method,
        'total_in', total_in,
        'total_out', total_out,
        'balance', total_in - total_out
      )
      ORDER BY payment_method_code
    ),
    '[]'::jsonb
  )
  INTO v_by_payment
  FROM (
    SELECT
      COALESCE(payment_method_code, 'not_informed') AS payment_method_code,
      COALESCE(payment_method, 'Não informado') AS payment_method,
      COALESCE(SUM(amount) FILTER (WHERE direction = 'in' AND status = 'confirmed' AND affects_balance = true AND COALESCE(affects_financial_result, true) = true AND COALESCE(is_transfer, false) = false), 0) AS total_in,
      COALESCE(SUM(amount) FILTER (WHERE direction = 'out' AND status = 'confirmed' AND affects_balance = true AND COALESCE(affects_financial_result, true) = true AND COALESCE(is_transfer, false) = false), 0) AS total_out
    FROM public.cashbook_entries
    WHERE store_id = p_store_id
      AND entry_date BETWEEN p_start_date AND p_end_date
    GROUP BY
      COALESCE(payment_method_code, 'not_informed'),
      COALESCE(payment_method, 'Não informado')
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'total_in', v_total_in,
      'total_out', v_total_out,
      'balance', v_balance,
      'by_payment_method', v_by_payment
    )
  );
END;
$function$;

update public.store_financial_accounts
set name = case
  when code = 'cash_drawer' and lower(name) in ('caixa fisico','caixa físico','cash drawer','cash_drawer') then 'Caixa físico'
  when code = 'card_receivable' and lower(name) in ('recebiveis de cartao','recebíveis de cartão','card receivable','card_receivable') then 'Recebíveis de cartão'
  when code = 'owner' and lower(name) in ('proprietario','proprietário','owner') then 'Proprietário'
  when code = 'optmapay_receivable' and (name is null or btrim(name) = '' or lower(name) = 'optmapay_receivable') then 'Valores a receber — OptmaPay'
  else name
end,
updated_at = now()
where
  (code = 'cash_drawer' and lower(name) in ('caixa fisico','caixa físico','cash drawer','cash_drawer'))
  or (code = 'card_receivable' and lower(name) in ('recebiveis de cartao','recebíveis de cartão','card receivable','card_receivable'))
  or (code = 'owner' and lower(name) in ('proprietario','proprietário','owner'))
  or (code = 'optmapay_receivable' and (name is null or btrim(name) = '' or lower(name) = 'optmapay_receivable'));
