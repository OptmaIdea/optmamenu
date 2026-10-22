import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductMovementHistory } from './ProductMovementHistory';
import type { ReservationReleaseEvent } from '../utils/reservationLifecycleEvents';

afterEach(cleanup);

const release: ReservationReleaseEvent = {
  id:'cb0a59a4-7890-4b4c-9531-1ef4095b27d7',
  date:'2026-10-18T00:13:00-03:00',
  createdAt:'2026-10-17T23:21:15-03:00',
  quantity:30, location:'Loja SJN', orderCode:'PED-20261017-232115-498E',
  reason:'Prazo da reserva encerrado', source:'reservation_status',
};

describe('contrapartida da reserva na Vida do Produto',()=>{
  it('mostra reserva liberada com horário real em evento independente e expansível',()=>{
    render(<MemoryRouter><ProductMovementHistory items={[
      {kind:'reservation_release',id:release.id,release},
    ]}/></MemoryRouter>);
    const item=screen.getByRole('button',{name:/Reserva liberada.*30 un/i});
    expect(item.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText(/Prazo da reserva encerrado/)).toBeTruthy();
    fireEvent.click(item);
    expect(screen.getByText(/Estoque físico:/)).toBeTruthy();
    expect(screen.getByText(/Não é compra nem nova entrada/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Recolher tudo'}));
    expect(item.getAttribute('aria-expanded')).toBe('false');
  });
});
