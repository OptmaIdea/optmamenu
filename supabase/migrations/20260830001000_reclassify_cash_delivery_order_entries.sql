-- Reclassify existing HML order entries using the new online order routing rules.
-- Safe in other databases: it only affects matching existing order codes.

with route_account as (
  select public.resolve_order_payment_destination_account(
    o.store_id,
    coalesce(o.sales_channel, 'public_store'),
    coalesce(o.fulfillment_type, 'any'),
    public.get_order_payment_timing(coalesce(o.payment_metadata, '{}'::jsonb), o.payment_status),
    coalesce(o.payment_method_code, o.payment_method::text),
    null
  ) as account_id,
  o.id as order_id,
  public.get_order_payment_timing(coalesce(o.payment_metadata, '{}'::jsonb), o.payment_status) as payment_timing,
  public.format_order_cashbook_payment_label(
    o.fulfillment_type,
    coalesce(o.payment_method_code, o.payment_method::text),
    public.get_order_payment_timing(coalesce(o.payment_metadata, '{}'::jsonb), o.payment_status)
  ) as payment_label
  from public.orders o
  where o.order_code = 'PED-20260829-202324-D798'
)
update public.cashbook_entries ce
set destination_financial_account_id = route_account.account_id,
    payment_method = route_account.payment_label,
    affects_cash_drawer = coalesce(a.account_type = 'cash_drawer', false),
    affects_financial_result = true,
    metadata = coalesce(ce.metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_timing', route_account.payment_timing,
      'destination_financial_account_id', route_account.account_id,
      'destination_financial_account_name', a.name,
      'destination_financial_account_code', a.code,
      'destination_financial_account_type', a.account_type,
      'payment_route_source', 'store_order_payment_account_routes_reclassified_20260830',
      'reclassified_at', now()
    ),
    updated_at = now()
from route_account
left join public.store_financial_accounts a on a.id = route_account.account_id
where ce.order_id = route_account.order_id
  and ce.type = 'sale'
  and ce.status <> 'cancelled';
