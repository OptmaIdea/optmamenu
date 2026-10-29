# Fundação financeira de Compras e Contas a Pagar — Bloco 1

Data: 05/09/2026

## Objetivo

Separar definitivamente três dimensões que antes ficavam misturadas no fluxo de Compras:

1. **comercial** — a compra foi criada, comprometida ou cancelada;
2. **física** — nada recebido, parcial, recebido ou cancelado;
3. **financeira** — não definida, rascunho, em aberto, parcialmente paga, paga ou cancelada.

Criar uma obrigação financeira não movimenta saldo. O saldo da conta financeira é afetado somente quando uma baixa é registrada.

## Entidades

### `purchase_payment_terms`

Condições reutilizáveis de pagamento. Cada condição guarda os deslocamentos em dias a partir da data da compra.

Presets iniciais:

- À vista: `[0]`
- 7 dias: `[7]`
- 15 dias: `[15]`
- 30 dias: `[30]`
- 45 dias: `[45]`
- 30/60: `[30, 60]`
- 30/60/90: `[30, 60, 90]`

A condição à vista é tecnicamente uma parcela com vencimento no próprio dia.

### `accounts_payable`

Cabeçalho da obrigação financeira originada pela compra. Preserva valor original, valor líquido, total pago, saldo em aberto, fornecedor, compra, condição, forma de pagamento e conta prevista.

### `accounts_payable_installments`

Parcelas e vencimentos reais. O estado `overdue` não é persistido: vencimento é derivado de `due_date` + saldo/estado para evitar inconsistência temporal.

### `accounts_payable_adjustments`

Ledger de ajustes. Abatimento, crédito do fornecedor, devolução, correção e outros não sobrescrevem o valor original. Cada ajuste é reversível e auditável.

### `accounts_payable_payments`

Cada baixa financeira é um registro próprio, vinculado à parcela e à conta financeira que efetivamente forneceu o recurso. O pagamento gera uma saída em `cashbook_entries`; o estorno gera movimento inverso e preserva os dois fatos.

### `accounts_payable_events`

Timeline auditável de criação, ajustes, pagamentos, estornos e cancelamentos.

## Compra

`purchase_documents` passou a guardar, além do status legado usado pela operação atual:

- `commercial_status`
- `physical_status`
- `financial_status`
- `payment_term_id`
- `payment_term_snapshot`
- `payment_term_source`
- `payment_mode`
- `payment_method_code`
- `preferred_financial_account_id`
- `financial_gross_amount`
- `financial_adjustment_amount`
- `financial_net_amount`
- `financial_notes`
- `source_quotation_id`

Os estados comercial e físico são sincronizados a partir do status operacional existente, permitindo transição gradual sem quebrar telas atuais.

## Cotação → Compra → Financeiro

A cotação preserva quatro momentos diferentes da negociação financeira:

1. **sugestão do OptmaMenu**;
2. **condição enviada ao fornecedor**;
3. **condição respondida pelo fornecedor**;
4. **condição aceita pela empresa**.

Não há sobrescrita entre esses momentos.

### Sugestão automática

Prioridade inicial e auditável:

1. condição da compra recente do mesmo fornecedor (`recent_purchase`);
2. condição preferencial cadastrada no fornecedor (`supplier_default`);
3. condição padrão da loja (`store_default`).

A resposta do fornecedor prevalece como proposta comercial. Quando a cotação é aprovada, a condição respondida é usada como aceite padrão, podendo ainda ser substituída explicitamente pela empresa antes da conversão.

Ao converter a cotação, a condição aceita é herdada pela compra e gera a estrutura financeira correspondente.

## Regras financeiras

