-- Harden authenticated customer sessions against legacy backoffice policies.
--
-- Customer portal sessions are real Supabase `authenticated` sessions. Legacy
-- owner/store policies that only checked app_current_store_id() could therefore
-- accidentally grant a customer the same store-wide access intended for staff.
-- Keep the dedicated customer SELECT policies/RPCs, but explicitly exclude the
-- logical `customer` role from backoffice owner policies.

alter policy addresses_owner_all on public.customer_addresses
  using (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.store_id = public.app_current_store_id()
    )
  )
  with check (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.store_id = public.app_current_store_id()
    )
  );

alter policy consent_owner_read on public.customer_consent_logs
  using (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.customers c
      where c.id = customer_consent_logs.customer_id
        and c.store_id = public.app_current_store_id()
    )
  );

alter policy notifications_owner_read on public.customer_notifications
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy fidelity_vouchers_owner_all on public.fidelity_vouchers
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy inventory_history_owner_all on public.inventory_history_legacy
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy loyalty_transactions_owner_all on public.loyalty_transactions
  using (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.fidelity_programs fp
      where fp.id = loyalty_transactions.program_id
        and fp.store_id = public.app_current_store_id()
    )
  )
  with check (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.fidelity_programs fp
      where fp.id = loyalty_transactions.program_id
        and fp.store_id = public.app_current_store_id()
    )
  );

alter policy order_items_owner_all on public.order_items
  using (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.store_id = public.app_current_store_id()
    )
  )
  with check (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.store_id = public.app_current_store_id()
    )
  );

alter policy orders_owner_all on public.orders
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy promotions_owner_all on public.promotions
  using (
    public.app_current_role() <> 'customer'
    and (
      (category_id is not null and exists (
        select 1 from public.categories c
        where c.id = promotions.category_id
          and c.store_id = public.app_current_store_id()
      ))
      or
      (product_id is not null and exists (
        select 1 from public.products p
        where p.id = promotions.product_id
          and p.store_id = public.app_current_store_id()
      ))
    )
  )
  with check (
    public.app_current_role() <> 'customer'
    and (
      (category_id is not null and exists (
        select 1 from public.categories c
        where c.id = promotions.category_id
          and c.store_id = public.app_current_store_id()
      ))
      or
      (product_id is not null and exists (
        select 1 from public.products p
        where p.id = promotions.product_id
          and p.store_id = public.app_current_store_id()
      ))
    )
  );

alter policy stock_movements_owner_all on public.stock_movements
  using (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.products p
      where p.id = stock_movements.product_id
        and p.store_id = public.app_current_store_id()
    )
  )
  with check (
    public.app_current_role() <> 'customer'
    and exists (
      select 1 from public.products p
      where p.id = stock_movements.product_id
        and p.store_id = public.app_current_store_id()
    )
  );

alter policy stock_reservations_owner_all on public.stock_reservations
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy store_hours_owner_all on public.store_hours
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy store_messages_owner_all on public.store_messages
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy store_schedules_exceptions_owner_all on public.store_schedules_exceptions
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );

alter policy store_security_logs_owner_all on public.store_security_logs
  using (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  )
  with check (
    public.app_current_role() <> 'customer'
    and store_id = public.app_current_store_id()
  );
