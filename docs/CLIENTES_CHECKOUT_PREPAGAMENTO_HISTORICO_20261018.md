# Clientes / Loja Pública — Solicitações anteriores e pagamento antecipado

**Rodada:** 18/10/2026 · **Branch:** `agent/homologacao-geral-20260820` · **Ambiente:** `homologacao.optmamenu.com.br`

## Aceites informados pelo usuário

- As solicitações de cancelamento já funcionam em `Meus pedidos` e `/admin/orders`, incluindo recusa, nova solicitação, sincronização e isolamento.
- Pedido Pix pago permanece reservado até confirmação real de estorno; nenhum estorno fictício foi feito.
- Fluxo de carrinho anônimo/autenticado está homologado: logout limpa apresentação; login restaura carrinho próprio. **Não modificado.**
- Regra de negócio confirmada: pagamento antecipado somente para cliente registrado e autenticado; cliente anônimo apenas retirada com pagamento na loja.
- Prazo para pagamento antecipado deve ser independente e configurável (de minutos a até 24h conforme segmento).

## Pacote implementado

### 1. Histórico completo da solicitação

`src/pages/store/components/CustomerOrderCancellationPanel.tsx` agora exibe a solicitação ativa/mais recente, seguida de **Solicitações anteriores** recolhível. Cada tentativa mantém motivo, situação, horário, resposta da loja e eventos. Reutiliza `get_customer_self_order_cancellation_requests_safe`, sem novas tabelas nem movimentação financeira.

### 2. Checkout com cliente autenticado — validação em duas camadas

**Backend:**
`20261018024000_customer_checkout_authenticated_advance_only.sql`

`create_public_order_by_slug_v3` exige sessão cliente válida e vinculada à loja (`app_current_role/customer_id/store_id`) para `pay_now` ou entrega. `create_public_order_by_slug` legado também proíbe convidado para métodos distintos de `pending` e para modalidades distintas de retirada. As verificações ocorrem antes da criação do pedido e da reserva. Não altera pedidos antigos.

**Frontend:** `src/pages/store/Checkout.tsx`: pagamento antecipado não é selecionável sem autenticação, apresenta explicação e retorno à loja para login. Checkout anônimo limitado a retirada com pagamento posterior, inclusive em validações finais. Seleção antecipada em rascunho é limpa se o cliente perde autenticação. Backend é a autoridade.

### 3. Prazo por loja para antecipação de pagamento — retirada

`20261018030000_customer_prepayment_pickup_configurable_window.sql`

Campo `store_settings.order_settings.prepayment_hold_minutes`: número inteiro **5–1440 minutos**, com fallback para `stores.reservation_time_minutes` se ainda não configurado. Em **Configurações / Pedido Online**, esse prazo tem entrada própria, separada de `Tempo de reserva`.

Para pedido **novo**, `pay_now`, **retirada**, ainda não pago e reservado: define `orders.expires_at`, `orders.cancellation_grace_until` e `stock_reservations.expires_at` para o mesmo prazo, mantendo `commercial_metadata.payment_deadline_at` como evidência. Pagamento confirmado antes do limite suspende expiração pela proteção existente. A função cron `cancel-expired-orders-every-minute` está **ativa e agendada a cada minuto**.

**Limite proposital:** prazo independente de entrega ainda não reconfigurado, pois entregas têm política própria de reserva física. Alterar a duração no admin aplica-se somente a pedidos futuros; não retroage em pedidos já pagos/reservados.

### 4. Admin: aguardando pagamento versus operação

`src/pages/private/admin/commercial/orders/Orders.tsx`:

- filtro habitual **Atual/Em atendimento** exclui pedidos `pay_now` com pagamento ainda não confirmado;
- ação **Aguardando pagamento (N)** mostra separadamente esses pedidos, com indicação de que não devem entrar em preparação;
- filtro **Todos** preserva observabilidade, sem apagar pedidos;
- após webhook/API marcar `payment_status=paid`, pedido sai da fila pendente na próxima reconsulta e entra em atendimento.

