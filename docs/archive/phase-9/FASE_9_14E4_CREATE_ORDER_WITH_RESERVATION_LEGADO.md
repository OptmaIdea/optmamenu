# Fase 9.14E.4 — create_order_with_reservation legado

## Status

Correção preparada.

Esta frente trata a função legada:

- `create_order_with_reservation(...)`.

Ela apareceu no diagnóstico 9.14E como função `SECURITY DEFINER` executável por `authenticated`.

---

## Advisor base

Arquivo atualizado informado:

- `docs/ADVISORS.md`

Commit informado:

- `65c1be25868f1131be0e4374887f2f57573cb1d0`

O arquivo continua contendo warnings públicos intencionais já classificados na 9.14D e warnings autenticados em auditoria incremental.

---

## Achados no frontend

### Fluxo público atual

O `Catalog.tsx` usa o serviço novo:

- `PublicOrderService.createPublicOrder(...)`.

Esse fluxo chama a RPC nova e mais segura:

- `create_public_order_by_slug(...)`.

Ele envia:

- slug da loja;
- tipo de atendimento;
- canal de venda;
- método de pagamento;
- método de entrega;
- itens por `product_id` e `quantity`;
- endereço quando necessário;
- mesa/comanda quando necessário.

---

### Fluxo legado

O único uso atual encontrado de `create_order_with_reservation` no frontend está em:

- `src/pages/store/components/CartDrawer.tsx`.

Esse componente chama diretamente:

- `supabase.rpc('create_order_with_reservation', ...)`.

Problemas desse fluxo:

- usa `store.id` em vez de slug;
- envia `p_total` calculado no cliente;
- usa método de pagamento simples;
- não passa canal público/método de entrega como o fluxo novo;
- não usa as validações completas de `create_public_order_by_slug`;
- depende de `store` recebido por prop.

---

### Uso real do CartDrawer

O `StoreLayout` renderizava:

- `<CartDrawer />`

sem passar a prop `store`.

Como o `CartDrawer` bloqueia o envio quando `store.id` não existe, esse caminho já não estava funcional para criação de pedido.

Além disso, o `Catalog.tsx` possui seu próprio fluxo de carrinho/pedido público novo e não importa mais o `CartDrawer`.

---

## Correção no frontend

Arquivo alterado:

- `src/components/layouts/StoreLayout.tsx`

Alteração:

- removido import do `CartDrawer`;
- removida renderização de `<CartDrawer />`.

Commit:

- `f46d5a5319cd3075c80d9e8951ff90a509d18b81`

Motivo:

- desacoplar componente legado do layout público;
- evitar manter caminho antigo acoplado ao app;
- preparar revogação segura da RPC legada.

---

## Decisão de banco

Como o fluxo público atual usa `create_public_order_by_slug` e o único uso direto de `create_order_with_reservation` foi desacoplado do layout, a função legada pode perder `authenticated`.

Decisão:

- revogar `authenticated` de `create_order_with_reservation(...)`;
- preservar `service_role`;
- não dropar a função nesta etapa;
- manter a função disponível apenas para manutenção/compatibilidade interna, se necessário.

---

## Migration preparada

Arquivo:

- `supabase/migrations/20260628001500_revoke_authenticated_from_create_order_with_reservation.sql`

Escopo:

- `REVOKE EXECUTE` de `authenticated`;
- `REVOKE EXECUTE` de `anon` e `PUBLIC`, por garantia;
- `GRANT EXECUTE` para `service_role`.

---

## Validação esperada

Após aplicar a migration e rodar novamente:

- `create_order_with_reservation` deve sair do diagnóstico `authenticated_can_execute=true`;
- `create_public_order_by_slug` deve continuar pública por design;
- o catálogo público deve continuar criando pedidos pelo fluxo novo;
- `CartDrawer` não deve mais ser renderizado pelo `StoreLayout`.

---

## Fora do escopo

- remover o arquivo `CartDrawer.tsx`;
- remover a rota `/checkout`;
- refatorar todo o checkout legado;
- dropar a função do banco;
- alterar `create_public_order_by_slug`.

---

## Próxima etapa recomendada

Depois da validação:

- continuar a 9.14E em outro subgrupo de funções autenticadas;
- candidatos naturais: funções auxiliares antigas de reserva/estoque, como `cancel_order_reservations`, `cancel_reservation_only`, `confirm_order_stock`, `confirm_reserved_stock`, após busca de uso no frontend.
