import React from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import DateRangeFilter from '@/components/common/DateRangeFilter';
import type {
  PricingHistoryPeriodPreset,
  PricingHistoryFiltersState,
} from '../../types/productPricingHistory.types';

interface PricingHistoryFiltersProps {
  filters: PricingHistoryFiltersState;
  onSelectPreset: (preset: PricingHistoryPeriodPreset) => void;
  onChangeCustomDates: (startDate: string, endDate: string) => void;
  onChangeSalesChannel: (channel: string) => void;
  onChangePricingSource: (source: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

const SALES_CHANNELS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todos os canais' },
  { key: 'in_person', label: 'PDV (Presencial)' },
  { key: 'direct', label: 'Venda Direta' },
  { key: 'online', label: 'Loja Pública Online' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

const PRICING_SOURCES: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todas as origens' },
  { key: 'product_base_price', label: 'Preço próprio do produto' },
  { key: 'product_volume', label: 'Faixa de atacado do produto' },
  { key: 'category_standard', label: 'Preço herdado da categoria' },
  { key: 'category_combined_volume', label: 'Categoria por quantidade combinada' },
  { key: 'pricing_group_combined_volume', label: 'Grupo de precificação combinada' },
  { key: 'custom_manual', label: 'Desconto ajustado manualmente' },
  { key: 'unregistered_legacy', label: 'Origem não registrada' },
];

export const PricingHistoryFilters: React.FC<PricingHistoryFiltersProps> = ({
  filters,
  onSelectPreset,
  onChangeCustomDates,
  onChangeSalesChannel,
  onChangePricingSource,
  onRefresh,
  loading,
}) => {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4">
      {/* Seleção compartilhada de Período e Botão de Atualização */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <DateRangeFilter
          periodFilter={filters.periodPreset}
          onPeriodChange={(preset) => onSelectPreset(preset as PricingHistoryPeriodPreset)}
          startDate={filters.startDate}
          onStartDateChange={(start) => onChangeCustomDates(start, filters.endDate)}
          endDate={filters.endDate}
          onEndDateChange={(end) => onChangeCustomDates(filters.startDate, end)}
          className="w-full md:w-auto flex-1"
        />

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 md:h-10 md:w-auto shrink-0 self-end md:self-center"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Linha de seletores secundários (Canal de Venda e Origem da Precificação) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
        {/* Canal de venda */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-200/80 dark:border-gray-700">
          <Filter size={15} className="text-gray-400 shrink-0 ml-1" />
          <select
            value={filters.salesChannel}
            onChange={(e) => onChangeSalesChannel(e.target.value)}
            className="w-full bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none"
          >
            {SALES_CHANNELS.map((ch) => (
              <option key={ch.key} value={ch.key}>
                {ch.label}
              </option>
            ))}
          </select>
        </div>

        {/* Origem da precificação */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-200/80 dark:border-gray-700">
          <Filter size={15} className="text-gray-400 shrink-0 ml-1" />
          <select
            value={filters.pricingSource}
            onChange={(e) => onChangePricingSource(e.target.value)}
            className="w-full bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none"
          >
            {PRICING_SOURCES.map((src) => (
              <option key={src.key} value={src.key}>
                {src.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