`20261018032500_customer_prepayment_prevent_unpaid_operational_transition.sql` adiciona bloqueio server-side nas RPCs existentes de **aceitar**, **marcar pronto** e **despachar**: pedidos `pay_now` não pagos retornam `payment_confirmation_required`, mesmo que alguém contorne a interface.

O status comercial do pedido permanece `reserved` até confirmação e aceite. Não há mudança artificial de status nem de contabilidade.

### 5. Acompanhamento por token

`20261018035000_customer_public_tracking_payment_timing.sql` inclui apenas `payment_timing` na resposta já protegida pelo token público. `/p` mostra "Aguardando confirmação do pagamento" e a data/hora de expiração de reserva somente em pedido reservado e `pay_now` não pago. Não publica dados financeiros internos nem credenciais.

## Evidências SQL

- Testes de `anon`: `pay_now`, entrega e rota legada com Pix negados por `customer_auth_required_for_checkout`.
- Teste `authenticated`: tentativa de criar pagamento antecipado em outra loja rejeitada; sessão ativa na loja própria superou guarda de identidade.
- Verificações com payload `items=[]`, sem criar pedido. Transação revertida ao final.
- `supabase/tests/customer_checkout_advance_auth_and_queue_20261018.sql` versionado e **executado com PASS**. Verifica também a presença do bloqueio de transições operacionais.
- `cron.job` consultado: `cancel-expired-orders-every-minute` ativo, cron `* * * * *`.

## Roteiro manual de aceite

1. **Pedido próprio já pago:** Meus pedidos → localizar pedido com duas solicitações → confirmar situação atual e seção **Solicitações anteriores** com a recusa e a resposta da loja.
2. **Sem login:** abrir checkout, escolher retirada, verificar que "Pagar agora" exige login; registrar apenas pedido de teste para retirada e pagamento na loja. Antes de criar um pedido, confirmar estoque e valores.
3. **Com login:** escolher Pix antecipado e finalizar; confirmar que primeiro aparece em **Aguardando pagamento** e **não em atendimento**.
4. **Sem pagar:** consultar `/p` e prazo; aguardar prazo de teste curto (5–10 min) e confirmar expiração e liberação de reserva sem alterar lançamentos financeiros.
5. **Pagamento via API antes do limite:** em outro pedido de teste, realizar simulação sandbox, confirmar API e ver item migrar para fila operacional, sem duplicidade.
6. **Admin:** com pedido ainda não pago, tentar aceite/ready apenas em teste controlado: RPC deve negar `payment_confirmation_required`; não liberar estoque.
7. **Configuração:** modificar prazo para 15 minutos e salvar no admin, recarregar e confirmar persistência. Para teste de 24h, salvar 1440 numa loja não alimentar e confirmar o valor, sem precisar esperar 24h; restaurar depois se necessário.

## Limites e próximas dependências

- **Estornos Pix/cartão e efetivação do cancelamento pago** continuam dependentes da autoridade Pedidos/Financeiro e confirmação do provedor. Esta rodada não mudou o pedido pago existente.
- Pedido anônimo sem conta não tem autoridade para solicitar cancelamento pelo link de rastreio; usa atendimento da loja. Pagamento antecipado para esse modo agora é impedido.
- **Entrega com pagamento antecipado:** regras de fila/autenticação são aplicadas, mas prazo de expiração de reservas de entrega exige integração com a política própria de estoque e não foi estendido para 24 horas aqui.
- O filtro do admin separa a fila de trabalho no frontend. **Outras integrações externas que escutem o evento de criação de pedido devem ser auditadas separadamente** para não enviar alertas operacionais antes da confirmação.
- Os testes HTTP/reais de concorrência e do webhook ainda precisam da homologação manual com sessão e Pix Sandbox.

## Decisão

**Histórico e nova regra de checkout: implementados; testes SQL de autorização aprovados; aguardando reteste funcional pelo usuário.**  
**Prazo de retirada e segregação operacional: implementados; aguardando pedido de teste ponta a ponta.**  
**Estorno definitivo do pedido pago: NÃO implementado nem simulado.**
