# Recebimento de compras — ressalvas, divergências e encerramento

Data: 2026-09-05

## Objetivo

Separar corretamente três fatos que hoje ainda aparecem misturados no recebimento de compras:

1. **o que foi apresentado pelo fornecedor nesta entrega**;
2. **o que foi efetivamente aceito e entrou no estoque**;
3. **o que acontecerá com a diferença comercial/fiscal**.

A quantidade não aceita **não deve ser automaticamente tratada como saldo pendente de mercadoria**. Ela só permanece pendente quando houver decisão explícita de que o fornecedor ainda fará complemento ou reposição.

## Caso real que evidenciou a lacuna

Documento: `ENT-20260905-102359-879`

- Flokito: pedido 15, recebido/aceito 15.
- Graviola: pedido 15, registrado como recebido/aceito 14.
- Observação geral: `1 picolé de Graviola derreteu`.

No modelo atual, o sistema calcula 1 unidade pendente e mantém a compra como `partially_received`, mas não sabe se essa unidade:

- será reposta;
- foi recusada por avaria;
- gerará abatimento/crédito;
- será devolvida;
- motivará recusa/devolução integral da NF/entrega;
- ou será aceita como diferença encerrada.

Além disso, como a avaria foi escrita apenas na observação geral, o recebimento atual não ficou formalmente classificado como divergência.

## Princípio de negócio

O OptmaMenu deve manter **estoque físico**, **situação do recebimento** e **tratamento da ocorrência** como dimensões relacionadas, porém independentes.

### Estoque físico

Só aumenta pela quantidade realmente aceita.

Exemplo: chegaram 15 unidades, 1 derreteu e 14 foram aceitas:

- apresentado pelo fornecedor: 15;
- aceito no estoque: 14;
- avaria: 1;
- entrada física: +14.

A Vida do Produto deve mostrar apenas o fato físico: **entrada de 14 unidades**. Não deve exibir texto de “1 pendente” nesse cartão.

### Situação da compra

O documento pode estar:

- `draft` — ainda sem recebimento;
- `partially_received` — existe mercadoria realmente aguardada em outra entrega;
- `confirmed` — recebimento encerrado sem ocorrência aberta;
- `received_with_exception` — recebimento físico encerrado, mas houve ressalva/ocorrência;
- `returned` — entrega/NF recusada ou devolvida integralmente;
- `cancelled` — cancelamento administrativo do documento.

Recomendação de implementação: manter o status físico principal e uma segunda dimensão de ocorrência (`none`, `open`, `resolved`) para evitar explosão de estados internos. A interface pode apresentar rótulos compostos como “Recebida com ressalva” ou “Aguardando fornecedor”.

## Regra obrigatória quando houver diferença

Sempre que ocorrer uma das condições abaixo, a interface deve exigir uma decisão antes de concluir o recebimento:

- `apresentado < saldo esperado`;
- `aceito < apresentado`;
- item incorreto informado;
- excesso informado;
- avaria informada.

O usuário não deve depender de abrir manualmente uma área escondida de “problemas”. O sistema detecta a diferença e pergunta o que ela significa.

## Fluxo proposto no modal “Receber compra”

### 1. Informar o que chegou

Para cada item:

- Pedido;
- Já aceito anteriormente;
- Saldo esperado antes desta entrega;
- **Apresentado nesta entrega**;
- **Aceito no estoque**.

### 2. Se não houver diferença

O fluxo segue normalmente.

### 3. Se houver diferença

Abrir automaticamente:

**“Há uma diferença de X unidade(s). O que acontecerá com essa diferença?”**

Opções:

#### A. Fornecedor entregará depois

Uso: entrega parcial prevista ou complemento posterior.

Efeito:

- quantidade fica como saldo de mercadoria pendente;
- compra permanece `partially_received`;
- não cria ressalva comercial se não houver problema;
- próximo recebimento apresenta somente o saldo restante.

#### B. Receber com ressalva

Uso: falta, avaria, item incorreto ou outra ocorrência em entrega que será aceita.

Após selecionar, exigir **tipo da ocorrência**:

- falta;
- avaria;
- item incorreto;
- excesso;
- outro.

E exigir **tratamento esperado**:

- reposição pelo fornecedor;
- abatimento/desconto;
- crédito/bonificação futura;
- devolução parcial;
- aceite da diferença e encerramento;
- outro tratamento.

Efeito:

- só a quantidade aceita entra no estoque;
- cria ocorrência auditável vinculada ao recebimento, compra, item e fornecedor;
- se houver reposição, mantém saldo de mercadoria aguardado;
- se houver abatimento/crédito/devolução sem reposição, encerra o saldo físico do item e mantém apenas a ocorrência comercial/financeira aberta;
- a compra aparece como **Recebida com ressalva** ou **Aguardando fornecedor**, conforme o caso.

#### C. Recusar/devolver toda esta entrega/NF

Uso: a entrega inteira não será aceita.

Efeito:

- nenhuma quantidade desta entrega deve permanecer no estoque;
- se o recebimento já foi gravado, a operação usa a reversão auditável existente;
- o documento passa a situação `returned`/“Devolvida/recusada”;
- mantém histórico, usuário, data, motivo e referência da NF;
- pode permitir posteriormente vincular nova NF/novo documento de substituição.

## Como interpretar falta x avaria

### Exemplo 1 — faltou uma unidade

