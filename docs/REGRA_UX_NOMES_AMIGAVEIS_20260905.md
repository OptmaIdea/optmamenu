# Regra de UX — nomes amigáveis em todas as telas

Data: 2026-09-05

## Regra permanente

Em interfaces destinadas a usuários finais do OptmaMenu, exibir **somente nomes, rótulos e descrições amigáveis**.

Não exibir identificadores técnicos ou internos quando existir uma representação humana equivalente, incluindo, entre outros:

- códigos internos de condições de pagamento (`d30`, `d30_60`, `cash` etc.);
- códigos de formas de pagamento (`pix`, `bank_transfer`, `account_debit` etc.);
- códigos de contas financeiras quando o nome da conta estiver disponível;
- códigos internos de locais de estoque quando o nome do local for suficiente;
- enums e status de banco em inglês;
- UUIDs, salvo em telas explicitamente técnicas/auditoria quando não houver identificador de negócio.

Identificadores de negócio criados para uso operacional, como `ENT-...`, `REC-...`, `RSV-...`, `COT-...` e equivalentes, podem ser exibidos porque funcionam como referências amigáveis e auditáveis do processo.

## Fallback

Se um nome amigável não puder ser resolvido, a UI deve usar um texto humano neutro, como `Não informado`, `Forma de pagamento` ou `Conta financeira`, em vez de revelar o valor interno.

## Aplicação

Esta regra deve ser considerada obrigatória em novas telas e em toda revisão de UX. Exceções somente em áreas deliberadamente técnicas/administrativas em que o código seja parte do dado que o usuário precisa editar.
