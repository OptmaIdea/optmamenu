import React from 'react';
import { Download, AlertCircle, FileSpreadsheet } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useProductPricingHistory } from './hooks/useProductPricingHistory';
import { PricingHistoryFilters } from './components/PricingHistoryFilters';
import { SalesPricingSummaryCards } from './components/SalesPricingSummaryCards';
import { SalesPricingBySourceTable } from './components/SalesPricingBySourceTable';
import { SalesPricingHistoryTable } from './components/SalesPricingHistoryTable';
import { PurchaseCostSummaryCards } from './components/PurchaseCostSummaryCards';
import { PurchaseCostHistoryTable } from './components/PurchaseCostHistoryTable';
import { MarginSummary } from './components/MarginSummary';
import { PricingHistoryEmptyState } from './components/PricingHistoryEmptyState';
import {
  exportSalesHistoryCsv,
  exportPurchaseHistoryCsv,
  exportConsolidatedSummaryCsv,
} from './utils/pricingHistoryExport';

interface ProductPricingHistoryTabProps {
  productId?: string;
  productName?: string;
}

export const ProductPricingHistoryTab: React.FC<ProductPricingHistoryTabProps> = ({
  productId,
  productName = 'Produto',
}) => {
  const {
    filters,
    snapshots,
    purchases,
    loading,
    error,
    salesSummary,
    bySource,
    purchaseSummary,
    marginSummary,
    setPeriodPreset,
    setCustomDates,
    setSalesChannel,
    setPricingSource,
    refetch,
  } = useProductPricingHistory(productId);

  if (loading) {
    return (
      <div className="py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-rose-50 dark:bg-rose-900/20 p-8 border border-rose-200 dark:border-rose-800 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h4 className="text-base font-black text-rose-900 dark:text-rose-200">
          Falha ao carregar histórico de preços
        </h4>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md mx-auto">
          Não foi possível sincronizar o histórico com a loja ativa. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const hasSales = snapshots.length > 0;
  const hasPurchases = purchases.length > 0;
  const hasNoData = !hasSales && !hasPurchases;

  const handleExportSales = () => {
    exportSalesHistoryCsv(productName, filters.startDate, filters.endDate, snapshots);
  };

  const handleExportPurchases = () => {
    exportPurchaseHistoryCsv(productName, filters.startDate, filters.endDate, purchases);
  };

  const handleExportConsolidated = () => {
    exportConsolidatedSummaryCsv(
      productName,
      filters.startDate,
      filters.endDate,
      salesSummary,
      bySource,
      purchaseSummary,
      marginSummary
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtros locais */}
      <PricingHistoryFilters
        filters={filters}
        onSelectPreset={setPeriodPreset}
        onChangeCustomDates={setCustomDates}
        onChangeSalesChannel={setSalesChannel}
        onChangePricingSource={setPricingSource}
        onRefresh={() => void refetch()}
        loading={loading}
      />

      {/* Barra de Ações de Exportação */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-[#19A999]" />
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
            Exportações CSV (UTF-8)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportSales}
            disabled={!hasSales}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-40"
          >
            <Download size={13} />
            <span>Exportar Vendas CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPurchases}
            disabled={!hasPurchases}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-40"
          >
            <Download size={13} />
            <span>Exportar Compras CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportConsolidated}
            disabled={hasNoData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#19A999] text-white text-xs font-bold hover:bg-[#158f81] transition shadow-xs disabled:opacity-40"
          >
            <Download size={13} />
            <span>Resumo Consolidado CSV</span>
          </button>
        </div>
      </div>

      {hasNoData ? (
        <PricingHistoryEmptyState />
      ) : (
        <>
          {/* Cards de Resumo de Vendas */}
          <SalesPricingSummaryCards summary={salesSummary} />

          {/* Cards de Resumo de Compras */}
          <PurchaseCostSummaryCards summary={purchaseSummary} />

          {/* Análise de Margem Estimada */}
          <MarginSummary summary={marginSummary} />

          {/* Tabela por Origem de Precificação */}
          <SalesPricingBySourceTable bySource={bySource} />

          {/* Tabela Detalhada de Vendas */}
          <SalesPricingHistoryTable snapshots={snapshots} />

          {/* Tabela Detalhada de Compras */}
          <PurchaseCostHistoryTable purchases={purchases} />
        </>
      )}
    </div>
  );
};
