import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductMovementHistory, type ProductTimelineItem } from './ProductMovementHistory';
import type { ProductStockMovementRow } from '@/services/stockService';
import type { ProductTransferDivergence } from '../services/productLifecycleService';

afterEach(cleanup);

const base = {transfer_id:'496faf89-2123-46cd-b33a-02d1c480ad12',transfer_code:'TRF-20261015-144225-589',source:'stock_transfer'};
const items: ProductTimelineItem[] = [
  {kind:'movement',id:'send',movement:{
    ...base,id:'send',type:'exit',quantity:-30,location_name:'Estoque Principal',
    previous_stock:190,new_stock:160,created_at:'2026-10-15T14:42:35-03:00',
  } as ProductStockMovementRow},
  {kind:'movement',id:'receive',movement:{
    ...base,id:'receive',type:'entry',quantity:27,location_name:'Loja SJN',
    previous_stock:114,new_stock:141,created_at:'2026-10-15T14:43:17-03:00',
  } as ProductStockMovementRow},
  {kind:'divergence',id:'difference',divergence:{
    id:'difference',transfer_id:base.transfer_id,transfer_code:base.transfer_code,
    divergence_qty:3,loss_qty:3,returned_to_origin_qty:0,accepted_shortage_qty:0,
    source_location_name:'Estoque Principal',destination_location_name:'Loja SJN',
    divergence_resolution:'loss',divergence_reason:'damage',
    received_at:'2026-10-15T14:43:17-03:00',
  } as ProductTransferDivergence},
];

describe('Vida do Produto — TRF consolidada',()=>{
  it('reúne envio, recebimento e divergência em uma única ocorrência com os saldos reais',()=>{
    render(<MemoryRouter><ProductMovementHistory items={items}/></MemoryRouter>);
    const button=screen.getByRole('button',{name:/Transferência TRF-20261015-144225-589/});
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByText(/Concluída com divergência/)).toHaveLength(1);
    expect(screen.queryByText(/Estoque físico nesse local:/)).toBeNull();
    fireEvent.click(button);
    expect(screen.getByText(/190 → 160/)).toBeTruthy();
    expect(screen.getByText(/114 → 141/)).toBeTruthy();
    expect(screen.getByText(/Perda 3/)).toBeTruthy();
    expect(screen.getByRole('link',{name:/Abrir documento TRF/}).getAttribute('href'))
      .toBe('/admin/transfers/496faf89-2123-46cd-b33a-02d1c480ad12');
    fireEvent.click(screen.getByRole('button',{name:'Recolher tudo'}));
    expect(screen.queryByText(/190 → 160/)).toBeNull();
  });
});
