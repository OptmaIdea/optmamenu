import React from 'react';
import { Calendar, Filter, RefreshCw } from 'lucide-react';
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

const PRESET_OPTIONS: Array<{ key: PricingHistoryPeriodPreset; label: string }> = [
  { key: 'today', label: 'Hoje' },
  { key: 'last_7_days', label: 'Últimos 7 dias' },
  { key: 'last_30_days', label: 'Últimos 30 dias' },
  { key: 'this_month', label: 'Este mês' },
  { key: 'last_month', label: 'Mês anterior' },
  { key: 'custom', label: 'Personalizado' },
];

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
      {/* Botões rápidos de período e canal */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Preset buttons */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {PRESET_OPTIONS.map((preset) => {
            const active = filters.periodPreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onSelectPreset(preset.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all tracking-tight ${
                  active
                    ? 'bg-[#19A999] text-white shadow-xs'
                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Botão atualizar */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Linha de seletores secundários (Datas livres, Canal, Origem) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
        {/* Intervalo de datas personalizado */}
        <div className="flex items-center gap-2 col-span-1 sm:col-span-2 lg:col-span-2 bg-gray-50 dark:bg-gray-900/60 p-2 rounded-xl border border-gray-200/80 dark:border-gray-700">
          <Calendar size={15} className="text-gray-400 shrink-0 ml-1" />
          <div className="flex items-center gap-2 text-xs font-medium w-full">
            <span className="text-gray-500 dark:text-gray-400 shrink-0">De</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChangeCustomDates(e.target.value, filters.endDate)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#19A999]"
            />
            <span className="text-gray-500 dark:text-gray-400 shrink-0">Até</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onChangeCustomDates(filters.startDate, e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#19A999]"
            />
          </div>
        </div>

        {/* Canal de venda */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/60 p-2 rounded-xl border border-gray-200/80 dark:border-gray-700">
          <Filter size={15} className="text-gray-400 shrink-0 ml-1" />
          <select
            value={filters.salesChannel}
            onChange={(e) => onChangeSalesChannel(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#19A999]"
          >
            {SALES_CHANNELS.map((ch) => (
              <option key={ch.key} value={ch.key}>
                {ch.label}
              </option>
            ))}
          </select>
        </div>

        {/* Origem da precificação */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/60 p-2 rounded-xl border border-gray-200/80 dark:border-gray-700">
          <Filter size={15} className="text-gray-400 shrink-0 ml-1" />
          <select
            value={filters.pricingSource}
            onChange={(e) => onChangePricingSource(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#19A999]"
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
