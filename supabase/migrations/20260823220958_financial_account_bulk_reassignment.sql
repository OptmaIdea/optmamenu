create or replace function public.reassign_financial_account_movements_bulk_safe(
  p_store_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_entry_ids uuid[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_requested integer;
  v_valid integer;
  v_entry public.cashbook_entries%rowtype;
  v_new_source uuid;
  v_new_destination uuid;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_moved integer := 0;
  v_neutralized integer := 0;
begin
  if p_store_id is null or p_source_account_id is null or p_destination_account_id is null or p_entry_ids is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if p_source_account_id = p_destination_account_id then
    return jsonb_build_object('ok', false, 'error', 'same_account');
  end if;

  v_requested := cardinality(array(select distinct x from unnest(p_entry_ids) x where x is not null));
  if coalesce(v_requested, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_selection');
  end if;
  if v_requested > 500 then
    return jsonb_build_object('ok', false, 'error', 'too_many_entries');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  if not exists (
    select 1
    from public.store_financial_accounts a
    where a.id = p_source_account_id and a.store_id = p_store_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'source_account_not_found');
  end if;

  if not exists (
    select 1
    from public.store_financial_accounts a
    where a.id = p_destination_account_id and a.store_id = p_store_id and a.active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_destination_account');
  end if;

  select count(*) into v_valid
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.id = any(p_entry_ids)
    and e.status = 'confirmed'
    and e.affects_balance = true
    and (e.source_financial_account_id = p_source_account_id or e.destination_financial_account_id = p_source_account_id);

  if v_valid <> v_requested then
    return jsonb_build_object('ok', false, 'error', 'selection_contains_invalid_entries');
  end if;

  if exists (
    select 1
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.id = any(p_entry_ids)
      and e.status = 'confirmed'
      and e.affects_balance = true
      and nullif(coalesce(e.payment_method_code, e.payment_method, ''), '') is not null
      and not exists (
        select 1
        from public.store_financial_account_payment_methods apm
        where apm.store_id = p_store_id
          and apm.account_id = p_destination_account_id
          and apm.active = true
          and apm.payment_method_code in (
            coalesce(e.payment_method_code, e.payment_method),
            coalesce((
              select pm.base_code
              from public.store_payment_methods pm
              where pm.store_id = p_store_id
                and pm.code = coalesce(e.payment_method_code, e.payment_method)
              limit 1
            ), coalesce(e.payment_method_code, e.payment_method))
          )
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'destination_does_not_accept_all_payment_methods');
  end if;

  for v_entry in
    select e.*
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.id = any(p_entry_ids)
    order by e.occurred_at, e.id
    for update
  loop
    v_new_source := case
      when v_entry.source_financial_account_id = p_source_account_id then p_destination_account_id
      else v_entry.source_financial_account_id
    end;
    v_new_destination := case
      when v_entry.destination_financial_account_id = p_source_account_id then p_destination_account_id
      else v_entry.destination_financial_account_id
    end;

    if coalesce(v_entry.is_transfer, false)
       and v_new_source is not null
       and v_new_destination is not null
       and v_new_source = v_new_destination then
      insert into public.cashbook_financial_account_allocation_audit(
        store_id,
        cashbook_entry_id,
        old_source_financial_account_id,
        old_destination_financial_account_id,
        new_source_financial_account_id,
        new_destination_financial_account_id,
        reason,
        changed_by,
        metadata
      ) values (
        p_store_id,
        v_entry.id,
        v_entry.source_financial_account_id,
        v_entry.destination_financial_account_id,
        v_new_source,
        v_new_destination,
        v_reason,
        auth.uid(),
        jsonb_build_object(
          'source', 'financial_account_bulk_reassignment',
          'action', 'neutralize_redundant_transfer',
          'source_account_id', p_source_account_id,
          'destination_account_id', p_destination_account_id
        )
      );

      update public.cashbook_entries e
      set status = 'cancelled',
          affects_balance = false,
          metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
            'financial_account_reassignment_at', now(),
            'financial_account_reassignment_by', auth.uid(),
            'financial_account_reassignment_from', p_source_account_id,
            'financial_account_reassignment_to', p_destination_account_id,
            'financial_account_reassignment_reason', v_reason,
            'financial_account_reassignment_action', 'neutralized_redundant_transfer'
          ),
          updated_at = now()
      where e.id = v_entry.id and e.store_id = p_store_id;

      v_neutralized := v_neutralized + 1;
    else
      insert into public.cashbook_financial_account_allocation_audit(
        store_id,
        cashbook_entry_id,
        old_source_financial_account_id,
        old_destination_financial_account_id,
        new_source_financial_account_id,
        new_destination_financial_account_id,
        reason,
        changed_by,
        metadata
      ) values (
        p_store_id,
        v_entry.id,
        v_entry.source_financial_account_id,
        v_entry.destination_financial_account_id,
        v_new_source,
        v_new_destination,
        v_reason,
        auth.uid(),
        jsonb_build_object(
          'source', 'financial_account_bulk_reassignment',
          'action', 'reassign_movement',
          'source_account_id', p_source_account_id,
          'destination_account_id', p_destination_account_id
        )
      );

      update public.cashbook_entries e
      set source_financial_account_id = v_new_source,
          destination_financial_account_id = v_new_destination,
          metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
            'financial_account_reassignment_at', now(),
            'financial_account_reassignment_by', auth.uid(),
            'financial_account_reassignment_from', p_source_account_id,
            'financial_account_reassignment_to', p_destination_account_id,
            'financial_account_reassignment_reason', v_reason,
            'financial_account_reassignment_action', 'reassigned'
          ),
          updated_at = now()
      where e.id = v_entry.id and e.store_id = p_store_id;

      v_moved := v_moved + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'requested_count', v_requested,
    'moved_count', v_moved,
    'neutralized_transfer_count', v_neutralized,
    'source_account_id', p_source_account_id,
    'destination_account_id', p_destination_account_id
  );
end;
$function$;

revoke all on function public.reassign_financial_account_movements_bulk_safe(uuid, uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.reassign_financial_account_movements_bulk_safe(uuid, uuid, uuid, uuid[], text) to authenticated, service_role;
