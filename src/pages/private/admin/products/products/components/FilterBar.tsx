import { useState } from 'react';
import { Search, X, /* RefreshCw, */ Download, FilterX } from 'lucide-react';
import type { Category, FilterStock, FilterStatus } from '../types/product.types';
import type { ExportFormat } from '@/pages/private/admin/products/products/hooks/useExport';

interface FilterBarProps {
    // Search
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;

    // Category filter
    filterCategory: string;
    onFilterCategoryChange: (value: string) => void;
    categories: Category[];

    // Stock filter
    filterStock: FilterStock;
    onFilterStockChange: (value: FilterStock) => void;

    // Status filter
    filterStatus: FilterStatus;
    onFilterStatusChange: (value: FilterStatus) => void;

    // Grouping
    groupByCategory: boolean;
    onGroupByCategoryChange: (checked: boolean) => void;

    // Clear all filters
    onClearFilters: () => void;

    // Export
    onExport: (format: ExportFormat) => void;
}

export default function FilterBar({
    searchTerm,
    onSearchChange,
    onClearSearch,
    filterCategory,
    onFilterCategoryChange,
    categories,
    filterStock,
    onFilterStockChange,
    filterStatus,
    onFilterStatusChange,
    groupByCategory,
    onGroupByCategoryChange,
    onClearFilters,
    onExport,
}: FilterBarProps) {
    const [isExportOpen, setIsExportOpen] = useState(false);

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md mb-6">
            <div className="p-3 flex flex-wrap items-center gap-3">
                {/* Busca com botão X */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#21A896]"
                    />
                    {searchTerm && (
                        <button
                            onClick={onClearSearch}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                            aria-label="Limpar busca"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Filtro Categoria */}
                <select
                    value={filterCategory}
                    onChange={(e) => onFilterCategoryChange(e.target.value)}
                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-[#21A896]"
                >
                    <option value="all">Todas categorias</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                            {cat.name}
                        </option>
                    ))}
                </select>

                {/* Filtro Estoque */}
                <select
                    value={filterStock}
                    onChange={(e) => onFilterStockChange(e.target.value as FilterStock)}
                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-[#21A896]"
                >
                    <option value="all">Todos estoques</option>
                    <option value="zero">Zerado</option>
                    <option value="low">Baixo</option>
                    <option value="normal">Normal</option>
                    <option value="high">Excesso</option>
                </select>

                {/* Filtro Status */}
                <select
                    value={filterStatus}
                    onChange={(e) => onFilterStatusChange(e.target.value as FilterStatus)}
                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-[#21A896]"
                >
                    <option value="all">Todos status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                </select>

                {/* Agrupar por categoria */}
                <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    <input
                        type="checkbox"
                        checked={groupByCategory}
                        onChange={(e) => onGroupByCategoryChange(e.target.checked)}
                        className="rounded border-gray-300 text-[#21A896] focus:ring-[#21A896]"
                    />
                    Agrupar
                </label>

                {/* Limpar filtros */}
                <button
                    onClick={onClearFilters}
                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Limpar filtros"
                >
                    <FilterX size={16} />
                </button>

                {/* Exportar com dropdown */}
                <div className="relative ml-auto">
                    <button
                        onClick={() => setIsExportOpen(!isExportOpen)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-1.5"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                    {isExportOpen && (
                        <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-30">
                            <button
                                onClick={() => {
                                    onExport('json');
                                    setIsExportOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                JSON
                            </button>
                            <button
                                onClick={() => {
                                    onExport('csv');
                                    setIsExportOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                CSV
                            </button>
                            <button
                                onClick={() => {
                                    onExport('txt');
                                    setIsExportOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Texto
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}