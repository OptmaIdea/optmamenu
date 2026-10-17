# Clientes / Loja Pública — Solicitação de cancelamento de pedidos
**Data:** 17/10/2026  
**Branch:** `agent/homologacao-geral-20260820`  
**Supabase:** `lgkkfmqzaorrutuoqeax`  
**Ambiente:** https://homologacao.optmamenu.com.br

## Contexto e segurança RC preservada

A RPC existente `cancel_customer_self_order_safe` cancela diretamente **somente reserva não paga** e valida pedido do próprio cliente; `admin_cancel_public_order_safe` mantém os bloqueios:
- `delivery_return_reversal_required` para `out_for_delivery`;
- `refund_workflow_required` para cobrança confirmada.

A presente frente **NÃO altera** RPCs financeiras, estoque, ordens, fidelidade ou bloqueios RC. Uma solicitação não é um cancelamento, não é um reembolso e não libera estoque.

## Pacote executado — solicitação e triagem, sem liquidação

Migration:
- `20261017195000_customer_order_cancellation_request_workflow.sql` — tabela de solicitações, eventos históricos, controles de exclusão lógica/uniqueness, autorização por RPC, fila restrita da loja.
- `20261017202000_customer_order_cancellation_lock_order.sql` — uniformiza aquisição de locks entre pedido e solicitação para evitar deadlocks durante requisição/revisão.

Tabelas: `customer_order_cancellation_requests`, `customer_order_cancellation_events`. RLS habilitada, **sem grants diretos a anon/authenticated**. Funções RPC:
- `request_customer_self_order_cancellation_safe(order_id,reason)`: exige sessão cliente ativa, valida loja e propriedade, registra motivo de 8–700 caracteres; idempotente para solicitação ativa.
- `get_customer_self_order_cancellation_requests_safe(limit)`: lê exclusivamente as próprias solicitações e eventos.
- `get_admin_order_cancellation_requests_safe(store_id,limit)`: loja com owner ou permissões `orders.view` e `orders.cancel`.
- `review_admin_order_cancellation_request_safe(id,status,note)`: owner ou `orders.cancel`; decisões possíveis nesta fase: `under_review`, `awaiting_return` somente em pedido `out_for_delivery`, ou `rejected` com justificativa de pelo menos 8 caracteres.

Estados previstos no modelo: `received`, `under_review`, `awaiting_return`, `refund_processing`, `approved`, `rejected`. **Nenhuma chamada da caixa administrativa pode forjar `refund_processing` ou `approved`.** O mapeamento desses dois estados às autoridades reais de estorno, conciliação e reversão física fica na integração Pedidos/Financeiro; não exibir ação de aprovar ficticiamente.

Acompanhamento: área **Minha conta → Pedidos** com formulário contextual, motivo, data/hora, resposta e histórico. Em `/p/<token>`, somente o portador de sessão pertencente à loja e de pedido que conste no próprio histórico pode solicitar; o token público por si só nunca autoriza alteração. Reconsulta periódica de 12–15 segundos nas interfaces existentes / novas.

Área administrativa: caixa recolhível em **Pedidos**, decisões restritas de triagem, atualização a cada 15 s, sem tocar em estoque/financeiro.

### Tipos de entrada

- `reserved` com pagamento pendente/falho: permanece o cancelamento simplificado legado; também pode solicitar revisão caso precise de assistência.
- `confirmed`, `ready` ou pedido com pagamento confirmado: registra solicitação, não altera o pedido.
- `out_for_delivery`: registra solicitação, possível estado `awaiting_return` **sem** baixa ou devolução fictícia.
- `completed`: registra **ocorrência pós-entrega/devolução**, não transforma o pedido concluído em cancelado.
- `cancelled`: não abre uma nova solicitação de cancelamento.

## Prova técnica

- Em transação revertida, duas identidades ativas na mesma loja: autor pode solicitar e acompanhar; outra identidade recebe `order_not_found` no pedido alheio, não lê eventos. Cliente sem acesso direto às tabelas nem à fila administrativa.
- Em transação revertida, proprietário da loja leu solicitação, marcou `under_review`, recusou com justificativa, e titular viu histórico de 3 eventos.
- Tentativa de operador declarar `refund_processing` sem autoridade devolveu `invalid_transition`. Status e pagamento do pedido original permaneceram iguais.
- O teste completo reproduzível, com rollback explícito, está versionado em `supabase/tests/customer_order_cancellation_requests.sql`.
- CI Verify e Vercel devem ser conferidos no SHA final depois das alterações da documentação; testes manuais ainda necessários.

## Limites / dependências fora desta frente (não fingir conclusão)

1. **Aprovação definitiva, estorno e reconciliação financeira** (inclusive Pix/cartão/OptmaPay e pagamento manual): trabalho da frente Pedidos/Financeiro, preservando `refund_workflow_required`. Nenhum estorno foi efetuado aqui.
2. **Retorno de entrega, conferência física e reversão de estoque**: trabalho de Pedidos/Estoque; preservado `delivery_return_reversal_required`.
3. **Atualização automática `refund_processing`/`approved`**: dependerá de eventos verificáveis do executor financeiro e da reconciliação de pedido/estoque. Não disponível na caixa de triagem.
4. Eventuais prazos de cancelamento e de devolução com implicação legal exigem política explícita por contexto e não podem ser inferidos apenas do status operacional.
5. Envio de e-mail/SMS/push proativo de decisão ainda não implantado. Status pode ser acompanhado na área de Clientes. Comunicação administrativa manual permanece possível fora desta frente.

## Roteiro de aceite externo controlado

1. Gelinhares, cliente autenticado: pedido `confirmed` ou `ready`, abrir Meus pedidos, expandir item, registrar motivo, conferir "Solicitação recebida"; atualizar e conferir persistência e histórico.
2. Admin com `orders.cancel`: abrir Pedidos, expandir solicitações, mover para "Em análise", conferir refletido na área de cliente; recusar com motivo e conferir o registro. Tentar nota curta de recusa; deve bloquear.
3. `/p/<token>`: com login da conta correta da loja, "Verificar minha conta" e solicitar; com outra conta ou outra loja, não deve expor formulário habilitado. Nunca enviar JWT em chat.
4. Pedido `out_for_delivery`: solicitar e colocar "Aguardando retorno" apenas como **pendência de conferência**; pedido não muda status nem estoque.
5. Pedido já pago: solicitar, conferir que continua pago, sem qualquer estorno fictício; cancelar pela função administrativa atual deve permanecer bloqueado pelo RC.
6. Pedido concluído: abrir ocorrência/devolução, verificar que status permanece `completed`.
7. Mobile e tema escuro: campos, labels, estados e timeline; refresh em múltiplos aparelhos, sem exposição de dados de outro cliente.
8. Conferir solicitação duplicada: retorna a solicitação em andamento, não cria outra nem duplica histórico.

### Decisão

**Solicitação e triagem: implementadas em homologação, aguardando aceite manual.**  
**Cancelamento financeiro definitivo/reversão física: não implementados, dependem da frente autoridade.**  
Não chamar o fluxo completo de cancelamento/estorno de concluído antes de comprovação transacional das integrações.

> Nota separada de Clientes: o segundo SMS de recuperação e a ausência da logo no e-mail, relatados pelo usuário na mesma sessão, permanecem na frente anterior e não são homologados por este pacote.
