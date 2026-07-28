import React, { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import CategoryEditModal from '@/pages/private/admin/products/category/components/CategoryEditModal';
import { getActiveStoreId } from '@/utils/activeStore';

import { BasicDataSection } from './BasicDataSection';
import { CodesSection } from './CodesSection';
import { PricingSection } from './PricingSection';
import { StockParametersSection } from './StockParametersSection';
import { ImagesSection } from './ImagesSection';

import type { Category } from '../../products/types/product.types';
import type { ProductFormStateHook, ProductFormMode } from '../types/productForm.types';

interface ProductFormProps {
  mode: ProductFormMode;
  formState: ProductFormStateHook;
  categories: Category[];
  categoriesLoading: boolean;
  onRefetchCategories: () => Promise<void>;
  onSave: () => void;
  onCancel: () => void;
  canManage: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  mode,
  formState,
  categories,
  categoriesLoading,
  onRefetchCategories,
  onSave,
  onCancel,
  canManage,
}) => {
  const isEditing = mode === 'edit';
  const activeStoreId = getActiveStoreId();
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);

  const handleNewCategorySuccess = async () => {
    await onRefetchCategories();
    setIsNewCategoryModalOpen(false);
  };

  const {
    values,
    errors,
    saving,
    setName,
    setDescription,
    setPrice,
    setCategoryId,
    setActive,
    setInternalCode,
    setSku,
    setEan,
    setPricingMode,
    setUseCategoryPricing,
    setMinStock,
    setMaxStock,
    handleAddPriceRule,
    handleRuleChange,
    handleRemovePriceRule,
    processFiles,
    removeMediaItem,
    setMainMediaItem,
    reorderMediaItems,
  } = formState;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="space-y-6 pb-24 md:pb-6"
    >
      {/* Seção 1: Dados Básicos */}
      <BasicDataSection
        name={values.name}
        setName={setName}
        description={values.description}
        setDescription={setDescription}
        categoryId={values.categoryId}
        setCategoryId={setCategoryId}
        categories={categories}
        categoriesLoading={categoriesLoading}
        onOpenNewCategoryModal={() => setIsNewCategoryModalOpen(true)}
        active={values.active}
        setActive={setActive}
        isDiscontinued={values.isDiscontinued}
        isEditing={isEditing}
        errors={errors}
      />

      {/* Seção 2: Imagens */}
      <ImagesSection
        mediaItems={values.mediaItems}
        onProcessFiles={processFiles}
        onRemoveMedia={removeMediaItem}
        onSetMainMedia={setMainMediaItem}
        onReorder={reorderMediaItems}
      />

      {/* Seção 3: Códigos */}
      <CodesSection
        internalCode={values.internalCode}
        setInternalCode={setInternalCode}
        sku={values.sku}
        setSku={setSku}
        ean={values.ean}
        setEan={setEan}
      />

      {/* Seção 4: Preço e Regras */}
      <PricingSection
        price={values.price}
        setPrice={setPrice}
        pricingMode={values.pricingMode}
        setPricingMode={setPricingMode}
        useCategoryPricing={values.useCategoryPricing}
        setUseCategoryPricing={setUseCategoryPricing}
        priceRules={values.priceRules}
        onAddRule={handleAddPriceRule}
        onRuleChange={handleRuleChange}
        onRemoveRule={handleRemovePriceRule}
        selectedCategoryName={categories.find((c) => c.id === values.categoryId)?.name}
        errors={errors}
      />

      {/* Seção 5: Parâmetros de Estoque */}
      <StockParametersSection
        minStock={values.minStock}
        setMinStock={setMinStock}
        maxStock={values.maxStock}
        setMaxStock={setMaxStock}
        errors={errors}
      />

      {/* Barra Inferior Acessível em Mobile e Desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-20 md:static bg-white/95 dark:bg-gray-800/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 p-4 md:p-0 md:border-none md:bg-transparent md:backdrop-none flex items-center justify-end gap-3 shadow-lg md:shadow-none">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 md:flex-initial px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition cursor-pointer"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={saving || !canManage}
          className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#19A999] hover:bg-[#14887B] text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>{isEditing ? 'Salvar alterações' : 'Salvar produto'}</span>
            </>
          )}
        </button>
      </div>

      {/* Modal de criação de nova categoria */}
      {activeStoreId && isNewCategoryModalOpen && (
        <CategoryEditModal
          isOpen={isNewCategoryModalOpen}
          onClose={() => setIsNewCategoryModalOpen(false)}
          category={null}
          storeId={activeStoreId}
          onSuccess={handleNewCategorySuccess}
        />
      )}
    </form>
  );
};
