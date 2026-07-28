export type ProductFormMode = 'create' | 'edit';

export type FormPriceRule = {
  min: number;
  price: string;
};

export type FormMediaItem = {
  id: string;
  type: 'url' | 'file';
  value: string | File;
  preview?: string;
};

export interface ProductFormValues {
  name: string;
  description: string;
  price: string;
  categoryId: string | null;
  active: boolean;
  isDiscontinued: boolean;
  internalCode: string;
  sku: string;
  ean: string;
  pricingMode: 'standard' | 'category_volume';
  useCategoryPricing: boolean;
  priceRules: FormPriceRule[];
  minStock: number;
  maxStock: number;
  mediaItems: FormMediaItem[];
  imagesToDelete: string[];
}

export interface FormErrors {
  name?: string;
  price?: string;
  minStock?: string;
  maxStock?: string;
  codes?: string;
  priceRules?: string;
  general?: string;
}

export interface ProductFormStateHook {
  values: ProductFormValues;
  errors: FormErrors;
  isDirty: boolean;
  saving: boolean;
  setName: (val: string) => void;
  setDescription: (val: string) => void;
  setPrice: (val: string) => void;
  setCategoryId: (val: string | null) => void;
  setActive: (val: boolean) => void;
  setInternalCode: (val: string) => void;
  setSku: (val: string) => void;
  setEan: (val: string) => void;
  setPricingMode: (val: 'standard' | 'category_volume') => void;
  setUseCategoryPricing: (val: boolean) => void;
  setMinStock: (val: number) => void;
  setMaxStock: (val: number) => void;
  handleAddPriceRule: () => void;
  handleRuleChange: (index: number, field: 'min' | 'price', value: string) => void;
  handleRemovePriceRule: (index: number) => void;
  processFiles: (files: FileList) => void;
  removeMediaItem: (id: string) => void;
  setMainMediaItem: (index: number) => void;
  reorderMediaItems: (oldIndex: number, newIndex: number) => void;
  handleSave: (
    isEditing: boolean,
    canManage: boolean,
    productIdToUse: string
  ) => Promise<{ success: boolean; productId?: string }>;
}
