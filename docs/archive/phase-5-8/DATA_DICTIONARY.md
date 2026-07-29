# Dicionário de Dados

## Catálogo

### products
**Objetivo**
Cadastro principal de produtos da store.

**Campos importantes**
- id
- store_id
- category_id
- name
- description
- price
- active
- stock_quantity
- min_stock
- max_stock
- last_sale_at
- last_stock_entry_at
- is_discontinued

**Observações**
- `stock_quantity` é legado/histórico e não deve ser tratado como única fonte da verdade no multiestoque.
- `min_stock` e `max_stock` ainda representam a camada global do produto.

### categories
*(A documentar)*

---

## Estoque

### inventory_location_balances
**Objetivo**
Armazena o saldo por produto e por local.

**Campos importantes**
- store_id
- location_id
- product_id
- on_hand
- reserved
- updated_at

**Observações**
- é a base principal da visão por local.
- o disponível é normalmente derivado de `on_hand - reserved`.

### inventory_balances
*(A documentar)*

### inventory_movements
*(A documentar)*

### stock_movements
*(A documentar)*

### stock_reservations
*(A documentar)*

### stock_locations
*(A documentar)*

---

## Transferências

### stock_transfers
**Objetivo**
Representa a transferência de estoque entre locais.

**Campos importantes**
- source_location_id
- destination_location_id
- status
- transfer_code
- requested_at
- shipped_at
- received_at
- notes
- cancel_reason

**Observações**
- serve como cabeçalho da transferência.
- os itens ficam em `stock_transfer_items`.

### stock_transfer_items
*(A documentar)*

---

## Compras

### purchase_documents
*(A documentar)*

### purchase_document_items
*(A documentar)*

### supplier_price_history
*(A documentar)*

### suppliers
**Objetivo**
Cadastro principal de fornecedores da loja.

**Campos importantes**
- id
- store_id
- name
- legal_name
- trade_name
- document
- phone
- email
- active
- homologation_status
- preferred_supplier
- blocked
- blocked_reason
- commercial_contact_name
- commercial_phone
- commercial_whatsapp
- commercial_email
- financial_contact_name
- financial_phone
- financial_email
- fiscal_contact_name
- fiscal_phone
- fiscal_email
- payment_terms
- average_payment_days
- minimum_order_value
- freight_policy
- delivery_days
- lead_time_days
- relationship_notes
- tags
- metadata

**Observações**
- É a entidade central da área Fornecedor 360º.
- Bloqueio e homologação impactam elegibilidade em compras/cotações.
- Contatos principais podem ser consolidados com `supplier_contacts`.

### supplier_contacts
**Objetivo**
Contatos estruturados do fornecedor.

**Campos importantes**
- supplier_id
- name
- role
- department
- phone
- whatsapp
- email
- is_primary
- active

### supplier_relationship_events
**Objetivo**
Eventos manuais da relação com o fornecedor.

**Campos importantes**
- supplier_id
- event_type
- title
- description
- event_at
- severity
- status
- related_purchase_document_id
- related_product_id
- created_by_email

### supplier_price_history
**Objetivo**
Histórico de custos por fornecedor/produto.

**Observações**
- Registros cancelados permanecem para rastreabilidade.
- O custo ativo deve ser interpretado considerando `is_active` e `cancelled_at`.

### purchase_quotations
**Objetivo**
Cabeçalho de cotações de compra.

**Campos importantes**
- quotation_code
- supplier_id
- status
- requested_at
- responded_at
- sent_channel
- responsible_name
- converted_purchase_document_id

### purchase_quotation_items
**Objetivo**
Itens de cotações de compra.

**Campos importantes**
- quotation_id
- product_id
- requested_qty
- reference_unit_cost
- quoted_unit_cost
- approved_qty

---

## Comercial

### orders
*(A documentar)*

### order_items
*(A documentar)*

---

## Precificação

### pricing_groups

Grupos por loja usados para somar quantidades de categorias distintas.

Campos principais:

- `id uuid`;
- `store_id uuid`;
- `name text`;
- `description text`;
- `price_logic_type text` — `category_volume` nesta versão;
- `price_rules jsonb` — faixas `{ min, price }`;
- `active boolean`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Restrições:

- nome não vazio e único por loja;
- regras em array;
- quantidades mínimas não negativas;
- preços maiores que zero;
- RLS por loja e permissões de Produtos/Categorias.

### categories — vínculo de atacado

Campos adicionados:

- `pricing_group_id uuid`;
- `use_pricing_group_rules boolean not null default false`.

O trigger de consistência impede vínculo entre categoria e grupo de lojas
diferentes.
