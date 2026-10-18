import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductMovementHistory } from './ProductMovementHistory';
import type { ProductPurchaseReceiptIssue, ProductPhysicalDiscrepancy } from '../services/productOperationalOccurrencesService';

afterEach(cleanup);

const purchase: ProductPurchaseReceiptIssue = {
  issue_id:'receipt-1', issue_code:'RSV-20260905-TESTE', purchase_document_id:'purchase-1',
  document_code:'ENT-20260905-01', invoice_number:'123',
  supplier_name:'Fornecedor de teste', issue_type:'damage', issue_status:'waiting_document',
  disposition:'partial_return', quantity:3, replacement_pending_quantity:0,
  physical_closed_quantity:0, estimated_amount:15, notes:'Em conferência',
  resolution_notes:null, resolution_reference:null, opened_at:'2026-09-05T12:00:00Z',
  resolved_at:null, cancelled_at:null, cancellation_reason:null,
};
const physical: ProductPhysicalDiscrepancy = {
  id:'physical-1',order_code:'PED-EXEMPLO',location_name:'Estoque Principal',
  occurrence_type:'pdv_sale_without_stock',status:'resolved',
  items:[{product_id:'abacaxi', product_name:'Abacaxi',requested:6,available:5,shortage:1}],
  opening_notes:null,resolution_type:'count',resolution_notes:'Recontagem registrada',
  created_at:'2026-07-25T15:29:00Z',resolved_at:'2026-07-26T15:29:00Z',
};

describe('Ocorrências em Vida do Produto: somente leitura', () => {
  it('exibe a ressalva e seu documento, com detalhes recolhidos inicialmente', () => {
    render(<MemoryRouter><ProductMovementHistory items={[{kind:'purchase_issue',id:purchase.issue_id,issue:purchase}]} /></MemoryRouter>);
    const button=screen.getByRole('button',{name:/Avaria na compra/});
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Tratamento:/)).toBeNull();
    fireEvent.click(button);
    expect(screen.getByText(/Tratamento:/)).toBeTruthy();
    expect(screen.getByText(/Devolução parcial/)).toBeTruthy();
    const link=screen.getByRole('link',{name:/Consultar na central de Divergências/});
    expect(link.getAttribute('href')).toContain('issue=RSV-20260905-TESTE');
  });
  it('mostra falta registrada sem lançar nova baixa, com acesso à central', () => {
    render(<MemoryRouter><ProductMovementHistory items={[{kind:'physical_issue',id:physical.id,occurrence:physical}]} /></MemoryRouter>);
    const button=screen.getByRole('button',{name:/Divergência física/});
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(screen.getByText(/não provoca nova baixa/)).toBeTruthy();
    expect(screen.getByRole('link',{name:/Consultar central de Divergências/}).getAttribute('href')).toBe('/admin/stock/divergences');
  });
  it('expande e recolhe fontes diferentes de forma independente', () => {
    render(<MemoryRouter><ProductMovementHistory items={[
      {kind:'purchase_issue',id:purchase.issue_id,issue:purchase},
      {kind:'physical_issue',id:physical.id,occurrence:physical},
    ]} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Expandir tudo'}));
    expect(screen.getByText(/Devolução parcial/)).toBeTruthy();
    expect(screen.getByText(/não provoca nova baixa/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Recolher tudo'}));
    expect(screen.queryByText(/Devolução parcial/)).toBeNull();
    expect(screen.queryByText(/não provoca nova baixa/)).toBeNull();
  });
});
