revoke all on function public.set_customer_self_consent_safe(text, boolean, text, text, text) from public;
revoke execute on function public.set_customer_self_consent_safe(text, boolean, text, text, text) from anon;
grant execute on function public.set_customer_self_consent_safe(text, boolean, text, text, text) to authenticated;

revoke all on function public.get_customer_self_consents_safe() from public;
revoke execute on function public.get_customer_self_consents_safe() from anon;
grant execute on function public.get_customer_self_consents_safe() to authenticated;
