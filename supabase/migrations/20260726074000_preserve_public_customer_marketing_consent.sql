do $$
declare
  v_oid oid := 'public.update_admin_customer_safe(uuid,uuid,text,text,text,text,date,text,text[],text,boolean,boolean)'::regprocedure::oid;
  v_definition text;
  v_needle text := 'marketing_consent = coalesce(p_marketing_consent, marketing_consent),';
  v_replacement text := 'marketing_consent = marketing_consent,';
begin
  select pg_get_functiondef(v_oid) into v_definition;

  if strpos(v_definition, v_needle) = 0 then
    raise exception 'Trecho protegido de marketing_consent não encontrado em update_admin_customer_safe';
  end if;

  v_definition := regexp_replace(
    v_definition,
    'marketing_consent = coalesce\(p_marketing_consent, marketing_consent\),',
    v_replacement,
    1,
    1,
    'g'
  );

  execute v_definition;
end;
$$;

comment on function public.update_admin_customer_safe(uuid,uuid,text,text,text,text,date,text,text[],text,boolean,boolean)
is 'Atualiza clientes administrativos; em clientes protegidos preserva dados pessoais e consentimento de marketing, permitindo apenas campos internos e fidelidade.';
