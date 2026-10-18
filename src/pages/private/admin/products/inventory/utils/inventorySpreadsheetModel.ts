import type { InventoryPositionRow } from '@/services/stockService';
import type { DeliveryInRouteSummary, DeliveryInRouteByLocation } from '../hooks/useInventoryDeliveryInRoute';

export type InventorySheetRow = InventoryPositionRow & {
  in_transit_in?: number | string | null;
  in_transit_out?: number | string | null;
};

export type StockHealth = 'zero' | 'below' | 'normal' | 'excess' | 'unconfigured';

export type InventorySheetLocation = {
  key: string;
  name: string;
  total: number;
  reserved: number;
  available: number;
  sending: number;
  receiving: number;
  inDelivery: number | null;
  minimum: number | null;
  maximum: number | null;
};

export type InventorySheetProduct = {
  id: string;
  name: string;
  total: number;
  reserved: number;
  available: number;
  inDelivery: number;
  sending: number;
  receiving: number;
  minimum: number | null;
  maximum: number | null;
  unallocatedDelivery: number;
  locations: InventorySheetLocation[];
};

const numeric = (x: unknown) => Number(x ?? 0) || 0;
const limit = (x: number | null | undefined) => x != null && numeric(x) > 0 ? numeric(x) : null;

export function getStockHealth(available: number, minimum: number | null, maximum: number | null): StockHealth {
  if (available <= 0) return 'zero';
  if (minimum != null && available < minimum) return 'below';
  if (maximum != null && available > maximum) return 'excess';
  if (minimum == null && maximum == null) return 'unconfigured';
  return 'normal';
}

export function buildInventorySheetRows(
  rows: InventorySheetRow[],
  byProduct: DeliveryInRouteSummary,
  byLocation: DeliveryInRouteByLocation,
): InventorySheetProduct[] {
  const grouped = new Map<string, InventorySheetRow[]>();
  for (const row of rows) grouped.set(row.product_id, [...(grouped.get(row.product_id) || []),row]);

  return Array.from(grouped,([id,group])=>{
    const byLocal = new Map<string, InventorySheetRow[]>();
    for (const row of group) byLocal.set(row.location_id,[...(byLocal.get(row.location_id)||[]),row]);
    const locations: InventorySheetLocation[] = Array.from(byLocal,([locationId,loc])=>{
      const row=loc[0];
      const sum=(key: keyof InventorySheetRow) => loc.reduce((total,item)=>total+numeric(item[key]),0);
      return {
        key: locationId, name:row.location_name,
        total:sum('on_hand'),reserved:sum('reserved'),available:sum('available'),
        sending:sum('in_transit_out'),receiving:sum('in_transit_in'),
        inDelivery: Object.prototype.hasOwnProperty.call(byLocation,`${id}:${locationId}`) ? numeric(byLocation[`${id}:${locationId}`]) : null,
        minimum:limit(row.provisional_location_min_stock),maximum:limit(row.provisional_location_max_stock),
      };
    }).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const sum=(key:keyof InventorySheetLocation)=>locations.reduce((total,item)=>total+numeric(item[key]),0);
    const inDelivery=numeric(byProduct[id]?.quantity);
    const assigned=sum('inDelivery');
    if (assigned >= inDelivery) {
      // A ausência de uma reserva consumida neste local equivale a zero somente
      // quando todas as entregas do produto foram atribuídas a outros locais.
      for (const local of locations) if (local.inDelivery == null) local.inDelivery = 0;
    }
    return {
      id,name:group[0].product_name,locations,
      total:sum('total'),reserved:sum('reserved'),available:sum('available'),
      sending:sum('sending'),receiving:sum('receiving'),inDelivery,
      unallocatedDelivery:Math.max(0,inDelivery-assigned),
      minimum:limit(group[0].global_min_stock),maximum:limit(group[0].global_max_stock),
    };
  }).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
