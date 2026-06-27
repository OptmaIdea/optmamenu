# Fase 9.14F — Validação das sugestões RLS

## Status

**Concluída.**

Esta frente tratou as 2 sugestões restantes do Advisor relacionadas a tabelas com RLS habilitado e sem policy.

---

## Commit de validação informado

Advisor atualizado no commit:

- `211883e4e7ff68e60d275add457093fecdd7604f`

Resultado informado:

- as duas sugestões sumiram.

---

## Sugestões tratadas

As sugestões removidas eram:

- `rls_enabled_no_policy_public_store_permission_catalog`;
- `rls_enabled_no_policy_public_store_role_permission_templates_backup_910c`.

Tabelas envolvidas:

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`.

---

## Migration aplicada

Arquivo:

- `supabase/migrations/20260627221500_add_explicit_deny_policies_permission_tables.sql`

Commit de criação:

- `a39bc0d34a0fe7aa0e6ba236ef7c928f9639a752`

---

## Correção aplicada

Foram criadas policies explícitas de negação total para `anon` e `authenticated`:

```sql
USING (false)
WITH CHECK (false)
```

Objetivo:

- manter as tabelas fechadas;
- registrar intenção de bloqueio direto no banco;
- evitar abertura acidental caso grants sejam reintroduzidos no futuro;
- remover o ruído `RLS Enabled No Policy` do Advisor.

---

## Resultado final

Após atualização do Advisor:

- as 2 sugestões desapareceram;
- RLS permanece habilitado;
- acesso direto por clients permanece bloqueado;
- as RPCs controladas continuam sendo o caminho funcional de acesso;
- `service_role`/postgres permanecem como acesso operacional privilegiado.

---

## Estado consolidado da rodada 9.14

### Concluídas

- 9.14A — diagnóstico/classificação inicial dos Advisors;
- 9.14B — hardening de grants em funções administrativas/internas;
- 9.14C — RLS das tabelas de permissões;
- 9.14D — auditoria de funções públicas intencionais;
- 9.14E.1 — remoção de `authenticated` de funções técnicas/trigger;
- 9.14F — remoção das sugestões `RLS Enabled No Policy`.

### Persistente por decisão

- `Leaked Password Protection Disabled` deve continuar sendo desconsiderado;
- WARNs de funções públicas intencionais permanecem documentados;
- WARNs de funções `SECURITY DEFINER` autenticadas permanecem em auditoria incremental.

---

## Próxima etapa recomendada

### 9.14E.2 — Funções legadas de pedidos/reservas

Continuar a auditoria incremental dos WARNs `authenticated_security_definer_function_executable`, começando por funções de pedidos/reservas com maior chance de legado ou necessidade de hardening:

- `cancel_order(p_order_id uuid)`;
- `complete_order(p_order_id uuid)`;
- `extend_reservation(p_order_id uuid, p_minutes integer)`;
- `create_order_with_reservation(...)`.

Diretriz:

- não revogar em massa;
- separar legado sem uso de fluxo ainda consumido;
- preservar funções usadas pelo frontend até haver alternativa segura;
- preferir hardening de corpo quando houver uso funcional.
