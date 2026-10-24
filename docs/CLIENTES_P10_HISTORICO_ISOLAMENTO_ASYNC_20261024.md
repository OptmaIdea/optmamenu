# Clientes P10 — Histórico navegável e isolamento de respostas assíncronas

Data: 24/10/2026. Baseline `cb2f5cb765ecfedef8f4629dd3f8376115ac39de`, CI SUCCESS e Vercel READY.

## Aceites reais registrados nesta rodada

1. **Exclusão com pedido pendente:** bloqueada e acompanhada por aviso amigável — **ACEITO**, segundo validação manual do usuário.
2. **Conta Cris em tablet e celular:** apelidos personalizados dos dois dispositivos permanecem após sair e entrar novamente no tablet — **ACEITO**.
3. **Vida do Cliente:** status em português — **ACEITO**.

Não reabrir estes casos nem solicitar que o usuário refaça o que validou. O P09 permanece aplicado. O commit posterior de `send-customer-otp-sms` que escolhe credencial OptmaSMSGate por loja foi preservado.

## Melhorias implementadas no P10

### 1. Meu consumo → Pedido correspondente

- Cada ocorrência histórica de produto concluído ganha **Abrir pedido no histórico**.
- O pedido precisa estar na lista autenticada de pedidos da conta atual; não confia em identificador de URL ou de outra conta.
- Na aba Pedidos mostra **somente o pedido selecionado**, abre seu detalhe, limpa filtros contraditórios e oferece **Ver todos os pedidos**.
- Não pesquisa nem modifica pedidos de outra pessoa e não interfere em cobrança, preço ou estoque.

### 2. Proteção contra retorno tardio de APIs privadas

- Introdução de um guard de identidade `(customerId, storeId, generation)`, com testes unitários.
- Pedidos, notificações, endereços e avaliações não aplicam resultado de solicitação anterior após a troca de cliente/loja ou retorno fora de ordem.
- As solicitações de cancelamento (lidas em paralelo aos pedidos) utilizam o mesmo gate dos pedidos, para não exibir estado antigo após a troca.
- A troca de identidade limpa o estado de pedidos, cancelamentos, mensagens, endereços, avaliações e foco anterior.
- Mantidos o refresh de 12s, o canal realtime existente e a sincronização de carrinho; nenhum polling extra criado.

## Contrato de não regressão

Não modificar funções Supabase, SQL/RLS, providers, OptmaPay/ASAAS, gateway SMS, identidade JWT, descontos, fidelidade, QR, pedido, reserva, baixa de estoque ou conciliação.

A suíte anterior P00–P09 deverá continuar verde, além do build. Não fazer ensaios destrutivos com dados de cliente real. A verificação em navegador requer conta de teste para confirmar:
- Em **Meu consumo** abra um produto concluído, expanda as ocorrências, toque em **Abrir pedido no histórico**; somente o pedido escolhido deve aparecer, com detalhes expandidos.
- Toque em **Ver todos os pedidos**; deve retornar à listagem completa, sem alterar carrinho ou pedidos.
- Em sessão válida, mudança de status do pedido deve continuar chegando automaticamente.
- Em contas de teste distintas, não devem aparecer pedidos, endereços ou mensagens da conta anterior enquanto há solicitações pendentes.

## Limite

O guard protege respostas no frontend, sem substituir validação de JWT, RLS e revogação de sessão no servidor. CI + READY não são prova de navegação ponta a ponta em vários aparelhos.
