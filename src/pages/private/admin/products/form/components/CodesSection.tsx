import React from 'react';
import { Barcode } from 'lucide-react';

interface CodesSectionProps {
  internalCode: string;
  setInternalCode: (val: string) => void;
  sku: string;
  setSku: (val: string) => void;
  ean: string;
  setEan: (val: string) => void;
}

export const CodesSection: React.FC<CodesSectionProps> = ({
  internalCode,
  setInternalCode,
  sku,
  setSku,
  ean,
  setEan,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="p-2 bg-[#19A999]/10 rounded-lg">
          <Barcode size={18} className="text-[#19A999]" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base">Códigos e Identificadores</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Códigos de identificação do produto para busca, integração e PDV.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Código Interno */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Código interno
          </label>
          <input
            type="text"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value.toUpperCase())}
            placeholder="Ex: PROD-001"
            className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
            autoComplete="off"
          />
        </div>

        {/* SKU */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            SKU
          </label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            placeholder="Ex: SKU-HAMB-01"
            className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
            autoComplete="off"
          />
        </div>

        {/* EAN / Código de Barras */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            EAN / Código de barras
          </label>
          <input
            type="text"
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            placeholder="Digite ou leia o código EAN"
            inputMode="numeric"
            className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#19A999] text-gray-900 dark:text-white"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
};
