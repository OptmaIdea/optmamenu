// src/components/common/DataCard.tsx
import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface DataCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  badge?: {
    text: string;
    color?: 'green' | 'orange' | 'red' | 'blue' | 'yellow';
  };
}

export default function DataCard({
  title,
  children,
  action,
  footer,
  className = '',
  badge
}: DataCardProps) {
  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 
      shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden
      ${className}
    `}>
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold">
            {title}
          </h3>
          {badge && (
            <span className={`
              px-2.5 py-0.5 rounded-full text-xs font-bold
              ${badge.color === 'red' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}
              ${badge.color === 'orange' && 'bg-brand-orange/10 text-brand-orange dark:bg-brand-orange/20 dark:text-brand-light'}
              ${badge.color === 'green' && 'bg-brand-green/10 text-brand-dark dark:bg-brand-green/20 dark:text-brand-green'}
              ${badge.color === 'blue' && 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-brand-purple-light'}
              ${badge.color === 'yellow' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}
              ${!badge.color && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}
            `}>
              {badge.text}
            </span>
          )}
        </div>
        {action || (
          <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>

      <div className="p-6">
        {children}
      </div>

      {footer && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
          {footer}
        </div>
      )}
    </div>
  );
}