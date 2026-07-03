-- POS_9 — Financeiro — plano simples de categorias

INSERT INTO public.cashbook_account_plan (code, name, kind, affects_cash_drawer, affects_financial_result, is_transfer, sort_order)
VALUES
  ('sale_cash', 'Venda em dinheiro', 'income', true, true, false, 10),
  ('sale_pix', 'Venda Pix', 'income', false, true, false, 20),
  ('sale_debit', 'Venda debito', 'income', false, true, false, 30),
  ('sale_credit', 'Venda credito', 'income', false, true, false, 40),
  ('pending_payment_received', 'Recebimento pendente', 'income', false, true, false, 50),
  ('closing_replenishment', 'Reposicao de divergencia', 'income', true, false, false, 60),
  ('change_float_reinforcement', 'Reforco de troco', 'adjustment', true, false, false, 70),
  ('owner_contribution', 'Aporte do proprietario', 'adjustment', true, false, false, 80),
  ('positive_adjustment', 'Ajuste positivo', 'adjustment', true, false, false, 90),
  ('operational_expense', 'Despesa operacional', 'expense', true, true, false, 110),
  ('small_purchase', 'Compra pequena', 'expense', true, true, false, 120),
  ('refund', 'Devolucao', 'expense', true, true, false, 130),
  ('negative_adjustment', 'Ajuste negativo', 'adjustment', true, false, false, 140),
  ('assumed_loss', 'Perda assumida', 'expense', true, true, false, 150),
  ('transfer_cash_to_safe', 'Caixa para cofre', 'transfer', true, false, true, 210),
  ('transfer_safe_to_cash', 'Cofre para caixa', 'transfer', true, false, true, 220),
  ('transfer_cash_to_bank', 'Caixa para banco', 'transfer', true, false, true, 230),
  ('transfer_bank_to_cash', 'Banco para caixa', 'transfer', true, false, true, 240),
  ('transfer_owner_to_cash', 'Proprietario para caixa', 'transfer', true, false, true, 250),
  ('transfer_cash_to_owner', 'Caixa para proprietario', 'transfer', true, false, true, 260),
  ('transfer_pix_to_bank', 'Pix para banco', 'transfer', false, false, true, 270),
  ('transfer_card_to_bank', 'Maquininha para banco', 'transfer', false, false, true, 280),
  ('cash_change_exchange', 'Troca de cedulas e moedas', 'transfer', true, false, true, 290)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  affects_cash_drawer = EXCLUDED.affects_cash_drawer,
  affects_financial_result = EXCLUDED.affects_financial_result,
  is_transfer = EXCLUDED.is_transfer,
  sort_order = EXCLUDED.sort_order,
  active = true,
  updated_at = now();
