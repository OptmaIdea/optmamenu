-- POS_9 — Financeiro — base de contas financeiras do Livro Diario
-- Cria estrutura sem alterar calculos atuais.

CREATE TABLE IF NOT EXISTS public.cashbook_account_plan (
  code text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  description text,
  affects_cash_drawer boolean NOT NULL DEFAULT false,
  affects_financial_result boolean NOT NULL DEFAULT true,
  is_transfer boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT cashbook_account_plan_kind_check CHECK (kind IN ('income', 'expense', 'transfer', 'adjustment'))
);

CREATE TABLE IF NOT EXISTS public.store_financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT store_financial_accounts_type_check CHECK (
    account_type IN ('cash_drawer', 'safe', 'bank', 'pix_wallet', 'card_acquirer', 'card_receivable', 'owner', 'other')
  ),
  CONSTRAINT store_financial_accounts_store_code_unique UNIQUE (store_id, code)
);

ALTER TABLE public.cashbook_entries
  ADD COLUMN IF NOT EXISTS account_plan_code text REFERENCES public.cashbook_account_plan(code),
  ADD COLUMN IF NOT EXISTS source_financial_account_id uuid REFERENCES public.store_financial_accounts(id),
  ADD COLUMN IF NOT EXISTS destination_financial_account_id uuid REFERENCES public.store_financial_accounts(id),
  ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_group_id uuid,
  ADD COLUMN IF NOT EXISTS affects_cash_drawer boolean,
  ADD COLUMN IF NOT EXISTS affects_financial_result boolean;

CREATE INDEX IF NOT EXISTS idx_store_financial_accounts_store_active
  ON public.store_financial_accounts (store_id, active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_cashbook_entries_account_plan
  ON public.cashbook_entries (store_id, account_plan_code, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_cashbook_entries_source_account
  ON public.cashbook_entries (store_id, source_financial_account_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_cashbook_entries_destination_account
  ON public.cashbook_entries (store_id, destination_financial_account_id, entry_date DESC);

ALTER TABLE public.cashbook_account_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashbook_account_plan_select_authenticated ON public.cashbook_account_plan;
CREATE POLICY cashbook_account_plan_select_authenticated
  ON public.cashbook_account_plan
  FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS cashbook_account_plan_write_service_only ON public.cashbook_account_plan;
CREATE POLICY cashbook_account_plan_write_service_only
  ON public.cashbook_account_plan
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS store_financial_accounts_select_safe ON public.store_financial_accounts;
CREATE POLICY store_financial_accounts_select_safe
  ON public.store_financial_accounts
  FOR SELECT
  TO authenticated
  USING (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.view')
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  );

DROP POLICY IF EXISTS store_financial_accounts_insert_safe ON public.store_financial_accounts;
CREATE POLICY store_financial_accounts_insert_safe
  ON public.store_financial_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  );

DROP POLICY IF EXISTS store_financial_accounts_update_safe ON public.store_financial_accounts;
CREATE POLICY store_financial_accounts_update_safe
  ON public.store_financial_accounts
  FOR UPDATE
  TO authenticated
  USING (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  )
  WITH CHECK (
    public.app_is_store_owner(store_id)
    OR public.user_has_store_permission(store_id, 'cashbook.create')
  );

DROP POLICY IF EXISTS store_financial_accounts_delete_blocked ON public.store_financial_accounts;
CREATE POLICY store_financial_accounts_delete_blocked
  ON public.store_financial_accounts
  FOR DELETE
  TO authenticated
  USING (false);

REVOKE ALL ON TABLE public.cashbook_account_plan FROM PUBLIC;
GRANT SELECT ON TABLE public.cashbook_account_plan TO authenticated;
GRANT ALL ON TABLE public.cashbook_account_plan TO service_role;

REVOKE ALL ON TABLE public.store_financial_accounts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.store_financial_accounts TO authenticated;
GRANT ALL ON TABLE public.store_financial_accounts TO service_role;