- criar Conta a Pagar **não** altera saldo de conta financeira;
- à vista e a prazo usam o mesmo domínio de Contas a Pagar;
- à vista = parcela única vencendo na data da compra;
- 30/60 = duas parcelas nos dias +30 e +60;
- centavos são distribuídos sem alterar o total da obrigação;
- pagamento acima do saldo da parcela é bloqueado;
- título com pagamento confirmado não pode ser cancelado sem estorno prévio;
- condição/valor não podem ser reestruturados depois de existir pagamento ou ajuste ativo;
- ajuste que reduziria a obrigação abaixo do valor já pago é bloqueado;
- a conta financeira prevista pode ser definida na compra, mas a conta efetiva é confirmada no momento da baixa;
- limites e cheque especial serão implementados no Bloco 6; este bloco não tenta inferir limite bancário.

## Segurança

Novas permissões:

- `accounts_payable.view`
- `accounts_payable.manage`
- `accounts_payable.pay`
- `accounts_payable.reverse_payment`

Padrões cadastrados:

- owner/admin: visão, gestão, baixa e estorno;
- manager: visão e gestão, sem baixa/estorno por padrão;
- staff/cashier/viewer: sem acesso por padrão.

As tabelas críticas possuem RLS. `authenticated` recebe SELECT conforme política e não recebe INSERT/UPDATE/DELETE direto. Escritas passam por RPCs `SECURITY DEFINER` com validação explícita de loja e permissão. `anon` não possui acesso nem EXECUTE nas RPCs financeiras.

## RPCs públicas seguras

Leitura e configuração:

- `list_purchase_payment_terms_safe`
- `upsert_purchase_payment_term_safe`
- `suggest_supplier_payment_term_safe`
- `set_purchase_financial_terms_safe`
- `list_accounts_payable_safe`
- `get_accounts_payable_detail_safe`

Ajustes e pagamentos:

- `apply_accounts_payable_adjustment_safe`
- `reverse_accounts_payable_adjustment_safe`
- `register_accounts_payable_payment_safe`
- `reverse_accounts_payable_payment_safe`
- `cancel_accounts_payable_safe`

Cotação:

- `set_purchase_quotation_payment_request_safe`
- `set_purchase_quotation_payment_response_safe`
- `accept_purchase_quotation_payment_terms_safe`

Funções internas iniciadas por `_` e funções de trigger não são executáveis por `anon` ou `authenticated`.

## Testes transacionais executados em homologação

Os testes foram executados dentro de subtransações revertidas de propósito para não deixar massa de teste.

Cenário principal:

- compra R$ 1.000 em 30/60;
- 2 parcelas de R$ 500;
- vencimentos 05/10/2026 e 04/11/2026 a partir de 05/09/2026;
- nenhum movimento financeiro ao criar a obrigação;
- abatimento de R$ 100 → líquido R$ 900;
- pagamento parcial R$ 300 → saldo R$ 600;
- tentativa de pagar acima do saldo da parcela bloqueada;
- estorno da baixa → efeito líquido no caixa volta a zero;
- estorno do abatimento → obrigação volta a R$ 1.000;
- cotação seguinte sugere 30/60 a partir da compra recente;
- fornecedor responde 45 dias;
- empresa aprova;
- compra convertida herda 45 dias;
- vencimento calculado em 20/10/2026.

Cenário de borda:

- compra à vista gera 1 parcela vencendo no dia da compra;
- confirmação da compra não recria o ID da parcela;
- pagamento integral encerra título como `paid`;
- cancelamento com pagamento confirmado é bloqueado;
- condição de outra loja é bloqueada;
- usuário `staff` sem permissão financeira não consegue operar o título.

Após os testes: zero documentos, cotações, títulos e movimentos de teste residuais.

## Fora do Bloco 1

Deliberadamente não entram nesta etapa:

- tela final de Contas a Pagar;
- editor visual de modelos de prazo;
- novo modal de recebimento;
- Central de Pendências de Compras;
- cheque especial/limites por conta;
- baixa automática de compra à vista;
- cartão de crédito do lojista e faturas;
- juros/multa;
- integração bancária/boleto.

Esses itens usam esta fundação nos blocos seguintes.
