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
*(A documentar)*

---

## Comercial

### orders
*(A documentar)*

### order_items
*(A documentar)*
