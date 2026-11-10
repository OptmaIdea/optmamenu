import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductStockMovementRow } from '@/services/stockService';
import type { ProductTransferDivergence } from '../services/productLifecycleService';
import { ProductMovementHistory, getTimelineEventKey } from './ProductMovementHistory';

afterEach(cleanup);

const movement = {
  id: 'movement-1', source: 'stock_transfer', type: 'exit',
  quantity: -30, transfer_id: 'transfer-1', transfer_code: 'TRF-20261015-144225-589',
  previous_stock: 190, new_stock: 160, affects_physical: true,
  location_name: 'Estoque Principal', from_location_name: 'Estoque Principal',
  to_location_name: 'Loja SJN', created_at: '2026-10-15T14:42:25Z',
  metadata: {}, reason: null,
} as ProductStockMovementRow;
const divergence = {
  id: 'difference-1', transfer_id: 'transfer-1',
  transfer_code: 'TRF-20261015-144225-589',
  shipped_qty: 30, received_qty: 27, divergence_qty: 3,
  loss_qty: 3, returned_to_origin_qty: 0, accepted_shortage_qty: 0,
  divergence_resolution: 'loss', divergence_reason: 'damage',
  source_location_name: 'Estoque Principal', destination_location_name: 'Loja SJN',
  received_at: '2026-10-15T16:22:00Z',
} as ProductTransferDivergence;
const items = [
  { kind: 'movement' as const, id: 'movement-1', movement },
  { kind: 'divergence' as const, id: 'difference-1', divergence },
];

describe('Vida do Produto — ocorrências compactas', () => {
  it('mostra resumo primeiro e expande saldo e origem/destino sob demanda', () => {
    render(<MemoryRouter><ProductMovementHistory items={[items[0]]} /></MemoryRouter>);
    expect(screen.getByText(/Transferência enviada · 30 un/)).toBeTruthy();
    expect(screen.queryByText('190 → 160')).toBeNull();
    const button = screen.getByRole('button', { name: /Transferência enviada.*30 un/i });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('190 → 160')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir transferência' }).getAttribute('href')).toBe('/admin/transfers/transfer-1');
  });
  it('exibe divergência como evento único sem fazer nova baixa', () => {
    render(<MemoryRouter><ProductMovementHistory items={[items[1]]} /></MemoryRouter>);
    expect(screen.queryByText(/A diferença já foi registrada/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Divergência na transferência.*3 un/i }));
    expect(screen.getByText(/A diferença já foi registrada/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Perda\/Avaria/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver TRF completa' }).getAttribute('href')).toBe('/admin/transfers/transfer-1');
  });
  it('expande e recolhe todos sem misturar eventos da mesma TRF', () => {
    render(<MemoryRouter><ProductMovementHistory items={items} /></MemoryRouter>);
    expect(getTimelineEventKey(items[0])).toBe('movement:movement-1');
    expect(getTimelineEventKey(items[1])).toBe('divergence:difference-1');
    fireEvent.click(screen.getByRole('button', { name: 'Expandir tudo' }));
    expect(screen.getByText('190 → 160')).toBeTruthy();
    expect(screen.getByText(/Conferência com divergência/)).toBeTruthy();
    expect(screen.getByText(/Perda 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher tudo' }));
    expect(screen.queryByText('190 → 160')).toBeNull();
    expect(screen.queryByText(/Conferência com divergência/)).toBeNull();
  });
});
