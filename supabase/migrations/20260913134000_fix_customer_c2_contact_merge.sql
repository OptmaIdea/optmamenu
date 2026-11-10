-- CLIENTES C2 — correção da fusão de contatos primários.
-- O modelo de contatos permite apenas um contato primário por tipo/cliente.
-- Antes de mover contatos do duplicado, rebaixa o primário conflitante para alternativo.
-- Também preserva is_whatsapp do cadastro canônico para não recriar/destruir contatos durante a fusão.

create or replace function public.merge_customers_safe(
  p_store_id uuid,
  p_canonical_customer_id uuid,
  p_duplicate_customer_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_canonical public.customers%rowtype;
  v_duplicate public.customers%rowtype;
  v_merge_id uuid;
  v_canonical_has_credentials boolean := false;
  v_duplicate_has_credentials boolean := false;
  v_canonical_has_legal boolean := false;
  v_duplicate_has_legal boolean := false;
  v_cpf_canonical text;
  v_cpf_duplicate text;
  v_match_basis text[] := '{}'::text[];
  v_counts jsonb := '{}'::jsonb;
  v_count integer := 0;
  v_demoted_count integer := 0;
  v_tags text[] := '{}'::text[];
  v_next_status text;
begin
  if p_store_id is null or p_canonical_customer_id is null or p_duplicate_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if p_canonical_customer_id = p_duplicate_customer_id then
    return jsonb_build_object('ok', false, 'error', 'same_customer');
  end if;

  if length(trim(coalesce(p_reason, ''))) < 8 then
    return jsonb_build_object('ok', false, 'error', 'merge_reason_required', 'message', 'Informe um motivo claro para a fusão.');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or (
        public.user_has_store_permission(p_store_id, 'customers.manage')
        and public.user_has_store_permission(p_store_id, 'customers.sensitive.view')
      )
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'A fusão exige gerenciar clientes e acesso a dados sensíveis.');
    end if;
  end if;

  select * into v_canonical
  from public.customers
  where id = p_canonical_customer_id
  for update;

  select * into v_duplicate
  from public.customers
  where id = p_duplicate_customer_id
  for update;

  if v_canonical.id is null or v_duplicate.id is null then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  if v_canonical.store_id <> p_store_id or v_duplicate.store_id <> p_store_id then
    return jsonb_build_object('ok', false, 'error', 'cross_store_merge_not_allowed');
  end if;

  if v_canonical.status in ('merged', 'anonymized') or v_duplicate.status in ('merged', 'anonymized')
     or v_canonical.merged_into_customer_id is not null or v_duplicate.merged_into_customer_id is not null then
    return jsonb_build_object('ok', false, 'error', 'customer_already_merged_or_anonymized');
  end if;

  select exists(select 1 from public.customer_credentials where customer_id = v_canonical.id)
    into v_canonical_has_credentials;
  select exists(select 1 from public.customer_credentials where customer_id = v_duplicate.id)
    into v_duplicate_has_credentials;
  select exists(select 1 from public.customer_legal_profiles where customer_id = v_canonical.id)
    into v_canonical_has_legal;
  select exists(select 1 from public.customer_legal_profiles where customer_id = v_duplicate.id)
    into v_duplicate_has_legal;

  if v_canonical_has_credentials and v_duplicate_has_credentials then
    return jsonb_build_object('ok', false, 'error', 'credentials_conflict', 'message', 'Os dois cadastros possuem credenciais. Resolva a identidade antes da fusão.');
  end if;

  if v_duplicate_has_credentials and not v_canonical_has_credentials then
    return jsonb_build_object('ok', false, 'error', 'credentialed_customer_must_be_canonical', 'message', 'O cadastro que possui credenciais deve ser mantido como principal.');
  end if;

  if v_duplicate.data_ownership = 'customer_owned' and v_canonical.data_ownership <> 'customer_owned' then
    return jsonb_build_object('ok', false, 'error', 'customer_owned_must_be_canonical', 'message', 'O cadastro controlado pelo cliente deve ser mantido como principal.');
  end if;

  if v_duplicate.identity_verified_at is not null and v_canonical.identity_verified_at is null then
    return jsonb_build_object('ok', false, 'error', 'verified_identity_must_be_canonical', 'message', 'A identidade verificada deve ser mantida como principal.');
  end if;

  if v_duplicate.phone_verified_at is not null and v_canonical.phone_verified_at is null
     and v_duplicate.phone_match_key is distinct from v_canonical.phone_match_key then
    return jsonb_build_object('ok', false, 'error', 'verified_phone_must_be_canonical', 'message', 'O telefone verificado deve pertencer ao cadastro principal.');
  end if;

  if v_canonical.phone_verified_at is not null and v_duplicate.phone_verified_at is not null
     and v_canonical.phone_match_key is distinct from v_duplicate.phone_match_key then
    return jsonb_build_object('ok', false, 'error', 'verified_phone_conflict', 'message', 'Os cadastros possuem telefones verificados diferentes.');
  end if;

  v_cpf_canonical := public.normalize_customer_cpf(v_canonical.cpf);
  v_cpf_duplicate := public.normalize_customer_cpf(v_duplicate.cpf);

  if v_cpf_canonical is not null and v_cpf_duplicate is not null and v_cpf_canonical <> v_cpf_duplicate then
    return jsonb_build_object('ok', false, 'error', 'cpf_conflict', 'message', 'Os cadastros possuem CPFs diferentes.');
  end if;

  if v_canonical.birth_date is not null and v_duplicate.birth_date is not null
     and v_canonical.birth_date <> v_duplicate.birth_date then
    return jsonb_build_object('ok', false, 'error', 'birth_date_conflict', 'message', 'Os cadastros possuem datas de nascimento diferentes.');
  end if;

  if v_canonical.person_type <> v_duplicate.person_type then
    return jsonb_build_object('ok', false, 'error', 'person_type_conflict', 'message', 'Os cadastros possuem tipos de pessoa diferentes.');
  end if;

  if v_canonical_has_legal and v_duplicate_has_legal then
    return jsonb_build_object('ok', false, 'error', 'legal_profile_conflict', 'message', 'Os dois cadastros possuem perfil legal. Revise-os antes da fusão.');
  end if;

  if exists (
    select 1
    from public.promotion_campaign_recipients d
    join public.promotion_campaign_recipients c
      on c.campaign_id = d.campaign_id
     and c.customer_id = v_canonical.id
    where d.customer_id = v_duplicate.id
  ) then
    return jsonb_build_object('ok', false, 'error', 'campaign_recipient_conflict', 'message', 'Há campanhas com os dois cadastros. Resolva os destinatários antes da fusão.');
  end if;

  if v_canonical.phone_match_key is not null and v_canonical.phone_match_key = v_duplicate.phone_match_key then
    v_match_basis := array_append(v_match_basis, 'phone');
  end if;
  if v_cpf_canonical is not null and v_cpf_canonical = v_cpf_duplicate then
    v_match_basis := array_append(v_match_basis, 'cpf');
  end if;
  if public.normalize_customer_email(v_canonical.email) is not null
     and public.normalize_customer_email(v_canonical.email) = public.normalize_customer_email(v_duplicate.email) then
    v_match_basis := array_append(v_match_basis, 'email');
  end if;
  if v_canonical.birth_date is not null and v_canonical.birth_date = v_duplicate.birth_date
     and public.normalize_customer_name(v_canonical.full_name) is not null
     and public.normalize_customer_name(v_canonical.full_name) = public.normalize_customer_name(v_duplicate.full_name) then
    v_match_basis := array_append(v_match_basis, 'name_birth_date');
  end if;

  insert into public.customer_merge_events(
    store_id, canonical_customer_id, duplicate_customer_id, actor_user_id,
    reason, match_basis, canonical_snapshot, duplicate_snapshot
  ) values (
    p_store_id, v_canonical.id, v_duplicate.id, auth.uid(),
    trim(p_reason), to_jsonb(v_match_basis), to_jsonb(v_canonical), to_jsonb(v_duplicate)
  ) returning id into v_merge_id;

  if exists(select 1 from public.customer_addresses where customer_id = v_canonical.id and is_default) then
    update public.customer_addresses set is_default = false
    where customer_id = v_duplicate.id and is_default;
  end if;
  update public.customer_addresses set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('addresses', v_count);

  update public.customer_benefit_rules set target_customer_id = v_canonical.id where target_customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('benefit_rules', v_count);

  update public.customer_consent_logs set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('consent_logs', v_count);

  update public.customer_contacts d
  set
    is_primary = false,
    metadata = coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
      'demoted_by_merge_id', v_merge_id,
      'demoted_by_merge_at', now()
    ),
    updated_at = now()
  where d.customer_id = v_duplicate.id
    and d.is_primary = true
    and exists (
      select 1
      from public.customer_contacts c
      where c.customer_id = v_canonical.id
        and c.is_primary = true
        and (
          c.contact_type = d.contact_type
          or (c.contact_type in ('phone', 'whatsapp') and d.contact_type in ('phone', 'whatsapp'))
        )
    );
  get diagnostics v_demoted_count = row_count;

  update public.customer_contacts set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object(
    'contacts', v_count,
    'contacts_demoted_to_alternate', v_demoted_count
  );

  if v_duplicate_has_legal and not v_canonical_has_legal then
    update public.customer_legal_profiles set customer_id = v_canonical.id where customer_id = v_duplicate.id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('legal_profiles', v_count);
  else
    v_counts := v_counts || jsonb_build_object('legal_profiles', 0);
  end if;

  update public.customer_notifications set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('notifications', v_count);

  delete from public.customer_segment_members d
  where d.customer_id = v_duplicate.id
    and exists (
      select 1 from public.customer_segment_members c
      where c.segment_id = d.segment_id and c.customer_id = v_canonical.id
    );
  update public.customer_segment_members set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('segment_memberships_moved', v_count);

  update public.fidelity_vouchers set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('vouchers', v_count);

  update public.loyalty_transactions set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('loyalty_transactions', v_count);

  update public.orders set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('orders', v_count);

  update public.promotion_campaign_recipients set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('campaign_recipients', v_count);

  select coalesce(array_agg(distinct x order by x), '{}'::text[])
  into v_tags
  from unnest(coalesce(v_canonical.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])) as t(x);

  v_next_status := case
    when v_canonical.status = 'blocked' or v_duplicate.status = 'blocked' then 'blocked'
    when v_canonical.status = 'restricted' or v_duplicate.status = 'restricted' then 'restricted'
    when v_canonical.status = 'active' or v_duplicate.status = 'active' then 'active'
    else v_canonical.status
  end;

  update public.customers
  set
    full_name = coalesce(nullif(trim(v_canonical.full_name), ''), v_duplicate.full_name),
    nickname = coalesce(nullif(trim(v_canonical.nickname), ''), v_duplicate.nickname),
    email = coalesce(nullif(trim(v_canonical.email), ''), v_duplicate.email),
    email_verified = case
      when nullif(trim(v_canonical.email), '') is not null then coalesce(v_canonical.email_verified, false)
      else coalesce(v_duplicate.email_verified, false)
    end,
    cpf = coalesce(nullif(regexp_replace(coalesce(v_canonical.cpf, ''), '\D', '', 'g'), ''), v_duplicate.cpf),
    birth_date = coalesce(v_canonical.birth_date, v_duplicate.birth_date),
    birth_date_locked = coalesce(v_canonical.birth_date_locked, false) or coalesce(v_duplicate.birth_date_locked, false),
    is_whatsapp = v_canonical.is_whatsapp,
    contact_preference = coalesce(v_canonical.contact_preference, v_duplicate.contact_preference),
    loyalty_points = coalesce(v_canonical.loyalty_points, 0) + coalesce(v_duplicate.loyalty_points, 0),
    current_stamps = coalesce(v_canonical.current_stamps, 0) + coalesce(v_duplicate.current_stamps, 0),
    last_login = greatest(v_canonical.last_login, v_duplicate.last_login),
    last_point_activity_at = greatest(v_canonical.last_point_activity_at, v_duplicate.last_point_activity_at),
    identity_verified_at = greatest(v_canonical.identity_verified_at, v_duplicate.identity_verified_at),
    tags = v_tags,
    internal_notes = concat_ws(E'\n\n', nullif(trim(coalesce(v_canonical.internal_notes, '')), ''),
      case when nullif(trim(coalesce(v_duplicate.internal_notes, '')), '') is not null
        then '[Fusão ' || v_merge_id::text || '] ' || trim(v_duplicate.internal_notes)
        else null end),
    data_ownership = case
      when v_canonical.data_ownership = v_duplicate.data_ownership then v_canonical.data_ownership
      else 'mixed'
    end,
    editable_by_store = coalesce(v_canonical.editable_by_store, true) and coalesce(v_duplicate.editable_by_store, true),
    status = v_next_status,
    restriction_reason = coalesce(v_canonical.restriction_reason, v_duplicate.restriction_reason),
    blocked_at = coalesce(v_canonical.blocked_at, v_duplicate.blocked_at),
    blocked_by = coalesce(v_canonical.blocked_by, v_duplicate.blocked_by),
    customer_metadata = coalesce(v_canonical.customer_metadata, '{}'::jsonb) || jsonb_build_object(
      'last_merge_id', v_merge_id,
      'last_merged_customer_id', v_duplicate.id,
      'last_merged_at', now()
    ),
    updated_at = now()
  where id = v_canonical.id;

  perform public.refresh_customer_commercial_summary(v_canonical.id);

  update public.customers
  set
    status = 'merged',
    merged_into_customer_id = v_canonical.id,
    merged_at = now(),
    merged_by = auth.uid(),
    editable_by_store = false,
    loyalty_points = 0,
    current_stamps = 0,
    total_orders = 0,
    total_spent = 0,
    last_order_at = null,
    customer_metadata = coalesce(customer_metadata, '{}'::jsonb) || jsonb_build_object(
      'merge_id', v_merge_id,
      'merged_into_customer_id', v_canonical.id,
      'merged_at', now()
    ),
    updated_at = now()
  where id = v_duplicate.id;

  update public.customer_merge_events
  set moved_counts = v_counts
  where id = v_merge_id;

  return jsonb_build_object(
    'ok', true,
    'merge_id', v_merge_id,
    'canonical_customer_id', v_canonical.id,
    'duplicate_customer_id', v_duplicate.id,
    'match_basis', to_jsonb(v_match_basis),
    'moved_counts', v_counts
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'merge_unique_conflict', 'message', 'A fusão encontrou um vínculo duplicado que precisa ser revisado antes de continuar.');
end;
$$;

revoke all on function public.merge_customers_safe(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.merge_customers_safe(uuid, uuid, uuid, text) to authenticated, service_role;
