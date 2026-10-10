# Fechamento da etapa financeira OptmaPay ↔ OptmaMenu — 10/10/2026

## Objetivo

Encerrar a frente específica de integração financeira do OptmaPay Sandbox com o OptmaMenu, deixando o comportamento de Livro Diário, Extrato, recebíveis, taxas, liquidação e conciliação compreensível para o usuário comum e auditável quando necessário.

Esta etapa continua **Sandbox**. Nenhum fluxo aqui autoriza processamento de dinheiro real.

## Modelo financeiro adotado

### Livro Diário

O **Modo Livro** representa resultado operacional.

- venda = entrada operacional;
- taxa de meio de pagamento = saída/despesa financeira;
- estorno e demais despesas afetam resultado conforme sua classificação;
- transferências entre contas próprias não aparecem como receita ou despesa.

Cards do Modo Livro continuam representando Entradas, Saídas e Resultado Operacional conforme o período.

### Extrato

O **Modo Extrato** representa onde o dinheiro está.

- cada conta financeira possui seu próprio saldo e movimentos;
- transferências internas alteram as contas envolvidas, mas não o resultado;
- o consolidado simplificado evita linhas técnicas redundantes;
- o modo completo preserva as linhas para auditoria.

O antigo conceito visual de “Saldo inicial” passa a ser tratado como **Saldo acumulado**, isto é, tudo que já estava naquela conta antes do período filtrado.

### Conciliação de saldo de conta

Uma conta específica pode receber:

- Entrada externa;
- Saída externa;
- Ajuste de saldo acumulado.

O ajuste de saldo acumulado recebe o saldo real informado pelo usuário e cria somente a diferença necessária no razão financeiro. Esse lançamento é transparente e **não afeta o resultado operacional**.

Isso permite iniciar a conta com saldo anterior, importar a posição atual de um banco e registrar movimentos externos que não nasceram no OptmaMenu.

## Cartão: bruto, taxa e líquido

Para cartões, a leitura padrão é:

**Venda bruta - taxas = líquido creditado**

Exemplo homologado:

- bruto: R$ 3,75;
- MDR: R$ 0,03;
- antecipação: R$ 0,04;
- total de taxas: R$ 0,07;
- líquido efetivamente creditado: R$ 3,68.

Na conta bancária não é criado um débito fictício para a taxa quando o adquirente já a reteve antes do crédito. O extrato da conta mostra o crédito líquido e a composição bruto/taxas/líquido.

O custo financeiro é reconhecido em:

**Despesas financeiras → Taxas de meios de pagamento (2.6.2)**

O balancete operacional exclui transferências internas e mostra a despesa das taxas normalmente.

## Antecipação

A antecipação deixou de atualizar saldo diretamente pelo frontend do OptmaPay.

A operação agora é autoritativa no PostgreSQL:

1. bloqueia transação, recebível e conta;
2. calcula o custo adicional de antecipação no servidor;
3. credita somente o líquido real;
4. atualiza o recebível;
5. gera `receivable.settled`;
6. cria o job de webhook;
7. OptmaMenu recebe o líquido real;
8. a diferença entre o líquido originalmente previsto e o valor efetivamente liquidado é reconhecida como custo financeiro adicional.

O teste transacional da nova RPC comprovou:

- recebível liquidado;
- taxa de antecipação calculada;
- saldo creditado uma única vez;
- evento `receivable.settled` criado;
- delivery job criado.

O Golden Debit/Credit permaneceu aprovado após a alteração.

## Correção do caso Sandbox já antecipado

O débito de homologação `PED-20261004-001552-00FC` havia sido antecipado pelo fluxo antigo:

- bruto R$ 3,75;
- MDR R$ 0,03;
- líquido D+1 R$ 3,72;
- antecipação R$ 0,04;
- líquido real R$ 3,68.

O OptmaPay já mostrava R$ 3,68, mas o recebível autoritativo e o OptmaMenu ainda guardavam R$ 3,72.

Foi feita reconciliação controlada desse registro Sandbox:

- OptmaPay: anticipation fee R$ 0,04, net R$ 3,68;
- OptmaMenu: anticipation fee R$ 0,04, net R$ 3,68;
- taxa do Livro Diário: R$ 0,07;
- transferência para banco: R$ 3,68.

Após a reconciliação, o período de outubro dos três cartões homologados ficou:

- vendas brutas: R$ 40,00;
- taxas financeiras: R$ 0,46;
- resultado operacional: R$ 39,54.

Isso coincide com o crédito líquido observado no OptmaPay.

## Plano de contas

