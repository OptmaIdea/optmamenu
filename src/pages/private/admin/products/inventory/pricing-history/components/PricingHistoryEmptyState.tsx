import React from 'react';
import { PackageSearch } from 'lucide-react';

interface PricingHistoryEmptyStateProps {
  title?: string;
  description?: string;
}

export const PricingHistoryEmptyState: React.FC<PricingHistoryEmptyStateProps> = ({
  title = 'Nenhuma venda ou compra registrada no período',
  description = 'Ajuste os filtros de data ou canal para visualizar o histórico de preços e margens deste produto.',
}) => {
  return (
    <div className="rounded-3xl bg-white dark:bg-gray-800 p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center">
      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 text-gray-400 mb-3">
        <PackageSearch size={32} />
      </div>
      <h4 className="text-base font-black text-gray-900 dark:text-white">{title}</h4>
      <p className="text-xs text-gray-500 max-w-md mt-1">{description}</p>
    </div>
  );
};
