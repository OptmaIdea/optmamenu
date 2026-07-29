# Análise de Referências Funcionais de Inventário

Este documento detalha a utilização das funções de lógica de negócio (RPC e Utilitários) relacionadas ao inventário no frontend (`src`).

## 1. `inventory_add_movement`
**Status:** Não encontrada com este nome exato no diretório `src`.
**Análise:** No frontend, o registro de movimentações é centralizado no hook `useStockMovement.ts` através da função `registerMovement`, que invoca a RPC `apply_stock_movement_delta`.

### Referência Principal: `useStockMovement.ts`
```typescript
// d:\optmamenu\src\pages\private\admin\products\inventory\hooks\useStockMovement.ts

const callApplyStockMovementDelta = async (args: {
    storeId: string;
    productId: string;
    type: StockMovementType;
    qty: number;
    reason?: string;
    orderId?: string;
}) => {
    // ...
    const { data, error } = await supabase.rpc('apply_stock_movement_delta', payload);
    // ...
};

const registerMovement = async (params: RegisterMovementParams): Promise<boolean> => {
    // ...
    let { data, error } = await callApplyStockMovementDelta({
        // ...
    });
    // ...
};
```

---

## 2. `product_has_movements`
**Status:** Encontrada. Utilizada para validar se um produto pode ser excluído ou desativado.

### Localização e Trechos:

#### `useStockMovement.ts`
```typescript
// d:\optmamenu\src\pages\private\admin\products\inventory\hooks\useStockMovement.ts

const hasMovements = async (productId: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase.rpc('product_has_movements', {
            p_product_id: productId,
        });
        if (error) throw error;
        return data || false;
    } catch (error: any) {
        // Fallback para busca direta se a RPC falhar
        const movements = await getProductMovements(productId);
        return movements.length > 0;
    }
};
```

#### `ProductDeleteConfirmModal.tsx`
```typescript
// d:\optmamenu\src\pages\private\admin\products\products\components\ProductDeleteConfirmModal.tsx

const checkMovements = async () => {
    // ...
    const { data: movementData } = await supabase.rpc('product_has_movements', {
        p_product_id: product.id
    });
    setHasMovements(!!movementData);
    // ...
};
```

---

## 3. `cancel_purchase_document`
**Status:** Encontrada. Utilizada para reverter uma entrada de compra confirmada.

### Localização e Trechos:

#### `PurchaseDocumentsPage.tsx`
```typescript
// d:\optmamenu\src\pages\private\admin\products\inventory\PurchaseDocumentsPage.tsx

const cancelConfirmedDocument = useCallback(async () => {
    // ...
    try {
      const { error } = await supabase.rpc('cancel_purchase_document', {
        p_document_id: cancelTarget.id,
        p_reason: cancelReason.trim(),
        p_master_password: cancelMasterPassword,
      });

      if (error) throw error;
      toast.success('Entrada cancelada com sucesso');
      // ...
    } catch (e: unknown) {
      // ...
    }
}, [...]);
```

---

## 4. `generate_purchase_document_code`
**Status:** Não encontrada no diretório `src`.
**Análise:** A geração de códigos de documentos (ex: `ENT-2024-001`) geralmente ocorre no lado do servidor (Database Triggers ou Stored Procedures) no momento da inserção na tabela `purchase_documents`. No frontend, o código é recebido após a criação do rascunho via `create_purchase_document_draft_batch`.

---

## 5. `is_supplier_purchase_eligible`
**Status:** Encontrada. Função utilitária que valida se um fornecedor está ativo, não bloqueado e homologado para compras.

### Localização e Trechos:

#### `supplierStatusUtils.ts` (Definição)
```typescript
// d:\optmamenu\src\pages\private\admin\products\inventory\utils\supplierStatusUtils.ts

export function isSupplierPurchaseEligible(supplier: {
    active?: boolean | null;
    blocked?: boolean | null;
    homologation_status?: string | null;
}) {
    const homologation = String(
        supplier.homologation_status ?? 'not_evaluated',
    ).toLowerCase();

    return (
        supplier.active !== false &&
        supplier.blocked !== true &&
        !['rejected', 'reproved', 'reprovado', 'blocked', 'bloqueado'].includes(
            homologation,
        )
    );
}
```

#### `PurchaseDocumentsPage.tsx` (Uso)
```typescript
// d:\optmamenu\src\pages\private\admin\products\inventory\PurchaseDocumentsPage.tsx

import { isSupplierPurchaseEligible } from './utils/supplierStatusUtils';

// ...
const eligibleSuppliers = useMemo(() => suppliers.filter(isSupplierPurchaseEligible), [suppliers]);
// ...
```

---

**Nota Final:** As funções `inventory_add_movement` e `generate_purchase_document_code` parecem ser nomes internos de procedimentos de banco de dados que não são chamados diretamente por esses nomes no código Typescript do frontend, ou são abstraídos por outras funções como `registerMovement` e `createPurchaseDocumentDraftBatch`.