Foi corrigida a árvore da conta `payment_processing_fees`, cujo path não apontava corretamente para o pai.

Agora:

- Saídas;
- Despesas financeiras;
- Taxas de meios de pagamento.

O balancete operacional não mistura mais transferências internas com despesas.

## Validações finais desta frente

- Golden Debit: aprovado.
- Golden Credit: aprovado.
- conta corrente não debitada na compra a crédito: aprovado.
- fatura autoritativa: aprovado.
- D+ automático: aprovado.
- webhook de liquidação: aprovado.
- idempotência: aprovada.
- taxa MDR contabilizada: aprovada.
- antecipação autoritativa: aprovada por teste transacional com rollback.
- custo adicional de antecipação no OptmaMenu: aprovado por teste transacional com rollback.
- conciliação de saldo acumulado: RPC testada com identidade proprietária.
- transferências internas fora do resultado operacional: aprovado.
- taxas em Despesas financeiras: aprovado.

## Estado de encerramento

A frente **OptmaPay / cartões / financeiro do OptmaMenu** fica encerrada para desenvolvimento desta etapa.

Na fase de testes gerais para entrega do OptmaMenu, revisar novamente:

- responsividade e contraste;
- extratos por conta;
- saldo acumulado;
- importação/lançamentos externos;
- recebíveis e liquidações;
- antecipação;
- cancelamento/estorno;
- conciliação geral;
- relatórios e impressão.

Mudanças futuras de produto financeiro devem partir deste modelo, evitando reintroduzir códigos técnicos na interface ou tratar transferências internas como receita/despesa.


## Adendo de encerramento — simplificação das contas e conta PJ

A Gelinhares foi simplificada para três contas visíveis ao usuário:

- **Caixa Loja Centro** — conta geral e padrão dos lançamentos manuais; recebe todas as formas ativas e concentra o saldo em espécie por forma de pagamento;
- **OptmaPay** — conta bancária externa Sandbox;
- **Retaguarda do caixa** — destino operacional para sangrias e guarda de numerário.

A conta **Compensação OptmaPay (interno)** continua ativa apenas como infraestrutura contábil dos recebíveis D+1. Ela fica oculta da interface comum e não deve ser confundida com uma quarta conta operacional.

Foram consolidados e ocultados os cadastros legados Caixa físico, CEF, Carteira Pix, Maquininha, Recebíveis de cartão, Proprietário e InfinitePay. O legado Asaas foi removido da Gelinhares, incluindo provider, conta financeira, referências e metadados específicos.

O saldo reconstruído da conta OptmaPay na data em que a conta foi cadastrada no OptmaMenu (27/09/2026 21:21:51 -03) é **R$ 14.798,71**. Esse valor foi registrado como saldo acumulado inicial sem afetar o resultado operacional.

A tarifa PJ do OptmaPay Sandbox foi configurada em **R$ 12,99 por mês**, com cobrança no dia 1 e retroativos de setembro e outubro/2026. A tarifa de outubro foi sincronizada no OptmaMenu como despesa bancária, pois ocorreu depois da abertura da conta financeira. Após a conciliação, o saldo do OptmaPay e o saldo da conta OptmaPay no OptmaMenu ficaram ambos em **R$ 14.844,01**.

A conta PJ recebeu limite Sandbox de **R$ 5.000,00**. O motor de saldo permite saldo negativo apenas até o limite configurado e esse limite passou a participar das validações de Pix, débito, boleto, devolução Pix e pagamento de fatura.

Para simulação de custo de limite, foi adotada a referência mensal de **13,45% a.m.** da série SGS 25446 (BCB, agosto/2026). O IOF Sandbox permanece parametrizado, neste baseline, em **0,0082% ao dia + adicional de 0,38%**, deixando explícito que eventual produto real deverá validar enquadramento fiscal e regra vigente por perfil do tomador.

O extrato do OptmaPay passou a aceitar janela de até **90 dias** e ganhou exportação CSV do período exibido.

O workspace financeiro do OptmaMenu passa a exibir:
- data de cadastro da conta;
- limite e uso de limite quando aplicável;
- saldo devedor em contas que admitem negativo;
- cartão visual **Em espécie no caixa**, calculado a partir dos movimentos em dinheiro do Caixa Loja Centro;
- nomenclatura **A conferir** em vez de “Não distribuído”;
- papéis de conta e textos mais simples, com contraste reforçado no modo escuro.

Este adendo encerra a simplificação financeira da Gelinhares para o ciclo atual. A próxima revisão ampla desta frente deve ocorrer na regressão geral de entrega do OptmaMenu.
