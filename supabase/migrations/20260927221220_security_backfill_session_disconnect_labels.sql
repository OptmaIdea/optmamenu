update public.store_security_logs
set display_action='Sessão encerrada por inatividade'
where action='session_disconnected'
  and details->>'source'='idle_timeout';

update public.store_security_logs
set display_action='Sessão encerrada ao retomar sessão'
where action='session_disconnected'
  and details->>'source'='session_security'
  and (
    coalesce(details->>'reason','') ilike '%fechamento do navegador%'
    or coalesce(details->>'reason','') ilike '%tempo ausente%'
  );