Pedido 15. O fornecedor trouxe 14.

- apresentado: 14;
- aceito: 14;
- diferença: 1.

O sistema pergunta se:

- a unidade será entregue depois; ou
- é uma falta aceita com ressalva e será tratada por reposição, abatimento, crédito etc.

### Exemplo 2 — uma unidade chegou derretida

Pedido 15. O fornecedor trouxe as 15, mas 1 não foi aceita.

- apresentado: 15;
- aceito: 14;
- avaria: 1.

A interface deve abrir automaticamente a decisão de ressalva. Nesse caso não é correto registrar “chegou 14” se fisicamente 15 foram apresentadas.

## Ocorrências de recebimento

Não reutilizar diretamente a fila `stock_discrepancy_occurrences` como estrutura principal de compras. Ela foi criada com foco em exceções operacionais de estoque/venda e possui acoplamentos específicos a pedidos.

Criar estrutura própria, por exemplo `purchase_receipt_issues`, com pelo menos:

- `id`;
- `store_id`;
- `purchase_document_id`;
- `receipt_id`;
- `purchase_document_item_id`;
- `product_id`;
- `supplier_id`;
- `issue_type` (`shortage`, `damage`, `wrong_item`, `excess`, `other`);
- `quantity`;
- `disposition` (`awaiting_replacement`, `discount`, `supplier_credit`, `partial_return`, `accepted_closed`, `other`);
- `status` (`open`, `waiting_supplier`, `waiting_financial`, `resolved`, `cancelled`);
- `notes`;
- `resolved_by`;
- `resolved_at`;
- `resolution_notes`;
- referências fiscais/financeiras opcionais;
- `created_by`, `created_at`, `updated_at`.

## Onde tratar na interface

### Compras

É o ponto primário.

No próprio documento de compra:

- registrar recebimento;
- visualizar parcelas;
- visualizar ressalvas;
- resolver ocorrência;
- desfazer recebimento;
- concluir ou devolver a compra.

### Divergências

A tela global de **Divergências** deve ganhar uma visão/filtro para **Recebimentos de compras**.

Ela será a fila operacional para pendências que precisam de acompanhamento:

- aguardando reposição;
- aguardando fornecedor;
- aguardando abatimento/crédito;
- aguardando documento de devolução;
- vencidas/sem resolução.

Não deve misturar conceitualmente “saldo de produto aguardando entrega” com “ocorrência comercial aguardando resolução”.

### Fornecedor 360º

Exibir indicadores de qualidade de entrega:

- entregas com ressalva;
- faltas;
- avarias;
- itens incorretos;
- tempo médio de resolução;
- reincidência.

### Financeiro

Não alterar silenciosamente o valor fiscal da NF.

Manter separados:

- valor original da NF/documento;
- valor das mercadorias efetivamente aceitas;
- valor em disputa/ressalva;
- ajustes posteriores (crédito, abatimento, devolução etc.).

Quando uma ocorrência exigir efeito financeiro, ela deve gerar/ligar uma pendência financeira específica, em vez de simplesmente modificar o total original do documento.

### Vida do Produto

Deve permanecer estritamente física e auditável.

Mostrar:

- quantidade que entrou ou saiu;
- local;
- fornecedor/origem quando aplicável;
- referência correta do recebimento (`REC-...`) ou documento;
- saldo antes/depois.

Não mostrar “quantidade pendente de compra” no cartão de movimentação física.

Se depois houver reposição de 1 unidade, a Vida do Produto mostrará uma nova entrada de +1, preservando a sequência real dos fatos.

## Regras de consistência

1. `accepted_quantity <= reported_quantity`.
2. Quantidade aceita é a única que altera estoque.
3. `accepted < reported` exige classificação de ocorrência.
4. `reported < saldo esperado` exige decisão explícita: **entrega parcial futura** ou **ressalva**.
5. A observação geral não substitui a classificação de ocorrência.
6. Uma ocorrência com reposição pode manter saldo de mercadoria pendente.
7. Uma ocorrência com abatimento/crédito/devolução sem reposição encerra o saldo físico, mas mantém a ocorrência aberta até sua resolução comercial/financeira.
8. Reversão nunca apaga histórico.
9. Recusa/devolução integral remove do estoque qualquer quantidade aceita daquela entrega por meio de reversão auditável.
10. O histórico do produto não deve inferir nem exibir pendências comerciais.

## Critérios de aceite para a próxima implementação

1. Receber pedido completo sem diferença continua sendo fluxo de um clique/atalho.
2. Recebimento parcial voluntário mantém saldo pendente sem marcar problema.
3. Quantidade menor que o esperado obriga a escolher “entrega depois” ou “ressalva”.
4. Quantidade aceita menor que a apresentada obriga a classificar ocorrência.
5. Avaria permite apresentado 15, aceito 14, avaria 1.
6. “Receber com ressalva + reposição” mantém 1 unidade aguardada.
7. “Receber com ressalva + crédito/abatimento” encerra o saldo físico e abre ocorrência comercial.
8. “Devolver/recusar toda a entrega” reverte o estoque e preserva histórico.
9. A tela Divergências lista ocorrências de recebimento de compras.
10. O Fornecedor 360º recebe histórico/indicadores dessas ocorrências.
11. A Vida do Produto mostra apenas movimentos físicos, com referência `REC-...`, origem fornecedor e contraste correto em modo escuro.
