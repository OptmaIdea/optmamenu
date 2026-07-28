import React from 'react';
import { Package, Plus, Archive, AlertCircle } from 'lucide-react';
import type { Category } from '../../products/types/product.types';

interface BasicDataSectionProps {
  name: string;
  setName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  categoryId: string | null;
  setCategoryId: (val: string | null) => void;
  categories: Category[];
  categoriesLoading: boolean;
  onOpenNewCategoryModal: () => void;
  active: boolean;
  setActive: (val: boolean) => void;
  isDiscontinued?: boolean;
  isEditing: boolean;
  errors?: { name?: string };
}

export const BasicDataSection: React.FC<BasicDataSectionProps> = ({
  name,
  setName,
  description,
  setDescription,
  categoryId,
  setCategoryId,
  categories,
  categoriesLoading,
  onOpenNewCategoryModal,
  active,
  setActive,
  isDiscontinued,
  isEditing,
  errors,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#19A999]/10 rounded-lg">
            <Package size={18} className="text-[#19A999]" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base">Dados Básicos</h3>
        </div>

        {/* Toggle de Situação Ativa / Inativa */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#19A999]"></div>
          <span className="ml-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
            {active ? 'Ativo' : 'Inativo'}
          </span>
        </label>
      </div>

      {/* Aviso de produto descontinuado (se aplicável na edição) */}
      {isEditing && isDiscontinued && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-800 dark:text-purple-300 text-xs">
          <Archive size={16} className="shrink-0" />
          <span>
            <strong>Produto Descontinuado:</strong> Este produto está marcado como descontinuado no histórico e não permite reativação automática.
          </span>
        </div>
      )}

      {/* Campo Nome */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
          Nome do produto <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Hambúrguer Artesanal Supremo 200g"
          className={`w-full px-3 py-2.5 bg-white dark:bg-gray-700 border ${
            errors?.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-600'
          } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white`}
        />
        {errors?.name && (
          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle size={12} />
            {errors.name}
          </p>
        )}
      </div>

      {/* Campo Descrição */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
          Descrição
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descreva os detalhes, ingredientes ou características do produto..."
          className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
        />
      </div>

      {/* Campo Categoria com botão para criar nova */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
          Categoria
        </label>
        <div className="flex items-center gap-2">
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            disabled={categoriesLoading}
            className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
          >
            <option value="">Sem categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenNewCategoryModal}
            className="inline-flex items-center gap-1 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Nova</span>
          </button>
        </div>
      </div>
    </div>
  );
};
