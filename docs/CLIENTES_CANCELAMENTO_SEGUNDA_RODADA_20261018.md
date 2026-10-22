# Clientes / Loja Pública — Segunda rodada de cancelamentos — 18/10/2026

## Evidência de homologação manual

- Pedido `PED-20261017-210853-11FF`: retirada, pagamento na loja, cancelado pelo próprio cliente com console limpo. Banco confirmava `orders.status=cancelled`, `payment_status=pending`, nenhuma reserva ativa e `commercial_metadata.cancel_source=customer_self_service`. **Origem já persistida**, não precisa de campo novo para o rótulo.
- Pedido `PED-20261017-211309-4ED6`: retirada, pagamento antecipado Pix, confirmação apenas pela API, registro financeiro lançado, pedido em `ready`, `payment_status=paid` e duas reservas ativas; duas solicitações de cancelamento na trilha, uma recusada e uma nova, com análise e status refletidos imediatamente entre admin/cliente. **Não cancelar por alteração de status nem liberar reservas antes do estorno real**.
- `/p/<pedido>`: cliente relatou não conseguir solicitar. Correção frontend faz verificação automática da sessão já autenticada (antes exigia um clique manual extra) e exige correspondência de loja e pedido, sem confiar apenas no token público. Aguardando reteste em navegador real.
- Pedido anônimo: checkout atual permite prosseguir com pagamento antecipado sem autenticação. Para manter cancelamento self-service seguro, uma sessão autenticada e prova de identidade são necessárias. Definir como decisão comercial se `pay_now` exigirá login/cadastro; não desabilitar silenciosamente o fluxo existente.
- Enviar ao admin somente após pagamento: o pedido e a reserva são criados ANTES de iniciar/capturar Pix. Separar `pedido aguardando pagamento` de `fila operacional` requer distinguir visibilidade, aviso, reserva, prazo de pagamento e transição idempotente pelo webhook. Não implementar só filtrando cards, sem avaliar todo o fluxo.

## Modificações desta rodada

1. `src/pages/private/admin/commercial/orders/Orders.tsx`: rótulo visível de `Cancelado pelo cliente` quando `commercial_metadata.cancel_source=customer_self_service`, distinguindo de expiração automática ou cancelamento operacional. Não alterar estados nem reclassificar cancelamentos anteriores sem prova.
2. `src/pages/store/components/PublicOrderCancellationAccess.tsx`: verificação inicial automática do cliente em `/p`; ação para repetir verificação, mensagem explícita de autenticação requerida e verificação da loja, pedido e sessão.
3. **Efetivação financeira NÃO executada:** foi elaborado protótipo de migration para fechamento apenas de pedidos não pagos, pré-despacho, chamando o cancelamento protegido existente. A aplicação recebeu **bloqueio da ferramenta de segurança**. O arquivo não aplicado foi retirado da branch para evitar deriva Git/Supabase. Nenhuma RPC nova de efetivação está publicada e nenhum botão novo de aprovação definitiva foi ativado.
4. Os bloqueios `refund_workflow_required` / `delivery_return_reversal_required` permanecem em vigor. Nenhuma reserva, status, pagamento ou estorno do pedido Pix citado foi alterado por esta rodada.

## Contrato necessário para efetivação dos pedidos pagos

A frente Pedidos/Financeiro deverá fornecer operação rastreável de estorno real:
- checar método, provedor e identificador do pagamento, valor efetivamente liquidado e eventual estorno parcial/duplicado;
- persistir intenção/requisição de estorno idempotente (sem prometer `refund_processing` antes de envio aceito pelo provedor);
- receber confirmação autoritativa da liquidação do estorno pelo provedor, reconciliar cashbook/livro diário sem duplicar saídas;
- somente então transicionar pedido e reservas em operação transacional protegida, contabilizar estoque, conciliar fidelidade e registrar timeline;
- em `out_for_delivery`, antes de devolver estoque físico exigir retorno e conferência; em `completed`, tratar ocorrência/devolução em vez de desfazer entrega.
- monitorar falhas/retentativas/reembolsos atrasados e manter status explícito sem simular sucesso.

## Homologação curta

1. Abrir `/p/<token>` em navegador com sessão autenticada na loja; o formulário de solicitação deve aparecer automaticamente no pedido próprio.
2. Testar `/p` sem login e de outra conta/loja: não pode criar solicitação nem expor timeline de terceiro; mostrar encaminhamento para identificação.
3. Admin: verificar rótulo `Cancelado pelo cliente` no pedido `PED-20261017-210853-11FF`, preservando pedido `PED-20261017-211309-4ED6` pago e reservado.
4. Conferir GitHub Actions Verify e Vercel READY para o SHA final.

## Decisão

**Solicitação/triagem: homologada para pedidos próprios na conta; /p aguarda reteste após correção.**
**Efetivação de cancelamento financeiro: bloqueada por integração e autoridade de estorno real, não implementada.**
**Operação pré-pagamento na fila administrativa e exigência de login para pagamento antecipado: decisões comerciais ainda não homologadas.**
