// src/components/common/PageContainer.tsx
import type { ReactNode } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface PageContainerProps {
  title: string;
  subtitle?: string;
  category?: string;
  children: ReactNode;
  action?: ReactNode;
  lastUpdated?: Date;
  onRefresh?: () => void;
  className?: string;
  withoutHeader?: boolean;
  flat?: boolean;
  icon?: ReactNode;
}

export default function PageContainer({
  title,
  subtitle,
  category,
  children,
  action,
  lastUpdated,
  onRefresh,
  className = '',
  withoutHeader = false,
  flat = false,
  icon
}: PageContainerProps) {
  return (
    <div className={`max-w-7xl mx-auto animate-fadeIn ${className}`}>
      {/* Header */}
      {!withoutHeader && (
        flat ? (
          <div className="relative mb-6 md:mb-8">
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                {category && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#21A896] dark:text-[#37d0bb]">
                    {category}
                  </p>
                )}
                <div className="flex items-center gap-2.5">
                  {icon}
                  <h1 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white font-candara-bold tracking-tight">
                    {title}
                  </h1>
                  {lastUpdated && (
                    <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                      <Clock size={12} />
                      {lastUpdated.toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-candara max-w-2xl">
                    {subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-[#21A896]/30 font-candara text-sm"
                  >
                    <RefreshCw size={16} className="animate-spin-slow" />
                    <span className="hidden sm:inline">Atualizar</span>
                  </button>
                )}
                {action}
              </div>
            </div>

            {/* Meta info mobile */}
            {lastUpdated && (
              <div className="mt-3 md:hidden flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Clock size={12} />
                <span>Última atualização: {lastUpdated.toLocaleTimeString('pt-BR')}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative mb-6 md:mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 p-6 md:p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#21A896]/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                {category && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#21A896] dark:text-[#37d0bb] mb-1">
                    {category}
                  </p>
                )}
                <div className="flex items-center gap-2.5">
                  {icon}
                  <h1 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white font-candara-bold tracking-tight">
                    {title}
                  </h1>
                  {lastUpdated && (
                    <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                      <Clock size={12} />
                      {lastUpdated.toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-candara max-w-2xl">
                    {subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-[#21A896]/30 font-candara text-sm"
                  >
                    <RefreshCw size={16} className="animate-spin-slow" />
                    <span className="hidden sm:inline">Atualizar</span>
                  </button>
                )}
                {action}
              </div>
            </div>

            {/* Meta info mobile */}
            {lastUpdated && (
              <div className="mt-3 md:hidden flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Clock size={12} />
                <span>Última atualização: {lastUpdated.toLocaleTimeString('pt-BR')}</span>
              </div>
            )}
          </div>
        )
      )}

      <div className="space-y-6 md:space-y-8">
        {children}
      </div>
    </div>
  );
}