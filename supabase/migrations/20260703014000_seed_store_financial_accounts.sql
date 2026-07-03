-- POS_9 — Financeiro — contas financeiras padrao por loja

INSERT INTO public.store_financial_accounts (store_id, code, name, account_type, is_default, sort_order)
SELECT s.id, v.code, v.name, v.account_type, v.is_default, v.sort_order
FROM public.stores s
CROSS JOIN (VALUES
  ('cash_drawer', 'Caixa fisico', 'cash_drawer', true, 10),
  ('safe', 'Cofre', 'safe', false, 20),
  ('bank_main', 'Banco principal', 'bank', false, 30),
  ('pix_wallet', 'Carteira Pix', 'pix_wallet', false, 40),
  ('card_acquirer', 'Maquininha', 'card_acquirer', false, 50),
  ('card_receivable', 'Recebiveis de cartao', 'card_receivable', false, 60),
  ('owner', 'Proprietario', 'owner', false, 70)
) AS v(code, name, account_type, is_default, sort_order)
ON CONFLICT (store_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  is_default = EXCLUDED.is_default,
  sort_order = EXCLUDED.sort_order,
  active = true,
  updated_at = now();
