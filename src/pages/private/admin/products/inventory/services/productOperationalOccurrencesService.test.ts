import { describe, expect, it } from 'vitest';
import { getPhysicalDiscrepancyQuantity, type ProductPhysicalDiscrepancy } from './productOperationalOccurrencesService';

describe('quantidade das ocorrências físicas da Vida do Produto', () => {
  it('soma apenas as faltas registradas para o produto consultado', () => {
    const discrepancy = { items: [{ product_id: 'a', shortage: 2 }, { product_id: 'a', shortage_quantity: 3 }] } as ProductPhysicalDiscrepancy;
    expect(getPhysicalDiscrepancyQuantity(discrepancy)).toBe(5);
  });
  it('não infere uma baixa quando a ocorrência não informou diferença', () => {
    expect(getPhysicalDiscrepancyQuantity({ items: [{ product_id: 'a', requested: 5, available: 5 }] } as ProductPhysicalDiscrepancy)).toBe(0);
  });
});
