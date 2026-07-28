import { Package, AlertCircle, AlertTriangle, ArrowUp, CheckCircle, XCircle, Layers, Archive } from 'lucide-react';
import type { ProductStats, ModalFilterType } from '../types/product.types';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';

interface StatsCardsProps {
    stats: ProductStats;
    onStatsClick: (filterType: ModalFilterType) => void;
}

export default function StatsCards({ stats, onStatsClick }: StatsCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6 overflow-visible">
            {/* Total de Produtos */}
            <div
                onClick={() => onStatsClick('all')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible shadow-sm"
            >
                <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md shrink-0">
                    <Package size={16} className="md:w-[18px] md:h-[18px] text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate">
                        Total Ativos
                    </p>
                    <div className="flex items-baseline gap-1">
                        <p className="text-sm md:text-base lg:text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {stats.total}
                        </p>
                        <div className="flex items-center gap-0.5 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                            <CheckCircle size={12} className="text-green-600 dark:text-green-400" />
                            <span>{stats.totalActive}</span>
                            <XCircle size={12} className="text-gray-400 dark:text-gray-500 ml-1" />
                            <span>{stats.totalInactive}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comprar */}
            <div
                onClick={() => onStatsClick('buy')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible shadow-sm"
            >
                <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-md shrink-0">
                    <AlertCircle size={16} className="md:w-[18px] md:h-[18px] text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Comprar
                        <InfoTooltip text="Produtos cujo estoque global está zerado ou crítico. A ação gerencial sugerida é compra/reposição." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-red-600 dark:text-red-400 truncate">
                        {stats.recommendedBuy}
                    </p>
                </div>
            </div>

            {/* Transferir */}
            <div
                onClick={() => onStatsClick('transfer')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible shadow-sm"
            >
                <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md shrink-0">
                    <Layers size={16} className="md:w-[18px] md:h-[18px] text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Transferir
                        <InfoTooltip text="Produtos com saldo global suficiente, mas com ruptura ou criticidade em algum local/ponto." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-blue-600 dark:text-blue-400 truncate">
                        {stats.recommendedTransfer}
                    </p>
                </div>
            </div>

            {/* Crítico */}
            <div
                onClick={() => onStatsClick('low')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible shadow-sm"
            >
                <div className="p-1.5 md:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-md shrink-0">
                    <AlertTriangle size={16} className="md:w-[18px] md:h-[18px] text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Crítico
                        <InfoTooltip text="Produtos cuja disponibilidade global está abaixo do estoque mínimo configurado." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-yellow-600 dark:text-yellow-400 truncate">
                        {stats.lowStock}
                    </p>
                </div>
            </div>

            {/* Excesso */}
            <div
                onClick={() => onStatsClick('high')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible shadow-sm"
            >
                <div className="p-1.5 md:p-2 bg-purple-100 dark:bg-purple-900/30 rounded-md shrink-0">
                    <ArrowUp size={16} className="md:w-[18px] md:h-[18px] text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Excesso
                        <InfoTooltip text="Produtos cujo estoque físico global ultrapassa o estoque máximo configurado." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-purple-600 dark:text-purple-400 truncate">
                        {stats.highStock}
                    </p>
                </div>
            </div>

            {/* Descontinuados */}
            <div
                onClick={() => onStatsClick('discontinued')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible shadow-sm"
            >
                <div className="p-1.5 md:p-2 bg-gray-100 dark:bg-gray-700 rounded-md shrink-0">
                    <Archive size={16} className="md:w-[18px] md:h-[18px] text-gray-600 dark:text-gray-300" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Descontinuados
                        <InfoTooltip text="Produtos retirados de linha/descontinuados. Clique para filtrar na listagem." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-gray-700 dark:text-gray-300 truncate">
                        {stats.totalDiscontinued ?? 0}
                    </p>
                </div>
            </div>
        </div>
    );
}