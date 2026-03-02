import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { History, Filter, X, ChevronLeft, ChevronRight, Package, Printer, Calendar, ListFilter, FileText } from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';
import type { StockMovement, StockMovementType, StockMovementFilters } from './types/inventory.types';
import PrintableStockMovements from '@/pages/private/admin/products/inventory/components/PrintableStockMovements';
import { useReactToPrint } from 'react-to-print';

const MOVEMENT_LABELS: Record<StockMovementType, { label: string; color: string }> = {
    entry: { label: 'Entrada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    exit: { label: 'Saída', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    reservation: { label: 'Reserva', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    confirmation: { label: 'Baixa (Pedido)', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    cancellation: { label: 'Cancelamento', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    clearance: { label: 'Zeramento', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

export default function StockMovementsPage() {
    const [searchParams] = useSearchParams();
    const { fetchMovements } = useStockMovement();
    const { products: allProducts } = useInventory();

    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const pageSize = 50;

    const [showFilters, setShowFilters] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [filters, setFilters] = useState<StockMovementFilters>({
        productId: undefined,
        type: undefined,
        startDate: undefined,
        endDate: undefined,
    });

    const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
    const [storeName, setStoreName] = useState('Minha Loja');
    const [userEmail, setUserEmail] = useState('Admin');

    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Relatorio_Movimentacoes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
    });

    useEffect(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 3);

        setFilters({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        });

        const productId = searchParams.get('productId');
        const productName = searchParams.get('productName');

        if (productId) {
            setSelectedProduct({ id: productId, name: productName || 'Produto' });
            setFilters(prev => ({ ...prev, productId }));
        }
    }, [searchParams]);

    useEffect(() => {
        const paramsProductIds = searchParams.get('productIds');
        if (paramsProductIds) {
            setSelectedProductIds(paramsProductIds.split(','));
        }
    }, [searchParams]);

    useEffect(() => {
        const fetchStoreAndUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserEmail(user.email || 'Admin');

            // Primeiro busca a loja do usuário via RPC
            const { data: storeData, error: storeError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (storeError || !storeData) return;
            const store = Array.isArray(storeData) ? storeData[0] : storeData;

            // Agora usa o store.id correto para buscar a config
            const { data, error } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: store.id }
            );
            if (error) return;
            const storeConfig = Array.isArray(data) ? data[0] : data;
            if (storeConfig) setStoreName(storeConfig.name);
        };
        fetchStoreAndUser();
    }, []);

    useEffect(() => {
        loadMovements();
    }, [currentPage, filters]);

    const loadMovements = async () => {
        setLoading(true);
        try {
            const result = await fetchMovements(filters, currentPage, pageSize);
            setMovements(result.movements);
            setTotal(result.total);
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 3);

        setFilters({
            productId: selectedProduct?.id || undefined,
            productIds: undefined,
            type: undefined,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        });
        setSelectedProductIds([]);
        setCurrentPage(1);
    };

    const toggleProductSelection = (productId: string) => {
        setSelectedProductIds(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    const applyProductFilter = () => {
        setFilters(prev => ({
            ...prev,
            // se selecionou múltiplos, usa productIds e limpa productId
            productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
            productId: selectedProductIds.length > 0 ? undefined : prev.productId,
        }));

        setCurrentPage(1);
        setShowFilters(false);
    };

    const availableProducts = useMemo(() => {
        return allProducts.filter(p => !p.discontinued);
    }, [allProducts]);

    const totalPages = Math.ceil(total / pageSize);

    const formatQuantity = (qty: number, type: StockMovementType) => {
        const sign = type === 'entry' || type === 'cancellation' || type === 'reservation' ? '+' : '-';
        return `${sign}${Math.abs(qty)}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDateOnly = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    return (
        <PageContainer
            title={selectedProduct ? `Movimentações: ${selectedProduct.name}` : 'Movimentações de Estoque'}
            subtitle="Histórico completo de todas as entradas, saídas e ajustes"
            action={
                <div className="flex gap-2">
                    <Link
                        to="/admin/products"
                        className="p-2 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                        title="Ir para Produtos"
                    >
                        <Package size={20} />
                    </Link>
                    <Link
                        to="/admin/inventory"
                        className="p-2 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                        title="Ir para Controle de Estoque"
                    >
                        <FileText size={20} />
                    </Link>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${showFilters
                            ? 'bg-[#21A896] text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Filter size={18} />
                        <span className="hidden sm:inline">Filtros</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium flex items-center gap-2"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Imprimir</span>
                    </button>
                </div>
            }
        >
            {/* Filtros Avançados */}
            {showFilters && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 print:hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <ListFilter size={18} />
                            Filtros Avançados
                        </h3>
                        <button
                            onClick={clearFilters}
                            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 font-medium flex items-center gap-1"
                        >
                            <X size={14} />
                            Limpar Filtros
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <Calendar size={16} />
                                Período
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-xs text-gray-500 mb-1 block">Data inicial</span>
                                    <input
                                        type="date"
                                        value={filters.startDate || ''}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 mb-1 block">Data final</span>
                                    <input
                                        type="date"
                                        value={filters.endDate || ''}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tipo de Movimentação
                            </label>
                            <select
                                value={filters.type || ''}
                                onChange={(e) => setFilters({ ...filters, type: e.target.value as StockMovementType || undefined })}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                            >
                                <option value="">Todos os tipos</option>
                                {Object.entries(MOVEMENT_LABELS).map(([key, { label }]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="lg:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Produtos (opcional - deixe vazio para todos)
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {availableProducts.map(product => (
                                        <label
                                            key={product.id}
                                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedProductIds.includes(product.id)}
                                                onChange={() => toggleProductSelection(product.id)}
                                                className="w-4 h-4 text-[#21A896] border-gray-300 rounded focus:ring-[#21A896]"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{product.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-2 flex gap-2">
                                <button
                                    onClick={applyProductFilter}
                                    className="px-3 py-1.5 bg-[#21A896] text-white text-sm rounded-lg hover:bg-[#1a867a]"
                                >
                                    Aplicar Filtro de Produtos
                                </button>
                                {selectedProductIds.length > 0 && (
                                    <span className="text-sm text-gray-500">
                                        {selectedProductIds.length} produto(s) selecionado(s)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Resumo */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 print:mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <History size={20} />
                        <span className="font-medium">Total de movimentações: </span>
                        <span className="font-bold text-gray-900 dark:text-white">{total}</span>
                    </div>
                    {filters.startDate && filters.endDate && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 print:block hidden">
                            Período: {formatDateOnly(filters.startDate)} até {formatDateOnly(filters.endDate)}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabela de movimentações */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden print:shadow-none print:border-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm font-medium print:bg-gray-100">
                            <tr>
                                <th className="p-4 print:p-2">Data/Hora</th>
                                <th className="p-4 print:p-2">Produto</th>
                                <th className="p-4 print:p-2 text-center">Tipo</th>
                                <th className="p-4 print:p-2 text-right">Quantidade</th>
                                <th className="p-4 print:p-2 text-right">Estoque Antes</th>
                                <th className="p-4 print:p-2 text-right">Estoque Depois</th>
                                <th className="p-4 print:p-2">Motivo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : movements.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-500">
                                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>Nenhuma movimentação encontrada no período selecionado</p>
                                    </td>
                                </tr>
                            ) : (
                                movements.map((movement) => {
                                    const config = MOVEMENT_LABELS[movement.type];
                                    return (
                                        <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors print:hover:bg-transparent">
                                            <td className="p-4 print:p-2 text-sm text-gray-600 dark:text-gray-400">
                                                {formatDate(movement.created_at)}
                                            </td>
                                            <td className="p-4 print:p-2 font-medium text-gray-900 dark:text-white">
                                                {movement.product_name || 'Produto removido'}
                                            </td>
                                            <td className="p-4 print:p-2 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color} print:border print:border-gray-300`}>
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td className={`p-4 print:p-2 text-right font-bold ${movement.type === 'entry' || movement.type === 'cancellation'
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                                }`}>
                                                {formatQuantity(movement.quantity, movement.type)}
                                            </td>
                                            <td className="p-4 print:p-2 text-right text-gray-600 dark:text-gray-400">
                                                {movement.previous_stock}
                                            </td>
                                            <td className="p-4 print:p-2 text-right font-bold text-gray-900 dark:text-white">
                                                {movement.new_stock}
                                            </td>
                                            <td className="p-4 print:p-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                                {movement.reason || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between print:hidden">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Página {currentPage} de {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Componente oculto para impressão */}
            <div className="hidden">
                <PrintableStockMovements
                    ref={printRef}
                    movements={movements}
                    title={selectedProduct ? `Produto: ${selectedProduct.name}` : 'Movimentações de Estoque'}
                    storeName={storeName}
                    printedBy={userEmail}
                    filters={{
                        startDate: filters.startDate,
                        endDate: filters.endDate,
                        type: filters.type,
                    }}
                />
            </div>
        </PageContainer>
    );
}
