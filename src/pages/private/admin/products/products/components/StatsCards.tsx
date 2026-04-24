import { Package, DollarSign, AlertCircle, AlertTriangle, ArrowUp, CheckCircle, XCircle } from 'lucide-react';
import type { ProductStats, ModalFilterType } from '../types/product.types';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';

interface StatsCardsProps {
    stats: ProductStats;
    onStatsClick: (filterType: ModalFilterType) => void;
}

export default function StatsCards({ stats, onStatsClick }: StatsCardsProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3 mb-6 overflow-visible">
            {/* Total de Produtos */}
            <div
                onClick={() => onStatsClick('all')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 md:p-3 flex items-center gap-2 md:gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible"
            >
                <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md shrink-0">
                    <Package size={16} className="md:w-[18px] md:h-[18px] text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate">
                        Total
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

            {/* Valor em Estoque */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 md:p-3 flex items-center gap-2 md:gap-3 relative overflow-visible">
                <div className="p-1.5 md:p-2 bg-green-100 dark:bg-green-900/30 rounded-md shrink-0">
                    <DollarSign size={16} className="md:w-[18px] md:h-[18px] text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Valor em estoque
                        <InfoTooltip text="Valor estimado do estoque físico ativo, calculado a partir do saldo consolidado dos produtos." />
                    </p>
                    <p className="text-xs md:text-sm lg:text-base font-semibold text-gray-900 dark:text-white truncate">
                        {stats.totalValue.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        })}
                    </p>
                </div>
            </div>

            {/* Sem Estoque */}
            <div
                onClick={() => onStatsClick('zero')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 md:p-3 flex items-center gap-2 md:gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible"
            >
                <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-md shrink-0">
                    <AlertCircle size={16} className="md:w-[18px] md:h-[18px] text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Sem estoque
                        <InfoTooltip text="Produtos com disponibilidade igual ou menor que zero." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-red-600 dark:text-red-400 truncate">
                        {stats.zeroStock}
                    </p>
                </div>
            </div>

            {/* Estoque Baixo */}
            <div
                onClick={() => onStatsClick('low')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 md:p-3 flex items-center gap-2 md:gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible"
            >
                <div className="p-1.5 md:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-md shrink-0">
                    <AlertTriangle size={16} className="md:w-[18px] md:h-[18px] text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Estoque baixo
                        <InfoTooltip text="Produtos cuja disponibilidade está menor ou igual ao estoque mínimo configurado." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-yellow-600 dark:text-yellow-400 truncate">
                        {stats.lowStock}
                    </p>
                </div>
            </div>

            {/* Excesso de Estoque */}
            <div
                onClick={() => onStatsClick('high')}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 md:p-3 flex items-center gap-2 md:gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors relative overflow-visible"
            >
                <div className="p-1.5 md:p-2 bg-purple-100 dark:bg-purple-900/30 rounded-md shrink-0">
                    <ArrowUp size={16} className="md:w-[18px] md:h-[18px] text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                        Excesso
                        <InfoTooltip text="Produtos cujo estoque físico ultrapassa o estoque máximo configurado." />
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-semibold text-purple-600 dark:text-purple-400 truncate">
                        {stats.highStock}
                    </p>
                </div>
            </div>
        </div>
    );
}