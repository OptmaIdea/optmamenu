export type Supplier = {
  id: string;
  store_id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type SupplierInput = {
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active?: boolean;
};
