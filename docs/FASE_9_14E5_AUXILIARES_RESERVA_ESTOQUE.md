# Fase 9.14E.5 — Auxiliares antigas de reserva e estoque

## Status

Correção preparada.

Esta frente continua a auditoria incremental dos warnings `authenticated_security_definer_function_executable`, tratando quatro funções auxiliares antigas de reserva/estoque.

## Funções avaliadas

- `cancel_order_reservations(p_store_id uuid, p_order_id uuid, p_created_by uuid)`;
- `cancel_reservation_only(p_store_id uuid, p_order_id uuid, p_created_by uuid)`;
- `confirm_order_stock(p_store_id uuid, p_order_id uuid, p_created_by uuid)`;
- `confirm_reserved_stock(p_store_id uuid, p_order_id uuid, p_created_by uuid)`.

## Resultado da busca

Busca direta por `supabase.rpc(...)`:

- `rpc('cancel_order_reservations')`: não encontrado;
- `rpc('cancel_reservation_only')`: não encontrado;
- `rpc('confirm_order_stock')`: não encontrado;
- `rpc('confirm_reserved_stock')`: não encontrado.

Busca geral pelo nome das funções:

- resultados apenas em documentação/Advisors;
- nenhum uso operacional atual identificado no frontend.

## Classificação

As quatro funções foram classificadas como auxiliares antigas/legadas.

Motivos:

- não possuem uso direto no frontend atual;
- recebem `store_id`, `order_id` e `created_by` por parâmetro;
- não validam `auth.uid()`;
- não validam vínculo com loja;
- não validam permissão granular;
- executam efeitos de estoque/reserva;
- existem fluxos mais novos e seguros para pedido público confirmado/cancelado.

## Decisão

Remover `authenticated` dessas funções.

Preservar:

- `service_role`;
- owner/postgres;
- função existente no banco, sem `DROP` nesta etapa.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628012500_revoke_authenticated_from_legacy_reservation_helpers.sql`

Escopo:

- revogar `authenticated` das quatro funções;
- revogar também `PUBLIC` e `anon` por garantia;
- preservar `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente:

- as quatro funções não devem aparecer no diagnóstico `authenticated_can_execute=true`;
- a contagem deve cair de 173 para 169 funções;
- fluxos novos como `admin_cancel_public_order_safe`, `admin_complete_public_order_safe`, `confirm_order_payment`, `confirm_reserved_public_order` e `complete_confirmed_public_order` devem permanecer inalterados.

## Fora do escopo

- dropar funções antigas;
- alterar funções novas/seguras;
- alterar frontend;
- trocar fluxo de pedidos;
- tratar o grupo completo de estoque/transferência.

## Próxima etapa recomendada

Continuar a 9.14E por subgrupos pequenos. Próximos candidatos naturais:

- funções comerciais seguras que talvez precisem apenas de documentação;
- funções de estoque operacionais que devem ser preservadas;
- funções SQL `SECURITY DEFINER` de leitura que precisam validar `is_store_member`.
