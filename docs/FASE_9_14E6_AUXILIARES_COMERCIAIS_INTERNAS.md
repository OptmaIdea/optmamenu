# Fase 9.14E.6 — Auxiliares comerciais internas

## Status

Correção preparada.

Esta frente continua a auditoria incremental dos warnings `authenticated_security_definer_function_executable`, tratando funções comerciais que parecem ser auxiliares internas ou legado de fluxo anterior.

## Base atual

Após a 9.14E.5, o diagnóstico retornou **169 funções** ainda executáveis por `authenticated`.

## Funções avaliadas

- `create_cashbook_entry_from_order(p_order_id uuid)`;
- `apply_order_loyalty_points_advanced(p_order_id uuid)`;
- `calculate_order_loyalty_points_advanced(p_order_id uuid)`;
- `complete_confirmed_public_order(p_order_id uuid)`;
- `confirm_reserved_public_order(p_order_id uuid)`.

## Resultado da busca

### Sem chamada direta atual por RPC no frontend

- `create_cashbook_entry_from_order`;
- `apply_order_loyalty_points_advanced`;
- `calculate_order_loyalty_points_advanced`;
- `complete_confirmed_public_order`;
- `confirm_reserved_public_order`.

### Chamadas diretas preservadas

As seguintes funções comerciais continuam usadas diretamente no admin e não entram nesta migration:

- `admin_cancel_public_order_safe`;
- `admin_complete_public_order_safe`;
- `confirm_order_payment`.

## Classificação

As cinco funções avaliadas foram classificadas como auxiliares internas ou legado operacional.

Motivos:

- não há uso direto por `supabase.rpc(...)` no frontend atual;
- algumas são chamadas por funções administrativas mais seguras;
- outras parecem ter ficado como apoio/legado de etapas comerciais anteriores;
- não há necessidade de exposição direta para `authenticated`.

## Decisão

Remover `authenticated` dessas cinco funções e preservar `service_role`.

Não dropar funções nesta etapa.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628014000_revoke_authenticated_from_commercial_internal_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das cinco funções;
- garantir `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente:

- a contagem deve cair de 169 para 164 funções;
- as cinco funções devem sair do diagnóstico `authenticated_can_execute=true`;
- `admin_cancel_public_order_safe`, `admin_complete_public_order_safe` e `confirm_order_payment` devem permanecer.

## Fora do escopo

- alterar tela de pedidos;
- alterar fluxo público novo;
- alterar funções `*_safe` usadas diretamente;
- mexer em fidelidade avançada na UI;
- dropar funções antigas.

## Próxima etapa recomendada

Continuar a auditoria do grupo comercial, separando funções `*_safe` realmente usadas e bem validadas das funções restantes que ainda possam ser auxiliares internas.
