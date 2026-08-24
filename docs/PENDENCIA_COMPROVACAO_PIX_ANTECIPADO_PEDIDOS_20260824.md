# Pendência — comprovação manual de PIX antecipado em pedidos

Data: 2026-08-24

## Contexto

Em pedidos com pagamento antecipado por PIX, quando não houver integração automática com API/webhook bancário, o cliente poderá enviar um comprovante. Esse comprovante **não deve, sozinho, transformar o pedido em pago**.

A confirmação financeira precisa ser uma ação explícita, auditável e autorizada da equipe da loja.

## Fluxo funcional desejado

1. O pedido é criado com pagamento PIX e estado financeiro `pending` / aguardando comprovação.
2. O cliente pode anexar/enviar um comprovante do PIX pelo fluxo do pedido.
3. O comprovante fica associado ao pedido com data/hora e origem, mas sem produzir baixa financeira automática.
4. Um usuário com permissão financeira visualiza o comprovante e escolhe:
   - **Confirmar recebimento**;
   - **Rejeitar comprovante**;
   - **Solicitar novo comprovante** / manter pendente.
5. Ao confirmar o recebimento, em uma única operação transacional:
   - o pedido passa para pagamento `paid`;
   - é criado/confirmado o lançamento correspondente no Livro Diário;
   - a conta financeira PIX selecionada recebe o valor;
   - ficam registrados usuário, data/hora, comprovante e forma de validação;
   - o pedido deixa de ser elegível à expiração/cancelamento automático por falta de pagamento.
6. Se o comprovante for rejeitado, o pedido continua pendente e o motivo da rejeição fica auditado.
7. Se o prazo expirar sem confirmação financeira, aplica-se a política normal de expiração/cancelamento do pedido e liberação de reservas.

## Regra de segurança

- Não usar OCR, IA ou análise visual do comprovante como fonte autoritativa de pagamento.
- A imagem pode auxiliar a conferência humana, mas a confirmação manual precisa ser explícita.
- Quando houver integração bancária, webhook/API do provedor passa a ser a fonte autoritativa preferencial, mantendo o modo manual como exceção controlada.

## Dados mínimos a preservar

- `order_id` / código do pedido;
- identificador/URL segura do comprovante;
- valor informado;
- data/hora apresentada no comprovante, se informada pelo cliente;
- conta financeira de destino;
- usuário que confirmou/rejeitou;
- data/hora da decisão;
- motivo de rejeição ou observação;
- origem da confirmação: `bank_webhook`, `manual_proof_review` ou equivalente;
- trilha de auditoria imutável.

## Relação com cancelamento automático

A confirmação financeira deve ser considerada antes do job de expiração. O job não pode cancelar um pedido que já possua confirmação financeira válida, ainda que o comprovante tenha sido confirmado manualmente pouco antes do limite.

É necessário tratar concorrência/idempotência para impedir que confirmação financeira e expiração sejam aplicadas simultaneamente em terminais ou processos diferentes.

## Fora do escopo da rodada atual

Esta pendência pertence ao ciclo de **pedido ainda não concluído**. A rodada atual de Vendas realizadas trata reversões **após a conclusão** da venda: cancelamento/estorno total e devolução parcial, preservando estoque, Livro Diário, conta financeira e auditoria.

## Critérios para considerar esta pendência encerrada

- upload/associação segura do comprovante ao pedido;
- tela financeira de conferência;
- confirmação/rejeição com permissão;
- operação transacional de confirmação financeira;
- bloqueio correto da expiração após confirmação;
- idempotência e teste de corrida confirmação × expiração;
- histórico visível no detalhe do pedido;
- posterior compatibilidade com webhook/API bancária.
