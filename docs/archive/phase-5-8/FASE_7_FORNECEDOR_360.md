# Fase 7 — Fornecedor 360º / Vida do Fornecedor

## 1. Objetivo

A Fase 7 consolidou a área de fornecedores como uma visão gerencial completa, permitindo acompanhar cadastro, compras, cotações, produtos fornecidos, evolução de custos, contatos, relacionamento e linha do tempo operacional.

O objetivo principal foi transformar o fornecedor em uma entidade viva dentro da operação, no mesmo nível de maturidade da Vida do Produto.

---

## 2. Escopo entregue

### Cadastro enriquecido de fornecedores

O cadastro passou a contemplar informações cadastrais, fiscais, comerciais, financeiras, operacionais e de relacionamento.

Campos relevantes:

- razão social;
- nome fantasia;
- CPF/CNPJ;
- inscrições fiscais;
- regime tributário;
- contatos por área;
- dados financeiros;
- PIX;
- banco;
- pedido mínimo;
- política de frete;
- lead time;
- homologação;
- bloqueio;
- fornecedor preferencial;
- observações de relacionamento.

---

## 3. Vida do Fornecedor

A Vida do Fornecedor reúne informações operacionais e gerenciais em abas.

### Abas principais

- Compras
- Cotações
- Produtos
- Preços
- Contatos
- Relacionamento
- Linha do tempo

---

## 4. Compras

A aba Compras mostra o histórico de documentos de compra vinculados ao fornecedor.

Informações exibidas:

- código operacional `ENT-...`;
- data de emissão;
- status;
- quantidade de itens;
- quantidade total;
- valor total.

Boas práticas:

- usar o código `ENT-...` como referência operacional;
- evitar expor UUID ao usuário final;
- diferenciar compra criada, confirmada, aplicada ao estoque e cancelada.

---

## 5. Cotações

A aba Cotações mostra o histórico de cotações vinculadas ao fornecedor.

Informações exibidas:

- código `COT-...`;
- status;
- canal;
- responsável;
- itens;
- quantidade solicitada;
- quantidade aprovada;
- total cotado;
- total aprovado;
- compra gerada, quando houver.

Essa visão permite avaliar resposta comercial e aproveitamento das cotações.

---

## 6. Produtos fornecidos

A aba Produtos exibe os produtos comprados ou historicamente vinculados ao fornecedor.

Indicadores exibidos:

- produto;
- status;
- número de compras;
- quantidade total;
- custo médio;
- menor custo;
- maior custo;
- último custo;
- variação;
- última compra.

A aba também permite navegar para a Vida do Produto.

---

## 7. Preços

A aba Preços mostra a evolução de custos por produto e documento.

Informações exibidas:

- produto;
- custo unitário;
- quantidade;
- total;
- origem;
- documento;
- data;
- status;
- observação.

Registros cancelados ou inativos permanecem visíveis para rastreabilidade, mas não devem ser usados como referência principal de negociação.

---

## 8. Contatos

A aba Contatos consolida:

- contatos cadastrados em `supplier_contacts`;
- contato comercial do cadastro principal;
- contato financeiro do cadastro principal;
- contato fiscal do cadastro principal.

Funcionalidades:

- abrir WhatsApp;
- ligar;
- enviar e-mail;
- identificar contato principal;
- diferenciar contato ativo/inativo;
- classificar por departamento.

---

## 9. Relacionamento

A aba Relacionamento registra eventos manuais da relação com o fornecedor.

Exemplos:

- anotações;
- ligações;
- reuniões;
- e-mails;
- incidentes;
- bloqueios;
- desbloqueios;
- aprovações;
- rejeições;
- mudanças de status.

Essa aba mantém o histórico humano/manual da relação.

---

## 10. Linha do tempo unificada

A aba Linha do tempo reúne eventos manuais e eventos operacionais.

Fontes principais:

- `supplier_relationship_events`;
- `operational_timeline_events`.

Eventos cobertos:

- cotação criada;
- canal de cotação definido;
- cotação aprovada;
- cotação convertida em compra;
- compra criada;
- compra confirmada;
- compra aplicada ao estoque;
- compra cancelada;
- rascunho excluído;
- eventos manuais de relacionamento.

A timeline usa status operacional derivado por tipo de evento, evitando confundir o status técnico do evento com o estágio real do processo.

---

## 11. RPCs principais

RPCs usadas pela Vida do Fornecedor:

- `get_supplier_360_summary`
- `get_supplier_purchase_history`
- `get_supplier_supplied_products`
- `get_supplier_price_evolution`
- `get_supplier_contacts`
- `get_supplier_relationship_timeline`
- `get_supplier_quotation_history`
- `get_supplier_unified_timeline`
- `create_supplier_contact`
- `create_supplier_relationship_event`
- `update_supplier_operational_status`

---

## 12. Tabelas principais

- `suppliers`
- `supplier_contacts`
- `supplier_relationship_events`
- `purchase_documents`
- `purchase_document_items`
- `purchase_quotations`
- `purchase_quotation_items`
- `supplier_price_history`
- `operational_timeline_events`
- `products`
- `stock_movements`

---

## 13. Decisões importantes

### UUID não deve ser referência principal para o usuário

Sempre que possível, usar:

- `ENT-...` para compras;
- `COT-...` para cotações;
- `TRF-...` para transferências.

### Datas

- `issue_date` é data documental/fiscal.
- `occurred_at`, `created_at`, `confirmed_at`, `cancelled_at` e equivalentes são datas operacionais.
- Datas `YYYY-MM-DD` devem ser formatadas sem deslocamento de fuso.

### Contatos

A Vida do Fornecedor consolida contatos formais e contatos do cadastro principal para evitar duplicidade operacional.

---

## 14. Pendências futuras

- exportação PDF da área de fornecedores;
- filtros avançados por período/status nas abas internas;
- score de fornecedor;
- indicadores de prazo médio de resposta;
- comparação entre fornecedores por produto;
- documentação fiscal/XML;
- integração futura com contas a pagar.