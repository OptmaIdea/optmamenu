import { describe, expect, it } from 'vitest';
import { buildInventorySheetRows, getStockHealth, type InventorySheetRow } from './inventorySpreadsheetModel';

const row=(overrides: Partial<InventorySheetRow>): InventorySheetRow => ({
  store_id:'store', location_id:'principal', location_name:'Principal',location_code:'P',location_type:'stock',
  location_active:true,product_id:'abacate',product_name:'Abacate',category_id:null,price:null,product_active:true,
  min_stock:40,max_stock:120,last_entry_unit_cost:null,variant_id:null,on_hand:144,reserved:0,available:144,stock_status:'ok',
  updated_at:'2026-10-17T12:00:00Z',global_on_hand:279,global_reserved:3,global_available:276,
  global_min_stock:40,global_max_stock:120,global_status:'global_excess',
  provisional_location_min_stock:20,provisional_location_max_stock:60,location_status:'location_excess',
  possible_source_locations:0,source_locations:[],recommended_action:'ok',
  ...overrides,
});
describe('tabela de inventário da planilha',()=>{
  const rows=[row({in_transit_out:5}),row({location_id:'sjn',location_name:'Loja SJN',on_hand:135,reserved:3,available:132,in_transit_in:5})];
  it('apresenta produto e os locais agrupados, com as duas direções da transferência',()=>{
    const items=buildInventorySheetRows(rows,{abacate:{quantity:7,orders:1}},{'abacate:sjn':7});
    const p=items[0];
    expect(p.total).toBe(279);
    expect(p.reserved).toBe(3);
    expect(p.inDelivery).toBe(7);
    expect(p.sending).toBe(5);
    expect(p.receiving).toBe(5);
    expect(p.locations.map(x=>x.name)).toEqual(['Loja SJN','Principal']);
    expect(p.locations[0].inDelivery).toBe(7);
    expect(p.locations[0].available+p.locations[0].receiving).toBe(137);
    // Quantidade despachada já saiu do físico no backend; não subtrair de novo.
    expect(p.available).toBe(276);
  });
  it('não inventa local da entrega quando falta atribuição',()=>{
    const p=buildInventorySheetRows(rows,{abacate:{quantity:7,orders:1}},{} )[0];
    expect(p.unallocatedDelivery).toBe(7);
    expect(p.locations[0].inDelivery).toBeNull();
  });
  it('classifica disponibilidade e previsão pelos limites configurados',()=>{
    expect(getStockHealth(0,20,60)).toBe('zero');
    expect(getStockHealth(12,20,60)).toBe('below');
    expect(getStockHealth(35,20,60)).toBe('normal');
    expect(getStockHealth(65,20,60)).toBe('excess');
    expect(getStockHealth(7,null,null)).toBe('unconfigured');
  });
});
