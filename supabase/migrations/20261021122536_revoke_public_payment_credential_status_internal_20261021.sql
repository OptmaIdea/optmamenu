-- P00 / 2026-10-21: narrow an unintentionally public payment-status helper.
-- Read-only audit found EXECUTE granted to anon and authenticated; the helper
-- updates provider credential status without caller/store authorization.
-- Its implementation is unchanged. No table grants, policies or RLS are modified.

begin;

revoke execute on function
  public.mark_online_payment_provider_credential_status_internal(
    uuid, text, text, text, jsonb
  )
from public, anon, authenticated;

grant execute on function
  public.mark_online_payment_provider_credential_status_internal(
    uuid, text, text, text, jsonb
  )
to service_role;

do $check$
declare
  v_target regprocedure :=
    'public.mark_online_payment_provider_credential_status_internal(uuid,text,text,text,jsonb)'::regprocedure;
begin
  if has_function_privilege('anon', v_target, 'EXECUTE')
     or has_function_privilege('authenticated', v_target, 'EXECUTE') then
    raise exception 'p00: payment provider internal helper must not be browser-executable';
  end if;

  if not has_function_privilege('service_role', v_target, 'EXECUTE') then
    raise exception 'p00: payment provider internal helper must retain service_role access';
  end if;
end
$check$;

commit;
