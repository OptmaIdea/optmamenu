# Multiestoque Frontend

## Visão Geral

O sistema de multiestoque substitui a coluna `stock_quantity` da tabela `products` como fonte de verdade.
O saldo operacional real vive na posição por local (`inventory_positions`).

---

## Rotas

| Rota | Descrição |
|---|---|
| `/admin/inventory` | Posições de estoque por local (todos os produtos) |
| `/admin/transfers` | Lista de transferências com filtros |
| `/admin/transfers/:id` | Detalhe de uma transferência |
| `/admin/products/lifecycle` | Seletor de produto para "Vida do produto" |
| `/admin/products/:id/lifecycle` | Visão 360º de um produto específico |
| `/admin/stock-movements` | Movimentações globais de estoque |

---

## Páginas

| Componente | Rota |
|---|---|
| `InventoryByLocationPage` | `/admin/inventory` |
| `TransfersPage` | `/admin/transfers` |
| `TransferDetailPage` | `/admin/transfers/:id` |
| `ProductLifecycleSelectorPage` | `/admin/products/lifecycle` |
| `ProductLifecyclePage` | `/admin/products/:id/lifecycle` |
| `StockMovementsPage` | `/admin/stock-movements` |

---

## Hooks

| Hook | Fonte | Finalidade |
|---|---|---|
| `useInventoryByLocation` | `get_inventory_position_by_store` | Posições por local (todos os produtos) |
| `useStockTransfers` | `get_stock_transfers_by_store` | Lista de transferências |
| `useStockTransferDetail` | `get_stock_transfer_detail` | Detalhe de uma transferência |
| `useProductLifecycle` | `get_product_inventory_lifecycle` | Resumo de vida de um produto |
| `useProductStockMovements` | `get_product_stock_movements` | Movimentações físicas de um produto |
| `useProductInventoryAudit` | `get_product_inventory_audit_events` | Auditoria não-física de um produto |
| `useProductLocationInventory` | (filtra `useInventoryByLocation`) | Posições de um produto por local |
| `useProductInventorySnapshot` | `get_inventory_position_by_store` | Mapa consolidado produto→saldo total |

---

## RPCs / Fontes Supabase

| RPC | Uso |
|---|---|
| `get_inventory_position_by_store` | Posições por loja/local |
| `get_stock_transfers_by_store` | Transferências da loja |
| `get_stock_transfer_detail` | Itens de uma transferência |
| `get_product_inventory_lifecycle` | Resumo de vida de um produto |
| `get_product_stock_movements` | Movimentações físicas de um produto |
| `get_product_inventory_audit_events` | Eventos de auditoria de um produto |

---

## Regras de Negócio

- **`inventory_positions` é a verdade operacional** — saldo por local é o dado real
- **`products.stock_quantity` é legado** — usar apenas como fallback onde `snapshotMap` não estiver disponível
- **Vida do Produto** é a visão focada em um item específico (resumo + locais + movimentações + auditoria)
- **Movimentação** é a visão global operacional (todos os produtos, filtros avançados)
- **Transferências** registram movimentos físicos entre locais, com rastreio de divergências

---

## Uso do `useProductInventorySnapshot`

```tsx
import { useProductInventorySnapshot } from '@/hooks/inventory/useProductInventorySnapshot';

const { snapshotMap } = useProductInventorySnapshot();

// Por produto:
const inventory = snapshotMap.get(product.id);
const displayOnHand    = inventory?.onHand    ?? product.stock_quantity ?? 0;
const displayAvailable = inventory?.available ?? product.stock_quantity ?? 0;
const displayStatus    = inventory?.status    ?? 'ok';
```

Status possíveis: `'out'` | `'low'` | `'ok'` | `'over'`

> **Nota:** O threshold de `low` está fixo em ≤ 5 unidades disponíveis.
> Futuramente pode ser refinado usando `min_stock` por produto via RPC.
