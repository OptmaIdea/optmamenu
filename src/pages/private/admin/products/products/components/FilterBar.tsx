import { useState } from 'react';
import { Search, X, /* RefreshCw, */ Download, FilterX } from 'lucide-react';
import type { Category, FilterStock, FilterStatus, FilterAction } from '../types/product.types';
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

    // Action filter
    filterAction: FilterAction;
    onFilterActionChange: (value: FilterAction) => void;

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
    filterAction,
    onFilterActionChange,
    filterStatus,
    onFilterStatusChange,
    groupByCategory,
    onGroupByCategoryChange,
    onClearFilters,
    onExport,
}: FilterBarProps) {
    const [isExportOpen, setIsExportOpen] = useState(false);

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl mb-6">
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                {/* Busca com botão X */}
                <div className="relative min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full min-w-0 pl-9 pr-8 h-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#19A999]"
                    />
                    {searchTerm && (
                        <button
                            onClick={onClearSearch}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
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
                    className="w-full min-w-0 h-10 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-1 focus:ring-[#19A999]"
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
                    className="w-full min-w-0 h-10 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-1 focus:ring-[#19A999]"
                >
                    <option value="all">Todos estoques</option>
                    <option value="zero">Zerado</option>
                    <option value="low">Crítico</option>
                    <option value="attention">Atenção</option>
                    <option value="normal">Normal</option>
                    <option value="high">Excesso</option>
                </select>

                {/* Filtro Ação Gerencial */}
                <select
                    value={filterAction}
                    onChange={(e) => onFilterActionChange(e.target.value as FilterAction)}
                    className="w-full min-w-0 h-10 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-1 focus:ring-[#19A999]"
                >
                    <option value="all">Todas ações</option>
                    <option value="buy">Comprar</option>
                    <option value="transfer">Transferir</option>
                    <option value="monitor">Monitorar</option>
                    <option value="review_excess">Revisar excesso</option>
                    <option value="ok">OK</option>
                </select>

                {/* Filtro Status */}
                <select
                    value={filterStatus}
                    onChange={(e) => onFilterStatusChange(e.target.value as FilterStatus)}
                    className="w-full min-w-0 h-10 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-1 focus:ring-[#19A999]"
                >
                    <option value="all">Todos status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                </select>

                {/* Agrupar por categoria */}
                <div className="flex items-center h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 w-full cursor-pointer">
                        <input
                            type="checkbox"
                            checked={groupByCategory}
                            onChange={(e) => onGroupByCategoryChange(e.target.checked)}
                            className="rounded border-gray-300 text-[#19A999] focus:ring-[#19A999]"
                        />
                        Agrupar categorias
                    </label>
                </div>

                {/* Export e Limpar Filtros */}
                <div className="flex items-center gap-2 h-10">
                    <button
                        onClick={onClearFilters}
                        className="flex-shrink-0 h-10 w-10 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl transition"
                        title="Limpar filtros"
                    >
                        <FilterX size={16} />
                    </button>
                    <div className="relative flex-1">
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className="w-full h-10 px-3 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl flex items-center justify-center gap-1.5 transition"
                        >
                            <Download size={16} />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>
                        {isExportOpen && (
                            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
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
        </div>
    );
}