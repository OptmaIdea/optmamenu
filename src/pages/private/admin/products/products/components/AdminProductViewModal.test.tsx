import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminProductViewModal from './AdminProductViewModal';
import type { Product } from '../types/product.types';

afterEach(cleanup);

const sample: Product = {
  id:'abacate-id',store_id:'loja-id',name:'Abacate',description:'Fruta fresca',price:8.50,
  active:true,min_stock:5,max_stock:50,display_on_hand:25,display_reserved:3,
  display_available:22,images:['https://example.com/abacate.png'],
};
const show=(product:Product, onClose=()=>{})=>
  render(<MemoryRouter><AdminProductViewModal isOpen product={product} onClose={onClose}/></MemoryRouter>);

describe('visualização de produto — tablet e celular',()=>{
  it('separa o saldo físico, reservado e disponível e navega para a Vida do Produto',()=>{
    show(sample);
    expect(screen.getByText('Físico')).toBeTruthy();
    expect(screen.getByText('Reservado')).toBeTruthy();
    expect(screen.getByText('Disponível')).toBeTruthy();
    expect(screen.getByRole('link',{name:/Vida do produto/i}).getAttribute('href'))
      .toBe('/admin/products/abacate-id/lifecycle');
    expect(screen.queryByRole('button',{name:'Editar'})).toBeNull();
  });
  it('não inventa responsável, data de criação nem data de descontinuação',()=>{
    show({...sample,is_discontinued:true});
    expect(screen.getByText(/Data de cadastro não informada/)).toBeTruthy();
    expect(screen.queryByText(/Por: Admin/)).toBeNull();
    expect(screen.queryByText(/Descontinuado em:/)).toBeNull();
    expect(screen.getByText(/Produto marcado como descontinuado/)).toBeTruthy();
  });
  it('não considera excesso quando máximo de estoque ainda não está configurado',()=>{
    show({...sample,min_stock:0,max_stock:0,display_on_hand:25,display_reserved:0,display_available:25});
    expect(screen.getByText('limites não configurados')).toBeTruthy();
    expect(screen.queryByText('excedente')).toBeNull();
  });
  it('amplia a imagem e fecha somente a ampliação com Escape',()=>{
    let closes=0;
    show(sample,()=>{closes++;});
    fireEvent.click(screen.getByRole('button',{name:'Ampliar imagem de Abacate'}));
    expect(screen.getByRole('dialog',{name:'Imagem ampliada de Abacate'})).toBeTruthy();
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('dialog',{name:'Imagem ampliada de Abacate'})).toBeNull();
    expect(closes).toBe(0);
    fireEvent.keyDown(document,{key:'Escape'});
    expect(closes).toBe(1);
  });
});
