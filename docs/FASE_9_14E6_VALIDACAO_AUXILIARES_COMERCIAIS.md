# Fase 9.14E.6 — Validação das auxiliares comerciais internas

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628014000_revoke_authenticated_from_commercial_internal_helpers.sql`

## Resultado

O diagnóstico retornou **164 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **169**.

Redução confirmada:

- **5 funções removidas da superfície authenticated**.

## Funções removidas

As funções abaixo não aparecem mais no diagnóstico:

- `create_cashbook_entry_from_order(p_order_id uuid)`;
- `apply_order_loyalty_points_advanced(p_order_id uuid)`;
- `calculate_order_loyalty_points_advanced(p_order_id uuid)`;
- `complete_confirmed_public_order(p_order_id uuid)`;
- `confirm_reserved_public_order(p_order_id uuid)`.

## Funções administrativas preservadas

Permanecem no diagnóstico, conforme esperado:

- `admin_cancel_public_order_safe(p_order_id uuid, p_reason text)`;
- `admin_complete_public_order_safe(p_order_id uuid)`;
- `confirm_order_payment(p_order_id uuid)`.

## Interpretação

A etapa foi validada porque:

- removeu apenas funções auxiliares sem chamada direta atual por `supabase.rpc(...)` no frontend;
- preservou funções administrativas usadas diretamente;
- não alterou o fluxo público novo;
- manteve `service_role` para compatibilidade operacional.

## Estado acumulado da 9.14E

Até aqui:

- 9.14E.1 reduziu de 184 para 176;
- 9.14E.2 reduziu de 176 para 174;
- 9.14E.3 endureceu `extend_reservation` sem alterar contagem;
- 9.14E.4 reduziu de 174 para 173;
- 9.14E.5 reduziu de 173 para 169;
- 9.14E.6 reduziu de 169 para 164.

## Próxima etapa recomendada

### 9.14E.7 — Comercial seguro restante

Agora o bloco comercial restante parece composto principalmente por funções `*_safe`, dashboards e operações administrativas ainda usadas.

Diretriz recomendada:

- documentar exceções intencionais quando a função já valida `auth.uid()`, loja e permissão/vínculo;
- aplicar hardening pontual apenas onde faltar permissão granular;
- evitar revogar funções usadas diretamente pelo admin;
- avançar para o grupo de estoque/transferências em recortes pequenos quando o bloco comercial estiver estabilizado.
