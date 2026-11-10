# P09 — Fechamento de Clientes: solicitações de privacidade, dispositivos e timeline
**Data:** 22/10/2026  
**Baseline:** OptmaIdea/optmamenu, branch agent/homologacao-geral-20260820, SHA fc9f5324bc6839730c2787231f10461a7809613e, CI SUCCESS, Vercel READY.

## Escopo preservado, sem regressões planejadas

Os fluxos de cadastro, OTP/SMS, sessões, pedidos de diferentes clientes, checkout, pagamentos OptmaPay já utilizados nos testes do titular, webhooks, reserva/estoque, fidelidade e cancelamentos não foram modificados. Não houve SQL ou chamadas reais para apagar usuários, pedidos ou pagamentos. A Edge Function `process-customer-account-deletion` já existe, incluindo retry administrativo; esta entrega **não** a reimplementa.

## Correções efetivas

1. **Resposta 409 da exclusão:** `CustomerService.processSelfAccountDeletion()` passa a ler o corpo de `FunctionHttpError.context.clone().json()`, para mostrar quantidade de pedidos ativos; um erro de rede/JSON inválido usa mensagem genérica e nunca expõe informações internas.
2. **Solicitação pendente recuperável:** registro inicial continua exigindo senha + SMS OTP. Caso a execução fique pendente, o Portal permite retomar **a mesma solicitação**, sem novo OTP, invocando o processamento protegido já existente. O servidor continua obrigatoriamente validando identidade, sessão, solicitação, pedidos ativos, retenção e revogação. Estado `processing` não oferece reexecução paralela.
3. **Sucesso real confirmado:** a interface só anuncia exclusão e executa logout após o serviço retornar `status=executed`. Se não houver confirmação, a solicitação permanece auditável.
4. **Apelidos de dispositivos:** verificações periódicas assíncronas não sobrescrevem mudanças confirmadas durante renomeação e desconexão, usando geração monotônica e trava durante a mutação. O polling entre dispositivos continua existindo (intervalo atual de 8 s), sem reescrever Edge Functions ou banco.
5. **Administração mais legível:** `Vida do Cliente` traduz status pending/processing no registro preservado da exclusão. A timeline traduz os principais estados de pedidos para pt-BR sem alterar os valores reais.
6. **Testes Vitest:** respostas 409 e 401, solicitação ausente, privacidade de erros, estado pendente vs executado, apresentação administrativa e rótulos de pedidos.

## Verificações reais necessárias para aceite final

- Abrir conta de teste **com pedido não concluído**; solicitar exclusão com senha/SMS, confirmar erro de pedidos ativos sem alteração no pedido.
- Após conclusão comercial legítima, retornar a Privacidade e usar `Tentar concluir exclusão pendente`; conferir logout, auditoria e acessos revogados (não usar pedido Pix/cartão pago sem estorno confirmado).
- Em dois dispositivos, alterar apelido de um; confirmar persistência e reprodução no outro; revogar um e verificar atualização após polling e impossibilidade de voltar sem OTP.
- Consultar Vida do Cliente e timeline: rótulos em português e links de pedidos funcionais.
- Testar login/logout, carrinho e checkout existentes com as mesmas identidades de homologação, sem refazer pagamentos reais durante este pacote.

## Limites

O teste automático não faz SMS de verdade nem exclui uma conta real. Não podemos afirmar aceitação ponta a ponta antes do teste manual com conta isolada. Essa distinção é intencional para preservar dados e pagamentos previamente homologados.
