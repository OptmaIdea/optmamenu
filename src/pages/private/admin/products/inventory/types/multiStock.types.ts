export type SidebarGroupKey =
  | 'dashboard'
  | 'commercial'
  | 'products'
  | 'settings'
  | 'support';

export type InventoryStockStatus = 'out' | 'low' | 'ok' | 'over';

export type InventoryLocationFilters = {
  search: string;
  locationId: string | 'all';
  stockStatus: InventoryStockStatus | 'all';
};

export type TransferStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'shipped'
  | 'received'
  | 'cancelled'
  | 'divergent';
