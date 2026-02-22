import { Package, Trash2, Edit, Save } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import type { Category } from '../../../types/product.types';

type PriceRule = { min: number; price: string };

interface ProductFormPanelProps {
  isEditing: boolean;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;

  categories: Category[];
  categoriesLoading: boolean;
  categoryId: string | null;
  setCategoryId: (v: string | null) => void;
  onOpenNewCategoryModal: () => void;

  active: boolean;
  setActive: (v: boolean) => void;
  onRequestDeactivate: () => void;
  onRequestReactivate: () => void;
  onRequestDelete: () => void;

  pricingMode: 'standard' | 'category_volume';
  setPricingMode: (v: 'standard' | 'category_volume') => void;
  useCategoryPricing: boolean;
  setUseCategoryPricing: (v: boolean) => void;

  price: string;
  setPrice: (v: string) => void;

  priceRules: PriceRule[];
  onAddRule: () => void;
  onRuleChange: (index: number, field: 'min' | 'price', value: string) => void;
  onRemoveRule: (index: number) => void;

  stockQuantity: number;
  setStockQuantity: (v: number) => void;
  minStock: number;
  setMinStock: (v: number) => void;
  maxStock: number;
  setMaxStock: (v: number) => void;

  saving: boolean;
  canSave: boolean;
  onSaveClick: () => void;
  onCancel: () => void;
}

export default function ProductFormPanel(props: ProductFormPanelProps) {
  const {
    isEditing,
    name,
    setName,
    description,
    setDescription,
    categories,
    categoriesLoading,
    categoryId,
    setCategoryId,
    onOpenNewCategoryModal,
    active,
    setActive,
    onRequestDeactivate,
    onRequestReactivate,
    onRequestDelete,
    pricingMode,
    setPricingMode,
    useCategoryPricing,
    setUseCategoryPricing,
    price,
    setPrice,
    priceRules,
    onAddRule,
    onRuleChange,
    onRemoveRule,
    stockQuantity,
    setStockQuantity,
    minStock,
    setMinStock,
    maxStock,
    setMaxStock,
    saving,
    canSave,
    onSaveClick,
    onCancel,
  } = props;

  return (
    <div className="w-full md:w-3/5 flex flex-col max-h-full overflow-hidden">
      {/* Cabeçalho (desktop) */}
      <div className="hidden md:flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#21A896]/10 rounded-lg">
            <Package size={20} className="text-[#21A896]" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>

      {/* Conteúdo rolável */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Ações principais (editar / excluir / ativar) */}
        {isEditing && (
          <div className="flex flex-wrap gap-2 justify-end mb-4">
            {active ? (
              <button
                type="button"
                onClick={onRequestDeactivate}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
              >
                <Edit size={16} />
                Inativar
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestReactivate}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                <Edit size={16} />
                Reativar
              </button>
            )}

            <button
              type="button"
              onClick={onRequestDelete}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition"
            >
              <Trash2 size={16} />
              Excluir
            </button>
          </div>
        )}

        {/* Nome e descrição */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              placeholder="Nome do produto"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              placeholder="Descrição do produto"
              rows={3}
            />
          </div>

          {/* Categoria */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
              <select
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                disabled={categoriesLoading}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onOpenNewCategoryModal}
              className="px-3 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium"
            >
              + Nova
            </button>
          </div>

          {/* Preço */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Modo de preço</label>
              <select
                value={pricingMode}
                onChange={(e) => setPricingMode(e.target.value as any)}
                className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <option value="standard">Preço único</option>
                <option value="category_volume">Atacado por faixas</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={useCategoryPricing}
                  onChange={(e) => setUseCategoryPricing(e.target.checked)}
                />
                Usar preço da categoria
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Ativo
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Preço (R$)</label>
            <NumericFormat
              className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              value={price}
              onValueChange={(values) => setPrice(values.value)}
              decimalScale={2}
              fixedDecimalScale
              decimalSeparator=","
              thousandSeparator="."
              disabled={useCategoryPricing}
            />
          </div>

          {pricingMode === 'category_volume' && !useCategoryPricing && (
            <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Regras de Atacado</label>
                <button
                  type="button"
                  onClick={onAddRule}
                  className="text-xs flex items-center gap-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition font-medium"
                >
                  + Adicionar Regra
                </button>
              </div>

              <div className="space-y-3">
                {priceRules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex gap-4 items-end bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">A partir de (un)</label>
                      <input
                        type="number"
                        className="w-full p-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-sm"
                        value={rule.min}
                        onChange={(e) => onRuleChange(index, 'min', e.target.value)}
                        min={1}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Preço Unitário (R$)</label>
                      <NumericFormat
                        className="w-full p-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-sm"
                        value={rule.price}
                        onValueChange={(values) => onRuleChange(index, 'price', values.value)}
                        decimalScale={2}
                        fixedDecimalScale
                        decimalSeparator=","
                        thousandSeparator="."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveRule(index)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition mb-[1px]"
                      aria-label="Remover regra"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estoque */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Estoque</label>
              <input
                type="number"
                className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(Number(e.target.value))}
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mín.</label>
              <input
                type="number"
                className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Máx.</label>
              <input
                type="number"
                className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                value={maxStock}
                onChange={(e) => setMaxStock(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé com botões */}
      <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>

        <button
          onClick={onSaveClick}
          disabled={saving || !canSave}
          className="px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save size={16} />
              {isEditing ? 'Atualizar' : 'Criar'} Produto
            </>
          )}
        </button>
      </div>
    </div>
  );
}
