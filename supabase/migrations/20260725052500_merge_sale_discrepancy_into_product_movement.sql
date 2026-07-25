create or replace function public.get_product_stock_movements(p_store_id uuid, p_product_id uuid)
returns table(id uuid, store_id uuid, product_id uuid, product_name text, order_id uuid, quantity integer, type text, reason text, user_id uuid, previous_stock integer, new_stock integer, created_at timestamptz, created_at_display text, affects_physical boolean, source text, source_id uuid, reason_code text, metadata jsonb, created_by uuid, supplier_id uuid, location_id uuid, location_code text, location_name text, from_location_id uuid, from_location_code text, from_location_name text, to_location_id uuid, to_location_code text, to_location_name text, transfer_id uuid)
language plpgsql security definer set search_path=public as $$
begin
 if p_store_id is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'stock.view') or public.user_has_store_permission_v2(p_store_id,'stock.adjust') or public.user_has_store_permission_v2(p_store_id,'stock.transfer') or public.user_has_store_permission_v2(p_store_id,'products.view')) then raise exception 'Acesso negado à loja informada.'; end if;
 return query
 select sm.id, sm.store_id, sm.product_id, p.name::text, sm.order_id, sm.quantity, sm.type::text,
   (case when d.id is null then sm.reason else concat_ws(' ', sm.reason, 'Divergência de estoque:',
     case d.status when 'open' then 'aberta.' when 'under_review' then 'em análise.' when 'waiting_stock_count' then 'aguardando contagem.' when 'resolved' then 'resolvida.' when 'cancelled' then 'cancelada.' else d.status||'.' end,
     case d.resolution_type when 'inventory_count_corrected' then 'Resolução: contagem de estoque corrigida.' when 'physical_item_found' then 'Resolução: item físico localizado.' when 'loss_or_breakage_registered' then 'Resolução: perda ou quebra registrada.' when 'registration_or_location_error' then 'Resolução: erro de cadastro ou local.' when 'other' then 'Resolução: outro tratamento.' else null end,
     case when nullif(btrim(d.resolution_notes),'') is not null then 'Observação: '||d.resolution_notes else null end) end)::text,
   coalesce(d.resolved_by,sm.user_id), sm.previous_stock, sm.new_stock, sm.created_at, public.format_datetime_sao_paulo(sm.created_at), sm.affects_physical, sm.source, sm.source_id, sm.reason_code,
   coalesce(sm.metadata,'{}'::jsonb) || case when d.id is null then '{}'::jsonb else jsonb_build_object('discrepancy_id',d.id,'discrepancy_status',d.status,'discrepancy_status_label',case d.status when 'open' then 'Aberta' when 'under_review' then 'Em análise' when 'waiting_stock_count' then 'Aguardando contagem' when 'resolved' then 'Resolvida' when 'cancelled' then 'Cancelada' else d.status end,'discrepancy_resolution_type',d.resolution_type,'discrepancy_resolution_notes',d.resolution_notes,'discrepancy_resolved_by',d.resolved_by,'discrepancy_resolved_at',d.resolved_at,'discrepancy_updated_at',d.updated_at,'discrepancy_link','/admin/stock/divergences') end,
   sm.created_by, sm.supplier_id, sm.location_id, loc.code::text, loc.name::text, sm.from_location_id, fl.code::text, fl.name::text, sm.to_location_id, tl.code::text, tl.name::text, sm.transfer_id
 from public.stock_movements sm join public.products p on p.id=sm.product_id and p.store_id=sm.store_id
 left join public.stock_locations loc on loc.id=sm.location_id and loc.store_id=sm.store_id
 left join public.stock_locations fl on fl.id=sm.from_location_id and fl.store_id=sm.store_id
 left join public.stock_locations tl on tl.id=sm.to_location_id and tl.store_id=sm.store_id
 left join lateral (select o.* from public.stock_discrepancy_occurrences o cross join lateral jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) i(value) where o.store_id=sm.store_id and o.order_id=sm.order_id and nullif(i.value->>'product_id','')::uuid=sm.product_id order by o.updated_at desc limit 1) d on true
 where sm.store_id=p_store_id and sm.product_id=p_product_id order by sm.created_at desc limit 500;
end;$$;
revoke all on function public.get_product_stock_movements(uuid,uuid) from public;
grant execute on function public.get_product_stock_movements(uuid,uuid) to authenticated;
