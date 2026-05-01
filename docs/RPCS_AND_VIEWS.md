# RPCs, functions e views

## Objetivo
Documentar funções, RPCs e views usadas pelo sistema.

## Modelo de documentação
### Nome
### Objetivo
### Parâmetros
### Retorno
### Dependências
### Onde é usada no frontend
### Observações

---

## Itens prioritários para documentar primeiro
- `apply_stock_movement_delta`
- funções de confirmação/cancelamento de compra
- views de histórico e posição de estoque
- views/queries de transferências
- visões usadas por dashboards de fornecedor

## Fornecedor 360º

### get_supplier_360_summary
**Objetivo:** retorna o resumo gerencial do fornecedor.

### get_supplier_purchase_history
**Objetivo:** retorna histórico de compras do fornecedor, usando `document_code` como referência operacional.

### get_supplier_supplied_products
**Objetivo:** retorna produtos fornecidos, volumes, custos e última compra.

### get_supplier_price_evolution
**Objetivo:** retorna evolução de custos por produto e documento.

### get_supplier_contacts
**Objetivo:** retorna contatos consolidados do fornecedor, unindo `supplier_contacts` e contatos do cadastro principal.

### get_supplier_relationship_timeline
**Objetivo:** retorna eventos manuais de relacionamento.

### get_supplier_quotation_history
**Objetivo:** retorna histórico de cotações vinculadas ao fornecedor.

### get_supplier_unified_timeline
**Objetivo:** retorna linha do tempo unificada, combinando eventos manuais e eventos operacionais.

### create_supplier_contact
**Objetivo:** cria contato estruturado do fornecedor.

### create_supplier_relationship_event
**Objetivo:** cria evento manual de relacionamento.

### update_supplier_operational_status
**Objetivo:** atualiza status operacional do fornecedor, incluindo bloqueio, desbloqueio, aprovação e rejeição.
