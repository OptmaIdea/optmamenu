import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const authMock = vi.hoisted(() => ({
  signIn: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: authMock.signIn, signOut: authMock.signOut },
    rpc: authMock.rpc,
  },
}));
vi.mock('@/utils/activeStore', () => ({
  clearActiveStoreId: vi.fn(), setActiveStoreId: vi.fn(),
}));
vi.mock('@/utils/sessionSecurity', () => ({
  markSessionAsActive: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

import Login from './Login';

beforeEach(() => {
  authMock.signIn.mockReset().mockResolvedValue({ error: null });
  authMock.signOut.mockReset().mockResolvedValue({ error: null });
  authMock.rpc.mockReset().mockImplementation(async (name: string) => (
    name === 'get_login_store_options'
      ? { data: [{ store_id:'store1', store_name:'Gelinhares', store_slug:'gelinharessjn',role:'owner',status:'active',access_blocked:false }], error: null }
      : { data: null, error: null }
  ));
});
afterEach(cleanup);

function mount() {
  render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<Login/>}/>
    <Route path="/admin" element={<div>Admin carregado</div>}/>
  </Routes></MemoryRouter>);
}

describe('Login administrativo com autofill do navegador', () => {
  it('entra com um clique quando Chrome preenche sem disparar onChange do React', async () => {
    mount();
    const email=screen.getByPlaceholderText('seu@email.com') as HTMLInputElement;
    const password=screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    // Simula preenchimento do DOM pelo gerenciador de senhas, sem evento React.
    email.value='usuario@teste.com';
    password.value='senha-autofill';
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByText('Admin carregado')).toBeTruthy());
    expect(authMock.signIn).toHaveBeenCalledExactlyOnceWith({
      email:'usuario@teste.com', password:'senha-autofill',
    });
  });

  it('preserva senha preenchida depois de alternar a visibilidade', () => {
    mount();
    const password=screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    password.value='senha-sem-evento';
    fireEvent.click(screen.getByRole('button', {name:'Mostrar senha'}));
    expect(password.value).toBe('senha-sem-evento');
  });
});
