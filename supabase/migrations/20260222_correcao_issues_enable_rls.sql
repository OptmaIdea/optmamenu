-- =========================================================
-- B) RLS ON (tabelas do linter + multi-tenant core)
-- =========================================================
alter table public.customer_addresses          enable row level security;
alter table public.customer_otps               enable row level security;
alter table public.customer_consent_logs       enable row level security;
alter table public.store_messages              enable row level security;
alter table public.inventory_history           enable row level security;
alter table public.store_security_logs         enable row level security;
alter table public.otp_codes                   enable row level security;

alter table public.stores                      enable row level security;
alter table public.categories                  enable row level security;
alter table public.products                    enable row level security;
alter table public.promotions                  enable row level security;
alter table public.store_hours                 enable row level security;
alter table public.store_schedules_exceptions  enable row level security;

alter table public.customers                   enable row level security;
alter table public.customer_notifications      enable row level security;

alter table public.orders                      enable row level security;
alter table public.order_items                 enable row level security;
alter table public.stock_movements             enable row level security;
alter table public.stock_reservations          enable row level security;

alter table public.fidelity_programs           enable row level security;
alter table public.fidelity_rewards            enable row level security;
alter table public.fidelity_tiers              enable row level security;
alter table public.fidelity_vouchers           enable row level security;
alter table public.loyalty_transactions        enable row level security;